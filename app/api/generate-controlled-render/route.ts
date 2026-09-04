/**
 * Controlled Final Design Render pipeline.
 *
 * Visible Production Layout Preview is NOT used as visual style reference for AI.
 * AI receives a hidden structure control map — a deterministic SVG→PNG layout
 * reference (arch/round/panel outlines, plinth, garland guide dots, standee
 * zones, custom-text guide) passed as image_url alongside the detailed prompt.
 *
 * Actual model routing (see "Model routing" below and `resolvedEditModelId`):
 *   - primary path (first_generate AND edit_existing) → an edit/img2img model
 *     from the fal-ai/flux-2 family, selected per-scene:
 *       - arch panel present, no round panel → fal-ai/flux-2/flash/edit
 *       - round panel present                → fal-ai/flux-2/edit
 *       - otherwise (shimmer/rect/frame only) → mode default
 *         (turbo → fal-ai/flux-2/turbo/edit, dev → fal-ai/flux-2/edit,
 *          pro → fal-ai/flux-2-pro/edit), controlled by AI_RENDER_MODEL_MODE
 *   - strict correction pass (Sempertex color lock) reuses the same
 *     resolvedEditModelId as an additional img2img call on its own output
 *   - text-to-image fallback (only reached if the primary edit call fails,
 *     the scene isn't geometry-critical, and fallback isn't disabled) →
 *     fal-ai/flux-2{,-pro,/turbo} pure text-to-image, no layout reference
 *
 * There is no Kontext model anywhere in this pipeline — edit_existing and
 * small style edits reuse the same fal-ai/flux-2 edit model as first_generate.
 *
 * Diagnostics `actualPrimaryModelId` / `actualModelReason` reflect the routing
 * decision made before any fal call; `actualRenderPath` / `actualEditModelId` /
 * `actualFirstGenerateModelId` reflect what actually executed for this response.
 *
 * Production Layout Preview and future export package use scene state as source
 * of truth. AI render is a visual preview, not the production measurement source.
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { fal } from "@fal-ai/client";
import {
  generatePrompt,
  type PromptInput,
} from "@/lib/generatePrompt";
import { type SceneModel } from "@/lib/buildSceneModel";
import { type FalImageSize } from "@/lib/calculateRenderAspectRatio";
import { generateStructureSilhouette, computeShimmerWallMaskGeometry, panelRectToFraction, computeDoubleArchPlinthOverlayGeometry, computeBackdropGroupGeometry, type CutoutGuideItem } from "@/lib/generateStructureSilhouette";
import { getSetupLayoutTemplate, inferSetupLayoutTemplateIdFromBackdropItems, type LayoutZone } from "@/lib/setupLayoutCatalog";
import { type BalloonStyleId, SHIMMER_COLOR_HEX, SHIMMER_COLORS, type ShimmerColorId, resolveTextColorHex, describeTextColor } from "@/lib/config";
import { SEMPERTEX_CATALOG, type SempertexColor } from "@/lib/sempertexCatalog";
import { THEME_CATALOG } from "@/lib/themeCatalog";
import { type SempertexSelectionItem } from "@/lib/renderPrompts/types";
import { getVisualLabel, renderSafeBalloonLabel } from "@/lib/renderPrompts/colorLabels";
import { buildNegativePrompt } from "@/lib/renderPrompts/buildNegativePrompt";
import { buildStrictCorrectionPrompt } from "@/lib/renderPrompts/buildStrictCorrectionPrompt";
import { buildLayoutRefEditPrompt } from "@/lib/renderPrompts/buildLayoutRefEditPrompt";

// ── Model routing ────────────────────────────────────────────────────────
// AI_RENDER_MODEL_MODE controls cost: turbo (default, cheapest) | dev | pro.
// Used for first_generate (layout-reference edit), edit_existing (color-only
// / style-tweak recolor), and the pure text-to-image fallback — so the whole
// pipeline scales cost together under one switch.
type ModelMode = "turbo" | "dev" | "pro";

function getModelMode(): ModelMode {
  const raw = (process.env.AI_RENDER_MODEL_MODE || "turbo").toLowerCase();
  return raw === "pro" || raw === "dev" ? raw : "turbo";
}

function getEditModelId(mode: ModelMode): string {
  if (mode === "pro") return "fal-ai/flux-2-pro/edit";
  if (mode === "dev") return "fal-ai/flux-2/edit";
  return "fal-ai/flux-2/turbo/edit";
}

// first_generate (no layout guide): pure text-to-image fallback — same mode switch
function getT2IModelId(mode: ModelMode): string {
  if (mode === "pro") return "fal-ai/flux-2-pro";
  if (mode === "dev") return "fal-ai/flux-2";
  return "fal-ai/flux-2/turbo";
}
function getT2IEndpoint(mode: ModelMode): string {
  return `https://fal.run/${getT2IModelId(mode)}`;
}

// ── Shimmer wall product removal (2026-07-12) ───────────────────────────────
// Shimmer wall is no longer a selectable layout — the recolor pipeline was
// too unreliable and the product direction shifted to arch-based designs.
// buildSceneModel()/buildSceneModelFromItems() already sanitize any legacy
// shimmer_wall backdropItem to an arch panel for requests built through the
// normal client flow, but this route trusts `promptInput`/`sceneModel`
// straight from the request body (no server-side rebuild) — so this flag is
// the actual, unconditional guarantee that shimmer recolor never runs for a
// normal user selection, independent of what a stale or hand-crafted request
// body contains. Mirrors the ENABLE_LEGACY_GENERATE_ENDPOINT / pro-endpoint
// disable pattern used elsewhere in this file. The recolor code itself is
// left intact (not deleted) in case shimmer ever comes back.
const SHIMMER_RECOLOR_ENABLED = process.env.ENABLE_SHIMMER_RECOLOR === "true";

// ── Double Arch plinth composite ────────────────────────────────────────────
// History: 8 real-render attempts (2026-07-12) couldn't get the edit model
// to paint a solid white plinth for Double Arch — glass/transparent or
// omitted every time — so a deterministic SVG cylinder overlay was built
// (same pattern as the custom-text/standee composites). Its v1 shading was
// rejected as flat pasted-on clipart and the flag was turned off
// (2026-07-13), hiding the plinth from Double Arch's preview entirely.
//
// RE-ENABLED 2026-07-19 (v2 shading), then DISABLED AGAIN later the same
// day by product request: the composited plinth should look "the same as
// Single Arch", i.e. painted by the AI itself with real scene lighting and
// reflections, not overlaid. Double Arch's plinth is now AI-rendered again
// (guide plinthEdge marker centered in the gap + the same plinthDesc clause
// Single Arch uses — see generateStructureSilhouette.ts and
// buildLayoutRefEditPrompt.ts). The 8 historical AI-plinth failures
// happened under the OLD prompt/garland pipeline, since fully rewritten.
// This v2 overlay code stays intact as the fallback if the AI plinth
// regresses to glass/omitted again.
//
// Briefly re-enabled 2026-09-03 when turning the injection pass off made the
// plinth vanish. The customer rejected the result — the overlay reads as
// pasted on — so it is off again.
//
// The plinth is now obtained the way Single Arch obtains it: painted by the
// primary pass from plinthDesc alone, with no injection pass and no overlay.
// That is the whole point of this round's change — Double Arch copies Single
// Arch feature-for-feature and only the backdrop differs — and it is also the
// only option that keeps Double Arch to a single generation, which is what
// protects the balloons. The prompt asks for it far more gently than during
// the 8 historical failures: the PLINTH HARD LOCK clause and the bespoke
// double-arch garland paragraph that used to crowd it out are both gone.
const DOUBLE_ARCH_PLINTH_COMPOSITE_ENABLED = false;
function getThemeSempertexDefaults(themeId: string): SempertexColor[] {
  const entry = THEME_CATALOG.find((t) => t.id === themeId);
  if (!entry || entry.sempertexPaletteIds.length === 0) return [];
  return entry.sempertexPaletteIds
    .map((id) => SEMPERTEX_CATALOG.find((c) => c.id === id))
    .filter((c): c is SempertexColor => Boolean(c))
    .slice(0, 5);
}

// ── T2I fallback gating ──────────────────────────────────────────────────
// Inaccurate fallback renders (no layout reference → hallucinated props/
// stage/base) are worse than an explicit error for this configurator.
function isT2IFallbackAllowed(): boolean {
  return (process.env.ALLOW_T2I_FALLBACK || "false").toLowerCase() === "true";
}

function isAuthOrBillingError(message: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("forbidden") || m.includes("unauthorized") || m.includes(" 401") ||
    m.includes(" 403") || m.includes("401 ") || m.includes("403 ") ||
    m.includes("payment") || m.includes("credit") || m.includes("billing") ||
    m.includes("authentication") || m.includes("model access") || m.includes("access denied")
  );
}

// ── Simple in-memory render cache ───────────────────────────────────────
// Keyed by RENDER_CACHE_VERSION:sceneHash:requestedRenderMode:modelMode. Only
// successful results are cached. Persists for the lifetime of the server
// process (sufficient for a single-instance/dev deployment — not a
// distributed cache). Bump RENDER_CACHE_VERSION whenever a prompt/negative
// change should invalidate previously cached (now-stale) renders.
const RENDER_CACHE_VERSION = "single-arch-garland-spacing-wrapped-text-v47";

interface RenderCacheEntry {
  imageUrl: string;
  diagInfo: Record<string, unknown>;
  extra:    Record<string, unknown>;
}
const renderCache = new Map<string, RenderCacheEntry>();

function buildCacheKey(
  sceneHash: string | undefined,
  requestedRenderMode: string,
  resolvedEditModelId: string
): string {
  return `${RENDER_CACHE_VERSION}:${sceneHash ?? "nohash"}:${requestedRenderMode}:${resolvedEditModelId}`;
}

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic"; // prevent Next.js from caching route responses
export const maxDuration = 90;

// ---------------------------------------------------------------------------
// Deterministic standee overlay — applied on top of the final AI render.
// Character cutouts are NOT generated by the AI; they are composited here.
// ---------------------------------------------------------------------------

// TODO: replace placeholder SVG with real PNG asset from public/cutouts/[theme]/[assetId]-[size].png
// The dashed placeholder below is the fallback for when a real cutout asset is not available.
function buildStandeeOverlaySvg(
  items:       CutoutGuideItem[],
  imageW:      number,
  imageH:      number,
  _presetAssetId: string,
): string {
  // Floor sits at ~87 % of image height in a typical room render
  const floorY = Math.round(imageH * 0.87);
  // Scale calibration: 150cm standee should read clearly shorter than a 200cm arch —
  // target ~60 % of image height for 150cm, hard-capped at 62 %.
  const pxPerCm   = (imageH * 0.80) / 200;
  const maxHeight = Math.round(imageH * 0.62);

  // Build flat list sorted tallest-first — ASCII-only labels ("150cm")
  const standees: { heightCm: number; label: string }[] = [];
  for (const item of items) {
    if (item.quantity <= 0) continue;
    for (let q = 0; q < item.quantity; q++) {
      standees.push({ heightCm: item.heightCm, label: `${item.heightCm}cm` });
    }
  }
  standees.sort((a, b) => b.heightCm - a.heightCm);

  const elems: string[] = [];
  const betweenGap = Math.round(imageW * 0.015);
  // Right side of the setup, outside the main arch opening — clear of the plinth
  // (plinth is typically placed center/left in the render).
  let curRight = Math.round(imageW * 0.96);

  for (const s of standees) {
    const heightPx  = Math.min(Math.round(s.heightCm * pxPerCm), maxHeight);
    const widthPx   = Math.max(28, Math.round(heightPx * 0.24));
    const cx        = curRight - widthPx / 2;
    const topY      = floorY - heightPx;
    const cornerR   = Math.round(widthPx * 0.28);
    const baseRy    = Math.max(4, Math.round(widthPx * 0.14));
    const fs        = Math.max(9, Math.min(13, Math.round(widthPx * 0.45)));

    // Bail out if we'd clip off the left edge
    if (curRight - widthPx < 8) break;

    elems.push(
      // Thin white halo — subtle separation from the scene, not a solid frame
      `<rect x="${(cx - widthPx / 2 - 1.5).toFixed(1)}" y="${(topY - 1.5).toFixed(1)}" ` +
        `width="${(widthPx + 3).toFixed(1)}" height="${(heightPx + 3).toFixed(1)}" ` +
        `rx="${cornerR + 1.5}" ry="${cornerR + 1.5}" fill="none" stroke="white" stroke-width="1.5" opacity="0.45"/>`,
      // Body — near-transparent light gray fill with thin dashed outline
      `<rect x="${(cx - widthPx / 2).toFixed(1)}" y="${topY.toFixed(1)}" ` +
        `width="${widthPx.toFixed(1)}" height="${heightPx.toFixed(1)}" ` +
        `rx="${cornerR}" ry="${cornerR}" ` +
        `fill="rgba(220,220,220,0.18)" stroke="#8A8A8A" stroke-width="1.2" stroke-dasharray="6,4" opacity="0.45"/>`,
      // Base foot ellipse — light, low opacity
      `<ellipse cx="${cx.toFixed(1)}" cy="${floorY.toFixed(1)}" ` +
        `rx="${(widthPx / 2 * 1.25).toFixed(1)}" ry="${baseRy.toFixed(1)}" ` +
        `fill="rgba(200,200,200,0.22)" stroke="#8A8A8A" stroke-width="1" opacity="0.42"/>`,
      // Label beneath base — plain ASCII, subtle
      `<text x="${cx.toFixed(1)}" y="${(floorY + baseRy + fs + 2).toFixed(1)}" ` +
        `text-anchor="middle" font-size="${fs}" font-family="Arial, sans-serif" ` +
        `fill="#555555" opacity="0.55">${s.label}</text>`,
    );

    curRight = cx - widthPx / 2 - betweenGap;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imageW}" height="${imageH}" viewBox="0 0 ${imageW} ${imageH}">`,
    `  ${elems.join("\n  ")}`,
    `</svg>`,
  ].join("\n");
}

type RenderMode = "first_generate" | "edit_existing";

interface RequestBody {
  promptInput:             PromptInput;
  sceneModel:              SceneModel;
  controlImageBase64?:     string;      // reserved for future ControlNet; not used for t2i
  previousFinalRenderUrl?: string;
  renderMode:              RenderMode;
  editDescription?:        string;
  force?:                  boolean;
  currentSceneHash?:       string;
  /** Client-computed structure hash (scene hash minus balloon colors) — echoed back in diagnostics. */
  structureHash?:          string;
  renderAspectRatio?:      FalImageSize; // dynamic image_size from real panel dimensions
  /** Exact selected Sempertex balloon palette — empty/undefined falls back to theme palette. */
  sempertexSelection?:     SempertexSelectionItem[];
  /** Debug: generate layout reference PNG only — do NOT call fal. Returns the PNG data URI for inspection. */
  debugLayoutReferenceOnly?: boolean;
  /** Skip strict correction pass — return the primary layout-reference result directly. */
  skipStrictCorrection?:   boolean;
}

// ---------------------------------------------------------------------------
// fal storage helper — uploads base64 layout guide, returns a URL for Kontext
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

// Active for every AI render — backdrop must be physically blank (text is a frontend overlay).
const BLANK_BACKDROP_CLAUSE =
  "[Blank Backdrop Surface]: The backdrop panels must remain completely blank and plain, " +
  "with no text, no lettering, no typography, no calligraphy, no birthday sign, " +
  "no name sign, no decals, no printed words, and no logo. " +
  "Text is handled separately as a frontend overlay and must not be rendered by the AI.";

// Plinth wording intentionally excluded from STYLE_PREFIX — count-specific plinth
// language is added only by plinthClause where the actual count is known.
const STYLE_PREFIX =
  "Photorealistic luxury birthday party event setup in Dubai, UAE. " +
  "Premium high-end event decorator portfolio photograph. " +
  "Soft natural daylight from the left, elegant indoor venue, glossy reflective floor, " +
  "realistic room depth, beautiful lighting. " +
  "Professional event photography, 4K quality, sharp focus, soft bokeh background.";

// Fixed studio environment clause — appended to every Final Design Render prompt
// to ensure consistent room/background across regenerations.
const ENV_CLAUSE =
  "Set inside a luxury high-end minimalist interior photography studio. " +
  "The background is a solid, clean, seamless warm-gray microcement wall with a matching " +
  "light-beige polished concrete floor and subtle clean reflections. " +
  "Soft highly directional natural light comes from an off-camera large window on the left; " +
  "the window itself is not visible. " +
  "Maintain identical camera angle, lens perspective, wall, floor, lighting direction, " +
  "and studio atmosphere across all renders.";

// Prop isolation clause — prevents hallucinated side columns, furniture, and background clutter
const ISOLATION_CLAUSE =
  "The backdrop installation stands freely in the center. " +
  "No extra props, no side columns, no visible windows, no stray furniture, " +
  "no decorative background objects, no additional event structures.";

// Fixed seed for reproducible studio environment across Final Design Renders.
// fal-ai/flux-2-pro supports the seed parameter.
const FINAL_RENDER_SEED = 42424242;

// Tried and reverted: an arch_shimmer-only alternate seed (ARCH_SHIMMER_SEED)
// to break the model out of what looked like a seed-locked extra-cluster
// bias. A real A/B render at the alternate seed showed the identical
// artifact (detached cluster on the shimmer wall's far top corner + a
// separate floor cluster) — same failure, different seed, only the arch
// panel's own color drifted as an unrelated side effect. That ruled out
// "seed-locked" as the explanation: it's a seed-independent compositional
// prior of the edit model for two-panel backdrops, not something a
// different fixed seed fixes. Reverted to keep every layout on the single
// shared FINAL_RENDER_SEED rather than add seed divergence with no benefit.

// Applied whenever plinths are configured — guarantees the plinth is always rendered.
const PLINTH_VISIBILITY_CLAUSE =
  "[Plinth Visibility Guarantee]: Every configured plinth must be fully rendered and clearly visible in the final image. " +
  "The plinth must appear as a separate freestanding tall slim white cylindrical display column on the open side of the setup, in front of the backdrop but not merged with it. " +
  "It must be upright, vertical, and clearly taller than it is wide. " +
  "Do not omit, crop, hide, replace, merge, flatten, widen, shorten, or sacrifice the plinth. " +
  "It must not be hidden behind balloons, covered by balloons, merged into the backdrop, or replaced by decor. " +
  "The plinth must remain visually separated from the balloon garland with clear empty floor space around it.";

const PLINTH_GEOMETRY_LOCK_CLAUSE =
  "[Plinth Geometry Lock]: Any configured plinth must remain a tall, slim, upright cylindrical display column. " +
  "Its height must be clearly greater than its diameter, like a vertical column, not a low table. " +
  "It must never become a short podium, low platform, cake stand, squat cylinder, wide cylinder, flat cylinder, disk-shaped base, drum table, or round stool. " +
  "Theme selection must not alter plinth geometry, proportions, height, diameter, position, or vertical orientation.";

const FROZEN_PALETTE_LOCK_CLAUSE =
  "[Frozen Palette Lock]: For the Frozen theme, the balloon installation must be dominated by icy baby blue, soft powder blue, crisp white, and metallic silver. " +
  "The overall feeling must be cool-toned, fresh, icy, and wintery. " +
  "Do not shift the palette warm, creamy, beige, yellow, ivory-heavy, or champagne-dominant. " +
  "Blue and white must remain the primary visible colors, with metallic silver as the accent.";

// Active for every AI render — physical setup must be rendered exactly as configured.
const PHYSICAL_FIDELITY_CLAUSE =
  "[Physical Setup Fidelity]: Render the exact configured setup — no creative reinterpretation, " +
  "no embellishment, no extra decor, and no inflation of a minimal setup into a fuller or more luxurious one. " +
  "Preserve the exact backdrop count, types, proportions, and colors. " +
  "Preserve the exact configured balloon style and volume — do not expand a half garland into a full garland " +
  "or add extra balloon clusters in unconfigured areas. " +
  "Preserve the exact plinth count, size, and freestanding floor position — every configured plinth must be clearly visible. " +
  "If the setup is minimal (one panel, one plinth, half garland), render it as a minimal but premium event scene, " +
  "not as a fully decorated installation.";

  const BACKDROP_SIZE_LOCK_CLAUSE =
  "[Backdrop Size Lock]: The main arch backdrop panel must preserve its configured real-world size and proportions. " +
  "For a 100cm wide by 200cm tall arch panel, the panel must appear tall and narrow with an approximate 1:2 width-to-height ratio. " +
  "It must not become a wide wall, oversized architectural arch, 150cm wide panel, 180cm wide panel, or wall-sized backdrop. " +
  "The arch should read as a portable event backdrop panel, not a permanent wall feature.";

const BALLOON_STYLE: Record<string, string> = {
  half:    "a controlled asymmetric half-garland attached to ONE side of the backdrop only. " +
           "Begins near the top corner of that side and extends continuously down the SAME side to the floor. " +
           "Terminates in one compact cluster at the base of that same side — NOT spread across the floor, " +
           "NOT running horizontally in front of the backdrop, NOT covering the open/opposite side. " +
           "'Floor-reaching' means the garland ends in a compact side-base cluster only — " +
           "it does NOT become a horizontal floor trail, a balloon carpet, or a front-of-stage installation. " +
           "The opposite side remains completely open and clean. " +
           "Do NOT wrap around to the other side. Do NOT become a full garland or full frame. " +
           "Varied balloon sizes (large, medium, small), layered depth, glossy latex balloons",
  full:    "a full organic balloon frame around the backdrop group — both sides and top, " +
           "varied balloon sizes, rich layered depth, glossy latex balloons",
  premium: "a dense luxury organic balloon installation — large, medium, small, and mini latex balloons, " +
           "rich layered depth, high-end editorial balloon styling",
  none:    "no balloons anywhere in the scene",
};

function buildFirstGenPrompt(
  sceneModel:  SceneModel,
  basePrompt:  string,
  promptInput: PromptInput,
): string {
  const panelCount  = sceneModel.panels.length;
  const panelWord   = panelCount === 1 ? "panel" : "panels";

  const panelCount_str =
    `The scene must show EXACTLY ${panelCount} backdrop ${panelWord} — ` +
    `no more, no less. Do not add extra panels. Do not remove panels.`;

  const balloonStyle   = sceneModel.balloons.style;
  const configuredBalloonColors = sceneModel.balloons.colors.slice(0, 4);
  const promptProbe = JSON.stringify(promptInput).toLowerCase() + " " + basePrompt.toLowerCase();
  const isFrozenTheme =
    promptProbe.includes("frozen") ||
    promptProbe.includes("icy blues") ||
    promptProbe.includes("snowflake");

  const balloonColors  = configuredBalloonColors.length > 0
    ? `in ${configuredBalloonColors.join(", ")} tones`
    : "";
  const balloonColorAdherence = configuredBalloonColors.length > 0
    ? ` Balloon colors must visibly and clearly match the configured palette (${configuredBalloonColors.join(", ")}). ` +
      `Do not desaturate the garland into mostly white or colorless. ` +
      `The configured colors must be the dominant visible colors in the balloon installation.`
    : "";
  const balloonClause  = BALLOON_STYLE[balloonStyle]
    ? `Balloons: ${BALLOON_STYLE[balloonStyle]}${balloonColors ? " " + balloonColors : ""}.${balloonColorAdherence}`
    : "";

  const plinthCount = sceneModel.plinths.length;
  const hasArch = sceneModel.panels.some((p) => p.type === "arch");
  const backdropSizeLockClause = hasArch ? BACKDROP_SIZE_LOCK_CLAUSE : "";
  
  const frozenPaletteLockClause = isFrozenTheme ? FROZEN_PALETTE_LOCK_CLAUSE : "";
  const plinthGeometryLockClause = plinthCount > 0 ? PLINTH_GEOMETRY_LOCK_CLAUSE : "";

  const plinthClause = (() => {
    if (plinthCount === 0) return "No plinths.";

    const plinthDescs = sceneModel.plinths.map((p) => {
      const h = p.heightCm;
      const d = p.diameterCm;
      return (
        `a tall, slim, upright cylindrical display column — ${h}cm tall, ${d}cm diameter, ` +
        `height (${h}cm) is much greater than diameter (${d}cm), ` +
        `vertical orientation, straight vertical sides, flat circular top, ` +
        `freestanding on the floor. ` +
        `NOT a low platform, NOT a wide disk, NOT a stage, NOT a podium, ` +
        `NOT a cake stand, NOT a short round podium, NOT a low display stand, NOT a short cylinder`
      );
    });

    if (plinthCount === 1) {
      return (
        `Plinths: exactly one (1) visible white cylindrical display plinth — ${plinthDescs[0]}. ` +
        `It must stand upright as a tall narrow column, never as a short round platform or floor disk. ` +
        `Do not add a second plinth.`
      );
    }

    return (
      `Plinths: exactly ${plinthCount} visible white cylindrical display plinths. ` +
      plinthDescs.map((d, i) => `Plinth ${i + 1}: ${d}`).join(". ") + ". " +
      `Each must stand upright as a tall narrow column, never as a short round platform or floor disk. ` +
      `Do not add extra plinths beyond ${plinthCount}.`
    );
  })();

  // Selected-objects whitelist — theme influences mood/color only, not physical props
  const extras        = promptInput.extras ?? [];
  const hasFlorals    = extras.includes("florals");
  const hasCakeTable  = extras.includes("dessert_table");
  const hasCutouts    = sceneModel.cutouts.size !== "none";

  const allowedItems  = [
    `${panelCount} backdrop ${panelWord}`,
    sceneModel.balloons.style !== "none" ? "balloon garland" : null,
    plinthCount > 0 ? `${plinthCount} plinth${plinthCount > 1 ? "s" : ""}` : null,
    hasCutouts   ? "character cutout standees" : null,
    hasCakeTable ? "cake/dessert table" : null,
    hasFlorals   ? "floral clusters" : null,
  ].filter(Boolean).join(", ");

  const whitelistClause =
    `STRICT SCENE RULE: Render ONLY the following configured objects — ${allowedItems}. ` +
    `Do NOT invent extra decor items. ` +
    `The theme controls color palette and mood ONLY — it must NOT automatically add physical props, ` +
    `flowers, foliage, greenery, tables, cake stands, themed toys, or decorative filler objects. ` +
    (!hasFlorals    ? "No flowers, no floral arrangements, no foliage, no greenery. " : "") +
    (!hasCakeTable  ? "No cake stand, no dessert table, no side table, no coffee table. " +
                      "Note: selected plinths are allowed and must appear as tall slim white cylindrical display columns — do not interpret them as side tables or cake stands. " : "") +
    (!hasCutouts    ? "No character cutouts, no themed standees, no figure props. " : "") +
    `Clean event backdrop scene: only the configured items listed above.`;

  // Scale reference: helps AI understand backdrop width relative to the plinth
  const firstPlinth    = sceneModel.plinths[0];
  const firstArchPanel = sceneModel.panels.find((p) => p.type === "arch");
  const archWidthCm    = firstArchPanel?.widthCm ?? 100;
  const scaleRefClause = hasArch && plinthCount > 0 && firstPlinth
    ? (() => {
        const d     = firstPlinth.diameterCm;
        const h     = firstPlinth.heightCm;
        const ratio = Math.round(archWidthCm / d * 10) / 10;
        return (
          `SCALE REFERENCE: the white cylindrical plinth is ${d}cm diameter and ${h}cm tall. ` +
          `Height (${h}cm) is much greater than diameter (${d}cm) — it is a tall, slim, upright column, ` +
          `NOT a low disk or round platform. ` +
          `The arch backdrop panel is ${archWidthCm}cm wide — about ${ratio} times the plinth diameter. ` +
          `Use this ratio to judge the correct arch panel width in the scene. ` +
          `The arch must NOT appear wider than ${ratio} plinths placed side by side.`
        );
      })()
    : "";

  // Text is now a deterministic client-side overlay — NOT rendered by AI.
  // renderTextInAi = false disables all AI text clauses globally.
  const renderTextInAi = false as const;

  // Half-garland containment — fires only when half garland is configured.
  // Keeps all balloons confined to one side and plinth clearly visible on the open side.
  const halfGarlandContainmentClause = sceneModel.balloons.style === "half"
    ? `[Half Garland Containment]: All balloons must remain confined to the ONE configured garland side. ` +
      `The opposite/open side of the backdrop must remain completely clean with no balloons. ` +
      `The floor in front of the backdrop must remain clear — no balloons spreading horizontally across the floor. ` +
      `The plinth stands on the open side and must remain fully visible — ` +
      `no balloons must overlap, surround, cover, or obscure the plinth. ` +
      `The plinth must be clearly separated from the balloon installation.`
    : "";

  // Plinth clear zone — fires when a half garland and at least one plinth are configured.
  const plinthClearZoneClause = (sceneModel.balloons.style === "half" && plinthCount > 0)
    ? `[Plinth Clear Zone]: The plinth stands on the open side of the setup and must remain isolated and unobstructed. ` +
      `No balloons may overlap, touch, wrap around, sit directly in front of, sit behind, surround, ` +
      `or visually cover the plinth. ` +
      `Keep a clear floor area around the plinth so it remains fully visible as a separate object.`
    : "";

  // Shimmer wall clause — fires when a shimmer wall panel is configured.
  const shimmerColor = sceneModel.shimmerColor;
  const isSingleShimmer = sceneModel.panels.length === 1 && sceneModel.panels[0]?.type === "shimmer_wall";
  const shimmerWidthCm  = shimmerColor ? 200 : null;
  const shimmerHeightCm = shimmerColor ? 200 : null;
  const shimmerClause = shimmerColor
    ? (isSingleShimmer
        ? `[Single Square Shimmer Wall — Only Backdrop]: This setup contains exactly ONE backdrop panel: ` +
          `a single freestanding square shimmer wall, ${shimmerWidthCm}cm wide and ${shimmerHeightCm}cm tall. ` +
          `It is a flat front-facing rectangular event panel with a full square silhouette and NO cutouts or openings. ` +
          `The entire visible surface is covered edge-to-edge with small square ${shimmerColor} sequin tiles in a neat regular grid. ` +
          `This is a sequin shimmer wall rental panel. ` +
          `It is NOT an arch, NOT a rounded-top board, NOT a niche, NOT a frame, NOT a cutout, ` +
          `NOT a layered composition, and NOT a panel behind another panel. ` +
          `Do not add an arch. Do not add any other backdrop panel.`
        : `[Shimmer Wall — Required Appearance]: The shimmer wall must be rendered as a freestanding ` +
          `${shimmerWidthCm}cm wide x ${shimmerHeightCm}cm tall square event shimmer wall ` +
          `made of a regular neat grid of small flat square ${shimmerColor} sequin tiles. ` +
          `The tile grid must be clearly visible — flat, orderly, consistent rows and columns of square tiles. ` +
          `Clean reflective sparkle, neat flat tiled sequin surface, ${shimmerColor} shimmer finish. ` +
          `NOT a matte board. NOT a plain cream backdrop. NOT crumpled foil. NOT wrinkled metal. ` +
          `NOT embossed or hammered texture. The tiles must be flat and orderly, not crinkled or chaotic.`)
    : "";

  // balloonLockClause and plinthLockClause are disabled since text is overlay-only.
  const balloonLockClause       = "";
  const plinthLockClause        = "";
  const textSurfaceOnlyLockClause = "";

  return [
    STYLE_PREFIX,
    ENV_CLAUSE,
    BLANK_BACKDROP_CLAUSE,
    PHYSICAL_FIDELITY_CLAUSE,
    basePrompt,
    whitelistClause,
    ISOLATION_CLAUSE,
    panelCount_str,
    scaleRefClause,
    backdropSizeLockClause,
    balloonClause,
    frozenPaletteLockClause,
    halfGarlandContainmentClause,
    shimmerClause,
    plinthClause,
    plinthCount > 0 ? PLINTH_VISIBILITY_CLAUSE : "",
    plinthGeometryLockClause,
    plinthClearZoneClause,
    // buildVisibleTextRenderClause and buildCompositionBlueprintClause removed:
    // text is overlay-only; AI should render only the physical setup.
    buildCompositionBlueprintClause(sceneModel, renderTextInAi),
    balloonLockClause,
    plinthLockClause,
    textSurfaceOnlyLockClause,
  ].filter(Boolean).join(" ");
}

/**
 * Builds an explicit text visibility clause for every panel that has text enabled.
 * Each configured text string must appear visibly on its panel — not omitted,
 * not hidden behind balloons, not blended into the backdrop.
 */
function buildVisibleTextRenderClause(sceneModel: SceneModel): string {
  const textPanels = sceneModel.panels.filter((p) => p.text.enabled && p.text.value.trim());
  if (textPanels.length === 0) return "";

  const entries = textPanels.map((p) => {
    const panelTypeLabel = p.type === "arch" ? "arch" : p.type === "rect" ? "rectangular" : p.type;
    const fontDesc       = p.text.fontStyle === "block" ? "bold block" : p.text.fontStyle === "elegant" ? "elegant serif" : "script cursive";
    return (
      `Render the exact text "${p.text.value}" visibly on the ${panelTypeLabel} backdrop panel ` +
      `in ${fontDesc} style, ${describeTextColor(p.text.color)} color, centered. ` +
      `The text must be clearly legible, not omitted, not hidden behind balloons, ` +
      `and not blended into the backdrop surface. ` +
      `Do not place any balloon or object over the text area. ` +
      `If the text color is too close to the backdrop color for legibility, ` +
      `preserve the intended color appearance but add a subtle shadow or soft outline ` +
      `so the text remains clearly readable.`
    );
  });

  return `[Text Render - REQUIRED]: ${entries.join(" ")}`;
}

/**
 * Generates a dynamic composition blueprint clause for text-enabled renders.
 * All values come from sceneModel — no hardcoded sides, counts, or dimensions.
 */
function buildCompositionBlueprintClause(
  sceneModel:  SceneModel,
  textEnabled: boolean,
): string {
  if (!textEnabled) return "";

  // ── Balloon section ──────────────────────────────────────────────────────
  let balloonBlueprintSection = "";
  if (sceneModel.balloons.style !== "none") {
    const styleLabel = sceneModel.balloons.style; // half | full | premium
    const colorList  = sceneModel.balloons.colors.length > 0
      ? sceneModel.balloons.colors.slice(0, 4).join(", ")
      : "the currently configured palette";
    balloonBlueprintSection =
      `2. BALLOON GARLAND: The configured ${styleLabel} organic balloon garland is a single continuous ` +
      `installation on its configured side. It must extend from its upper attachment area all the way ` +
      `down to the floor in one unbroken flow — do not stop it mid-height, do not end it above the floor, ` +
      `and do not convert any part of it into a detached floor cluster on the opposite side. ` +
      `Preserve its configured side, flow, density, volume, color palette (${colorList}), and organic ` +
      `nesting exactly as established. Do not move, mirror, shrink, thin, simplify, recolor, or relocate ` +
      `the garland when text is added or updated. Only allow separate floor clusters if they are ` +
      `explicitly configured in the scene.`;
  } else {
    balloonBlueprintSection = `2. BALLOON GARLAND: No balloon garland is configured. Do not add one.`;
  }

  // ── Plinth section ───────────────────────────────────────────────────────
  let plinthBlueprintSection = "";
  const plinthCount = sceneModel.plinths.length;
  if (plinthCount === 0) {
    plinthBlueprintSection = `3. PLINTH SETUP: No plinths are configured. Do not add any plinth.`;
  } else {
    const plinthDescList = sceneModel.plinths.map((sp) =>
      `${sp.heightCm} cm tall, ${sp.diameterCm} cm diameter`
    ).join(" and ");
    const countWord = plinthCount === 1 ? "exactly one (1) plinth" : `exactly ${plinthCount} plinths`;
    plinthBlueprintSection =
      `3. PLINTH SETUP: Preserve ${countWord} (${plinthDescList}) visibly rendered in the foreground. ` +
      `Every configured plinth must remain visible — text must never cause any plinth to be omitted, ` +
      `hidden, cropped out, merged into the backdrop, or removed from the scene. ` +
      `Preserve the exact configured count, height, diameter, shape, color, floor contact, ` +
      `foreground placement, and vertical orientation for each plinth. ` +
      `Do not add, remove, duplicate, widen, shorten, enlarge, distort, or move any plinth ` +
      `when text is added or updated. ` +
      (plinthCount === 1
        ? "Exactly one (1) visible plinth must remain. Do not add a second plinth. "
        : `Exactly ${plinthCount} visible plinths must remain, no more, no less. `);
  }

  // ── Full clause ──────────────────────────────────────────────────────────
  return (
    `[Composition Blueprint - DO NOT ALTER]: This is the exact configured spatial layout for this render. ` +
    `Text is a flat surface-level decal only and must not cause the physical event setup to be ` +
    `regenerated, mirrored, flipped, rebalanced, resized, or reinterpreted. ` +
    `1. BACKDROP TEXT: Place the configured text only on its configured backdrop panel/surface ` +
    `and preserve its configured alignment. ` +
    `${balloonBlueprintSection} ` +
    `${plinthBlueprintSection} ` +
    `Maintain this exact configured spatial arrangement across all text-enabled generations.`
  );
}

// ---------------------------------------------------------------------------
// Layout-reference edit helpers
// ---------------------------------------------------------------------------

interface LayoutRefPngResult {
  dataUri:  string | null;
  error:    string | null;
  stage:    string | null;  // "svg-generation" | "sharp-import" | "rasterization"
  bytes:    number | null;
  /** Double Arch dense garland guide balloon counts (0 when not double arch). */
  doubleArchGarlandBalloonsLeft:  number;
  doubleArchGarlandBalloonsRight: number;
  /** Arch + Open Frame dense garland guide balloon counts (0 when not that layout). */
  archOpenFrameMainGarlandBalloons: number;
  archOpenFrameMiniClusterBalloons: number;
  archOpenFrameMainGarlandMinRadiusPx: number;
  archOpenFrameMainGarlandMaxRadiusPx: number;
  archOpenFrameMainGarlandLaneCount:   number;
  archOpenFrameMainGarlandStyle:       string;
  archOpenFrameFrameThicknessPx: number;
  archOpenFrameGeometryStyle:    string;
  /** Arch + Shimmer composition guide balloon count (0 when not that layout). */
  archShimmerCompositionBalloons: number;
  /** Bounding box (panel-local px) of the shimmer-side accent cluster — used
   *  to exclude it from the shimmer recolor mask. Null when not that layout. */
  archShimmerAccentZone: { xMin: number; xMax: number; yMin: number; yMax: number } | null;
  /** Where the guide drew each panel's lettering (inner viewBox px), so the
   *  render stage can recolour it — see the recolour block further down. */
  textZones: { panelIdx: number; colorHex: string; xMin: number; xMax: number; yMin: number; yMax: number }[];
}

/**
 * Generates a clean SVG layout reference and rasterizes it to a PNG data URI.
 * Returns a structured result so callers can report exactly why it failed.
 * Same sharp import pattern as the proven test route (fal-layout-reference-test).
 */
async function generateLayoutReferencePng(
  sceneModel:        SceneModel,
  promptInput:       PromptInput,
  selectedHexColors: string[] = [],
  cutoutGuideItems:  CutoutGuideItem[] = [],
): Promise<LayoutRefPngResult> {
  // Stage 1: SVG generation — derive plinth sizes from sceneModel for type safety
  let silhouette: ReturnType<typeof generateStructureSilhouette>;
  try {
    // Hand the guide each panel's RESOLVED colour (own colour, or the global
    // backdrop colour when the panel has none). promptInput.backdropItems keeps
    // an empty string for "inherit", which the guide cannot interpret.
    const colouredBackdropItems = (promptInput.backdropItems ?? []).map((item, i) => ({
      ...item,
      color: sceneModel.panels[i]?.color || item.color,
    }));
    silhouette = generateStructureSilhouette(
      colouredBackdropItems,
      sceneModel.plinths.map((p) => p.size),
      (sceneModel.balloons.style ?? "none") as BalloonStyleId,
      selectedHexColors.length > 0
        ? selectedHexColors
        : sceneModel.balloons.colors.length > 0
          ? sceneModel.balloons.colors
          : promptInput.balloonColors,
      cutoutGuideItems,
      sceneModel.shimmerColor ? SHIMMER_COLOR_HEX[sceneModel.shimmerColor as ShimmerColorId] : undefined,
    );
  } catch (err) {
    const msg = String(err);
    console.error("[generate-controlled-render] SVG generation failed:", msg);
    return { dataUri: null, error: msg, stage: "svg-generation", bytes: null, doubleArchGarlandBalloonsLeft: 0, doubleArchGarlandBalloonsRight: 0, archOpenFrameMainGarlandBalloons: 0, archOpenFrameMiniClusterBalloons: 0, archOpenFrameMainGarlandMinRadiusPx: 0, archOpenFrameMainGarlandMaxRadiusPx: 0, archOpenFrameMainGarlandLaneCount: 0, archOpenFrameMainGarlandStyle: "none", archOpenFrameFrameThicknessPx: 0, archOpenFrameGeometryStyle: "none", archShimmerCompositionBalloons: 0, archShimmerAccentZone: null, textZones: [] };
  }

  // Stage 2: sharp import — direct dynamic import so webpack/Vercel can trace and bundle it
  let sharpMod: (buf: Buffer) => { png(): { toBuffer(): Promise<Buffer> } };
  try {
    const sharpPkg = await import("sharp");
    sharpMod = (sharpPkg.default ?? sharpPkg) as typeof sharpMod;
  } catch (err) {
    const msg = String(err);
    console.error("[generate-controlled-render] sharp import failed:", msg);
    return { dataUri: null, error: msg, stage: "sharp-import", bytes: null, doubleArchGarlandBalloonsLeft: silhouette.doubleArchGarlandBalloonsLeft, doubleArchGarlandBalloonsRight: silhouette.doubleArchGarlandBalloonsRight, archOpenFrameMainGarlandBalloons: silhouette.archOpenFrameMainGarlandBalloons, archOpenFrameMiniClusterBalloons: silhouette.archOpenFrameMiniClusterBalloons, archOpenFrameMainGarlandMinRadiusPx: silhouette.archOpenFrameMainGarlandMinRadiusPx, archOpenFrameMainGarlandMaxRadiusPx: silhouette.archOpenFrameMainGarlandMaxRadiusPx, archOpenFrameMainGarlandLaneCount: silhouette.archOpenFrameMainGarlandLaneCount, archOpenFrameMainGarlandStyle: silhouette.archOpenFrameMainGarlandStyle, archOpenFrameFrameThicknessPx: silhouette.archOpenFrameFrameThicknessPx, archOpenFrameGeometryStyle: silhouette.archOpenFrameGeometryStyle, archShimmerCompositionBalloons: silhouette.archShimmerCompositionBalloons, archShimmerAccentZone: silhouette.archShimmerAccentZone, textZones: silhouette.textZones };
  }

  // Stage 3: rasterize SVG → PNG
  try {
    const svgBuffer = Buffer.from(silhouette.svg, "utf8");
    const pngBuffer = await sharpMod(svgBuffer).png().toBuffer() as Buffer;
    const dataUri   = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    console.log("[generate-controlled-render] layout reference PNG ready, bytes:", pngBuffer.length);
    return {
      dataUri, error: null, stage: null, bytes: pngBuffer.length,
      textZones: silhouette.textZones,
      doubleArchGarlandBalloonsLeft:  silhouette.doubleArchGarlandBalloonsLeft,
      doubleArchGarlandBalloonsRight: silhouette.doubleArchGarlandBalloonsRight,
      archOpenFrameMainGarlandBalloons: silhouette.archOpenFrameMainGarlandBalloons,
      archOpenFrameMiniClusterBalloons: silhouette.archOpenFrameMiniClusterBalloons,
      archOpenFrameMainGarlandMinRadiusPx: silhouette.archOpenFrameMainGarlandMinRadiusPx,
      archOpenFrameMainGarlandMaxRadiusPx: silhouette.archOpenFrameMainGarlandMaxRadiusPx,
      archOpenFrameMainGarlandLaneCount:   silhouette.archOpenFrameMainGarlandLaneCount,
      archOpenFrameMainGarlandStyle:       silhouette.archOpenFrameMainGarlandStyle,
      archOpenFrameFrameThicknessPx:       silhouette.archOpenFrameFrameThicknessPx,
      archOpenFrameGeometryStyle:          silhouette.archOpenFrameGeometryStyle,
      archShimmerCompositionBalloons:      silhouette.archShimmerCompositionBalloons,
      archShimmerAccentZone:               silhouette.archShimmerAccentZone,
    };
  } catch (err) {
    const msg = String(err);
    console.error("[generate-controlled-render] rasterization failed:", msg);
    return { dataUri: null, error: msg, stage: "rasterization", bytes: null, doubleArchGarlandBalloonsLeft: silhouette.doubleArchGarlandBalloonsLeft, doubleArchGarlandBalloonsRight: silhouette.doubleArchGarlandBalloonsRight, archOpenFrameMainGarlandBalloons: silhouette.archOpenFrameMainGarlandBalloons, archOpenFrameMiniClusterBalloons: silhouette.archOpenFrameMiniClusterBalloons, archOpenFrameMainGarlandMinRadiusPx: silhouette.archOpenFrameMainGarlandMinRadiusPx, archOpenFrameMainGarlandMaxRadiusPx: silhouette.archOpenFrameMainGarlandMaxRadiusPx, archOpenFrameMainGarlandLaneCount: silhouette.archOpenFrameMainGarlandLaneCount, archOpenFrameMainGarlandStyle: silhouette.archOpenFrameMainGarlandStyle, archOpenFrameFrameThicknessPx: silhouette.archOpenFrameFrameThicknessPx, archOpenFrameGeometryStyle: silhouette.archOpenFrameGeometryStyle, archShimmerCompositionBalloons: silhouette.archShimmerCompositionBalloons, archShimmerAccentZone: silhouette.archShimmerAccentZone, textZones: silhouette.textZones };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json({ error: "Missing FAL_KEY." }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const {
    promptInput, sceneModel,
    controlImageBase64,
    previousFinalRenderUrl,
    renderMode, editDescription,
    force                    = false,
    currentSceneHash,
    structureHash,
    renderAspectRatio        = "landscape_4_3",  // default fallback if not sent
    sempertexSelection,
    debugLayoutReferenceOnly = false,
    skipStrictCorrection     = false,
  } = body;

  const hasText    = sceneModel.panels.some((p) => p.text.enabled && p.text.value.trim());
  const hasGraphic = sceneModel.panels.some((p) => p.graphic.enabled);
  const selectedBackdropTypes = sceneModel.panels.map((p) => p.type);

// ── Model routing + cache lookup ──────────────────────────────────────
const modelMode = getModelMode();

const hasArchPanelInScene = sceneModel.panels.some((p) => p.type === "arch");
const hasRoundPanelInScene = sceneModel.panels.some((p) => p.type === "round");

const selectedThemeId = String(sceneModel.theme ?? "").trim().toLowerCase();
const themeEntry = THEME_CATALOG.find((t) => t.id === selectedThemeId);
const missingThemePalette = !themeEntry || themeEntry.sempertexPaletteIds.length === 0;
const missingThemePaletteId = missingThemePalette ? selectedThemeId : null;

const themeDefaultSempertexSelection = getThemeSempertexDefaults(selectedThemeId);

const firstGraphicPanel = sceneModel.panels.find(p => p.graphic.enabled);
const selectedBackdropGraphicEnabled = !!firstGraphicPanel;
const selectedBackdropGraphicSource  = firstGraphicPanel?.graphic.source ?? null;
const selectedBackdropGraphicAssetId = firstGraphicPanel?.graphic.assetId ?? null;

const effectiveSempertexSelection: SempertexSelectionItem[] =
  (sempertexSelection?.length ?? 0) > 0
    ? (sempertexSelection ?? [])
    : themeDefaultSempertexSelection;

if (process.env.NODE_ENV === "development") {
  console.log("[generate-controlled-render] selectedThemeId:", selectedThemeId, "missingThemePalette:", missingThemePalette);
  console.log(
    "[generate-controlled-render] effectiveSempertexSelection:",
    effectiveSempertexSelection.map((c) => `${c.code}-${c.colorName}-${c.finish}`)
  );
}

const hasSempertexLock = effectiveSempertexSelection.length > 0;

// Palette-aware forbidden-color sanitization (2026-07-18): "blue" must never
// appear in the forbidden list when the selected palette itself contains a
// blue — Frozen's 839 Arctic Blue / 640 Blue were being contradicted by a
// blanket "blue" entry in forbiddenBalloonColorLabels. Same conflict-avoidance
// treatment the prompt builders already give yellow/green (and now blue too,
// see hasBlueInPalette / negBlueInPalette there).
const paletteHasBlue = effectiveSempertexSelection.some((c) => {
  const name   = String(c.colorName ?? "").toLowerCase();
  const family = String((c as SempertexSelectionItem & { family?: string }).family ?? "").toLowerCase();
  return name.includes("blue") || family === "blue";
});

// Hex colors for the layout-reference balloon guide dots.
// When a Sempertex palette is locked, pass the exact hex values so the SVG
// guide image shows the selected colors instead of transparent white outlines.
const effectiveBalloonHexColors: string[] = hasSempertexLock
  ? effectiveSempertexSelection
      .map((c) => String((c as SempertexSelectionItem & { hex?: string }).hex ?? ""))
      .filter(Boolean)
  : [];
const layoutGuideBalloonColorMode: "selected_hex" | "scene_colors" | "prompt_fallback" =
  effectiveBalloonHexColors.length > 0 ? "selected_hex"
  : sceneModel.balloons.colors.length > 0 ? "scene_colors"
  : "prompt_fallback";

const strictColorReason: string[] = [];

if (hasRoundPanelInScene) {
  strictColorReason.push("round_backdrop");
}

if (hasSempertexLock) {
  strictColorReason.push("sempertex_color_lock");
}

if (
  effectiveSempertexSelection.some((color) =>
    ["Silk", "Reflex"].includes(String(color.finish ?? ""))
  )
) {
  strictColorReason.push("silk_or_reflex_finish");
}

const strictColorModelApplied =
  modelMode !== "pro" && strictColorReason.length > 0;

// Fast Stable Arch Profile:
// Arch scenes use flash/edit because it is fast and looked good in testing.
// Round scenes stay away from flash for now because flash added a base/stage.
//
// 2026-09-03 — MULTI-PANEL arch scenes move off flash. Double Arch has now
// been made identical to Single Arch everywhere it could be: the layout guide
// regenerates with the same balloon radii and lane structure, the prompt uses
// the same garland, balloon-size and plinth clauses, and it runs as a single
// generation with no correction, injection or composite pass. Single Arch
// renders beautifully under those conditions and Double Arch still returns
// merged, sausage-shaped balloons and drops the plinth entirely, so the
// remaining variables are the model and the frame it is asked to fill.
//
// flash is the cheapest member of the family and a two-panel scene is
// materially harder than a one-panel one — more objects, a centre gap to
// respect, and each garland occupying roughly half the linear resolution it
// gets in Single Arch's portrait frame. This codebase already has precedent
// for flash being the weak link on the harder layout: round scenes were moved
// off it because it invented a base/stage. Multi-panel arch scenes now use
// the same non-flash model those round scenes use.
// 2026-09-03, later: the multi-panel split above is REVERTED. Moving Double
// Arch to the non-flash model did not improve it, and it was itself a
// difference from Single Arch — which renders beautifully on flash — at the
// same time as the customer asked for the two to be made identical. Both arch
// layouts are back on flash.
let resolvedEditModelId = getEditModelId(modelMode);
let actualModelReason: string = `mode_default_${modelMode}`;

if (hasArchPanelInScene && !hasRoundPanelInScene) {
  resolvedEditModelId = "fal-ai/flux-2/flash/edit";
  actualModelReason   = "arch_scene_flash_edit";
} else if (hasRoundPanelInScene) {
  resolvedEditModelId = "fal-ai/flux-2/edit";
  actualModelReason   = "round_scene_edit";
}

const editModelId = resolvedEditModelId;
// The routing decision made above, before any fal call is attempted — present
// on every response path (cache hit, edit_existing, first_generate, fallback,
// or hard failure) since it's computed unconditionally per-request.
const actualPrimaryModelId = resolvedEditModelId;

const cacheKey = buildCacheKey(
  currentSceneHash,
  renderMode ?? "first_generate",
  resolvedEditModelId
);

const cached = force ? null : renderCache.get(cacheKey);

if (cached) {
  if (process.env.NODE_ENV === "development") {
    console.log("[generate-controlled-render] cache hit:", cacheKey);
  }

  return NextResponse.json({
    imageUrl: cached.imageUrl,
    ...cached.extra,
    ...cached.diagInfo,
    cacheHit: true,
  });
}
  

  if (process.env.NODE_ENV === "development") {
    console.group("[generate-controlled-render] incoming request");
    console.log("renderMode:              ", renderMode);
    console.log("force:                   ", force, force ? "→ always calls fal, no cache reuse" : "");
    console.log("currentSceneHash:        ", currentSceneHash ?? "none");
    console.log("controlImageBase64:      ", !!controlImageBase64, controlImageBase64 ? `length=${controlImageBase64.length}` : "(not provided)");
    console.log("previousFinalRenderUrl:  ", previousFinalRenderUrl ?? "none");
    console.log("panelCount:              ", sceneModel.panels.length);
    console.log("plinthCount:             ", sceneModel.plinths.length);
    console.log("hasText:                 ", hasText);
    console.log("hasGraphic:              ", hasGraphic);
    sceneModel.panels.forEach((p, i) =>
      console.log(`  panel ${i + 1}: type=${p.type} sizeId=${p.sizeId} ${p.widthCm}×${p.heightCm}cm color=${p.color}`)
    );
    console.groupEnd();
  }

  fal.config({ credentials: falKey });

  // Diagnostics — resolved from sceneModel, shared by every render path.
  // IMPORTANT: each panel-type diagnostic is sourced from a panel of that EXACT
  // type only — never a generic "first panel" fallback mislabeled as arch/round.
  const firstPlinthDiag = sceneModel.plinths[0];
  const firstArchDiag   = sceneModel.panels.find((p) => p.type === "arch");
  const firstRoundDiag  = sceneModel.panels.find((p) => p.type === "round");
  const cutouts = sceneModel.cutouts;
const cutoutItems = cutouts?.items?.filter((item: any) => item.quantity > 0) ?? [];
const resolvedCutoutTotalCount = cutoutItems.reduce((sum: number, item: any) => sum + item.quantity, 0);

// ── Multi-asset standee model ─────────────────────────────────────────────
// selectedAssets: several designs, each with per-size quantities. Legacy
// presetAssetId configs are mapped into selectedAssets by normalizeCutouts
// client-side; a server-side fallback below covers raw legacy payloads.
type SelectedCutoutAsset = {
  assetId: string;
  label?: string;
  quantities: { large?: number; medium?: number; small?: number };
};
const SIZE_HEIGHT_CM = { large: 150, medium: 100, small: 60 } as const;
let selectedCutoutAssets = (((cutouts as any)?.selectedAssets ?? []) as SelectedCutoutAsset[])
  .filter((a) => a && a.assetId);
if (selectedCutoutAssets.length === 0 && (cutouts as any)?.presetAssetId && resolvedCutoutTotalCount > 0) {
  // Legacy single-asset payload → one selected asset with the item quantities
  const q = (size: "large" | "medium" | "small") =>
    Math.max(0, (cutouts?.items ?? []).find((i: any) => i.size === size)?.quantity ?? 0);
  selectedCutoutAssets = [{
    assetId: (cutouts as any).presetAssetId as string,
    label: (cutouts as any).presetAssetId as string,
    quantities: { large: q("large"), medium: q("medium"), small: q("small") },
  }];
}
const resolvedCutoutOverlayItems = selectedCutoutAssets.flatMap((a) =>
  (["large", "medium", "small"] as const)
    .map((size) => ({
      assetId:  a.assetId,
      label:    a.label ?? a.assetId,
      size,
      heightCm: SIZE_HEIGHT_CM[size],
      quantity: Math.max(0, a.quantities?.[size] ?? 0),
    }))
    .filter((x) => x.quantity > 0),
);
const selectedCutoutAssetIds = Array.from(new Set(resolvedCutoutOverlayItems.map((x) => x.assetId)));
const cutoutGuideItems: CutoutGuideItem[] = (cutouts as any)?.mode === "standees"
  ? cutoutItems.map((item: any) => ({ heightCm: item.heightCm as number, quantity: item.quantity as number }))
  : [];
const layoutGuideCutoutPlaceholdersApplied = cutoutGuideItems.length > 0;
const layoutGuideCutoutPlaceholderCount    = cutoutGuideItems.reduce((s, i) => s + i.quantity, 0);
const layoutGuideCutoutHeightsCm           = cutoutGuideItems.flatMap(i => Array<number>(i.quantity).fill(i.heightCm));

// Controlled setup layout template — inferred from selected backdrop types.
// Drives prompt garland/panel instructions and locked standee overlay zones.
const setupLayoutTemplateId = inferSetupLayoutTemplateIdFromBackdropItems(sceneModel.panels);
const setupLayoutTemplate   = setupLayoutTemplateId ? getSetupLayoutTemplate(setupLayoutTemplateId) : undefined;

// ── Customized text diagnostics ───────────────────────────────────────────
// Text is baked into the AI render via prompt + layout guide (no overlay).
const customizedTextPanels = sceneModel.panels.filter(
  (p) => p.text?.enabled && (p.text?.value ?? "").trim().length > 0,
);
const customizedTextSolidPanels = customizedTextPanels.filter(
  (p) => p.type !== "shimmer_wall" && p.type !== "open_arch_frame",
);
const hasShimmerInScene = sceneModel.panels.some((p) => p.type === "shimmer_wall");
// Exactly one arch + one shimmer_wall, no open frame — the arch_shimmer
// layout specifically (not single_shimmer, not double_arch, not any
// open-frame variant). Used to scope the arch_shimmer bridge-garland
// diagnostics below to only the scenes that can actually have one.
const isArchShimmerScene =
  sceneModel.panels.length === 2 &&
  sceneModel.panels.some((p) => p.type === "arch") &&
  sceneModel.panels.some((p) => p.type === "shimmer_wall") &&
  !sceneModel.panels.some((p) => p.type === "open_arch_frame");

  const diagInfo = {
  selectedPlinthSize:       firstPlinthDiag?.size       ?? null,
  resolvedPlinthHeightCm:   firstPlinthDiag?.heightCm   ?? null,
  resolvedPlinthDiameterCm: firstPlinthDiag?.diameterCm ?? null,

  selectedCutoutMode: cutouts?.mode ?? "none",
selectedCutoutPosition: cutouts?.position ?? "floor",
selectedCutoutSource: cutouts?.source ?? null,
selectedCutoutPresetAssetId: cutouts?.presetAssetId ?? null,
resolvedCutoutItems: cutoutItems,
resolvedCutoutTotalCount,
isCutoutExpected: resolvedCutoutTotalCount > 0,
cutoutPromptApplied: resolvedCutoutTotalCount > 0,
selectedCutoutAssetIds,
resolvedCutoutOverlayItems,

// Customized text diagnostics
customizedTextPromptApplied: customizedTextPanels.length > 0,
customizedTextValue:         customizedTextPanels[0]?.text.value.trim() ?? null,
customizedTextPanelIds:      customizedTextPanels.map((p) => p.id),
customizedTextGuideApplied:  customizedTextSolidPanels.length > 0,
renderTextInAi:              customizedTextPanels.length > 0,
  // Reported so a render can be traced to the code that produced it. Without
  // it there is no way to tell a stale deployment from a real defect, which
  // cost several rounds of debugging on 2026-09-03.
  renderCacheVersion:          RENDER_CACHE_VERSION,

  selectedArchSize:         firstArchDiag?.sizeId       ?? null,
  resolvedArchWidthCm:      firstArchDiag?.widthCm      ?? null,
  resolvedArchHeightCm:     firstArchDiag?.heightCm     ?? null,

  selectedRoundSize:        firstRoundDiag ? "medium"   : null,
  resolvedRoundDiameterCm:  firstRoundDiag?.widthCm     ?? null,

  selectedShimmerColor:     sceneModel.shimmerColor     ?? null,
  resolvedShimmerWidthCm:   sceneModel.shimmerColor ? 200 : null,
  resolvedShimmerHeightCm:  sceneModel.shimmerColor ? 200 : null,

  selectedBackdropTypes,
  isSingleShimmerOnly:      sceneModel.panels.length === 1 && sceneModel.panels[0]?.type === "shimmer_wall",
  panelCount:               sceneModel.panels.length,

  selectedBalloonStyle:     sceneModel.balloons.style,
  balloonColorCount:        sceneModel.balloons.colors.length,

  plinthCount:              sceneModel.plinths.length,
  isBalloonGarlandExpected: sceneModel.balloons.style !== "none",
  isPlinthExpected:         sceneModel.plinths.length > 0,

  // Single source of truth for balloon color — exactly what the prompt used.
  effectiveSempertexSelection,
effectiveBalloonColors: sceneModel.balloons.colors ?? [],

  requestedRenderMode: renderMode ?? null,
  structureHash:       structureHash ?? null,
  sceneHash:           currentSceneHash ?? null,

  modelMode,
  resolvedEditModelId,
  // Explicit "actual model path" diagnostics — see file-header comment for
  // the full routing table. These reflect the routing decision made before
  // any fal call; actualRenderPath/actualEditModelId/actualFirstGenerateModelId
  // (added to each response's `extra`) reflect what actually executed.
  actualPrimaryModelId,
  actualModelReason,
  strictColorModelApplied,
  strictColorReason,

  // Confirms what actually drove the balloon color prompt clause.
  balloonColorSource:
  (effectiveSempertexSelection?.length ?? 0) > 0
    ? "manual_sempertex_selection"
    : effectiveSempertexSelection.length > 0
      ? "theme_sempertex_default"
      : "theme_default",

balloonColorLockApplied:
  effectiveSempertexSelection.length > 0 && sceneModel.balloons.style !== "none",

// Color fidelity diagnostics — what the AI was told vs. what it must not produce
allowedBalloonPaletteLabels: effectiveSempertexSelection.map((c) => {
  const hex = String((c as SempertexSelectionItem & { hex?: string }).hex ?? "");
  return `${c.code} ${hex} ${getVisualLabel(c)}`;
}),
forbiddenBalloonColorLabels: hasSempertexLock
  ? [
      "teal", "turquoise",
      ...(paletteHasBlue ? [] : ["blue"]),
      "orange", "coral", "copper", "bronze", "dark gold", "saturated red", "rainbow colors",
    ]
  : [],

  // Layout-reference guide diagnostics
  layoutGuideBalloonColors:                 effectiveBalloonHexColors,
  layoutGuideBalloonColorMode,
  roundPrimaryPromptColorOverrideApplied:   hasRoundPanelInScene && effectiveBalloonHexColors.length > 0,
  roundHalfGarlandGuideApplied:             hasRoundPanelInScene && sceneModel.balloons.style === "half",
  plinthGuideProtected:                     sceneModel.plinths.length > 0,
  layoutGuideCutoutPlaceholdersApplied,
  layoutGuideCutoutPlaceholderCount,
  layoutGuideCutoutHeightsCm,

  // Controlled setup layout template diagnostics
  selectedSetupLayoutTemplateId:   setupLayoutTemplateId,
  selectedSetupLayoutTemplateName: setupLayoutTemplate?.name ?? null,
  layoutTemplateGuideApplied:      !!setupLayoutTemplate,
  layoutTemplateGarlandGuideApplied: !!setupLayoutTemplate && sceneModel.balloons.style !== "none",

  // Double Arch lock diagnostics
  doubleArchLayoutLocked:              setupLayoutTemplateId === "double_arch",
  doubleArchMirrorGarlandGuideApplied: setupLayoutTemplateId === "double_arch" && sceneModel.balloons.style !== "none",
  centeredPlinthGuideApplied:          setupLayoutTemplateId === "double_arch" && sceneModel.plinths.length === 1,

  // Double Arch render-fidelity reinforcement diagnostics (2026-07-12) —
  // fixes for: the two arches rendering near-identical in size, and the two
  // arch bases merging/touching at the floor. See buildLayoutRefEditPrompt.ts
  // (doubleArchSizeLockClause, doubleArchSeparationClause),
  // buildNegativePrompt.ts (doubleArchNeg), and calculateExactLayout.ts
  // (panel height now exactly proportional to configured heightCm instead
  // of a weak approximate stagger, and the panel gap widens when a plinth
  // needs room). These two remain accurate and unchanged.
  //
  // doubleArchPlinthRetentionPromptApplied / doubleArchPlinthGuideStrengthened
  // are now permanently false: after 8 real-render attempts, AI-side plinth
  // prompt/guide reinforcement was abandoned in favor of a deterministic
  // post-render composite (see doubleArchPlinthCompositeApplied /
  // doubleArchPlinthAiSuppressed in `extra`, added by the compositing stage
  // below) — there is no more AI-facing plinth prompt or guide to apply or
  // strengthen for Double Arch. Field names kept stable rather than removed.
  doubleArchPlinthRetentionPromptApplied: false,
  doubleArchPlinthGuideStrengthened:      false,
  // 2026-09-03: the SIZE LOCK / SEPARATION LOCK clauses were retired (see
  // buildLayoutRefEditPrompt.ts) — the guide fixes both; the clauses were
  // part of the block that suppressed the plinth. Names kept, values false.
  doubleArchSizeLockStrengthened:         false,
  doubleArchGapLockApplied:               false,
  doubleArchPhysicalSeparationApplied:    false,

  // Double Arch restoration diagnostics (2026-07-18) — Double Arch was
  // brought back into the product with simplified balloon behavior: each
  // arch reuses the exact proven Single Arch garland treatment, mirrored,
  // instead of the old bespoke double-arch garland algorithm. Plinth stays
  // suppressed from the AI-facing render (doubleArchPlinthRenderSuppressed /
  // doubleArchPlinthAiSuppressed below, unchanged from the prior decision).
  doubleArchRestored:                       setupLayoutTemplateId === "double_arch",
  doubleArchUsesMirroredSingleArchGarland:  setupLayoutTemplateId === "double_arch" && sceneModel.balloons.style !== "none",
  doubleArchCenterGapProtected:             setupLayoutTemplateId === "double_arch",
  // False since 2026-07-19: the plinth is visible in Double Arch again —
  // AI-rendered via the same guide-marker + prompt path Single Arch uses
  // (doubleArchPlinthAiRendered below reports it).
  doubleArchPlinthPreviewHidden:            false,
  doubleArchPlinthAiRendered:               setupLayoutTemplateId === "double_arch" && sceneModel.plinths.length > 0,

  // Double Arch garland geometry fix (2026-07-18) — the first restored
  // version rendered as thin detached vertical bead columns floating beside
  // the arches. The guide now reuses the thick-organic-mass drawing
  // (drawThickOrganicMainGarland: base cluster + 5-lane edge-overlapping
  // climb + crown curl) per arch, and the prompt/negatives mandate physical
  // attachment to the arch edge and forbid the detached-column shape.
  doubleArchGarlandAttachedToArchEdges:     setupLayoutTemplateId === "double_arch" && sceneModel.balloons.style !== "none",
  doubleArchGarlandDetachedColumnPrevented: setupLayoutTemplateId === "double_arch" && sceneModel.balloons.style !== "none",
  doubleArchGarlandThickOrganicMass:        setupLayoutTemplateId === "double_arch" && sceneModel.balloons.style !== "none",
  // 2026-07-19: the tight guide now tapers — enlarged floor mound, balloons
  // concentrated low, band width and radii shrinking with height, lighter
  // crown — and the prompt/negatives forbid the even side-border/trim look.
  doubleArchGarlandBottomHeavyOrganic:      setupLayoutTemplateId === "double_arch" && sceneModel.balloons.style !== "none",
  doubleArchColorForbiddenListSanitized:    hasSempertexLock,

  cutoutAiGenerationSuppressed: cutoutGuideItems.length > 0,

  // Theme catalog diagnostics
  selectedThemeId,
  selectedThemePaletteIds:    themeEntry?.sempertexPaletteIds ?? [],
  missingThemePalette,
  missingThemePaletteId,
  selectedBackdropGraphicEnabled,
  selectedBackdropGraphicSource,
  selectedBackdropGraphicAssetId,

  // Single Shimmer / Arch + Shimmer parity diagnostics — confirms single_shimmer
  // no longer runs the old legacy special-cased prompt path and instead shares
  // the exact same shimmer-wall creation method (guide + prompt + negatives)
  // that arch_shimmer already used.
  singleShimmerGuideStyle:
    sceneModel.panels.length === 1 && sceneModel.panels[0]?.type === "shimmer_wall"
      ? "arch_shimmer_parity_v1" : "n/a",
  singleShimmerUsesArchShimmerMethod:
    sceneModel.panels.length === 1 && sceneModel.panels[0]?.type === "shimmer_wall",
  singleShimmerPromptStyle:
    sceneModel.panels.length === 1 && sceneModel.panels[0]?.type === "shimmer_wall"
      ? "premium_shimmer_wall_v1" : "n/a",

  // Shimmer color switching diagnostics (Phase 2) — confirms the selected
  // shimmer color actually reaches both the layout-reference guide tiles
  // (generateStructureSilhouette) and the render prompt (buildLayoutRefEditPrompt),
  // for both single_shimmer and arch_shimmer.
  resolvedShimmerColorHex:
    sceneModel.shimmerColor ? SHIMMER_COLOR_HEX[sceneModel.shimmerColor as ShimmerColorId] ?? null : null,
  resolvedShimmerColorLabel:
    sceneModel.shimmerColor
      ? SHIMMER_COLORS.find((c) => c.id === sceneModel.shimmerColor)?.label ?? sceneModel.shimmerColor
      : null,
  shimmerColorAppliedToGuide: hasShimmerInScene && !!sceneModel.shimmerColor,
  shimmerColorAppliedToPrompt: hasShimmerInScene && !!sceneModel.shimmerColor,

  // Shimmer adherence diagnostics — v3 ("large_paillette_checker_v2" +
  // "forceful_v2" color lock) broke Arch + Shimmer quality: the edit model
  // copied the large checkerboard guide tiles literally as visible square
  // patchwork/mosaic blocks, and this happened even at color=silver, proving
  // the guide/prompt geometry — not the color-lock wording — was the root
  // cause. Rolled back to the previously-good dense small-tile sequin method;
  // shimmer color customization is de-prioritized (soft mention only) until
  // quality is confirmed stable again.
  shimmerTileVisualStyle: hasShimmerInScene ? "dense_event_sequin_wall_restored_v1" : "n/a",
  shimmerTileScaleLabel: hasShimmerInScene ? "normal_event_sequin_scale" : "n/a",
  shimmerColorLockStrength: hasShimmerInScene ? "soft_or_disabled_for_quality" : "n/a",
  shimmerPromptForcesNonSilver: false,
  shimmerGuideUsesSelectedColorDominantly: false,

  // Arch + Shimmer rule-path diagnostics — confirms whether this scene took
  // the arch_shimmer path at all. Balloon-count/applied fields live in the
  // pngResult-derived `extra` object further down (only known after the
  // layout-reference PNG is generated).
  archShimmerGuideStyle: isArchShimmerScene ? "arch_dense_garland_plus_shimmer_accent_v3" : "n/a",
  archShimmerUsesMultiPanelNegs: isArchShimmerScene,
  archShimmerModelPath: isArchShimmerScene ? actualPrimaryModelId : "n/a",
  // Balloon styling reference mode — v3 reverted the interpolated "bridge"
  // guide (balloons spanning the panel gap) and the accompanying SINGLE
  // GARLAND LOCK prompt/negative-prompt engineering after a real render
  // comparison showed that combination read as an awkward, over-engineered
  // composition. Restored to the older, visually-successful pattern: the
  // arch gets its own full drawDenseGarland treatment (same function
  // double_arch uses), the shimmer wall gets a standalone near-corner
  // accent cluster, and the balloon PROMPT text is back to the same default
  // wording every other arch scene uses (no arch_shimmer special case) —
  // relying on setupLayoutCatalog's own garland description, as it did
  // before the bridge experiment.
  balloonStyleReferenceMode: "older_successful_arrangement_v1",
  archShimmerBalloonCompositionMode: isArchShimmerScene ? "arch_dense_garland_plus_shimmer_accent_v3" : "n/a",
  // single_shimmer's balloon guide was never touched by the bridge
  // experiment (it uses the separate generic single-panel garland branch,
  // positioned outside the shimmer panel's own footprint) — reported here
  // for completeness/symmetry with the arch_shimmer diagnostic above.
  singleShimmerBalloonCompositionMode:
    sceneModel.panels.length === 1 && sceneModel.panels[0]?.type === "shimmer_wall"
      ? "unchanged_generic_corner_garland" : "n/a",
};

  try {
    // ── Edit existing render — color-only / style-tweak recolor on the previous render ──
    if (renderMode === "edit_existing" && previousFinalRenderUrl) {
      const editPrompt =
        editDescription
          ? `${editDescription}. Preserve the room, camera angle, floor, lighting, balloon arrangement, backdrop count, panel shapes, and plinth positions exactly.`
          : `Refine the design while keeping all structural and atmospheric elements identical.`;

      const falResult = await fal.subscribe(editModelId, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input: {
          prompt:        editPrompt,
          image_urls:    [previousFinalRenderUrl],
          image_size:    renderAspectRatio,   // dynamic from panel dimensions — preserved
          seed:          FINAL_RENDER_SEED,   // fixed seed for consistent studio environment
          output_format: "jpeg",
        } as any,
        logs: true,
      });

      const d         = falResult.data as Record<string, unknown>;
      const imagesArr = Array.isArray(d?.["images"]) ? (d["images"] as Record<string, unknown>[]) : null;
      const imageUrl  =
        (imagesArr?.[0]?.["url"] as string | undefined) ??
        ((d?.["image"] as Record<string, unknown> | undefined)?.["url"] as string | undefined) ??
        (d?.["url"] as string | undefined) ??
        null;
      if (!imageUrl) return NextResponse.json({ error: "No image returned" }, { status: 502 });

      if (process.env.NODE_ENV === "development") {
        console.log("[generate-controlled-render] edit done:", imageUrl);
      }

      const extra = {
        mode: "edit_existing",
        modelId: editModelId,
        fallbackUsed: false,
        actualRenderPath:           "edit_existing_recolor",
        actualEditModelId:          editModelId,
        actualFirstGenerateModelId: null,
      };
      renderCache.set(cacheKey, { imageUrl, diagInfo, extra });
      return NextResponse.json({ imageUrl, ...extra, ...diagInfo, cacheHit: false });
    }

    // ── First generate ─────────────────────────────────────────────────────────
    // Customized text is baked into the AI render (printed into the backdrop
    // surface) — when any panel has text, drop the text negatives so the model
    // can render it. Panels without text keep the strict no-text negatives.
    const renderTextInAi = sceneModel.panels.some(
      (p) => p.text?.enabled && (p.text?.value ?? "").trim().length > 0,
    );

    const promptInputForAi: typeof promptInput = {
      ...promptInput,
      // Legacy global text stays stripped; per-item customized text is KEPT —
      // it drives both the prompt clause and the layout-reference text guide.
      backdropText: promptInput.backdropText
        ? { ...promptInput.backdropText, enabled: false, name: "", customText: "" }
        : undefined,
      backdropItems: promptInput.backdropItems,
    };

    const { prompt: basePrompt } = generatePrompt(promptInputForAi);
    const finalPrompt            = buildFirstGenPrompt(sceneModel, basePrompt, promptInputForAi);
    const negativePrompt         = buildNegativePrompt(sceneModel.panels, renderTextInAi, hasGraphic, promptInputForAi, sceneModel, effectiveSempertexSelection);

    // ── Primary path: layout-reference edit ────────────────────────────────
    // Same proven pattern as fal-layout-reference-test in the structure test route.
    const pngResult       = await generateLayoutReferencePng(sceneModel, promptInputForAi, effectiveBalloonHexColors, cutoutGuideItems);
    const layoutRefPrompt = buildLayoutRefEditPrompt(sceneModel, effectiveSempertexSelection);

    // Debug shortcut: return the layout reference PNG without calling fal.
    // Lets the caller inspect exactly what visual guide the model receives.
    if (debugLayoutReferenceOnly) {
      return NextResponse.json({
        ok:                      true,
        debugMode:               true,
        layoutReferenceDataUri:  pngResult.dataUri,
        layoutReferencePngBytes: pngResult.bytes,
        layoutReferencePngError: pngResult.error,
        layoutReferencePngStage: pngResult.stage,
        ...diagInfo,
      });
    }

    let fallbackReason:       string | null = null;
    let fallbackStage:        string | null = null;
    let fallbackErrorMessage: string | null = null;

    if (!pngResult.dataUri) {
      fallbackReason       = "layout-reference PNG generation failed";
      fallbackStage        = pngResult.stage;
      fallbackErrorMessage = pngResult.error;
      console.error("[generate-controlled-render] PNG failed at stage:", pngResult.stage, pngResult.error);
    } else {
      // AbortController + setTimeout — exact pattern from proven test route
      const abortController = new AbortController();
      const timeoutHandle   = setTimeout(() => abortController.abort(), 80_000);

      try {
        console.log(`[generate-controlled-render] → ${editModelId} (layout-reference), pngBytes:`, pngResult.bytes);

        const falResult = await fal.subscribe(editModelId, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input: {
            prompt:          layoutRefPrompt,
            negative_prompt: negativePrompt,
            image_urls:      [pngResult.dataUri],
            image_size:      renderAspectRatio,
            seed:            FINAL_RENDER_SEED,
            output_format:   "jpeg",
          } as any,
          logs:        true,
          abortSignal: abortController.signal,
          onQueueUpdate: (status) => {
            console.log("[generate-controlled-render] queue:", status.status,
              status.status === "IN_QUEUE" ? `pos=${status.queue_position}` : "");
          },
        });

        // Defensive image URL extraction (same as test route)
        const d         = falResult.data as Record<string, unknown>;
        const imagesArr = Array.isArray(d?.["images"]) ? (d["images"] as Record<string, unknown>[]) : null;
        const imageUrl  =
          (imagesArr?.[0]?.["url"] as string | undefined) ??
          ((d?.["image"] as Record<string, unknown> | undefined)?.["url"] as string | undefined) ??
          (d?.["url"] as string | undefined) ??
          null;

        if (imageUrl) {
  if (process.env.NODE_ENV === "development") {
    console.log("[generate-controlled-render] layout-reference edit succeeded:", imageUrl);
  }

  let finalImageUrl = imageUrl;
  let strictCorrectionApplied = false;

  // ── Double Arch plinth injection pass (2026-07-19) ───────────────────────
  // flux-2/flash/edit reliably paints the Single Arch plinth but refuses to
  // render ANY object between the two arches in the primary layout-reference
  // pass — 5 verification renders with a filled high-contrast guide marker
  // AND a PLINTH HARD LOCK prompt clause all came back plinth-less (a
  // fixed-seed compositional bias, matching the 8 historical failures from
  // 2026-07-12). The same model is however very good at adding a described
  // object to an existing photo, so the plinth is added in a dedicated small
  // edit pass on the primary render — the result is still fully AI-painted
  // with real scene lighting, shadows, and floor reflection, exactly like
  // Single Arch's plinth (per product request).
  //
  // 2026-09-03 — DISABLED, and this time not to save time but to save the
  // balloons. With the guide canvas fixed in v22, the Double Arch and Single
  // Arch layout guides are now pixel-for-pixel equivalent garlands (verified
  // by rendering both to PNG and comparing side by side: identical radii,
  // 26.5 / 41.7 / 80, identical lane structure). Single Arch still renders
  // beautifully from that guide and Double Arch still renders mushy, merged
  // sausages, so the defect cannot be in the guide or the garland code.
  //
  // The one structural difference left is round trips. With strict correction
  // now off, Single Arch is a single generation, while Double Arch runs this
  // second full generation on top of it. Its prompt says "preserve ... every
  // balloon exactly as they are", but a flux edit pass re-synthesises the
  // whole frame regardless — the exact mechanism already recorded for the
  // correction pass in buildStrictCorrectionPrompt, which "was flattening
  // balloons into solid flat-coloured discs while fixing their hue". Same
  // failure, different pass.
  //
  // If the plinth now goes missing, do NOT simply switch this back on and
  // accept the degraded balloons — composite it deterministically instead;
  // computeDoubleArchPlinthOverlayGeometry already exists for that, and the
  // doubleArchPlinthComposite* diagnostics are already wired up.
  const DOUBLE_ARCH_PLINTH_INJECTION_ENABLED = false;

  let plinthSourceUrl = imageUrl;
  let doubleArchPlinthInjectionApplied = false;
  if (DOUBLE_ARCH_PLINTH_INJECTION_ENABLED &&
      setupLayoutTemplateId === "double_arch" && sceneModel.plinths.length > 0) {
    const pl = sceneModel.plinths[0];
    const injectionPrompt =
      `Edit the existing photograph ONLY. Add exactly one cylindrical display plinth standing upright ` +
      `on the floor, centered in the gap between the two arch backdrop panels, slightly in front of them. ` +
      `It is a solid opaque matte white cylinder, ${pl.heightCm}cm tall and ${pl.diameterCm}cm in ` +
      `diameter — NOT glass, NOT transparent, NOT acrylic, not a box, not a podium, not a stage. ` +
      `Its base sits flat on the floor with a soft natural contact shadow, and it picks up the room's ` +
      `real lighting and a subtle floor reflection, matching the photograph's style exactly. ` +
      `If a white cylindrical plinth already stands between the arches, keep it exactly as is and add nothing. ` +
      `Change NOTHING else: preserve the camera angle, room, floor, lighting, both arch panels, their ` +
      `sizes and positions, and every balloon exactly as they are.`;
    try {
      const injResult = await fal.subscribe(resolvedEditModelId, {
        input: {
          prompt:        injectionPrompt,
          image_urls:    [imageUrl],
          image_size:    renderAspectRatio,
          seed:          FINAL_RENDER_SEED,
          output_format: "jpeg",
          // no negative_prompt: the shared negatives contain cylinder-shape
          // bans that would fight the very object this pass must add
        } as any,
        logs: true,
      });
      const jd   = injResult.data as Record<string, unknown>;
      const jArr = Array.isArray(jd?.["images"]) ? (jd["images"] as Record<string, unknown>[]) : null;
      const injUrl =
        (jArr?.[0]?.["url"] as string | undefined) ??
        ((jd?.["image"] as Record<string, unknown> | undefined)?.["url"] as string | undefined) ??
        (jd?.["url"] as string | undefined) ??
        null;
      if (injUrl) {
        plinthSourceUrl = injUrl;
        finalImageUrl   = injUrl;
        doubleArchPlinthInjectionApplied = true;
        if (process.env.NODE_ENV === "development") {
          console.log("[generate-controlled-render] double-arch plinth injection succeeded:", injUrl);
        }
      }
    } catch (injErr) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[generate-controlled-render] double-arch plinth injection failed:", String(injErr));
      }
    }
  }

  const isMaxEditModel = resolvedEditModelId === "fal-ai/flux-2-max/edit";
  const hasRoundPanelInRender = sceneModel.panels.some((p) => p.type === "round");

  // Round scenes: skip strict correction for now — primary render test.
  // Strict correction was damaging the primary render (plinth disappearing, color drift).
  // Arch and Sempertex-only scenes retain correction.
  const strictCorrectionSkippedReason: string | null = hasRoundPanelInRender
    ? "round_primary_test"
    : null;

  // 2026-09-03 — strict correction DISABLED as a speed experiment, per product
  // decision to cut render time. It is a second full image generation, so it
  // costs roughly a third of a Double Arch render's wall time.
  //
  // Two reasons it is the right pass to drop first. It is largely redundant:
  // the primary layout-reference prompt already carries the full BALLOON COLOR
  // LOCK with the exact Sempertex palette plus the paletteEnforcement
  // sentences, so the colours are locked before this pass ever runs. And it
  // has a recorded history of making things worse — see the 2026-09-01 note in
  // buildStrictCorrectionPrompt: this pass was itself flattening balloons into
  // solid flat-coloured discs while fixing their hue. Dropping it should help
  // the organic balloon look, not just the clock.
  //
  // TO REVERT: set this back to true. The whole correction block below is
  // intact and simply gated. Check the render diagnostics — if balloon colours
  // drift off-palette (silver going gold/bronze is the classic failure) with
  // `strictCorrectionApplied: false`, this flips back on.
  const STRICT_CORRECTION_ENABLED = false;

  const needsStrictCorrection =
    STRICT_CORRECTION_ENABLED &&
    !isMaxEditModel &&
    !skipStrictCorrection &&
    strictCorrectionSkippedReason === null &&
    (sempertexSelection?.length ?? 0) > 0;

  if (needsStrictCorrection) {
    const correctionPrompt = buildStrictCorrectionPrompt(
      effectiveSempertexSelection,
      {
        isRound: selectedBackdropTypes.includes("round"),
        hasPlinth: sceneModel.plinths.length > 0,
        roundDiameterCm: firstRoundDiag?.widthCm ?? 200,
        isDoubleArch: setupLayoutTemplateId === "double_arch",
      }
    );

    try {
      const correctionResult = await fal.subscribe(resolvedEditModelId, {
        input: {
          prompt:          correctionPrompt,
          negative_prompt: negativePrompt,
          image_urls:      [plinthSourceUrl],
          image_size:      renderAspectRatio,
          seed:            FINAL_RENDER_SEED,
          output_format:   "jpeg",
        } as any,
        logs: true,
      });

      const cd = correctionResult.data as Record<string, unknown>;
      const correctedImages = Array.isArray(cd?.["images"])
        ? (cd["images"] as Record<string, unknown>[])
        : null;

      const correctedUrl =
        (correctedImages?.[0]?.["url"] as string | undefined) ??
        ((cd?.["image"] as Record<string, unknown> | undefined)?.["url"] as string | undefined) ??
        (cd?.["url"] as string | undefined) ??
        null;

      if (correctedUrl) {
        finalImageUrl = correctedUrl;
        strictCorrectionApplied = true;

        if (process.env.NODE_ENV === "development") {
          console.log("[generate-controlled-render] strict correction succeeded:", correctedUrl);
        }
      }
    } catch (correctionErr) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[generate-controlled-render] strict correction failed:", String(correctionErr));
      }
    }
  }

  // ── Deterministic post-render composites ─────────────────────────────────
  // Order: AI final image → shimmer recolor → custom text composite → standee
  // overlay. Text sits behind standees. All stages share one working buffer.
  let outputImageUrl         = finalImageUrl;
  let workingImageBuf: Buffer | null = null;
  // Retried: a single transient "fetch failed" here silently costs the customer
  // their composited standees/text on an already-paid render (seen 2026-09-01),
  // because every composite stage falls back to the bare AI image.
  const fetchFinalImage = async (): Promise<Buffer | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(finalImageUrl);
        if (resp.ok) return Buffer.from(await resp.arrayBuffer());
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[generate-controlled-render] final image fetch attempt ${attempt + 1} failed:`, String(err));
        }
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    return null;
  };

  // ── Deterministic shimmer wall recolor ───────────────────────────────────
  // The AI model reliably renders a premium silver shimmer wall (shape, tile
  // density, and sequin texture all verified good) but does not reliably
  // apply a requested non-silver color via prompt text — prior testing in
  // this project showed forceful prompt wording and even negative-prompt
  // reinforcement made no visible difference to the rendered color. Instead
  // of touching the AI prompt/guide again, the selected shimmer color is
  // applied here as a deterministic, luminance-preserving tint over ONLY the
  // shimmer wall panel's own region (via sharp's built-in `.tint()`, which
  // replaces hue/chroma while preserving luminance — the sparkle/highlight
  // pattern is what carries the sequin texture, so it survives untouched).
  // Silver is a no-op (the AI's native silver render is the golden baseline
  // and is left completely untouched).
  //
  // v3: mask is PURE GEOMETRY (computeShimmerWallMaskGeometry) — no generous
  // padding, no texture-based width search. A v2 attempt padded the
  // geometric guess and searched for the true edge by pixel contrast; real
  // renders showed that leaked tint onto the background wall and — because a
  // plain rectangle has no notion of what's drawn in front of the panel —
  // onto the plinth too (some layouts place the plinth in front of the
  // shimmer wall's own footprint). This version uses the exact panel
  // geometry only, explicitly excludes known foreground objects (plinths,
  // and for arch_shimmer the shimmer-side accent balloon cluster, using
  // their own deterministic layout geometry) via an evenodd SVG mask, and
  // feathers just 1-2px at every mask edge (outer boundary and hole edges).
  let shimmerRecolorApplied    = false;
  let shimmerRecolorMethod     = "none";
  let shimmerMaskSource        = "none";
  let shimmerMaskFeatherPx     = 0;
  let shimmerRegionOnlyRecolor = false;
  const shimmerColorForRecolor = sceneModel.shimmerColor as ShimmerColorId | null;
  if (SHIMMER_RECOLOR_ENABLED && shimmerColorForRecolor && shimmerColorForRecolor !== "silver") {
    try {
      const maskGeometry = computeShimmerWallMaskGeometry(
        promptInputForAi.backdropItems ?? [],
        sceneModel.plinths.map((p) => p.size),
        (sceneModel.balloons.style ?? "none") as BalloonStyleId,
      );
      const baseBuf = maskGeometry ? await fetchFinalImage() : null;
      if (maskGeometry && baseBuf) {
        const sharpPkgSh = await import("sharp");
        const sharpFnSh  = ((sharpPkgSh as any).default ?? sharpPkgSh) as (b: Buffer) => any;
        const metaSh     = await sharpFnSh(baseBuf).metadata() as { width?: number; height?: number };
        const imgW = metaSh.width  ?? 1024;
        const imgH = metaSh.height ?? 1024;

        const toPx = (r: { xFrac: number; yFrac: number; wFrac: number; hFrac: number }) => ({
          x: Math.max(0, Math.round(r.xFrac * imgW)),
          y: Math.max(0, Math.round(r.yFrac * imgH)),
          w: Math.max(0, Math.round(r.wFrac * imgW)),
          h: Math.max(0, Math.round(r.hFrac * imgH)),
        });

        const panelPx = toPx(maskGeometry.panel);
        const excludeFracs = [...maskGeometry.excludeRects];
        // arch_shimmer only: also exclude the shimmer-side accent balloon
        // cluster, using the EXACT zone the guide actually drew it in (same
        // source values, not a re-derived approximation), so those balloons
        // are never tinted.
        if (pngResult.archShimmerAccentZone) {
          excludeFracs.push(panelRectToFraction(promptInputForAi.backdropItems ?? [], pngResult.archShimmerAccentZone));
        }

        if (panelPx.w > 4 && panelPx.h > 4) {
          const tintHex = SHIMMER_COLOR_HEX[shimmerColorForRecolor];
          const tintedRegion = await (sharpFnSh(baseBuf)
            .extract({ left: panelPx.x, top: panelPx.y, width: panelPx.w, height: panelPx.h })
            .tint(tintHex)
            .toBuffer()) as Buffer;

          // Panel-local holes, clamped to the panel's own extracted bounds.
          const holes: { x: number; y: number; w: number; h: number }[] = [];
          for (const ex of excludeFracs) {
            const exPx = toPx(ex);
            const x0 = Math.max(0, exPx.x - panelPx.x);
            const y0 = Math.max(0, exPx.y - panelPx.y);
            const x1 = Math.min(panelPx.w, exPx.x - panelPx.x + exPx.w);
            const y1 = Math.min(panelPx.h, exPx.y - panelPx.y + exPx.h);
            if (x1 > x0 && y1 > y0) holes.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          }

          // Evenodd path: outer panel rect minus each hole rect — genuinely
          // transparent (alpha 0) in hole areas, unlike drawing a "black"
          // rect (which would still be fully opaque and not mask anything).
          // Wrapped in a <g filter> so the 1-2px feather softens both the
          // outer boundary and every hole edge uniformly.
          const feather = 2;
          const holePath = holes
            .map((h) => `M${h.x},${h.y} H${h.x + h.w} V${h.y + h.h} H${h.x} Z`)
            .join(" ");
          const pathD = `M0,0 H${panelPx.w} V${panelPx.h} H0 Z ${holePath}`;
          const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${panelPx.w}" height="${panelPx.h}">` +
            `<defs><filter id="f" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${feather}"/></filter></defs>` +
            `<g filter="url(#f)"><path fill-rule="evenodd" fill="white" d="${pathD}"/></g>` +
            `</svg>`;
          const maskBuf = await sharpFnSh(Buffer.from(maskSvg)).png().toBuffer();
          const masked = await (sharpFnSh(tintedRegion)
            .composite([{ input: maskBuf, blend: "dest-in" }])
            .png()
            .toBuffer()) as Buffer;

          workingImageBuf = await (sharpFnSh(baseBuf)
            .composite([{ input: masked, left: panelPx.x, top: panelPx.y, blend: "over" }])
            .png()
            .toBuffer()) as Buffer;

          outputImageUrl = `data:image/jpeg;base64,${(await (sharpFnSh(workingImageBuf).jpeg({ quality: 92 }).toBuffer()) as Buffer).toString("base64")}`;
          shimmerRecolorApplied    = true;
          shimmerRecolorMethod     = "luminance_preserving_tint_geometry_mask_v3";
          shimmerMaskSource        = "layout_geometry";
          shimmerMaskFeatherPx     = feather;
          shimmerRegionOnlyRecolor = true;

          if (process.env.NODE_ENV === "development") {
            console.log("[generate-controlled-render] shimmer recolor applied:", shimmerColorForRecolor, tintHex,
              { panelPx, excludeCount: holes.length });
          }
        }
      }
    } catch (shimmerRecolorErr) {
      console.warn("[generate-controlled-render] shimmer recolor failed (keeping silver):", String(shimmerRecolorErr));
      workingImageBuf = null;
    }
  }

  // ── Guaranteed custom text composite ─────────────────────────────────────
  // Prompt + layout guide stay as soft signals; this composite guarantees the
  // exact text appears, styled to read as printed into the board material.
  let customTextCompositeApplied = false;
  let customTextCompositeValue: string | null = null;
  let customTextCompositeTargetPanelId: string | null = null;
  let customTextCompositePosition: { x: number; y: number } | null = null;
  let preTextCompositeImageUrl: string | null = null;

  // The edit model now paints the lettering itself, on the right board, in the
  // chosen font and colour (2026-09-03). This stage used to be how text got
  // into a render at all, but it draws only ONE panel's words and it draws
  // them over what the model already painted -- so a Double Arch came back
  // with the first board's text twice, the composited copy sitting slightly
  // high and leaving the model's own lettering showing underneath as a dark
  // smudge, while the second board's word was missing entirely because this
  // stage never handled it. Turned off; the code is kept in case the model
  // path ever needs to be backed out.
  const CUSTOM_TEXT_COMPOSITE_ENABLED = false;

  if (CUSTOM_TEXT_COMPOSITE_ENABLED && customizedTextSolidPanels.length > 0) {
    try {
      // Chain from the shimmer-recolored buffer when present (matches the
      // cutout-overlay stage below) — otherwise a prior shimmer recolor
      // would be silently discarded by a fresh fetch of the pre-recolor image.
      const baseBuf = workingImageBuf ?? await fetchFinalImage();
      if (baseBuf) {
        const sharpPkgT = await import("sharp");
        const sharpFnT  = ((sharpPkgT as any).default ?? sharpPkgT) as (b: Buffer) => any;
        const metaT     = await sharpFnT(baseBuf).metadata() as { width?: number; height?: number };
        const imgW      = metaT.width  ?? 1024;
        const imgH      = metaT.height ?? 1024;

        // Target: first solid panel with text (arch preferred by panel order).
        const targetPanel = customizedTextSolidPanels.find((p) => p.type === "arch") ?? customizedTextSolidPanels[0];
        const textValue   = targetPanel.text.value.trim();

        // Normalized panel anchor: single panel is centered; in 2-piece scenes
        // panels sit roughly at 30% / 70% of image width (mirrors the guide).
        const panelIdx = sceneModel.panels.findIndex((p) => p.id === targetPanel.id);
        const xFrac = sceneModel.panels.length <= 1 ? 0.50 : panelIdx === 0 ? 0.30 : 0.70;
        // Upper-middle of the arch face: arch spans ~20%..92% of image height.
        const yFrac = 0.40;
        const cx = Math.round(imgW * xFrac);
        const cy = Math.round(imgH * yFrac);

        const fillHex = resolveTextColorHex(targetPanel.text.color, "#EC4D8D");
        // Fit font to ~34% of image width for the string length, clamped.
        const safeLen  = Math.max(4, textValue.length);
        const fontSize = Math.max(18, Math.min(Math.round(imgW * 0.06), Math.round((imgW * 0.34) / safeLen * 1.9)));

        const esc = (s: string) => s
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
        const safeText = esc(textValue);

        // Printed-into-the-board look: soft blurred shadow only (never the main
        // text), main text at ~0.86 opacity so board texture shows through
        // faintly, plus a whisper-thin darker edge. No background rectangle.
        const textSvg =
          `<svg xmlns="http://www.w3.org/2000/svg" width="${imgW}" height="${imgH}" viewBox="0 0 ${imgW} ${imgH}">` +
          `<defs><filter id="softsh" x="-30%" y="-30%" width="160%" height="160%">` +
          `<feGaussianBlur stdDeviation="${Math.max(1.5, fontSize * 0.05)}"/></filter></defs>` +
          // Blurred contact shadow — grounds the print into the surface
          `<text x="${cx}" y="${cy + Math.round(fontSize * 0.06)}" text-anchor="middle" ` +
            `font-family="DejaVu Sans, Arial, sans-serif" font-weight="600" font-size="${fontSize}" ` +
            `fill="rgba(0,0,0,0.30)" filter="url(#softsh)">${safeText}</text>` +
          // Main lettering — slightly translucent so it reads as printed ink
          `<text x="${cx}" y="${cy}" text-anchor="middle" ` +
            `font-family="DejaVu Sans, Arial, sans-serif" font-weight="600" font-size="${fontSize}" ` +
            `fill="${fillHex}" fill-opacity="0.86" stroke="rgba(0,0,0,0.10)" stroke-width="0.6">${safeText}</text>` +
          `</svg>`;

        workingImageBuf = await (sharpFnT(baseBuf)
          .composite([{ input: Buffer.from(textSvg, "utf8"), blend: "over" }])
          .png()
          .toBuffer()) as Buffer;

        preTextCompositeImageUrl         = finalImageUrl;
        customTextCompositeApplied       = true;
        customTextCompositeValue         = textValue;
        customTextCompositeTargetPanelId = targetPanel.id;
        customTextCompositePosition      = { x: xFrac, y: yFrac };
        outputImageUrl = `data:image/jpeg;base64,${(await (sharpFnT(workingImageBuf).jpeg({ quality: 92 }).toBuffer()) as Buffer).toString("base64")}`;
      }
    } catch (textErr) {
      console.warn("[generate-controlled-render] custom text composite failed (continuing without):", String(textErr));
      workingImageBuf = null;
    }
  }

  // ── Lock the balloons to the selected palette ────────────────────────────
  // A second edit pass over the finished render that changes colour only.
  //
  // This replaces a pixel-level saturation boost that lived here for one
  // afternoon and was wrong: it amplified whatever tint a pixel already had,
  // so the faint warm cast on near-white balloons was pushed into visible
  // PINK — a colour in nobody's palette. Measured on the customer's scene, it
  // took blue from 9.3% to 22.4% but also produced 1.7% pink pixels, and it
  // could never recover Light Amethyst at all, because the render contained no
  // purple to amplify (0.0% lavender before and after).
  //
  // This pass, which the app already used for colour-only edits and which
  // produced the render the customer singled out as the one they wanted, does
  // what arithmetic cannot: it repaints balloons rather than stretching what is
  // there. Same scene, measured: blue 19.2%, lavender 8.4% (from nothing), and
  // zero pink. It costs one extra model call per render, which is the price of
  // the palette actually being the palette.
  let balloonColorLockPassApplied = false;
  if (effectiveBalloonHexColors.length > 0 && sceneModel.balloons.style !== "none") {
    try {
      const baseBuf = workingImageBuf ?? await fetchFinalImage();
      if (baseBuf) {
        const swatches = effectiveSempertexSelection.length > 0
          ? effectiveSempertexSelection.map((c) =>
              `${c.code}: ${c.hex} - ${renderSafeBalloonLabel(c)}`).join("; ")
          : effectiveBalloonHexColors.join("; ");
        const names = effectiveSempertexSelection.length > 0
          ? effectiveSempertexSelection.map((c) => renderSafeBalloonLabel(c)).join(", ")
          : effectiveBalloonHexColors.join(", ");
        const colourCount = effectiveSempertexSelection.length > 0
          ? effectiveSempertexSelection.length
          : effectiveBalloonHexColors.length;
        const lockPrompt =
          `Edit the existing render ONLY. Preserve the exact camera angle, room, floor, lighting, backdrop ` +
          `position, backdrop shape, backdrop scale, balloon arrangement, balloon shapes, balloon sizes, ` +
          `lettering and overall composition. Do NOT redesign or rearrange the setup. ` +
          `Recolor every balloon using ONLY the following selected Sempertex palette: ${swatches}. ` +
          `These are the ONLY allowed balloon colors. Use exactly these ${colourCount} balloon colors: ${names}. ` +
          `Every one of these colours must be clearly present and clearly distinguishable in the garland. ` +
          `Do not introduce any additional balloon color. Any balloon outside this list must be recolored to ` +
          `the nearest allowed palette colour. ` +
          `Forbidden balloon colors: pink, blush, rose, peach, coral, orange, terracotta, yellow, gold, bronze, ` +
          `copper, beige, cream, ivory, champagne, red, teal, turquoise, green, and any other non-selected tone. ` +
          `Overall balloon finish is mostly matte pastel with a soft satin sheen on silk and metallic colours; ` +
          `not glossy, not chrome, not mirror metallic. ` +
          `Keep the scene neutral and color-accurate: no warm tint, no creamy cast, no sepia, no haze, no ` +
          `filtering. Keep whites neutral white, not ivory and not cream. Preserve true pastel colour separation. ` +
          `Preserve the white cylindrical plinth exactly as it is, and do not add any extra plinth, riser, ` +
          `platform or base. Do not add any new object that was not already in the image.`;

        const lockResult = await fal.subscribe(editModelId, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input: {
            prompt:        lockPrompt,
            image_urls:    [`data:image/jpeg;base64,${baseBuf.toString("base64")}`],
            image_size:    renderAspectRatio,
            seed:          FINAL_RENDER_SEED,
            output_format: "jpeg",
          } as any,
          logs: false,
        });
        const ld   = lockResult.data as Record<string, unknown>;
        const larr = Array.isArray(ld?.["images"]) ? (ld["images"] as Record<string, unknown>[]) : null;
        const lurl = (larr?.[0]?.["url"] as string | undefined) ?? null;
        if (lurl) {
          const resp = await fetch(lurl);
          if (resp.ok) {
            workingImageBuf = Buffer.from(await resp.arrayBuffer());
            outputImageUrl  = lurl;
            balloonColorLockPassApplied = true;
          }
        }
      }
    } catch (lockErr) {
      // A failed colour pass must never lose the render that already succeeded.
      console.warn("[generate-controlled-render] balloon colour lock pass failed, keeping the primary render:", String(lockErr));
    }
  }


  // ── Recolour the rendered lettering ──────────────────────────────────────
  // The arch path (fal-ai/flux-2/flash/edit) paints the lettering BLACK no
  // matter what colour it is asked for. Verified 2026-09-04 on the customer
  // scene at a fixed seed: the guide drew the word in #5B2A86, the prompt
  // named it "deep purple" twice and forbade black explicitly, and the render
  // still came back black. (The round path, which runs a different model,
  // honours the colour — so this only ever has work to do on some scenes.)
  //
  // The model does place the lettering well, in the right font, printed into
  // the board with the scene lighting on it. So rather than compositing our
  // own flat text over the top — which is what used to be done, and which drew
  // the word twice — the model's own letters are recoloured in place. Their
  // shape, edges and shading are kept; only the hue changes.
  let textRecolourApplied = false;
  let textRecolourZones   = 0;
  const silhouetteTextZones = pngResult.textZones ?? [];
  if (silhouetteTextZones.length > 0) {
    try {
      const baseBuf = workingImageBuf ?? await fetchFinalImage();
      if (baseBuf) {
        const sharpPkgR = await import("sharp");
        const sharpFnR  = ((sharpPkgR as any).default ?? sharpPkgR) as (b: Buffer) => any;
        const metaR     = await sharpFnR(baseBuf).metadata() as { width?: number; height?: number };
        const imgW = metaR.width ?? 1024, imgH = metaR.height ?? 1024;
        const { data, info } = await (sharpFnR(baseBuf).ensureAlpha().raw()
          .toBuffer({ resolveWithObject: true })) as { data: Buffer; info: { width: number; height: number; channels: number } };
        const W = info.width, C = info.channels, Hh = info.height;
        // Neighbour tests must read the untouched render: recolouring in place
        // and then sampling the same buffer makes each new purple pixel look
        // like a balloon to the pixel beside it, which stopped the recolour a
        // few letters in.
        const orig = Buffer.from(data);

        for (const zone of silhouetteTextZones) {
          const target = zone.colorHex;
          const tr = parseInt(target.slice(1, 3), 16);
          const tg = parseInt(target.slice(3, 5), 16);
          const tb = parseInt(target.slice(5, 7), 16);
          // Black lettering is what the model produces and what a customer who
          // picked black already wanted, so leave those alone.
          if (0.299 * tr + 0.587 * tg + 0.114 * tb < 60) continue;

          // Padded well beyond the guide's own lettering: the model paints the
          // words about twice as wide as the guide draws them, and slightly
          // lower. The padding is safe because the tests below decide what is
          // ink, not the box.
          const f = panelRectToFraction(promptInput.backdropItems ?? [], {
            xMin: zone.xMin - 90, xMax: zone.xMax + 90,
            yMin: zone.yMin - 45, yMax: zone.yMax + 45,
          });
          const x0 = Math.max(0, Math.floor(f.xFrac * imgW));
          const x1 = Math.min(imgW, Math.ceil((f.xFrac + f.wFrac) * imgW));
          const y0 = Math.max(0, Math.floor(f.yFrac * imgH));
          const y1 = Math.min(imgH, Math.ceil((f.yFrac + f.hFrac) * imgH));
          let touched = 0;
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = (y * W + x) * C;
              const r = orig[i], g = orig[i + 1], b = orig[i + 2];
              const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              // Ink is dark and near-neutral. Measured on the reference render:
              // the lettering sits at 0.0-0.3 luminance, while the dark crevices
              // between balloons sit at 0.4-0.6, so 0.42 separates them.
              const chroma = Math.max(r, g, b) - Math.min(r, g, b);
              if (lum > 0.42 || chroma > 46) continue;
              // ...and it sits on the white board. The grey wall behind the
              // panel is dark and neutral too, but has no bright board beside
              // it (board ~0.80, wall ~0.50 on that render).
              let onBoard = false;
              for (let dx = -20; dx <= 20 && !onBoard; dx += 2) {
                const xx = x + dx; if (xx < 0 || xx >= W) continue;
                const j = (y * W + xx) * C;
                if ((0.299 * orig[j] + 0.587 * orig[j + 1] + 0.114 * orig[j + 2]) / 255 > 0.72) onBoard = true;
              }
              if (!onBoard) continue;
              // ...and not tucked inside the garland, where a coloured balloon
              // is always close by.
              let nearBalloon = false;
              for (let dy = -12; dy <= 12 && !nearBalloon; dy += 4) {
                for (let dx = -16; dx <= 16 && !nearBalloon; dx += 4) {
                  const xx = x + dx, yy = y + dy;
                  if (xx < 0 || xx >= W || yy < 0 || yy >= Hh) continue;
                  const j = (yy * W + xx) * C;
                  if (Math.max(orig[j], orig[j + 1], orig[j + 2]) - Math.min(orig[j], orig[j + 1], orig[j + 2]) > 30) nearBalloon = true;
                }
              }
              if (nearBalloon) continue;
              const a = Math.min(1, Math.max(0, (0.42 - lum) / 0.34));
              data[i]     = Math.round(r * (1 - a) + tr * a);
              data[i + 1] = Math.round(g * (1 - a) + tg * a);
              data[i + 2] = Math.round(b * (1 - a) + tb * a);
              touched++;
            }
          }
          if (touched > 0) { textRecolourZones++; }
        }

        if (textRecolourZones > 0) {
          const sharpRaw = sharpFnR as unknown as (b: Buffer, o: Record<string, unknown>) => any;
          workingImageBuf = await (sharpRaw(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
            .png().toBuffer()) as Buffer;
          outputImageUrl = `data:image/jpeg;base64,${(await (sharpFnR(workingImageBuf).jpeg({ quality: 92 }).toBuffer()) as Buffer).toString("base64")}`;
          textRecolourApplied = true;
        }
      }
    } catch (recolourErr) {
      console.warn("[generate-controlled-render] text recolour failed, keeping AI lettering:", String(recolourErr));
    }
  }

  // ── Deterministic cutout standee overlay ─────────────────────────────────
  // Character standees are suppressed in the AI prompt and composited here
  // instead, so quantity and placement are always exact.
  let cutoutOverlayApplied   = false;
  let cutoutOverlayCount     = 0;
  let cutoutOverlayHeightsCm: number[] = [];
  let cutoutOverlayAssetUsed = false;
  let cutoutOverlayAssetPaths: string[] = [];
  let cutoutOverlayRenderedAssetWidthPx:  number | null = null;
  let cutoutOverlayRenderedAssetHeightPx: number | null = null;
  let cutoutOverlayScaleReason: "height" | "width_cap" | "fallback" = "fallback";
  const standeeOverlayZonesUsed: string[] = [];

  if (cutoutGuideItems.length > 0) {
    try {
      // Standees composite on top of the text-composited image when present
      const imgBuf = workingImageBuf ?? await fetchFinalImage();
      if (imgBuf) {
        const sharpPkg2 = await import("sharp");
        const sharpFn2  = ((sharpPkg2 as any).default ?? sharpPkg2) as (b: Buffer) => any;
        const meta      = await sharpFn2(imgBuf).metadata() as { width?: number; height?: number };
        const imgW      = meta.width  ?? 1024;
        const imgH      = meta.height ?? 1024;

        const presetId = (cutouts as any)?.presetAssetId as string ?? "";

        // ── Try real PNG cutout assets first (multi-asset) ──────────────────
        // Each selected design loads its own public/cutouts/[themeId]/[assetId].png.
        const themeIdForAsset = String(selectedThemeId ?? "").toLowerCase();
        let composites: { input: Buffer; left?: number; top?: number; blend: "over" }[] = [];

        // Flatten: one entry per physical standee — tallest first, then by
        // selection order. Exact count only.
        const flattenedStandees: { assetId: string; heightCm: number; order: number }[] =
          resolvedCutoutOverlayItems.length > 0
            ? resolvedCutoutOverlayItems.flatMap((it, order) =>
                Array.from({ length: it.quantity }, () => ({ assetId: it.assetId, heightCm: it.heightCm, order })))
            : presetId
              ? cutoutGuideItems.flatMap((i) =>
                  Array.from({ length: i.quantity }, () => ({ assetId: presetId, heightCm: i.heightCm, order: 0 })))
              : [];
        flattenedStandees.sort((a, b) => b.heightCm - a.heightCm || a.order - b.order);

        const uniqueAssetIds = Array.from(new Set(flattenedStandees.map((s) => s.assetId)));
        const assetPathFor   = (assetId: string) =>
          path.join(process.cwd(), "public", "cutouts", themeIdForAsset, `${assetId}.png`);
        const allAssetsExist = uniqueAssetIds.length > 0 && themeIdForAsset &&
          uniqueAssetIds.every((id) => fs.existsSync(assetPathFor(id)));

        if (allAssetsExist) {
          try {
            // Load + trim each unique asset once. Trimming removes transparent
            // canvas padding so the visible artwork — not the PNG canvas — is
            // what gets scaled to the target height.
            const trimmedBufs = new Map<string, Buffer>();
            // Where the figure actually touches the floor, as a fraction across
            // its own width. The contact shadow used to be centred on the
            // bounding box, which put it beside the feet whenever the artwork is
            // asymmetric: the Elsa cape sweeps far to one side, so the dark
            // patch landed under the cape and she read as hovering (2026-09-04).
            const footCenterFracs = new Map<string, number>();
            for (const id of uniqueAssetIds) {
              const rawBuf = fs.readFileSync(assetPathFor(id));
              let buf: Buffer = rawBuf;
              try {
                buf = await (sharpFn2(rawBuf)
                  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
                  .png()
                  .toBuffer()) as Buffer;
              } catch (trimErr) {
                console.warn("[generate-controlled-render] asset trim failed, using original buffer:", String(trimErr));
                buf = rawBuf;
              }
              trimmedBufs.set(id, buf);
              try {
                const { data, info } = await (sharpFn2(buf).ensureAlpha().raw()
                  .toBuffer({ resolveWithObject: true })) as { data: Buffer; info: { width: number; height: number; channels: number } };
                const aw = info.width, ah = info.height, ac = info.channels;
                // Alpha-weighted centre of the bottom slice: the feet, hem or
                // base the figure actually stands on.
                const fromY = Math.max(0, ah - Math.max(2, Math.round(ah * 0.04)));
                let sum = 0, wsum = 0;
                for (let y = fromY; y < ah; y++) {
                  for (let x = 0; x < aw; x++) {
                    const a = data[(y * aw + x) * ac + 3];
                    if (a > 12) { sum += x * a; wsum += a; }
                  }
                }
                if (wsum > 0) footCenterFracs.set(id, sum / wsum / aw);
              } catch (footErr) {
                console.warn("[generate-controlled-render] foot centre scan failed, using bbox centre:", String(footErr));
              }
            }

            // Height is authoritative: a 150cm cutout beside a 200cm arch
            // should read as ~75% of the arch — approximated via image height.
            const heightFrac = (cm: number): number =>
              cm >= 150 ? 0.60 : cm >= 100 ? 0.42 : 0.26;
            // Per-size width caps — generous for large props (castle) so the
            // cap doesn't undo the height scaling.
            const widthCapFrac = (cm: number): number =>
              cm >= 150 ? 0.48 : cm >= 100 ? 0.38 : 0.28;
            // Large must not shrink below this height even when width-capped,
            // unless honoring it would crop the asset off-canvas.
            const minLargeH = Math.round(imgH * 0.54);

            const floorY   = Math.round(imgH * 0.92);
            let  rightEdge = Math.round(imgW * 0.99);

            // TRUE-SCALE placement (2026-07-20). Sizing a standee as a fraction
            // of the IMAGE made a 150cm figure read as tiny beside a 220cm arch
            // ("it shrank, it should be 150cm"), and anchoring its feet at a
            // fixed image fraction stood it in the foreground ("it's still in
            // front"). With the backdrop's own rect we scale the standee by the
            // real cm ratio (standeeCm / panelCm) and stand it on the SAME
            // floor line as the backdrop, just outside the panel edge.
            const groupGeom = computeBackdropGroupGeometry(
              promptInputForAi.backdropItems ?? [],
              sceneModel.plinths.map((p) => p.size),
            );
            const panelPxHeight = groupGeom
              ? Math.round((groupGeom.floorYFrac - groupGeom.apexYFrac) * imgH)
              : 0;

            // Locked standee zones from the setup layout template, keyed by size.
            const sizeKey = (cm: number): "large" | "medium" | "small" =>
              cm >= 150 ? "large" : cm >= 100 ? "medium" : "small";
            const zoneUseCount: Record<"large" | "medium" | "small", number> = { large: 0, medium: 0, small: 0 };

            for (const standee of flattenedStandees) {
              const cm       = standee.heightCm;
              const assetBuf = trimmedBufs.get(standee.assetId)!;
              // Zone lock: template zone overrides the generic fractions
              let zone: LayoutZone | null = null;
              let zoneIdx = 0;
              let zoneOverflow = 0;
              if (setupLayoutTemplate) {
                const key   = sizeKey(cm);
                const zones = setupLayoutTemplate.standeeZones[key];
                const used  = zoneUseCount[key];
                zoneIdx      = Math.min(used, zones.length - 1);
                zoneOverflow = Math.max(0, used - (zones.length - 1));
                zone         = zones[zoneIdx] ?? null;
                zoneUseCount[key] = used + 1;
              }

              // True-scale height wins when we know the backdrop rect: a 150cm
              // standee beside a 220cm arch is exactly 150/220 of the panel's
              // rendered height. The zone fraction stays as an upper bound so a
              // very tall panel can't push the figure off-canvas.
              const trueScaleH = groupGeom && panelPxHeight > 0
                ? Math.round(panelPxHeight * (cm / groupGeom.refHeightCm))
                : 0;
              const zoneCapH = Math.round(imgH * (zone ? zone.maxHeightFraction : heightFrac(cm)));
              const targetH  = trueScaleH > 0 ? Math.min(trueScaleH, Math.round(imgH * 0.92)) : zoneCapH;
              // Width is only capped when we have no true-scale reference —
              // capping a true-scale figure by width is what shrank it before.
              const maxW    = trueScaleH > 0
                ? imgW
                : Math.round(imgW * (zone ? zone.maxWidthFraction : widthCapFrac(cm)));
              let scaleReason: "height" | "width_cap" = "height";

              // Resize by height first, preserving aspect ratio and transparency
              let resizedBuf = await (sharpFn2(assetBuf).resize({ height: targetH }).png().toBuffer()) as Buffer;
              let rMeta      = await sharpFn2(resizedBuf).metadata() as { width?: number; height?: number };

              if ((rMeta.width ?? 0) > maxW) {
                // Width-capped: resize by width instead
                let cappedBuf  = await (sharpFn2(assetBuf).resize({ width: maxW }).png().toBuffer()) as Buffer;
                let cappedMeta = await sharpFn2(cappedBuf).metadata() as { width?: number; height?: number };

                // For large standees, don't let the cap collapse the height below
                // minLargeH — re-resize to the minimum height unless the resulting
                // width would be cropped off the canvas.
                //
                // 2026-07-20: this rescue used to run even when a template zone
                // was active, blowing a 150cm standee back up to 54% of the
                // image height and ~50% of its width — the standee then covered
                // the backdrop ("the character is still standing in front").
                // A zone's maxHeightFraction is a deliberate art-direction
                // choice, so the rescue is now skipped whenever a zone applies.
                if (!zone && cm >= 150 && (cappedMeta.height ?? 0) < minLargeH) {
                  const rescueBuf  = await (sharpFn2(assetBuf).resize({ height: minLargeH }).png().toBuffer()) as Buffer;
                  const rescueMeta = await sharpFn2(rescueBuf).metadata() as { width?: number; height?: number };
                  if ((rescueMeta.width ?? 0) <= imgW) {
                    cappedBuf  = rescueBuf;
                    cappedMeta = rescueMeta;
                  }
                }
                resizedBuf  = cappedBuf;
                rMeta       = cappedMeta;
                scaleReason = "width_cap";
              }

              const rw = rMeta.width  ?? targetH;
              const rh = rMeta.height ?? targetH;

              let left: number;
              let bottom: number;
              if (zone) {
                const onLeft = zone.preferredSide === "left";
                if (groupGeom) {
                  // Stand it on the backdrop's own floor line — same depth as
                  // the setup, so it no longer reads as a figure standing in
                  // the foreground. Horizontally it sits mostly outside the
                  // panel edge; a 150cm figure is wider than the free floor
                  // beside a 120cm arch in this framing, so a quarter of it may
                  // overlap the panel, exactly as a real standee placed next to
                  // a backdrop does.
                  const panelLeft  = Math.round(groupGeom.leftFrac  * imgW);
                  const panelRight = Math.round(groupGeom.rightFrac * imgW);
                  left   = onLeft
                    ? Math.round(panelLeft - rw * 0.75)
                    : Math.round(panelRight - rw * 0.25);
                  // groupGeom.floorYFrac is where the BACKDROP BOARDS meet the
                  // floor — the back plane. A standee stands in FRONT of the
                  // boards, at about the depth of the plinth, and the camera
                  // looks slightly down, so its feet belong lower in the image
                  // than that line. Landing them exactly on it is what made the
                  // figure hover above the floor (2026-09-03 Double Arch).
                  //
                  // How far lower was measured, not guessed: in seven renders
                  // the painted plinth base sat below the guide's floor line by
                  // 6.1 / 6.7 / 6.9 / 7.7% of panel height in the landscape
                  // Double Arch frame, and by 1.7 / 1.7 / 1.8% in the portrait
                  // Single Arch frame. The gap tracks the frame's aspect ratio
                  // (a wide frame shows more foreground floor, so the same
                  // physical step forward covers more pixels), so it is
                  // interpolated between those two measured points and clamped
                  // for the frames that were not measured.
                  const frameAspect  = imgW / imgH;
                  const forwardFrac  = Math.min(0.075, Math.max(0.015,
                    0.017 + 0.0623 * (frameAspect - 0.5625)));
                  // That interpolation puts an object at the depth of the
                  // PLINTH, which is where the backdrop's own floor line sits.
                  // A standee stands beside the setup, and the model piles
                  // balloons on the floor around the backdrop base, so at that
                  // exact depth the figure's feet disappear into the balloon
                  // pile and it reads as standing on the balloons rather than
                  // on the floor (customer report, 2026-09-04, Single Arch).
                  // It therefore stands a little further forward, onto the
                  // clear floor. Measured on that scene: the plinth base and
                  // the feet both landed at y=851 in a 576x1024 frame, while
                  // the bare floor in front of the balloons started around
                  // y=872 — which is this extra 3% of panel height.
                  const standeeForwardFrac = forwardFrac + 0.030;
                  bottom = Math.round(groupGeom.floorYFrac * imgH + panelPxHeight * standeeForwardFrac);
                  // A left-hand standee used to be clamped flush to x=0, which
                  // pushed the whole figure back over the board and buried the
                  // lettering (customer report, 2026-09-03: "the cutout needs to
                  // go further left so the text shows"). It is allowed to run off
                  // the left edge instead, the way a real standee at the edge of
                  // a photograph does, capped so no more than a quarter of it is
                  // ever lost.
                  const maxBleed = Math.round(rw * 0.25);
                  if (left < -maxBleed) left = -maxBleed;
                  if (left + rw > imgW + maxBleed) left = Math.max(-maxBleed, imgW + maxBleed - rw);
                } else {
                  const anchorX = Math.round(zone.x * imgW);
                  left   = onLeft ? anchorX : anchorX - rw;
                  bottom = Math.round(zone.bottomY * imgH);
                }
                // Extra instances of the same size step outward so they don't stack
                if (zoneOverflow > 0) {
                  const step = zoneOverflow * (rw + Math.round(imgW * 0.02));
                  left += onLeft ? -step : step;
                }
                standeeOverlayZonesUsed.push(`${sizeKey(cm)}[${zoneIdx}]:${zone.preferredSide ?? "right"}${groupGeom ? ":truescale" : ""}`);
              } else {
                // Generic fallback: step leftward from the right edge
                left   = rightEdge - rw;
                bottom = floorY;
              }
              // Left may be negative for an edge-bled standee (see above); only
              // the no-zone fallback path is clamped to the canvas.
              if (!zone) left = Math.max(0, Math.min(left, imgW - rw));
              const top = Math.max(0, bottom - rh);

              // Floor shadow under the asset. This used to be a single ellipse
              // as wide as the figure and very diffuse, which read as a haze on
              // the floor rather than as contact — the customer reported the
              // standee looking like it was hovering (2026-09-04). What sells
              // contact is a small, comparatively dark patch right where the
              // feet meet the floor, so there are now two: a wide soft ambient
              // pool, and a tight contact shadow inside it.
              const shW = Math.round(rw * 0.92);
              const shH = Math.max(10, Math.round(rw * 0.13));
              const ctW = Math.max(12, Math.round(rw * 0.42));
              const ctH = Math.max(6,  Math.round(rw * 0.05));
              // Foot position measured on the artwork, expressed inside the
              // ambient shadow box (which is narrower than the figure itself).
              const footFrac = footCenterFracs.get(standee.assetId) ?? 0.5;
              const ctCx     = Math.round(rw * footFrac - (rw - shW) / 2);
              const shadowSvg =
                `<svg xmlns="http://www.w3.org/2000/svg" width="${shW}" height="${shH}" viewBox="0 0 ${shW} ${shH}">` +
                `<defs><radialGradient id="sh" cx="50%" cy="50%" r="50%">` +
                `<stop offset="0%" stop-color="rgba(0,0,0,0.16)"/>` +
                `<stop offset="65%" stop-color="rgba(0,0,0,0.07)"/>` +
                `<stop offset="100%" stop-color="rgba(0,0,0,0)"/>` +
                `</radialGradient>` +
                `<radialGradient id="ct" cx="50%" cy="50%" r="50%">` +
                `<stop offset="0%" stop-color="rgba(0,0,0,0.45)"/>` +
                `<stop offset="55%" stop-color="rgba(0,0,0,0.26)"/>` +
                `<stop offset="100%" stop-color="rgba(0,0,0,0)"/>` +
                `</radialGradient></defs>` +
                `<ellipse cx="${shW / 2}" cy="${shH / 2}" rx="${shW / 2}" ry="${shH / 2}" fill="url(#sh)"/>` +
                `<ellipse cx="${ctCx}" cy="${shH / 2}" rx="${ctW / 2}" ry="${ctH / 2}" fill="url(#ct)"/>` +
                `</svg>`;
              // The shadow is cropped, not clamped, for the same reason the
              // figure is: clamping it to x=0 slides it out from under the feet
              // whenever the standee bleeds off the left edge.
              const shadowLeftRaw = left + Math.round((rw - shW) / 2);
              let shadowBuf  = await (sharpFn2(Buffer.from(shadowSvg, "utf8")).png().toBuffer()) as Buffer;
              let shadowLeft = shadowLeftRaw;
              if (shadowLeftRaw < 0) {
                const cut = Math.min(-shadowLeftRaw, shW - 1);
                shadowBuf = await (sharpFn2(shadowBuf)
                  .extract({ left: cut, top: 0, width: shW - cut, height: shH })
                  .png().toBuffer()) as Buffer;
                shadowLeft = 0;
              }
              composites.push({
                input: shadowBuf,
                left:  shadowLeft,
                top:   Math.max(0, (top + rh) - Math.round(shH / 2)),
                blend: "over",
              });

              // sharp cannot composite at a negative offset, so an edge-bled
              // standee is cropped rather than moved back onto the canvas —
              // moving it back is exactly the behaviour being fixed here.
              let placeBuf  = resizedBuf;
              let placeLeft = left;
              if (left < 0) {
                const cut = Math.min(-left, rw - 1);
                placeBuf  = await (sharpFn2(resizedBuf)
                  .extract({ left: cut, top: 0, width: rw - cut, height: rh })
                  .png().toBuffer()) as Buffer;
                placeLeft = 0;
              } else if (left + rw > imgW) {
                const visible = Math.max(1, imgW - left);
                placeBuf = await (sharpFn2(resizedBuf)
                  .extract({ left: 0, top: 0, width: visible, height: rh })
                  .png().toBuffer()) as Buffer;
              }
              composites.push({ input: placeBuf, left: placeLeft, top, blend: "over" });
              cutoutOverlayAssetPaths.push(`/cutouts/${themeIdForAsset}/${standee.assetId}.png`);
              // Report the first (tallest) asset's rendered dimensions
              if (cutoutOverlayRenderedAssetWidthPx === null) {
                cutoutOverlayRenderedAssetWidthPx  = rw;
                cutoutOverlayRenderedAssetHeightPx = rh;
                cutoutOverlayScaleReason           = scaleReason;
              }
              rightEdge = left - Math.round(imgW * 0.02);
            }
            cutoutOverlayAssetUsed = composites.length > 0;
          } catch (assetErr) {
            console.warn("[generate-controlled-render] cutout asset load failed (falling back to placeholder SVG):", String(assetErr));
            composites = [];
            cutoutOverlayAssetPaths = [];
            cutoutOverlayAssetUsed  = false;
            cutoutOverlayRenderedAssetWidthPx  = null;
            cutoutOverlayRenderedAssetHeightPx = null;
            cutoutOverlayScaleReason           = "fallback";
            standeeOverlayZonesUsed.length     = 0;
          }
        }

        // ── Fallback: placeholder SVG when no real asset is available ───────
        if (!cutoutOverlayAssetUsed) {
          const overlaySvg = buildStandeeOverlaySvg(cutoutGuideItems, imgW, imgH, presetId);
          composites = [{ input: Buffer.from(overlaySvg, "utf8"), blend: "over" }];
        }

        const compBuf = await (sharpFn2(imgBuf)
          .composite(composites)
          .jpeg({ quality: 92 })
          .toBuffer()) as Buffer;

        // Persist to workingImageBuf too — not just outputImageUrl — so any
        // later compositing stage (e.g. the Double Arch plinth overlay
        // below) chains from this result instead of silently discarding it
        // by re-fetching the pre-cutout image via fetchFinalImage().
        workingImageBuf         = compBuf;
        outputImageUrl         = `data:image/jpeg;base64,${compBuf.toString("base64")}`;
        cutoutOverlayApplied   = true;
        cutoutOverlayHeightsCm = cutoutGuideItems.flatMap(i => Array<number>(i.quantity).fill(i.heightCm));
        cutoutOverlayCount     = cutoutOverlayHeightsCm.length;
        if (process.env.NODE_ENV === "development") {
          console.log("[generate-controlled-render] cutout overlay applied, standees:", cutoutOverlayCount, "assetUsed:", cutoutOverlayAssetUsed, "compBytes:", compBuf.length);
        }
      }
    } catch (overlayErr) {
      console.warn("[generate-controlled-render] cutout overlay failed (falling back to AI render):", String(overlayErr));
    }
  }

  // ── Deterministic Double Arch plinth composite (re-enabled 2026-07-19) ───
  // See the DOUBLE_ARCH_PLINTH_COMPOSITE_ENABLED comment near the top of
  // this file for the full history (AI plinth unreliable → v1 overlay
  // rejected as clipart → v2 overlay below with photo-real shading).
  // AI-side suppression (aiFacingHasPlinths in buildNegativePrompt.ts,
  // plinthDesc/noPlinthDesc in buildLayoutRefEditPrompt.ts) stays fully
  // active either way, since that's what stops the AI's own glass/ghost
  // plinth attempts from doubling up with this overlay.
  let doubleArchPlinthCompositeApplied  = false;
  let doubleArchPlinthCompositeMethod   = "none";
  let doubleArchPlinthCompositePosition: { x: number; y: number } | null = null;
  let doubleArchPlinthOverlayWidthPx:  number | null = null;
  let doubleArchPlinthOverlayHeightPx: number | null = null;
  // 2026-07-19: the plinth is AI-rendered for Double Arch again (same path
  // as Single Arch — guide marker + prompt clause), so nothing is
  // suppressed anymore. These fields stay for API stability and now always
  // read false/null; doubleArchPlinthAiRendered in diagInfo reports the
  // active mechanism.
  const doubleArchPlinthAiSuppressed = false;
  const doubleArchPlinthRenderSuppressed = false;
  const doubleArchPlinthSuppressionReason: string | null = null;

  if (DOUBLE_ARCH_PLINTH_COMPOSITE_ENABLED && setupLayoutTemplateId === "double_arch" && sceneModel.plinths.length > 0) {
    try {
      const plinthGeometry = computeDoubleArchPlinthOverlayGeometry(
        promptInputForAi.backdropItems ?? [],
        sceneModel.plinths.map((p) => p.size),
      );
      const baseBuf = plinthGeometry ? (workingImageBuf ?? await fetchFinalImage()) : null;

      if (plinthGeometry && baseBuf) {
        const sharpPkgP = await import("sharp");
        const sharpFnP  = ((sharpPkgP as any).default ?? sharpPkgP) as (b: Buffer, opts?: Record<string, unknown>) => any;
        const metaP     = await sharpFnP(baseBuf).metadata() as { width?: number; height?: number };
        const imgW = metaP.width  ?? 1024;
        const imgH = metaP.height ?? 1024;

        const px = {
          x: Math.round(plinthGeometry.xFrac * imgW),
          y: Math.round(plinthGeometry.yFrac * imgH),
          w: Math.round(plinthGeometry.wFrac * imgW),
          h: Math.round(plinthGeometry.hFrac * imgH),
        };

        if (px.w > 2 && px.h > 8) {
          const cx      = px.x + px.w / 2;
          const rx      = px.w / 2;
          // v2: flatter end caps (0.28 vs v1's 0.42) — matches the near-eye-
          // level photo perspective of the rendered scene; the steep v1
          // ellipse was a big part of the "clipart" read.
          const ryTop   = Math.max(2, Math.round(rx * 0.28));
          const topY    = px.y;
          const bottomY = px.y + px.h;
          const shadowRx = rx * 1.5;
          const shadowRy = Math.max(3, Math.round(ryTop * 1.1));

          // v2 shading (see DOUBLE_ARCH_PLINTH_COMPOSITE_ENABLED comment):
          // left-lit horizontal gradient (matches the scene's "soft natural
          // light from the left") + a vertical ambient-occlusion overlay
          // (subtly darker toward the floor) + a narrow left rim-light band
          // and right core-shadow band for cylindrical roundness + a soft
          // contact shadow biased slightly right (opposite the light).
          // Everything is fully opaque paint — no glass-coded translucency.
          const rimW  = Math.max(1.5, rx * 0.16);
          const coreW = Math.max(2, rx * 0.30);
          const plinthSvg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${imgW}" height="${imgH}" viewBox="0 0 ${imgW} ${imgH}">` +
            `<defs>` +
              `<linearGradient id="pbody" x1="0%" y1="0%" x2="100%" y2="0%">` +
                `<stop offset="0%" stop-color="#FDFDFC"/>` +
                `<stop offset="38%" stop-color="#F7F5F2"/>` +
                `<stop offset="78%" stop-color="#E7E2DB"/>` +
                `<stop offset="100%" stop-color="#D8D2C9"/>` +
              `</linearGradient>` +
              `<linearGradient id="pao" x1="0%" y1="0%" x2="0%" y2="100%">` +
                `<stop offset="0%" stop-color="rgba(0,0,0,0)"/>` +
                `<stop offset="70%" stop-color="rgba(0,0,0,0.03)"/>` +
                `<stop offset="100%" stop-color="rgba(60,50,40,0.12)"/>` +
              `</linearGradient>` +
              `<linearGradient id="pbottom" x1="0%" y1="0%" x2="100%" y2="0%">` +
                `<stop offset="0%" stop-color="#EAE6E0"/>` +
                `<stop offset="55%" stop-color="#DDD7CF"/>` +
                `<stop offset="100%" stop-color="#C9C2B8"/>` +
              `</linearGradient>` +
              `<radialGradient id="ptop" cx="36%" cy="34%" r="80%">` +
                `<stop offset="0%" stop-color="#FFFFFF"/>` +
                `<stop offset="70%" stop-color="#F3F0EB"/>` +
                `<stop offset="100%" stop-color="#E4DFD7"/>` +
              `</radialGradient>` +
              `<filter id="pshadow" x="-80%" y="-80%" width="260%" height="260%">` +
                `<feGaussianBlur stdDeviation="${Math.max(3, rx * 0.30).toFixed(1)}"/>` +
              `</filter>` +
              `<filter id="pband" x="-50%" y="-10%" width="200%" height="120%">` +
                `<feGaussianBlur stdDeviation="${Math.max(1, rx * 0.10).toFixed(1)}"/>` +
              `</filter>` +
            `</defs>` +
            // Soft floor contact shadow — biased right, opposite the left light
            `<ellipse cx="${(cx + rx * 0.28).toFixed(1)}" cy="${(bottomY + shadowRy * 0.25).toFixed(1)}" rx="${shadowRx.toFixed(1)}" ry="${shadowRy.toFixed(1)}" fill="rgba(20,18,15,0.32)" filter="url(#pshadow)"/>` +
            // Bottom cap BEFORE the body — only its lower bulge stays visible
            // below the body rect, the curved front bottom edge of a real
            // opaque cylinder. (v2 initially painted the full ellipse on top
            // of the body; its upper arc showing through inside the body
            // read as a faint frosted-glass cue.)
            `<ellipse cx="${cx.toFixed(1)}" cy="${bottomY.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ryTop.toFixed(1)}" fill="url(#pbottom)"/>` +
            // Cylinder body — horizontal light gradient
            `<rect x="${(cx - rx).toFixed(1)}" y="${topY.toFixed(1)}" width="${(rx * 2).toFixed(1)}" height="${px.h.toFixed(1)}" fill="url(#pbody)"/>` +
            // Vertical ambient occlusion over the body
            `<rect x="${(cx - rx).toFixed(1)}" y="${topY.toFixed(1)}" width="${(rx * 2).toFixed(1)}" height="${px.h.toFixed(1)}" fill="url(#pao)"/>` +
            // Left rim light + right core shadow — cylindrical roundness cues
            `<rect x="${(cx - rx + rimW * 0.3).toFixed(1)}" y="${(topY + ryTop).toFixed(1)}" width="${rimW.toFixed(1)}" height="${(px.h - ryTop).toFixed(1)}" fill="rgba(255,255,255,0.55)" filter="url(#pband)"/>` +
            `<rect x="${(cx + rx - coreW * 1.35).toFixed(1)}" y="${(topY + ryTop).toFixed(1)}" width="${coreW.toFixed(1)}" height="${(px.h - ryTop).toFixed(1)}" fill="rgba(90,80,70,0.13)" filter="url(#pband)"/>` +
            // Top cap — brightest surface, drawn last
            `<ellipse cx="${cx.toFixed(1)}" cy="${topY.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ryTop.toFixed(1)}" fill="url(#ptop)" stroke="rgba(0,0,0,0.04)" stroke-width="0.5"/>` +
            `</svg>`;

          workingImageBuf = await (sharpFnP(baseBuf)
            .composite([{ input: Buffer.from(plinthSvg, "utf8"), blend: "over" }])
            .png()
            .toBuffer()) as Buffer;
          outputImageUrl = `data:image/jpeg;base64,${(await (sharpFnP(workingImageBuf).jpeg({ quality: 92 }).toBuffer()) as Buffer).toString("base64")}`;

          doubleArchPlinthCompositeApplied  = true;
          doubleArchPlinthCompositeMethod   = "sharp_svg_cylinder_overlay_v2";
          doubleArchPlinthCompositePosition = {
            x: plinthGeometry.xFrac + plinthGeometry.wFrac / 2,
            y: plinthGeometry.yFrac + plinthGeometry.hFrac / 2,
          };
          doubleArchPlinthOverlayWidthPx  = px.w;
          doubleArchPlinthOverlayHeightPx = px.h;

          if (process.env.NODE_ENV === "development") {
            console.log("[generate-controlled-render] double arch plinth composite applied:", { px });
          }
        }
      }
    } catch (plinthCompositeErr) {
      console.warn("[generate-controlled-render] double arch plinth composite failed (continuing without):", String(plinthCompositeErr));
    }
  }

  const extra = {
    mode: "first_generate",
    renderMode: "first_generate_layout_reference_edit",
    referenceUsed: true,
    referenceVersion: "clean-layout-reference-v1",
    modelId: editModelId,
    fallbackUsed: false,
    strictCorrectionApplied,
    strictCorrectionSkippedReason,
    doubleArchPlinthInjectionApplied,
    actualRenderPath: strictCorrectionApplied
      ? "first_generate_layout_reference_edit_with_strict_correction"
      : "first_generate_layout_reference_edit",
    actualEditModelId:          editModelId,
    actualFirstGenerateModelId: editModelId,
    primaryLayoutReferenceImageUrl: imageUrl,
    preOverlayImageUrl: finalImageUrl,
    customTextCompositeApplied,
    customTextCompositeValue,
    customTextCompositeTargetPanelId,
    customTextCompositePosition,
    preTextCompositeImageUrl,
    balloonColorLockPassApplied,
    textRecolourApplied,
    textRecolourZones,
    cutoutOverlayApplied,
    cutoutOverlayCount,
    cutoutOverlayHeightsCm,
    cutoutOverlayAssetUsed,
    cutoutOverlayAssetPaths,
    cutoutOverlayRenderedAssetWidthPx,
    cutoutOverlayRenderedAssetHeightPx,
    cutoutOverlayScaleReason,
    // Double Arch plinth diagnostics (2026-07-12, composite disabled
    // 2026-07-13). AiSuppressed is true whenever the scene is double_arch
    // (plinth or not) since the AI-facing prompt/guide suppression is
    // unconditional for that layout — this stays on regardless of the
    // composite flag. CompositeApplied/Method/Position/OverlayWidthPx/
    // OverlayHeightPx are the deterministic-SVG-overlay diagnostics; with
    // DOUBLE_ARCH_PLINTH_COMPOSITE_ENABLED=false they always report
    // false/"none"/null now — the SVG cylinder looked like pasted clipart,
    // rejected for production. RenderSuppressed/SuppressionReason are the
    // current, accurate picture: no plinth shown in the final render at all
    // when one is configured, until a realistic asset-based overlay exists.
    doubleArchPlinthAiSuppressed,
    doubleArchPlinthRenderSuppressed,
    doubleArchPlinthSuppressionReason,
    doubleArchPlinthCompositeApplied,
    doubleArchPlinthCompositeMethod,
    doubleArchPlinthCompositePosition,
    doubleArchPlinthOverlayWidthPx,
    doubleArchPlinthOverlayHeightPx,
    standeeZoneLockApplied: !!setupLayoutTemplate && standeeOverlayZonesUsed.length > 0,
    standeeOverlayZonesUsed,
    layoutReferencePngGenerated: true,
    layoutReferencePngBytes: pngResult.bytes,
    layoutReferencePrefix: pngResult.dataUri.slice(0, 40),
    // Double Arch dense garland guide diagnostics
    doubleArchDenseGarlandGuideApplied:      pngResult.doubleArchGarlandBalloonsLeft > 0,
    doubleArchGarlandGuideBalloonCountLeft:  pngResult.doubleArchGarlandBalloonsLeft,
    doubleArchGarlandGuideBalloonCountRight: pngResult.doubleArchGarlandBalloonsRight,
    // Arch + Open Frame dense garland guide diagnostics
    archOpenFrameDenseGarlandGuideApplied:      pngResult.archOpenFrameMainGarlandBalloons > 0,
    archOpenFrameMainGarlandGuideBalloonCount:  pngResult.archOpenFrameMainGarlandBalloons,
    archOpenFrameMiniClusterGuideBalloonCount:  pngResult.archOpenFrameMiniClusterBalloons,
    archOpenFrameMainGarlandMinRadiusPx:        pngResult.archOpenFrameMainGarlandMinRadiusPx,
    archOpenFrameMainGarlandMaxRadiusPx:        pngResult.archOpenFrameMainGarlandMaxRadiusPx,
    archOpenFrameMainGarlandLaneCount:          pngResult.archOpenFrameMainGarlandLaneCount,
    archOpenFrameMainGarlandStyle:              pngResult.archOpenFrameMainGarlandStyle,
    // Arch + Open Frame geometry diagnostics (thick decor-prop frame fix)
    archOpenFrameFrameThicknessPx: pngResult.archOpenFrameFrameThicknessPx,
    archOpenFrameGeometryStyle:    pngResult.archOpenFrameGeometryStyle,
    // Arch + Shimmer composition guide diagnostics — confirms the structural
    // guide (arch-side dense garland + shimmer-side accent, no bridge)
    // actually drew.
    archShimmerCompositionGuideApplied: pngResult.archShimmerCompositionBalloons > 0,
    archShimmerCompositionBalloonCount: pngResult.archShimmerCompositionBalloons,
    // Deterministic shimmer wall recolor diagnostics — confirms whether the
    // post-render tint (not the AI prompt) actually applied a non-silver
    // shimmer color, via which method/mask/feather.
    shimmerRecolorApplied,
    shimmerRecolorMethod,
    shimmerMaskSource,
    shimmerMaskFeatherPx,
    shimmerRegionOnlyRecolor,
  };

  renderCache.set(cacheKey, { imageUrl: outputImageUrl, diagInfo, extra });
  const devExtras = process.env.NODE_ENV === "development" ? { layoutReferenceDataUri: pngResult.dataUri } : {};
  return NextResponse.json({ imageUrl: outputImageUrl, ...extra, ...diagInfo, ...devExtras, cacheHit: false });
}
        fallbackReason       = "fal edit returned no image url";
        fallbackStage        = "fal-edit-no-url";
        fallbackErrorMessage = `response keys: ${Object.keys(d).join(", ")}`;
        console.warn("[generate-controlled-render] edit returned no image, falling back:", fallbackErrorMessage);
      } catch (editErr) {
        const isTimeout = abortController.signal.aborted;
        fallbackReason       = isTimeout ? "fal edit timed out" : "fal edit threw";
        fallbackStage        = "fal-edit-error";
        fallbackErrorMessage = String(editErr);
        console.error("[generate-controlled-render] edit failed, falling back:", fallbackErrorMessage);
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    // ── Decide whether the T2I fallback may run at all ──────────────────────
    // Inaccurate fallback renders (no layout reference) are worse than an
    // explicit error for this configurator, so we gate hard before calling it.
    const isGeometryCriticalScene =
      sceneModel.panels.some((p) => p.type === "round") ||
      sceneModel.panels.some((p) => p.type === "arch") ||
      sceneModel.plinths.length > 0;
    const authOrBillingError = isAuthOrBillingError(fallbackErrorMessage);
    const t2iAllowed         = isT2IFallbackAllowed();

    if (authOrBillingError || !t2iAllowed || isGeometryCriticalScene) {
      const fallbackSkipReason = authOrBillingError
        ? "auth_or_billing_error"
        : !t2iAllowed
          ? "fallback_disabled"
          : "geometry_critical_scene";
      console.error("[generate-controlled-render] T2I fallback skipped:", fallbackSkipReason, fallbackErrorMessage);
      return NextResponse.json({
        ok:                 false,
        error:              "render_failed",
        userMessage:        "AI render could not be generated. Please try again or check fal.ai credits/model access.",
        fallbackUsed:       false,
        fallbackSkipped:    true,
        fallbackSkipReason,
        fallbackReason,
        fallbackStage,
        fallbackErrorMessage,
        referenceUsed:      false,
        modelId:            editModelId,
        actualRenderPath:           "render_failed_no_fallback",
        actualEditModelId:          editModelId,
        actualFirstGenerateModelId: null,
        ...diagInfo,
        cacheHit:           false,
      }, { status: 502 });
    }

    // ── Fallback: pure text-to-image ────────────────────────────────────────
    const t2iModelId  = getT2IModelId(modelMode);
    const t2iEndpoint = getT2IEndpoint(modelMode);
    if (process.env.NODE_ENV === "development") {
      console.log(`[generate-controlled-render] → calling ${t2iModelId} (text-to-image fallback)`);
      console.log("[generate-controlled-render] prompt:", finalPrompt);
      console.log("[generate-controlled-render] negative:", negativePrompt);
    }

    const falRes = await fetch(t2iEndpoint, {
      method:  "POST",
      headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt:          finalPrompt,
        negative_prompt: negativePrompt,
        image_size:      renderAspectRatio,
        output_format:   "jpeg",
        num_images:      1,
        seed:            FINAL_RENDER_SEED,
      }),
    });

    if (!falRes.ok) {
      const detail = await falRes.text();
      return NextResponse.json({ error: "Final render failed", detail }, { status: 502 });
    }

    const result   = await falRes.json();
    const imageUrl = result?.images?.[0]?.url as string | undefined;
    if (!imageUrl) return NextResponse.json({ error: "No image returned", result }, { status: 502 });

    const t2iExtra = {
      mode:             "first_generate",
      renderMode:       "first_generate_text_to_image_fallback",
      referenceUsed:    false,
      referenceVersion: null,
      modelId:          t2iModelId,
      fallbackUsed:     true,
      fallbackReason,
      fallbackStage,
      fallbackErrorMessage,
      actualRenderPath:           "first_generate_text_to_image_fallback",
      actualEditModelId:          null,
      actualFirstGenerateModelId: t2iModelId,
      layoutReferencePngGenerated: pngResult.dataUri !== null,
      layoutReferencePngBytes:     pngResult.bytes,
      layoutReferencePrefix:       pngResult.dataUri ? pngResult.dataUri.slice(0, 40) : null,
    };
    renderCache.set(cacheKey, { imageUrl, diagInfo, extra: t2iExtra });
    return NextResponse.json({ imageUrl, ...t2iExtra, ...diagInfo, cacheHit: false });

  } catch (err) {
    return NextResponse.json({ error: "Unexpected error", detail: String(err) }, { status: 500 });
  }
}
