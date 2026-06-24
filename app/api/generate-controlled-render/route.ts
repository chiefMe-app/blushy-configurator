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

// first_generate (no layout guide): pure text-to-image fallback
const FAL_T2I_ENDPOINT = "https://fal.run/fal-ai/flux-2-pro";

// first_generate (with layout guide) + edit_existing: image-guided Kontext
const KONTEXT_ENDPOINT = "https://fal.run/fal-ai/flux-pro/kontext";

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
  renderAspectRatio?:      FalImageSize; // dynamic image_size from real panel dimensions
}

// ---------------------------------------------------------------------------
// fal storage helper — uploads base64 layout guide, returns a URL for Kontext
// ---------------------------------------------------------------------------

async function uploadLayoutGuide(base64: string, falKey: string): Promise<string> {
  // Use the official fal SDK — fal is already imported and configured at call site
  fal.config({ credentials: falKey });
  const buffer = Buffer.from(base64, "base64");
  const blob   = new Blob([buffer], { type: "image/png" });
  const url    = await fal.storage.upload(blob);
  if (!url) throw new Error("fal.storage.upload returned empty URL");
  return url;
}

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

const BALLOON_STYLE: Record<string, string> = {
  half:    "a controlled asymmetric half-garland: organic balloon installation that begins at ONE top corner " +
           "and extends continuously down the SAME side all the way to the floor in one connected flow. " +
           "The garland must NOT stop halfway — it must reach the floor. " +
           "The lower balloon section must connect visually to the side garland with no visible gap. " +
           "The floor cluster and the side garland are one continuous installation, not two separate elements. " +
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
  const balloonColors  = sceneModel.balloons.colors.length > 0
    ? `in ${sceneModel.balloons.colors.slice(0, 4).join(", ")} tones`
    : "";
  const balloonClause  = BALLOON_STYLE[balloonStyle]
    ? `Balloons: ${BALLOON_STYLE[balloonStyle]}${balloonColors ? " " + balloonColors : ""}.`
    : "";

  const plinthCount = sceneModel.plinths.length;
  const hasArch = sceneModel.panels.some((p) => p.type === "arch");

  const plinthClause = (() => {
    if (plinthCount === 0) return "No plinths.";

    const plinthDescs = sceneModel.plinths.map((p) => {
      const h = p.heightCm;
      const d = p.diameterCm;
      return (
        `a tall, slim, upright cylindrical display column — ${h}cm tall, ${d}cm diameter, ` +
        `height (${h}cm) is much greater than diameter (${d}cm), ` +
        `vertical orientation, straight vertical sides, flat circular top, ` +
        `freestanding on the floor, NOT a low platform, NOT a wide disk, NOT a stage, NOT a podium`
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
  const firstPlinth = sceneModel.plinths[0];
  const scaleRefClause = hasArch && plinthCount > 0 && firstPlinth
    ? (() => {
        const d = firstPlinth.diameterCm;
        const h = firstPlinth.heightCm;
        const ratio = Math.round(100 / d * 10) / 10;
        return (
          `SCALE REFERENCE: the white cylindrical plinth is ${d}cm diameter and ${h}cm tall. ` +
          `Height (${h}cm) is much greater than diameter (${d}cm) — it is a tall, slim, upright column, ` +
          `NOT a low disk or round platform. ` +
          `The arch backdrop panel is approximately 100cm wide — about ${ratio} times the plinth diameter. ` +
          `Use this ratio to judge the correct arch panel width in the scene. ` +
          `The arch must NOT appear wider than ${ratio} plinths placed side by side.`
        );
      })()
    : "";

  // Text is now a deterministic client-side overlay — NOT rendered by AI.
  // renderTextInAi = false disables all AI text clauses globally.
  const renderTextInAi = false as const;

  // balloonLockClause and plinthLockClause are disabled since text is overlay-only.
  // The standard balloonClause / plinthClause already describe the physical scene correctly.
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
    balloonClause,
    plinthClause,
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
      "2 meter wide arch, wall-sized backdrop, square arch, landscape arch, " +
      "extra-wide panel, panel width similar to height, arch wider than 120 cm"
    : "";

  const structureNeg =
    "wrong number of panels, extra backdrop panel, missing backdrop panel, " +
    "changed panel silhouette, wrong panel proportions, oversized backdrop wall" +
    archPropNeg;

  const balloonNeg = "bead-like balloons, uniform balloon sizes, fake balloons";

  const plinthCountNeg = (sceneModel?.plinths?.length ?? 0) === 1
    ? ", second plinth, two plinths, duplicate plinth, extra plinth, additional cylinder, extra white cylinder"
    : "";
  const plinthNeg = "wrong plinth shape, wide platform, stage, podium, square pedestal, wide base" + plinthCountNeg;

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
      "missing lower balloons, weak lower section, gap between garland and floor cluster"
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
      "removed plinth, absent foreground plinth, " +
      "plinth replaced by platform, plinth as stage, flattened plinth, widened plinth, " +
      "short cylinder, squat cylinder, wide cylinder, horizontal cylinder, " +
      "low round platform, short round platform, flat circular stage, circular floor platform, " +
      "round stage, low podium, podium disk, floor disk, circular base platform"
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
    plinthNeg,
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
  ].map(strip).filter(Boolean).join(", ");
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
    renderAspectRatio = "landscape_4_3",  // default fallback if not sent
  } = body;

  const hasText    = sceneModel.panels.some((p) => p.text.enabled && p.text.value.trim());
  const hasGraphic = sceneModel.panels.some((p) => p.graphic.enabled);

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

  try {
    // ── Edit existing render — Kontext on the previous photorealistic render ──
    if (renderMode === "edit_existing" && previousFinalRenderUrl) {
      const editPrompt =
        editDescription
          ? `${editDescription}. Preserve the room, camera angle, floor, lighting, balloon arrangement, backdrop count, panel shapes, and plinth positions exactly.`
          : `Refine the design while keeping all structural and atmospheric elements identical.`;

      const falRes = await fetch(KONTEXT_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:        editPrompt,
          image_url:     previousFinalRenderUrl,
          image_size:    renderAspectRatio,   // dynamic from panel dimensions — preserved
          output_format: "jpeg",
          num_images:    1,
          seed:          FINAL_RENDER_SEED,   // fixed seed for consistent studio environment
        }),
      });

      if (!falRes.ok) {
        const detail = await falRes.text();
        return NextResponse.json({ error: "Edit render failed", detail }, { status: 502 });
      }

      const result   = await falRes.json();
      const imageUrl = result?.images?.[0]?.url as string | undefined;
      if (!imageUrl) return NextResponse.json({ error: "No image returned" }, { status: 502 });

      if (process.env.NODE_ENV === "development") {
        console.log("[generate-controlled-render] edit done:", imageUrl);
      }
      return NextResponse.json({ imageUrl, mode: "edit_existing", model: "fal-ai/flux-pro/kontext" });
    }

    // ── First generate — pure text-to-image, NO image_url ─────────────────────
    // Text is a frontend overlay — strip all panel text before building the AI prompt
    // so the AI never receives or renders user text.
    const renderTextInAi = false as const;

    const promptInputForAi: typeof promptInput = {
      ...promptInput,
      // Clear backdrop text fields — AI must always render a blank/plain backdrop surface
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
    // Pass renderTextInAi (always false) so text-suppression negatives are always active
    const negativePrompt         = buildNegativePrompt(sceneModel.panels, renderTextInAi, hasGraphic, promptInputForAi, sceneModel);

    // ── Diagnostics state — always logged and returned in response ───────────
    const controlImageProvided = !!controlImageBase64;
    const controlImageBase64Length = controlImageBase64?.length ?? 0;
    let layoutGuideUploadAttempted = false;
    let layoutGuideUploadSucceeded = false;
    let layoutGuideUrl = "";
    let fallbackReason: string | undefined;

    console.log("[generate-controlled-render] controlImageProvided:", controlImageProvided, "length:", controlImageBase64Length);

    // ── Layout-guided render (Kontext) when a layout guide is provided ──────────
    if (controlImageBase64) {
      layoutGuideUploadAttempted = true;
      console.log("[generate-controlled-render] uploading layout guide to fal storage...");
      try {
        layoutGuideUrl = await uploadLayoutGuide(controlImageBase64, falKey);
        layoutGuideUploadSucceeded = true;
        console.log("[generate-controlled-render] layout guide upload succeeded:", layoutGuideUrl);
      } catch (uploadErr) {
        fallbackReason = String(uploadErr);
        console.error("[generate-controlled-render] layout guide upload failed — falling back to T2I:", fallbackReason);
      }

      if (layoutGuideUrl) {
        const kontextPrompt =
          `Transform this clean structural layout guide into a professional photorealistic event photography scene. ` +
          `Do NOT preserve the flat colors of the reference — transform it into real studio photography. ` +
          `${ENV_CLAUSE} ` +
          `Preserve all structure exactly as shown in the reference image: ` +
          `panel shapes, sizes, and positions; ` +
          `plinth height-to-diameter ratio, vertical orientation, and freestanding floor position; ` +
          `balloon garland flow, side, and floor-reach path (the lavender/purple shapes show the balloon placement). ` +
          `${PHYSICAL_FIDELITY_CLAUSE} ` +
          `${BLANK_BACKDROP_CLAUSE}`;

        console.log("[generate-controlled-render] → calling flux-pro/kontext with layout guide");
        if (process.env.NODE_ENV === "development") {
          console.log("[generate-controlled-render] kontextPrompt:", kontextPrompt);
        }

        const falRes = await fetch(KONTEXT_ENDPOINT, {
          method:  "POST",
          headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt:        kontextPrompt,
            image_url:     layoutGuideUrl,
            image_size:    renderAspectRatio,   // dynamic from panel dimensions — preserved
            output_format: "jpeg",
            num_images:    1,
            seed:          FINAL_RENDER_SEED,   // fixed seed for reproducible studio environment
          }),
        });

        if (!falRes.ok) {
          const detail = await falRes.text();
          return NextResponse.json({ error: "Layout-guided render failed", detail }, { status: 502 });
        }

        const result   = await falRes.json();
        const imageUrl = result?.images?.[0]?.url as string | undefined;
        if (!imageUrl) return NextResponse.json({ error: "No image returned", result }, { status: 502 });

        console.log("[generate-controlled-render] layout_guided_kontext succeeded:", imageUrl);
        return NextResponse.json({
          imageUrl,
          mode:  "first_generate_layout_guided",
          model: "fal-ai/flux-pro/kontext",
          debug: {
            controlImageProvided,
            controlImageBase64Length,
            layoutGuideUploadAttempted,
            layoutGuideUploadSucceeded,
            layoutGuideUrl,
            renderPath: "layout_guided_kontext" as const,
          },
        });
      }
    }

    // ── Pure text-to-image fallback (no layout guide / upload failed) ─────────
    const renderPath = controlImageProvided ? "t2i_fallback" : "pure_t2i_no_control";
    console.log("[generate-controlled-render] → calling fal-ai/flux-2-pro, renderPath:", renderPath, fallbackReason ? `fallbackReason: ${fallbackReason}` : "");
    if (process.env.NODE_ENV === "development") {
      console.log("[generate-controlled-render] prompt:", finalPrompt);
      console.log("[generate-controlled-render] negative:", negativePrompt);
    }

    const falRes = await fetch(FAL_T2I_ENDPOINT, {
      method:  "POST",
      headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt:          finalPrompt,
        negative_prompt: negativePrompt,
        image_size:      renderAspectRatio,   // dynamic from panel dimensions — preserved
        output_format:   "jpeg",
        num_images:      1,
        seed:            FINAL_RENDER_SEED,   // fixed seed for reproducible studio environment
      }),
    });

    if (!falRes.ok) {
      const detail = await falRes.text();
      return NextResponse.json({ error: "Final render failed", detail }, { status: 502 });
    }

    const result   = await falRes.json();
    const imageUrl = result?.images?.[0]?.url as string | undefined;
    if (!imageUrl) return NextResponse.json({ error: "No image returned", result }, { status: 502 });

    return NextResponse.json({
      imageUrl,
      mode:  "first_generate",
      model: "fal-ai/flux-2-pro",
      debug: {
        controlImageProvided,
        controlImageBase64Length,
        layoutGuideUploadAttempted,
        layoutGuideUploadSucceeded,
        layoutGuideUrl:             layoutGuideUrl || undefined,
        renderPath:                 renderPath as "t2i_fallback" | "pure_t2i_no_control",
        fallbackReason,
      },
    });

  } catch (err) {
    return NextResponse.json({ error: "Unexpected error", detail: String(err) }, { status: 500 });
  }
}
