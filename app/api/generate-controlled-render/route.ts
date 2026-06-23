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

// first_generate: pure text-to-image — photorealistic, no control image passed
const FAL_T2I_ENDPOINT    = "https://fal.run/fal-ai/flux-2-pro";

// edit_existing: image-to-image on the already-beautiful photorealistic render
const KONTEXT_ENDPOINT    = "https://fal.run/fal-ai/flux-pro/kontext";

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
// Prompt builders
// ---------------------------------------------------------------------------

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

const BALLOON_STYLE: Record<string, string> = {
  half:    "asymmetric organic balloon garland cascading from the top corner down one side, " +
           "with a floor balloon cluster, varied balloon sizes (large, medium, small), " +
           "layered depth, glossy latex balloons, professional balloon styling",
  full:    "full organic balloon frame around the backdrop group, " +
           "varied balloon sizes, rich layered depth, glossy latex balloons",
  premium: "dense luxury organic balloon installation with large, medium, small, and mini latex balloons, " +
           "rich layered depth, high-end editorial balloon styling",
  none:    "",
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

  const plinthClause = plinthCount === 0
    ? "No plinths."
    : plinthCount === 1
      ? "Plinths: exactly one (1) narrow white cylindrical display plinth, " +
        "realistic slim cylinder, 40 cm diameter, tall slender column, " +
        "NOT a stage, NOT a podium, NOT a wide platform, subtle floor shadow. " +
        "Do not add a second plinth."
      : `Plinths: exactly ${plinthCount} narrow white cylindrical display plinths, ` +
        "realistic slim cylinders, 40 cm diameter each, tall slender columns, " +
        "NOT stages, NOT podiums, NOT wide platforms, subtle floor shadows. " +
        `Do not add extra plinths beyond ${plinthCount}.`;

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
  const scaleRefClause = hasArch && plinthCount > 0
    ? `SCALE REFERENCE: the white cylindrical plinth is 40 cm diameter. ` +
      `The arch backdrop panel is approximately 100 cm wide — about 2.5 times the plinth diameter. ` +
      `Use this ratio to judge the correct arch panel width in the scene. ` +
      `The arch must NOT appear wider than 2.5 plinths placed side by side. ` +
      `The plinth is 40 cm diameter. The plinth is tall and narrow, not low or table-like.`
    : "";

  // Text-enabled lock clauses — only injected when at least one panel has active text
  const textEnabled = sceneModel.panels.some((p) => p.text.enabled && p.text.value.trim());

  const lockBalloonColors = sceneModel.balloons.colors.length > 0
    ? sceneModel.balloons.colors.slice(0, 4).join(", ")
    : "the currently selected palette";

  const balloonLockClause = textEnabled && sceneModel.balloons.style !== "none"
    ? `[Balloon Installation Lock]: The currently configured organic balloon garland is ` +
      `completely locked in its structure, composition, density, silhouette, and volume. ` +
      `It must preserve the same continuous flow, same fullness, same rich nested sizing, ` +
      `and same exact positioning as in the standard render without text. ` +
      `Introducing or updating text on the backdrop surface must not alter, shift, shrink, ` +
      `thin out, simplify, or reposition the balloon garland in any way. ` +
      `Preserve the identical balloon installation layout exactly as already established in the scene. ` +
      `The locked balloon garland must use strictly the currently selected balloon color palette: ` +
      `${lockBalloonColors}. Do not introduce stray colors, and do not modify the garland's density, ` +
      `silhouette, or overall volume while applying these colors.`
    : "";

  const plinthLockClause = textEnabled && plinthCount > 0
    ? `[Foreground Plinth Lock]: The currently selected foreground plinth configuration is ` +
      `completely locked. Preserve the exact plinth count (${plinthCount}), exact height, ` +
      `exact diameter (40 cm), exact slender proportions, exact floor position, and exact spacing ` +
      `as configured in the standard render without text. ` +
      `Text on the backdrop is completely independent from the plinth zone and must not modify, ` +
      `upscale, widen, thicken, shorten, duplicate, or reposition any plinth. ` +
      (plinthCount === 1 ? "Do not add a second plinth. " : `Maintain exactly ${plinthCount} plinths. `)
    : "";

  const textSurfaceOnlyLockClause = textEnabled
    ? `[Text Surface Only Lock]: Treat all text as a flat surface-level graphic applied only to ` +
      `the backdrop face. Text must not cause any physical decor element to be regenerated, ` +
      `resized, repositioned, duplicated, removed, recolored, widened, shortened, or simplified.`
    : "";

  return [
    STYLE_PREFIX,
    ENV_CLAUSE,
    basePrompt,
    whitelistClause,
    ISOLATION_CLAUSE,
    panelCount_str,
    scaleRefClause,
    balloonClause,
    plinthClause,
    balloonLockClause,
    plinthLockClause,
    textSurfaceOnlyLockClause,
    buildCompositionBlueprintClause(sceneModel, textEnabled),
    buildVisibleTextRenderClause(sceneModel),
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

  const textNeg    = !hasText
    ? ", text overlay, words on backdrop, birthday message, name signage, logo, " +
      "typography, lettering, handwriting, calligraphy"
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

  // Text-enabled drift negatives — only added when backdrop text is active
  const textDriftNeg = hasText
    ? ", shifted garland, sparse garland, reduced balloon volume, thinner garland, " +
      "simplified garland, altered balloon layout, changed balloon silhouette, missing floor balloons, " +
      "thick plinth, wide plinth, distorted plinth, enlarged plinth, shortened plinth, " +
      "duplicate plinth, extra plinth, repositioned plinth"
    : "";

  // Step C — conditional negatives for text visibility, garland continuity, plinth omission

  // 1. Text visibility negatives
  const textVisibilityNeg = hasText
    ? ", missing text, omitted text, invisible text, unreadable text, illegible text, " +
      "text blending into backdrop, text hidden behind balloons, cropped text, tiny text"
    : "";

  // 2. Garland continuity negatives (when balloons are present)
  const hasBalloons = sceneModel?.balloons?.style !== "none";
  const garlandContinuityNeg = hasBalloons
    ? ", partial garland, broken garland continuity, garland stopping above floor, " +
      "detached floor balloon cluster, disconnected balloon pile, sparse lower garland, " +
      "missing lower balloons, balloon garland moved to opposite side"
    : "";

  // 3. Plinth omission negatives — applies whenever plinths are configured (not limited to text renders)
  const hasPlinths = (sceneModel?.plinths?.length ?? 0) > 0;
  const plinthOmissionNeg = hasPlinths
    ? ", missing plinth, omitted plinth, invisible plinth, plinth disappeared, plinth hidden, " +
      "plinth blended into backdrop, plinth merged with backdrop, cropped plinth, " +
      "removed plinth, absent foreground plinth"
    : "";

  // 4. Platform/base suppression — whenever a backdrop or plinth is configured
  const hasBackdrop = items.length > 0;
  const platformBaseNeg = (hasBackdrop || hasPlinths)
    ? ", stage, podium base, semicircle platform, oval platform, raised platform, " +
      "pedestal base attached to backdrop, backdrop base extension, " +
      "platform under backdrop, fake base platform"
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
    console.log("model:                   fal-ai/flux-2-pro (text-to-image, NO image_url)");
    console.log("Production Preview:      NOT used as image_url");
    console.log("controlImageBase64:      ", !!controlImageBase64, "(reserved for ControlNet)");
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
    // Visible Production Layout Preview is NOT passed as image_url.
    // Structure comes entirely from the detailed text prompt.
    // This ensures the output is fully photorealistic, not a styled layout copy.
    const { prompt: basePrompt } = generatePrompt(promptInput);
    const finalPrompt            = buildFirstGenPrompt(sceneModel, basePrompt, promptInput);
    const negativePrompt         = buildNegativePrompt(sceneModel.panels, hasText, hasGraphic, promptInput, sceneModel);

    if (process.env.NODE_ENV === "development") {
      console.log("[generate-controlled-render] → calling fal-ai/flux-2-pro (new fal call, no cache)");
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
    });

  } catch (err) {
    return NextResponse.json({ error: "Unexpected error", detail: String(err) }, { status: 500 });
  }
}
