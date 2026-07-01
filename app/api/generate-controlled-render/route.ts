/**
 * Controlled Final Design Render pipeline.
 *
 * Visible Production Layout Preview is NOT used as visual style reference for AI.
 * AI receives a hidden structure control map only — and for first_generate, structure
 * comes entirely from the text prompt (no image_url is passed so the model generates
 * a photorealistic scene from scratch guided by detailed panel/plinth/balloon descriptions).
 *
 * first_generate → fal-ai/flux-2-pro (text-to-image, photorealistic, no image_url)
 * edit_existing  → fal-ai/flux-pro/kontext (img2img on the previous beautiful render)
 *
 * Production Layout Preview and future export package use scene state as source
 * of truth. AI render is a visual preview, not the production measurement source.
 *
 * TODO: Small visual edits should use fal-ai/flux-pro/kontext with
 * currentFinalRenderUrl as image_url to preserve venue, camera, light,
 * balloons, and composition.
 */

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import {
  generatePrompt,
  type PromptInput,
} from "@/lib/generatePrompt";
import { type SceneModel } from "@/lib/buildSceneModel";
import { type FalImageSize } from "@/lib/calculateRenderAspectRatio";
import { generateStructureSilhouette } from "@/lib/generateStructureSilhouette";
import { type BalloonStyleId } from "@/lib/config";
import { SEMPERTEX_CATALOG, type SempertexColor } from "@/lib/sempertexCatalog";
import { THEME_CATALOG } from "@/lib/themeCatalog";
import { type SempertexSelectionItem } from "@/lib/renderPrompts/types";
import { getVisualLabel } from "@/lib/renderPrompts/colorLabels";
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
const RENDER_CACHE_VERSION = "backdrop-color-graphic-v1";

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
      `in ${fontDesc} style, ${p.text.color} color, centered. ` +
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
): Promise<LayoutRefPngResult> {
  // Stage 1: SVG generation — derive plinth sizes from sceneModel for type safety
  let silhouette: ReturnType<typeof generateStructureSilhouette>;
  try {
    silhouette = generateStructureSilhouette(
      promptInput.backdropItems ?? [],
      sceneModel.plinths.map((p) => p.size),
      (sceneModel.balloons.style ?? "none") as BalloonStyleId,
      selectedHexColors.length > 0
        ? selectedHexColors
        : sceneModel.balloons.colors.length > 0
          ? sceneModel.balloons.colors
          : promptInput.balloonColors,
    );
  } catch (err) {
    const msg = String(err);
    console.error("[generate-controlled-render] SVG generation failed:", msg);
    return { dataUri: null, error: msg, stage: "svg-generation", bytes: null };
  }

  // Stage 2: sharp import — direct dynamic import so webpack/Vercel can trace and bundle it
  let sharpMod: (buf: Buffer) => { png(): { toBuffer(): Promise<Buffer> } };
  try {
    const sharpPkg = await import("sharp");
    sharpMod = (sharpPkg.default ?? sharpPkg) as typeof sharpMod;
  } catch (err) {
    const msg = String(err);
    console.error("[generate-controlled-render] sharp import failed:", msg);
    return { dataUri: null, error: msg, stage: "sharp-import", bytes: null };
  }

  // Stage 3: rasterize SVG → PNG
  try {
    const svgBuffer = Buffer.from(silhouette.svg, "utf8");
    const pngBuffer = await sharpMod(svgBuffer).png().toBuffer() as Buffer;
    const dataUri   = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    console.log("[generate-controlled-render] layout reference PNG ready, bytes:", pngBuffer.length);
    return { dataUri, error: null, stage: null, bytes: pngBuffer.length };
  } catch (err) {
    const msg = String(err);
    console.error("[generate-controlled-render] rasterization failed:", msg);
    return { dataUri: null, error: msg, stage: "rasterization", bytes: null };
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

const selectedBackdropGraphicAssetId = (promptInput.backdropItems ?? []).find(
  (item) => item.graphic?.enabled && item.graphic?.theme
)?.graphic?.theme ?? null;

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
let resolvedEditModelId = getEditModelId(modelMode);

if (hasArchPanelInScene && !hasRoundPanelInScene) {
  resolvedEditModelId = "fal-ai/flux-2/flash/edit";
} else if (hasRoundPanelInScene) {
  resolvedEditModelId = "fal-ai/flux-2/edit";
}

const editModelId = resolvedEditModelId;

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
  const diagInfo = {
  selectedPlinthSize:       firstPlinthDiag?.size       ?? null,
  resolvedPlinthHeightCm:   firstPlinthDiag?.heightCm   ?? null,
  resolvedPlinthDiameterCm: firstPlinthDiag?.diameterCm ?? null,

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
  ? ["teal", "turquoise", "blue", "orange", "coral", "copper", "bronze", "dark gold", "saturated red", "rainbow colors"]
  : [],

  // Layout-reference guide diagnostics
  layoutGuideBalloonColors:                 effectiveBalloonHexColors,
  layoutGuideBalloonColorMode,
  roundPrimaryPromptColorOverrideApplied:   hasRoundPanelInScene && effectiveBalloonHexColors.length > 0,
  roundHalfGarlandGuideApplied:             hasRoundPanelInScene && sceneModel.balloons.style === "half",
  plinthGuideProtected:                     sceneModel.plinths.length > 0,

  // Theme catalog diagnostics
  selectedThemeId,
  selectedThemePaletteIds:    themeEntry?.sempertexPaletteIds ?? [],
  missingThemePalette,
  missingThemePaletteId,
  selectedBackdropGraphicAssetId,
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

      const extra = { mode: "edit_existing", modelId: editModelId, fallbackUsed: false };
      renderCache.set(cacheKey, { imageUrl, diagInfo, extra });
      return NextResponse.json({ imageUrl, ...extra, ...diagInfo, cacheHit: false });
    }

    // ── First generate ─────────────────────────────────────────────────────────
    // Text is a frontend overlay — strip all panel text before building the AI prompt.
    const renderTextInAi = false as const;

    const promptInputForAi: typeof promptInput = {
      ...promptInput,
      backdropText: promptInput.backdropText
        ? { ...promptInput.backdropText, enabled: false, name: "", customText: "" }
        : undefined,
      backdropItems: promptInput.backdropItems?.map((item) => ({
        ...item,
        text: { ...item.text, enabled: false, value: "" },
      })),
    };

    const { prompt: basePrompt } = generatePrompt(promptInputForAi);
    const finalPrompt            = buildFirstGenPrompt(sceneModel, basePrompt, promptInputForAi);
    const negativePrompt         = buildNegativePrompt(sceneModel.panels, renderTextInAi, hasGraphic, promptInputForAi, sceneModel, effectiveSempertexSelection);

    // ── Primary path: layout-reference edit ────────────────────────────────
    // Same proven pattern as fal-layout-reference-test in the structure test route.
    const pngResult       = await generateLayoutReferencePng(sceneModel, promptInputForAi, effectiveBalloonHexColors);
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

  const isMaxEditModel = resolvedEditModelId === "fal-ai/flux-2-max/edit";
  const hasRoundPanelInRender = sceneModel.panels.some((p) => p.type === "round");

  // Round scenes: skip strict correction for now — primary render test.
  // Strict correction was damaging the primary render (plinth disappearing, color drift).
  // Arch and Sempertex-only scenes retain correction.
  const strictCorrectionSkippedReason: string | null = hasRoundPanelInRender
    ? "round_primary_test"
    : null;

  const needsStrictCorrection =
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
      }
    );

    try {
      const correctionResult = await fal.subscribe(resolvedEditModelId, {
        input: {
          prompt:          correctionPrompt,
          negative_prompt: negativePrompt,
          image_urls:      [imageUrl],
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

  const extra = {
    mode: "first_generate",
    renderMode: "first_generate_layout_reference_edit",
    referenceUsed: true,
    referenceVersion: "clean-layout-reference-v1",
    modelId: editModelId,
    fallbackUsed: false,
    strictCorrectionApplied,
    strictCorrectionSkippedReason,
    primaryLayoutReferenceImageUrl: imageUrl,
    finalImageUrl: finalImageUrl,
    layoutReferencePngGenerated: true,
    layoutReferencePngBytes: pngResult.bytes,
    layoutReferencePrefix: pngResult.dataUri.slice(0, 40),
  };

  renderCache.set(cacheKey, { imageUrl: finalImageUrl, diagInfo, extra });
  const devExtras = process.env.NODE_ENV === "development" ? { layoutReferenceDataUri: pngResult.dataUri } : {};
  return NextResponse.json({ imageUrl: finalImageUrl, ...extra, ...diagInfo, ...devExtras, cacheHit: false });
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
