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
  force?:                  boolean;     // when true, always call fal — never reuse cached render
  currentSceneHash?:       string;      // hash of visual scene state at time of request
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const STYLE_PREFIX =
  "Photorealistic luxury birthday party event setup in Dubai, UAE. " +
  "Premium high-end event decorator portfolio photograph. " +
  "Soft natural daylight from the left, elegant indoor venue, glossy reflective floor, " +
  "realistic room depth, beautiful lighting, " +
  "narrow white cylindrical display plinths with realistic shadow and rim-light. " +
  "Professional event photography, 4K quality, sharp focus, soft bokeh background.";

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

  const plinthClause = plinthCount > 0
    ? `Plinths: exactly ${plinthCount} narrow white cylindrical display ` +
      `${plinthCount === 1 ? "plinth" : "plinths"}, realistic slim cylinder, ` +
      `40 cm diameter, tall slender column, NOT a stage, NOT a podium, NOT a wide platform, ` +
      `subtle floor shadow.`
    : "No plinths.";

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

  return [
    STYLE_PREFIX,
    basePrompt,
    whitelistClause,
    panelCount_str,
    scaleRefClause,
    balloonClause,
    plinthClause,
  ].filter(Boolean).join(" ");
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

  const plinthNeg  = "wrong plinth shape, wide platform, stage, podium, square pedestal, wide base";

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

  return `${sceneNeg}, ${styleNeg}, ${structureNeg}, ${balloonNeg}, ${plinthNeg}, ${propNeg}${textNeg}${printNeg}`;
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
    force          = false,
    currentSceneHash,
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
          image_size:    "landscape_4_3",
          output_format: "jpeg",
          num_images:    1,
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
        image_size:      "landscape_4_3",
        output_format:   "jpeg",
        num_images:      1,
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
