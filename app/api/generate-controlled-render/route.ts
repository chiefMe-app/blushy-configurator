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
  generateNegativePrompt,
  type PromptInput,
} from "@/lib/generatePrompt";
import { type SceneModel } from "@/lib/buildSceneModel";
import { type FalImageSize } from "@/lib/calculateRenderAspectRatio";
import { generateStructureSilhouette } from "@/lib/generateStructureSilhouette";
import { type BalloonStyleId } from "@/lib/config";

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
const RENDER_CACHE_VERSION = "no-extra-stage-v2";

interface RenderCacheEntry {
  imageUrl: string;
  diagInfo: Record<string, unknown>;
  extra:    Record<string, unknown>;
}
const renderCache = new Map<string, RenderCacheEntry>();

function buildCacheKey(sceneHash: string | undefined, requestedRenderMode: string, modelMode: ModelMode): string {
  return `${RENDER_CACHE_VERSION}:${sceneHash ?? "nohash"}:${requestedRenderMode}:${modelMode}`;
}

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic"; // prevent Next.js from caching route responses
export const maxDuration = 90;

type RenderMode = "first_generate" | "edit_existing";

interface SempertexSelectionItem {
  code:      string;
  colorName: string;
  finish:    string;
  family:    string;
  hex?:      string;
}

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

function buildNegativePrompt(
  items:        SceneModel["panels"],
  hasText:      boolean,
  hasGraphic:   boolean,
  promptInput?: PromptInput,
  sceneModel?:  SceneModel,
): string {
  const baseItems = items.map((p) => ({
    type: p.type, widthCm: p.widthCm, heightCm: p.heightCm,
    text:    { enabled: p.text.enabled, value: p.text.value, fontStyle: p.text.fontStyle as "script" | "block" | "elegant", color: p.text.color },
    graphic: { enabled: p.graphic.enabled, style: p.graphic.style, theme: "" },
    sizeId: p.sizeId, id: p.id, color: p.color, order: p.order,
    backdropColor: "", balloonStyle: "none" as const,
  }));

  const sceneNeg = generateNegativePrompt(
    baseItems as Parameters<typeof generateNegativePrompt>[0],
  );

  const styleNeg =
    "flat mockup, vector preview, engineering diagram, layout drawing, " +
    "cartoon style, sticker render, 3D toy render, plain catalog image, " +
    "sterile product mockup, CG render, plastic looking, unrealistic, " +
    // Measurement text must NEVER appear in AI render — app overlay adds exact labels from scene state
    "measurement text, dimension labels, ruler lines, size annotations, numbers on floor, " +
    "technical labels, measurement arrows, dimension lines, centimeter labels, cm text, " +
    "100cm, 200cm, width labels, height labels, floor measurements";

  const hasArchPanel = items.some((p) => p.type === "arch");
    const archPropNeg  = hasArchPanel
    ? ", wide arch wall, oversized arch panel, 150 cm wide arch, 180 cm wide arch, " +
      "2 meter wide arch, wall-sized backdrop, architectural wall arch, permanent arch wall, " +
      "extra-wide panel, panel width similar to height, arch wider than 120 cm, " +
      "wide rounded wall, giant arch, oversized event wall, backdrop wider than configured size, " +
      "hollow arch, open doorway arch, arch frame, cut-out center, empty opening, see-through arch, doorway frame"
    : "";

  const hasRoundPanel = items.some((p) => p.type === "round");
  const roundPropNeg = hasRoundPanel
    ? ", visible stand, wheels, metal frame, support hardware, support legs, " +
      "wall-mounted circle, flat painted circle on wall, circle attached to wall, no gap from wall, " +
      "undersized round backdrop, tiny round backdrop, wrong scale round backdrop, not 200cm round backdrop, " +
      "plinth set too far forward, plinth far from backdrop, " +
      "detached loose floor balloons, random isolated balloons on the floor, " +
      "hazy, washed out, desaturated, grey filter, gray color cast, dull lighting, low contrast, " +
      "flat lighting, foggy look, distant camera, far away shot, small in frame, low energy, lifeless, " +
      "small round backdrop, undersized circle, decorative wall circle, round panel smaller than plinth scale, " +
      "distant tiny round panel, " +
      "extra plinth, second plinth, duplicate plinth, low white platform, oval base, round base, stage, podium, " +
      "riser, pedestal, support block, support disc, base cylinder, round backdrop base, display base, " +
      "furniture base, extra cylinder, floating support, visible support bar, round backdrop on furniture, " +
      "round backdrop mounted on stand"
    : "";

  const structureNeg =
    "wrong number of panels, extra backdrop panel, missing backdrop panel, " +
    "changed panel silhouette, wrong panel proportions, oversized backdrop wall" +
    archPropNeg + roundPropNeg;

  const archBalloonNeg = hasArchPanel
    ? ", tiny balloons only, same-size balloons, sparse garland, thin garland, stringy garland, " +
      "thin single-file balloon chain, evenly spaced small balloons, weak floor volume, " +
      "balloons across the front of the arch, balloons covering the arch face, balloons in front of arch face, " +
      "balloons crossing the arch opening, balloon pile in front of arch, floor buildup in front of arch face, " +
      "balloons on left side of arch, garland on both sides of arch, " +
      "balloons across the front face, balloons blocking the arch face, balloons covering the open center, " +
      "floor balloon pile in front of panel, garland crossing inward over the panel face, " +
      "disconnected floor balloon pile, balloons in front of plinth"
    : "";

  const balloonNeg = "bead-like balloons, uniform balloon sizes, fake balloons, " +
    "gap between balloons and backdrop, detached garland, floating balloon cluster, separated balloons, " +
    "detached floor balloons, floating loose balloons, scattered floor balloons, " +
    "broken-looking loose balloons, floor balloons disconnected from garland, floating gap" +
    archBalloonNeg;

  // Balloon color fidelity — active when a palette is configured
  const hasBalloonColors = (sceneModel?.balloons?.colors?.length ?? 0) > 0;
  const balloonColorNeg = hasBalloonColors
    ? ", mostly white balloons, all-white garland, desaturated balloons, " +
      "colorless balloon garland, washed-out balloon colors, faded balloon palette, " +
      "wrong balloon colors, unrelated balloon colors, theme-default balloon colors, unselected balloon colors, " +
      "ignoring selected palette, changing backdrop size when color changes, " +
      "orange balloons when not selected, yellow balloons when not selected, " +
      "green balloons when not selected, blue balloons when not selected"
    : "";

  const balloonSizeStructureNeg =
    ", all balloons same size, mostly small balloons, no 36 inch balloons, " +
    "tiny-only garland, micro-balloon chain";

  const promptProbeForTheme = promptInput ? JSON.stringify(promptInput).toLowerCase() : "";
  const balloonColorProbe = (sceneModel?.balloons?.colors ?? []).join(" ").toLowerCase();
  const isFrozenTheme =
    promptProbeForTheme.includes("frozen") ||
    promptProbeForTheme.includes("icy blues") ||
    promptProbeForTheme.includes("snowflake") ||
    (balloonColorProbe.includes("blue") && balloonColorProbe.includes("silver"));

  const frozenPaletteNeg = isFrozenTheme
    ? ", warm balloons, creamy balloons, beige balloons, ivory-dominant balloons, " +
      "champagne-dominant balloons, yellowish balloons, warm pastel drift, " +
      "gold-dominant balloons, cream balloon garland, beige balloon garland"
    : "";

  const plinthGeometryNeg =
    "short podium, low podium, cake stand, squat cylinder, short cylinder, wide cylinder, " +
    "flat cylinder, disk plinth, low round platform, short round stand, wide display stand";

  const plinthCountNeg = (sceneModel?.plinths?.length ?? 0) === 1
    ? ", second plinth, two plinths, duplicate plinth, extra plinth, additional cylinder, extra white cylinder"
    : "";
    const plinthNeg = "wrong plinth shape, wide platform, stage, podium, square pedestal, wide base, " +
    "short round podium, cake stand, low display stand, short cylinder, low podium, " +
    "squat cylinder, wide cylinder, flat cylinder, disk plinth, drum table, round stool, " +
    "short round stand, wide display stand" + plinthCountNeg;

  // Shimmer wall negatives — fire when a shimmer wall is in the scene
  const hasShimmerWall = (sceneModel?.panels ?? []).some((p) => p.type === "shimmer_wall");
  const shimmerNeg = hasShimmerWall
    ? ", no crumpled aluminum foil, no wrinkled foil, no embossed metal sheet, " +
      "no hammered metal texture, no irregular crinkled texture, no chaotic foil surface, " +
      "no plain matte shimmer wall, no smooth cream panel for shimmer wall, " +
      "no solid backdrop board for shimmer wall, no missing square tile grid, " +
      "no flat off-white panel instead of shimmer, no wrong shimmer color, " +
      "no untextured shimmer wall, shimmer wall must not become a cream board, " +
      "no merged shimmer panel"
    : "";

  // Unselected-prop negatives — block everything not in the scene config
  const extrasList  = promptInput?.extras ?? [];
  const selCutouts  = sceneModel?.cutouts?.size !== "none";
  const selFlorals  = extrasList.includes("florals");
  const selCakeTable = extrasList.includes("dessert_table");

  const propNeg = [
    !selFlorals    && "extra flowers, floral arrangements, foliage, greenery, plant decorations, botanical props",
    !selCakeTable  && "side table, cake stand, dessert stand, dessert table, cake table, coffee table",
    !selCutouts    && "character cutouts, themed standees, figure props, cartoon props",
    "unselected props, extra decor items, random decorative objects, cluttered scene",
    "extra styling objects, themed toys, dinosaur toy, barbie accessory, safari prop",
    "gift box, candle, lamp, shelf, tray, basket, stool, chair, rug, cushion",
  ].filter(Boolean).join(", ");

  // Text is always an overlay — AI must never bake text into the image.
  // Active when hasText=false (= renderTextInAi=false), which is always the case for AI renders.
  const textNeg = !hasText
    ? ", text, lettering, typography, words, printed words, calligraphy, handwriting, " +
      "birthday sign, name sign, backdrop text, vinyl text, decals, logo, " +
      "text overlay, words on backdrop, birthday message, name signage, " +
      "any written characters, any readable text on backdrop surface"
    : "";

  const printNeg   = !hasGraphic
    ? ", printed illustration on backdrop, graphic design on panel, pattern on backdrop, " +
      "artwork on panel surface"
    : "";

  // Environment consistency negatives — prevent random room/furniture/window changes
  const envNeg =
    ", visible window, window frame, curtains, chandelier, sofa, chair, side column, pillar, " +
    "plant, vase, extra furniture, decorative props, busy background, " +
    "different room, new room, changed camera angle, different lighting direction, " +
    "extra event structures";

  // Garland/plinth drift negatives — always active when balloons are present.
  // Previously gated on hasText; now unconditional since text is overlay-only.
  const hasBalloonsDrift = (sceneModel?.balloons?.style ?? "none") !== "none";
  const textDriftNeg = hasBalloonsDrift
    ? ", shifted garland, sparse garland, reduced balloon volume, thinner garland, " +
      "simplified garland, altered balloon layout, changed balloon silhouette, missing floor balloons, " +
      "thick plinth, wide plinth, distorted plinth, enlarged plinth, shortened plinth, " +
      "duplicate plinth, extra plinth, repositioned plinth"
    : "";

  // Conditional half-garland fidelity — only fires when half garland is configured.
  // Prevents the AI from expanding a half garland into a full frame or adding extra clusters.
  const isHalfGarland = (sceneModel?.balloons?.style ?? "none") === "half";
  const halfGarlandNeg = isHalfGarland
    ? ", full garland when half garland is configured, full balloon frame, " +
      "balloons wrapping both sides, symmetrical balloon installation, " +
      "oversized balloon installation, extra balloon clusters, " +
      "over-decorated setup, embellished setup, balloon arch, full arch garland, " +
      "garland stopping halfway, incomplete side garland, truncated garland, shortened garland, " +
      "cut-off lower garland, upper-only garland, broken garland flow, " +
      "disconnected floor balloons, separate floor balloon pile, floating balloon cluster, " +
      "missing lower balloons, weak lower section, gap between garland and floor cluster, " +
      "balloons across the floor, horizontal floor balloon trail, floor-spreading balloons, " +
      "balloon spillover, balloon carpet, balloons across front, balloons on open side, " +
      "full floor balloon garland, overextended floor cluster, balloons on both sides, " +
      "balloons surrounding the plinth, balloons covering plinth, balloons hiding plinth, " +
      "balloons behind plinth, plinth obscured by balloons, " +
      "balloons touching plinth, balloons overlapping plinth, balloons blocking plinth, " +
      "balloons in front of plinth, balloon garland covering plinth, balloon cluster replacing plinth"
    : "";

  // Text is now a client-side overlay — remove AI text visibility negatives.
  // "missing text / omitted text" would encourage the AI to render text, which we no longer want.
  const textVisibilityNeg = "";

  // 2. Garland continuity negatives (when balloons are present)
  const garlandContinuityNeg = hasBalloonsDrift
    ? ", partial garland, broken garland continuity, garland stopping above floor, " +
      "detached floor balloon cluster, disconnected balloon pile, sparse lower garland, " +
      "missing lower balloons, balloon garland moved to opposite side"
    : "";

  // 3. Plinth omission negatives — applies whenever plinths are configured (not limited to text renders)
  const hasPlinths = (sceneModel?.plinths?.length ?? 0) > 0;
  const plinthOmissionNeg = hasPlinths
    ? ", missing plinth, omitted plinth, invisible plinth, plinth disappeared, plinth hidden, " +
      "plinth blended into backdrop, plinth merged with backdrop, cropped plinth, " +
      "removed plinth, absent foreground plinth, no plinth, " +
      "plinth replaced by platform, plinth as stage, flattened plinth, widened plinth, " +
      "short cylinder, squat cylinder, wide cylinder, horizontal cylinder, " +
      "low round platform, short round platform, flat circular stage, circular floor platform, " +
      "round stage, low podium, podium disk, floor disk, circular base platform, " +
      "balloons covering plinth, balloons hiding plinth, balloons obscuring plinth, " +
      "balloons around plinth, balloons behind plinth, plinth buried in balloons, " +
      "plinth not visible, plinth covered by decor, " +
      "partially visible plinth, plinth behind balloons, plinth merged into backdrop, " +
      "plinth replaced by decor, plinth removed from scene, plinth sacrificed for balloons, " +
      "plinth hidden by balloon garland"
    : "";

  // 4. Platform/base suppression — whenever a backdrop or plinth is configured
  const hasBackdrop = items.length > 0;
  const platformBaseNeg = (hasBackdrop || hasPlinths)
    ? ", stage, podium base, semicircle platform, oval platform, raised platform, " +
      "pedestal base attached to backdrop, backdrop base extension, " +
      "platform under backdrop, fake base platform, stage base, platform base, " +
      "low disk, disk on floor, round floor platform, flat round base"
    : "";

  const strip = (s: string) => s.replace(/^,\s*/, "").trim();

  return [
    sceneNeg,
    styleNeg,
    structureNeg,
    balloonNeg,
    balloonColorNeg,
    balloonSizeStructureNeg,
    frozenPaletteNeg,
    plinthNeg,
    plinthGeometryNeg,
    propNeg,
    textNeg,
    printNeg,
    envNeg,
    textDriftNeg,
    textVisibilityNeg,
    garlandContinuityNeg,
    halfGarlandNeg,
    plinthOmissionNeg,
    platformBaseNeg,
    shimmerNeg,
  ].map(strip).filter(Boolean).join(", ");
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
  sceneModel:  SceneModel,
  promptInput: PromptInput,
): Promise<LayoutRefPngResult> {
  // Stage 1: SVG generation — derive plinth sizes from sceneModel for type safety
  let silhouette: ReturnType<typeof generateStructureSilhouette>;
  try {
    silhouette = generateStructureSilhouette(
      promptInput.backdropItems ?? [],
      sceneModel.plinths.map((p) => p.size),
      (sceneModel.balloons.style ?? "none") as BalloonStyleId,
      sceneModel.balloons.colors.length > 0 ? sceneModel.balloons.colors : promptInput.balloonColors,
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

/**
 * Builds the premium photorealistic prompt for the layout-reference edit path.
 * Includes exact arch and plinth dimensions from sceneModel.
 */
// Maps panel type id to a readable label for prompts
function panelTypeLabel(type: string): string {
  switch (type) {
    case "arch":         return "rounded arch";
    case "rect":         return "rectangular flat";
    case "shimmer_wall": return "rectangular shimmer-wall";
    case "round":        return "round circular";
    case "wavy":         return "wavy-top";
    default:             return type;
  }
}

function buildLayoutRefEditPrompt(sceneModel: SceneModel, sempertexSelection?: SempertexSelectionItem[]): string {
  const panelCount  = sceneModel.panels.length;
  const isMulti     = panelCount > 1;

  // ── Backdrop description ──────────────────────────────────────────────────
  let backdropDesc: string;

  const isSingleShimmerOnly = panelCount === 1 && sceneModel.panels[0]?.type === "shimmer_wall";

  if (isSingleShimmerOnly) {
    // Dedicated shimmer-only prompt — correctly describes ONE backdrop panel
    // PLUS any selected decorative items (balloons, plinths).
    const sc    = sceneModel.shimmerColor ?? "silver";
    const p     = sceneModel.panels[0];

    // Plinth: deterministically centered in front of the shimmer wall
    const plinth    = sceneModel.plinths[0];
    const plinthStr = plinth
      ? `One slim freestanding white cylindrical plinth, ${plinth.heightCm}cm tall and ${plinth.diameterCm}cm diameter, ` +
        `fully visible from base to rounded top, centered horizontally in front of the shimmer wall, ` +
        `aligned to the horizontal center of the shimmer wall. ` +
        `Do not place the plinth on the left or right side. Do not omit the plinth.`
      : "";

    // Balloon garland: dense premium organic, chrome balloons for silver/gold shimmer
    const bStyle    = sceneModel.balloons.style;
    const bColors   = sceneModel.balloons.colors.length > 0
      ? sceneModel.balloons.colors.slice(0, 4).join(", ")
      : sc === "silver" ? "silver chrome, white, pearl white"
      : sc === "gold"   ? "gold chrome, white, cream"
      : "the selected palette";
    const chromeBalloonNote =
      sc === "silver" ? `Include large chrome silver mirror balloons mixed with medium white and small pearl balloons. ` :
      sc === "gold"   ? `Include large chrome gold mirror balloons mixed with medium white and cream balloons. ` :
      "";
    const garlandStr = bStyle !== "none"
      ? `Full dense premium organic balloon half-garland starting at the top-right corner of the shimmer wall ` +
        `and cascading richly all the way down the right side to the floor. ` +
        `The garland must be lush, full volume, and layered — not sparse, thin, or flat. ` +
        `Mix large, medium, and small balloons for maximum organic depth and texture. ` +
        `The balloon garland must be attached directly to the backdrop edge with no visible gap. ` +
        `Balloons must closely follow the backdrop contour and look professionally installed onto the structure. ` +
        `Balloon palette: ${bColors}. ` +
        chromeBalloonNote +
        `Do not omit the balloon garland. Do not reduce the garland volume.`
      : "No balloon garland.";

    return (
      `Cool neutral daylight studio photography with soft natural light from the left, ` +
      `gray textured plaster or concrete studio wall, polished light concrete or stone floor, ` +
      `neutral white balance, fresh modern editorial event styling. ` +
      `Transform this layout reference into a premium photorealistic indoor event setup. ` +
      `The setup contains exactly ONE backdrop panel plus selected decorative items. ` +
      `Backdrop: a freestanding ${p.widthCm}cm × ${p.heightCm}cm square event shimmer wall. ` +
      `Clean straight outer edges, full square silhouette, no cutouts or openings. ` +
      `The entire surface is covered edge-to-edge with a regular grid of small uniform reflective ${sc} shimmer tiles ` +
      `arranged in neat rows and columns — a realistic event rental shimmer wall surface. ` +
      `Reflective ${sc} finish with clean sparkle. Clearly a shimmer sequin wall, not a matte board. ` +
      (plinthStr ? `${plinthStr} ` : "") +
      `${garlandStr} ` +
      `NOT an arch. NOT a rounded-top board. NOT a niche or frame. NOT a cutout. ` +
      `NOT a layered backdrop. No second backdrop panel. No panel behind another panel. ` +
      `No crumpled foil. No wrinkled aluminum. No hammered metal. No irregular mirror mosaic. ` +
      `No noisy abstract reflective texture. No chaotic crinkled surface. ` +
      `No matte board. No cream board. No missing tile grid. No wrong shimmer color.`
    );
  }

  if (!isMulti) {
    const p = sceneModel.panels[0];
    if (p.type === "shimmer_wall") {
      // Shimmer-only (unreachable now, kept for safety)
      const sc = sceneModel.shimmerColor ?? "silver";
      backdropDesc =
        `one freestanding square shimmer wall, ${p.widthCm}cm wide x ${p.heightCm}cm tall, ` +
        `${sc} shimmer finish, regular neat grid of small flat square ${sc} sequin tiles, ` +
        `clean reflective sparkle, flat tiled sequin surface, ` +
        `NOT a matte board, NOT a cream backdrop, NOT crumpled foil`;
    } else if (p.type === "round") {
      backdropDesc =
        `a thin circular backdrop panel, exactly ${p.widthCm}cm x ${p.heightCm}cm — not a furniture object, ` +
        `not a platform, not a stage piece, not mounted on a display base. ` +
        `The bottom edge of the panel sits directly on the floor, with at most 0-2cm visual gap between the ` +
        `panel's lower edge and the floor surface. ` +
        `Clearly freestanding in front of the wall, with visible separation between the panel and the wall behind it. ` +
        `Not wall-mounted, not attached to the wall, not painted on the wall. ` +
        `NO visible stand. NO visible feet. NO visible wheels. NO visible frame. NO visible support bar. ` +
        `NO extra base of any kind beneath or around the panel. ` +
        `If the panel is structurally supported, that support must be fully hidden directly behind the thin panel ` +
        `and completely invisible in the photograph — the panel must read as a clean thin circular surface with ` +
        `absolutely nothing visible beneath, around, or supporting it. ` +
        `The ONLY cylinder allowed anywhere in this scene is the single selected vertical plinth — ` +
        `do not add any other cylinder, disc, or rounded object near the panel. ` +
        `Round backdrop is exactly 200 cm diameter. It must visually appear about 2.6 times taller than the ` +
        `75 cm plinth and about 5 times wider than the 40 cm plinth diameter. The round panel should dominate ` +
        `the setup and fill most of the background composition. ` +
        `Do not shrink the round panel. Do not render it as a small decorative circle. ` +
        `It must read as a full-size 2 meter event backdrop, thin and flat like a sign board, never like a piece ` +
        `of furniture or a display fixture. ` +
        `Only one visible prop is allowed in the entire scene: the single selected vertical cylindrical plinth. ` +
        `The round backdrop itself has no visible base, no stage, no platform, no pedestal, no riser, ` +
        `no support block, no support disc, no display base, no furniture base, no stand, no feet, ` +
        `and no second plinth. Do not invent any extra white cylinder, oval base, round base, or low platform ` +
        `under or beside the round panel — the floor beneath and around the panel must be completely bare ` +
        `except for the one selected plinth and the balloon garland.`;
    } else if (p.type === "arch") {
      backdropDesc =
        `single rounded arch backdrop, ${p.widthCm}cm wide by ${p.heightCm}cm tall — ` +
        `a solid filled freestanding arch backdrop panel with a fully opaque surface. ` +
        `The entire arch face is one continuous solid board, seamless matte cream-white surface, ` +
        `no cut-out opening, no hollow doorway, no empty arch frame — the full solid panel face must be visible. ` +
        `This is a solid event backdrop board shaped like an arch, not a doorway or passage you can see or walk through.`;
    } else {
      backdropDesc =
        `single ${panelTypeLabel(p.type)} cream-white backdrop board, ` +
        `${p.widthCm}cm wide by ${p.heightCm}cm tall, solid freestanding board, seamless matte surface`;
    }
  } else {
    // Multi-panel: describe every panel explicitly by number, type, dimensions, position
    const positions = ["left", "center", "right"];
    const posLabels = panelCount === 2
      ? ["left", "right"]
      : panelCount === 3
        ? ["left", "center", "right"]
        : sceneModel.panels.map((_, i) => positions[i] ?? `panel ${i + 1}`);

    const panelDescs = sceneModel.panels.map((p, i) => {
      const wRatio = (p.widthCm / p.heightCm).toFixed(2);
      const isShimmer = p.type === "shimmer_wall";
      const isArch    = p.type === "arch";
      const shimmerC  = sceneModel.shimmerColor ?? "silver";
      const surfaceDesc = isShimmer
        ? `freestanding square event shimmer wall (200cm x 200cm) — ` +
          `regular neat grid of small flat square ${shimmerC} sequin tiles, ` +
          `clean reflective sparkle, flat tiled surface, ${shimmerC} shimmer finish, ` +
          `NOT crumpled foil, NOT a matte board, NOT a cream panel`
        : isArch
          ? `solid filled freestanding arch backdrop panel, fully opaque surface, seamless matte cream-white surface, ` +
            `no cut-out opening, no hollow doorway, no empty arch frame, full solid panel face visible`
          : `full-width solid opaque cream-white freestanding backdrop board with broad visible surface`;
      return (
        `Panel ${i + 1} (${posLabels[i]}): ${panelTypeLabel(p.type)} backdrop board, ` +
        `${p.widthCm}cm wide by ${p.heightCm}cm tall (width-to-height ratio ${wRatio}), ` +
        `${surfaceDesc}, not compressed, not narrow, not a tower, correctly proportioned`
      );
    });
    backdropDesc =
      `exactly ${panelCount} separate freestanding backdrop boards arranged side by side, ` +
      `each fully solid, opaque, and rendered at its correct width. ` +
      `Both panels are full-size physical event backdrop boards with broad visible surfaces ` +
      `and correct width-to-height proportions. ` +
      `The total setup should feel wide and substantial, not skinny or compressed. ` +
      panelDescs.join(". ") + ".";
  }

  // ── Plinth description ────────────────────────────────────────────────────
  const plinth       = sceneModel.plinths[0];
  const hasRoundPanelInScene = sceneModel.panels.some((p) => p.type === "round");
  const plinthDesc   = plinth
    ? `one slim freestanding white cylindrical plinth, ${plinth.heightCm}cm tall and ${plinth.diameterCm}cm diameter, ` +
      `fully visible from base to top, ` +
      (hasRoundPanelInScene
        ? `standing close to the round backdrop panel, not set too far forward into the room`
        : `placed on the open side near the arch backdrop`)
    : "";
  const noPlinthDesc = plinth ? "" : "No plinths. ";

  // ── Balloon garland description ───────────────────────────────────────────
  const balloonStyle  = sceneModel.balloons.style;
  const hasSempertexLock = balloonStyle !== "none" && !!sempertexSelection && sempertexSelection.length > 0;
  // When a Sempertex palette is selected it fully overrides the theme palette —
  // never blend in theme defaults like "icy blue, white, silver".
  const balloonColors = hasSempertexLock
    ? sempertexSelection!.map((c) => c.colorName).join(", ")
    : sceneModel.balloons.colors.length > 0
      ? sceneModel.balloons.colors.slice(0, 4).join(", ")
      : "icy blue, white, silver";
  const hasArchPanelInScene = sceneModel.panels.some((p) => p.type === "arch");
  const archGarlandExtra = hasArchPanelInScene
    ? ` Premium organic balloon garland with large, medium, and small balloons nested together ` +
      `in lush clustered bunches, attached ONLY to ONE OUTER SIDE of the arch — the right outer edge — ` +
      `and nowhere else on the structure. ` +
      `The garland flows naturally and continuously starting at the top outer corner of the arch, ` +
      `following the outer side edge downward, ending in a connected floor-level cluster at the outer ` +
      `bottom corner/side — a single smooth top-to-bottom flow down the outer edge, never reversed, ` +
      `never starting from the bottom, never doubling back, never feeling awkward or disconnected. ` +
      `If there is a floor or base balloon cluster, it must stay directly connected to the garland at the ` +
      `outer bottom side/corner only — never placed in front of the panel, never centered, never spread ` +
      `across the base. ` +
      `Not a thin single-file chain. ` +
      `The arch front face, the open center opening, and the readable surface of the arch must stay ` +
      `completely clean, unobstructed, and fully visible at all times — absolutely no balloons crossing ` +
      `in front of the arch panel, no balloons covering the open center, no balloons blocking the arch face, ` +
      `and no balloon pile or floor buildup directly in front of the arch face. ` +
      `The plinth and the front floor area in front of the arch must remain completely clean and ` +
      `unobstructed — no balloons in front of the plinth, no balloons crossing into the front floor area.`
    : "";
  const balloonSizeDesc =
    ` Use exactly three balloon size families: several large 36 inch statement balloons, many 12 inch ` +
    `standard balloons, and small 5 inch filler balloons. Include at least 5 visible 36 inch statement ` +
    `balloons distributed through the garland at the top, side, and base. 36 inch balloons must be clearly ` +
    `larger than all others. 5 inch balloons only appear as small filler clusters attached to larger balloons. ` +
    `Any balloons resting on the floor must be part of the garland's base cluster, visually connected to ` +
    `and touching the main garland — never scattered, detached, or floating separately on the floor.`;
  const sempertexClause = hasSempertexLock
    ? ` BALLOON COLOR LOCK: Use ONLY these selected Sempertex balloon colors for every balloon: ` +
      sempertexSelection!.map((c) => `${c.code} - ${c.colorName} - ${c.finish} - ${c.hex ?? ""}`).join(", ") +
      `. Do not invent, substitute, blend, or add any other balloon colors. ` +
      `Ignore the theme palette for balloons.`
    : "";
  const garlandDesc   = balloonStyle === "none"
    ? "No balloon garland. "
    : `organic half balloon garland on the right side, dense and premium, ` +
      `individual ${balloonColors} latex balloons cascading from the top corner to the floor.` +
      balloonSizeDesc +
      ` The balloon garland must be attached directly to the backdrop edge with no visible gap. ` +
      `Balloons must closely follow the backdrop contour and look professionally installed onto the structure.` +
      archGarlandExtra +
      sempertexClause;

  // ── Multi-panel negatives ─────────────────────────────────────────────────
  const hasShimmerInMulti = isMulti && sceneModel.panels.some((p) => p.type === "shimmer_wall");
  const shimmerMultiNegs = hasShimmerInMulti
    ? `The shimmer wall must remain a tiled metallic sequin wall — ` +
      `do not turn it into a plain matte board or cream panel. ` +
      `No missing tile texture on shimmer wall. No flat off-white panel instead of shimmer. ` +
      `No wrong shimmer color. No smooth cream board for shimmer wall. `
    : "";

  const multiPanelNegs = isMulti
    ? `Do not merge panels into one. Do not omit any panel. No extra panels beyond ${panelCount}. ` +
      `No outline-only arch. No wire-frame backdrop. No thin frame backdrop. ` +
      `No transparent backdrop board. No decorative line structure. ` +
      `Every selected panel must appear as a full solid opaque backdrop board. ` +
      `No skinny panels. No narrow tower-like panels. No compressed backdrop boards. ` +
      `No thin vertical strips. No overly narrow arch. No overly narrow rectangular board. ` +
      `Do not shrink panel widths. Do not turn panels into slim columns. ` +
      shimmerMultiNegs
    : "";

  // Round backdrops render dull/distant with the default wide-shot wording — use a
  // brighter, sharper, closer-framed photography clause for round scenes only.
  const isRoundScene = hasRoundPanelInScene && !isMulti;
  const photographyOpening = isRoundScene
    ? `Bright, sharp, premium studio photography with clean natural daylight from the left, ` +
      `gray textured plaster or concrete studio wall, polished light concrete or stone floor, ` +
      `crisp clean whites, natural accurate color, normal punchy contrast, well-lit and clear — ` +
      `NOT hazy, NOT desaturated, NOT grey-filtered, NOT washed out, NOT low-energy, NOT distant. ` +
      `fresh modern editorial event styling. `
    : `Cool neutral daylight studio photography with soft natural light from the left, ` +
      `gray textured plaster or concrete studio wall, polished light concrete or stone floor, ` +
      `crisp clean whites, icy light blue and white balloon tones, neutral white balance, ` +
      `fresh modern editorial event styling. `;
  const framingClause = isRoundScene
    ? `Transform this clean layout reference into a premium photorealistic indoor children's birthday event setup. ` +
      `Medium-close full-body event photography — the round backdrop, balloon garland, and plinth fill the frame ` +
      `with strong visual presence and prominence, similar closeness and scale to a close-up arch backdrop photograph, ` +
      `while still keeping the entire setup fully visible with minimal extra empty space around it. `
    : `Transform this clean layout reference into a premium photorealistic indoor children's birthday event setup. ` +
      `Wide full-body event photography — entire setup fully visible with breathing room, nothing cropped. `;

  return (
    // Art direction first — establishes lighting, color, and mood before describing objects
    photographyOpening +
    framingClause +
    `${backdropDesc}. ` +
    (plinthDesc ? `${plinthDesc}. ` : noPlinthDesc) +
    `${garlandDesc}. ` +
    multiPanelNegs +
    `Premium modern editorial event photography, neutral white balance, clean fresh color grading, ` +
    `crisp white arch surface, no visible outline or border on the arch. ` +
    // Structure negatives
    `No text on backdrop. No people. No cake. No table. ` +
    `No stage. No podium. No base platform. No floor riser. ` +
    `No rectangular box plinth. No low round podium. No flat platform under plinth. ` +
    `No extra side panel. No extra wall or slab. ` +
    // Environment/lighting negatives
    `No warm yellow lighting. No golden ambient light. No beige hotel interior. No yellow color cast. ` +
    `No ornate luxury room. No cream or brown walls. No orange or yellow white balance. ` +
    `No overly warm shadows. No dark moody room. ` +
    `No plants. No furniture. No chairs. No mirrors. No doors. No visible support legs. No black stands. ` +
    (hasArchPanelInScene
      ? `No balloons across the front face. No balloons blocking the arch face. ` +
        `No balloons covering the open center. No floor balloon pile in front of panel. ` +
        `No garland crossing inward over the panel face. No disconnected floor balloon pile. ` +
        `No balloons in front of plinth. ` +
        `No hollow arch. No open doorway arch. No arch frame. No cut-out center. ` +
        `No empty opening. No see-through arch. No doorway frame. `
      : "") +
    (hasRoundPanelInScene
      ? `No small round backdrop. No undersized circle. No decorative wall circle. ` +
        `No round panel smaller than plinth scale. No distant tiny round panel. ` +
        `No extra plinth. No second plinth. No duplicate plinth. No low white platform. No oval base. ` +
        `No round base. No stage. No podium. No riser. No pedestal. No support block. No support disc. ` +
        `No base cylinder. No round backdrop base. No display base. No furniture base. No extra cylinder. ` +
        `No floating support. No visible stand. No visible feet. No visible wheels. No visible frame. ` +
        `No visible support bar. No round backdrop on furniture. No round backdrop mounted on a stand. `
      : "") +
    (sempertexClause
      ? `No wrong balloon colors. No unrelated balloon colors. No theme-default balloon colors. ` +
        `No unselected balloon colors. No ignoring selected palette. No changing backdrop size when color changes. ` +
        `No orange balloons when not selected. No yellow balloons when not selected. ` +
        `No green balloons when not selected. No blue balloons when not selected. ` +
        `No unrelated metallic balloons. No unselected gold balloons. No unselected rose gold balloons. ` +
        `No unselected yellow balloons. `
      : "") +
    `No balloons all the same size. No mostly small balloons. No garland without 36 inch balloons. ` +
    `No tiny-only garland. No micro-balloon chain.`
  );
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
    force             = false,
    currentSceneHash,
    structureHash,
    renderAspectRatio = "landscape_4_3",  // default fallback if not sent
    sempertexSelection,
  } = body;

  const hasText    = sceneModel.panels.some((p) => p.text.enabled && p.text.value.trim());
  const hasGraphic = sceneModel.panels.some((p) => p.graphic.enabled);

  // ── Model routing + cache lookup ──────────────────────────────────────
  const modelMode    = getModelMode();
  const editModelId  = getEditModelId(modelMode);
  const cacheKey     = buildCacheKey(currentSceneHash, renderMode, modelMode);
  const cached       = renderCache.get(cacheKey);
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
    selectedArchSize:         firstArchDiag?.sizeId        ?? null,
    resolvedArchWidthCm:      firstArchDiag?.widthCm       ?? null,
    resolvedArchHeightCm:     firstArchDiag?.heightCm      ?? null,
    selectedRoundSize:        firstRoundDiag ? "medium" : null,
    resolvedRoundDiameterCm:  firstRoundDiag?.widthCm       ?? null,
    selectedShimmerColor:     sceneModel.shimmerColor      ?? null,
    resolvedShimmerWidthCm:   sceneModel.shimmerColor ? 200 : null,
    resolvedShimmerHeightCm:  sceneModel.shimmerColor ? 200 : null,
    selectedBackdropTypes:    sceneModel.panels.map((p) => p.type),
    isSingleShimmerOnly:      sceneModel.panels.length === 1 && sceneModel.panels[0]?.type === "shimmer_wall",
    panelCount:               sceneModel.panels.length,
    selectedBalloonStyle:     sceneModel.balloons.style,
    balloonColorCount:        sceneModel.balloons.colors.length,
    plinthCount:              sceneModel.plinths.length,
    isBalloonGarlandExpected: sceneModel.balloons.style !== "none",
    isPlinthExpected:         sceneModel.plinths.length > 0,
    // Single source of truth for balloon color — exactly what the prompt used.
    effectiveSempertexSelection: sempertexSelection ?? [],
    effectiveBalloonColors:      sceneModel.balloons.colors ?? [],
    requestedRenderMode:         renderMode ?? null,
    structureHash:               structureHash ?? null,
    sceneHash:                   currentSceneHash ?? null,
    modelMode,
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
    const negativePrompt         = buildNegativePrompt(sceneModel.panels, renderTextInAi, hasGraphic, promptInputForAi, sceneModel);

    // ── Primary path: layout-reference edit ────────────────────────────────
    // Same proven pattern as fal-layout-reference-test in the structure test route.
    const pngResult       = await generateLayoutReferencePng(sceneModel, promptInputForAi);
    const layoutRefPrompt = buildLayoutRefEditPrompt(sceneModel, sempertexSelection);

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
            prompt:        layoutRefPrompt,
            image_urls:    [pngResult.dataUri],
            image_size:    renderAspectRatio,
            seed:          FINAL_RENDER_SEED,
            output_format: "jpeg",
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
          console.log("[generate-controlled-render] layout-reference edit succeeded:", imageUrl);
          const extra = {
            mode:             "first_generate",
            renderMode:       "first_generate_layout_reference_edit",
            referenceUsed:    true,
            referenceVersion: "clean-layout-reference-v1",
            modelId:          editModelId,
            fallbackUsed:     false,
            layoutReferencePngGenerated: true,
            layoutReferencePngBytes:     pngResult.bytes,
            layoutReferencePrefix:       pngResult.dataUri.slice(0, 40),
          };
          renderCache.set(cacheKey, { imageUrl, diagInfo, extra });
          return NextResponse.json({ imageUrl, ...extra, ...diagInfo, cacheHit: false });
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
