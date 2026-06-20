/**
 * Controlled Final Design Render pipeline.
 *
 * Uses the deterministic Production Layout Preview as a structural control image
 * passed to fal-ai/flux-pro/kontext (image-to-image), so the AI output preserves
 * exact panel count, shapes, proportions, and plinth placement.
 *
 * Production Layout Preview and future export package use scene state as source
 * of truth. AI render is a visual preview, not the production measurement source.
 *
 * TODO: Small visual edits should use image-to-image / Kontext editing with
 * currentFinalRender as image_url, not full text-to-image regeneration.
 */

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import {
  generatePrompt,
  generateNegativePrompt,
  type PromptInput,
} from "@/lib/generatePrompt";
import { type SceneModel } from "@/lib/buildSceneModel";

// fal-ai/flux-pro/kontext: image-to-image, preserves structure from reference.
const KONTEXT_ENDPOINT = "https://fal.run/fal-ai/flux-pro/kontext";

export const runtime    = "nodejs";
export const maxDuration = 90;

type RenderMode = "first_generate" | "edit_existing";

interface RequestBody {
  promptInput:          PromptInput;
  sceneModel:           SceneModel;
  controlImageBase64:   string;           // PNG from Production Layout Preview
  previousFinalRenderUrl?: string;        // stored currentFinalRenderUrl for edits
  renderMode:           RenderMode;
  editDescription?:     string;           // used in edit_existing mode
}

/** Build a structure-preserving prompt for the controlled render. */
function buildControlledPrompt(sceneModel: SceneModel, basePrompt: string): string {
  const panelCount = sceneModel.panels.length;
  const panelWord  = panelCount === 1 ? "panel" : "panels";

  const structureInstruction =
    `Preserve the EXACT structure from the reference control image: ` +
    `exactly ${panelCount} backdrop ${panelWord}, ` +
    `exact panel silhouettes, relative sizes, spacing, and plinth positions. ` +
    `Do NOT add extra panels. Do NOT remove panels. Do NOT change panel shapes or proportions.`;

  return `${basePrompt} ${structureInstruction}`;
}

/** Negative prompt — adds structure-specific terms on top of scene negatives. */
function buildControlledNegative(
  items: SceneModel["panels"],
  hasText: boolean,
): string {
  const baseItems = items.map((p) => ({
    type: p.type, widthCm: p.widthCm, heightCm: p.heightCm,
    text:    { enabled: p.text.enabled,    value: p.text.value,    fontStyle: p.text.fontStyle as "script" | "block" | "elegant", color: p.text.color },
    graphic: { enabled: p.graphic.enabled, style: p.graphic.style, theme: "" },
    sizeId:  p.sizeId, id: p.id, color: p.color, order: p.order,
    backdropColor: "", balloonStyle: "none" as const,
  }));

  const sceneNeg = generateNegativePrompt(baseItems as Parameters<typeof generateNegativePrompt>[0]);

  const structureNeg =
    "wrong number of panels, extra backdrop, missing backdrop, " +
    "changed panel shape, wrong panel proportions, " +
    "oversized backdrop wall, wide arch wall, " +
    "wrong plinth count, oversized plinth, stage platform, podium";

  const textNeg = !hasText
    ? ", text overlay, words on backdrop, birthday message, name signage, logo, typography, lettering"
    : "";

  return `${sceneNeg}, ${structureNeg}${textNeg}`;
}

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

  const { promptInput, sceneModel, controlImageBase64, previousFinalRenderUrl, renderMode, editDescription } = body;

  if (!controlImageBase64 && renderMode === "first_generate") {
    return NextResponse.json({ error: "controlImageBase64 required for first_generate." }, { status: 400 });
  }

  const hasText = sceneModel.panels.some((p) => p.text.enabled && p.text.value.trim());

  if (process.env.NODE_ENV === "development") {
    console.group("[generate-controlled-render]");
    console.log("model:                  fal-ai/flux-pro/kontext");
    console.log("renderMode:             ", renderMode);
    console.log("controlImageBase64:     ", controlImageBase64 ? `${controlImageBase64.length} chars` : "none");
    console.log("previousFinalRenderUrl: ", previousFinalRenderUrl ?? "none");
    console.log("panelCount:             ", sceneModel.panels.length);
    sceneModel.panels.forEach((p, i) => {
      console.log(`  panel ${i + 1}: type=${p.type} sizeId=${p.sizeId} ${p.widthCm}×${p.heightCm}cm color=${p.color}`);
    });
    console.groupEnd();
  }

  fal.config({ credentials: falKey });

  try {
    // ── Edit existing render (small change) ────────────────────────────────
    if (renderMode === "edit_existing" && previousFinalRenderUrl) {
      /*
       * TODO: Small visual edits should use fal-ai/flux-pro/kontext with
       * currentFinalRenderUrl as image_url to preserve venue, camera, light,
       * balloons, and composition.
       */
      const editPrompt =
        editDescription
          ? `${editDescription}. Keep the room, camera angle, floor, lighting, balloon arrangement, backdrop count, panel shapes, plinth position and overall composition identical.`
          : `Refine the design. Keep all structural elements — room, camera angle, floor, lighting, balloon arrangement, backdrop count, panel shapes, and plinth positions — completely identical.`;

      const falRes = await fetch(KONTEXT_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:                editPrompt,
          image_url:             previousFinalRenderUrl,
          image_size:            "landscape_4_3",
          output_format:         "jpeg",
          num_images:            1,
        }),
      });

      if (!falRes.ok) {
        const detail = await falRes.text();
        return NextResponse.json({ error: "Edit render failed", detail }, { status: 502 });
      }

      const result   = await falRes.json();
      const imageUrl = result?.images?.[0]?.url as string | undefined;
      if (!imageUrl) return NextResponse.json({ error: "No image returned", result }, { status: 502 });

      if (process.env.NODE_ENV === "development") {
        console.log("[generate-controlled-render] edit done:", imageUrl);
      }

      return NextResponse.json({ imageUrl, mode: "edit_existing", model: "fal-ai/flux-pro/kontext" });
    }

    // ── First generate — upload control image, run Kontext ─────────────────
    const pngBuffer     = Buffer.from(controlImageBase64, "base64");
    const controlBlob   = new Blob([new Uint8Array(pngBuffer)], { type: "image/png" });
    const controlUrl    = await fal.storage.upload(controlBlob);

    const { prompt: basePrompt } = generatePrompt(promptInput);
    const controlledPrompt       = buildControlledPrompt(sceneModel, basePrompt);
    const negativePrompt         = buildControlledNegative(sceneModel.panels, hasText);

    if (process.env.NODE_ENV === "development") {
      console.log("[generate-controlled-render] controlUrl:", controlUrl);
      console.log("[generate-controlled-render] prompt:", controlledPrompt);
      console.log("[generate-controlled-render] negative:", negativePrompt);
    }

    const falRes = await fetch(KONTEXT_ENDPOINT, {
      method:  "POST",
      headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt:        controlledPrompt,
        image_url:     controlUrl,
        image_size:    "landscape_4_3",
        output_format: "jpeg",
        num_images:    1,
      }),
    });

    if (!falRes.ok) {
      const detail = await falRes.text();
      return NextResponse.json({ error: "Controlled render failed", detail }, { status: 502 });
    }

    const result   = await falRes.json();
    const imageUrl = result?.images?.[0]?.url as string | undefined;
    if (!imageUrl) return NextResponse.json({ error: "No image returned", result }, { status: 502 });

    return NextResponse.json({
      imageUrl,
      mode:  "first_generate",
      model: "fal-ai/flux-pro/kontext",
    });

  } catch (err) {
    return NextResponse.json({ error: "Unexpected error", detail: String(err) }, { status: 500 });
  }
}
