import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import {
  generatePrompt,
  buildFocusedPrompt,
  generateNegativePrompt,
  type PromptInput,
  type ChangeType,
} from "@/lib/generatePrompt";
import { generateBackdropSVG } from "@/lib/backdropSVG";
import { svgToBase64PNG } from "@/lib/svgToBase64";

// Reference-image-guided generation — uses SVG silhouette as structural anchor.
const KONTEXT_MODEL = "fal-ai/flux-pro/kontext";
const KONTEXT_ENDPOINT = `https://fal.run/${KONTEXT_MODEL}`;

// A/B test: "ai" = plinths rendered by the AI model; "svg" = CSS overlay only.
const PLINTH_MODE: "ai" | "svg" = "ai";

// Safety switch: when false, all requests use full t2i regardless of changeType.
const ENABLE_IMG2IMG = false;

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = PromptInput & {
  baseImageUrl?: string;
  changeType?: string;
};

export async function POST(req: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { error: "Image generation is not configured (missing FAL_KEY)." },
      { status: 500 }
    );
  }

  let rawBody: RequestBody;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!rawBody.theme || !rawBody.package) {
    return NextResponse.json(
      { error: "Missing required fields: theme, package." },
      { status: 400 }
    );
  }

  const { baseImageUrl, changeType: rawChangeType, ...promptFields } = rawBody;

  const promptInput: PromptInput = {
    ...promptFields,
    plinthSizes: PLINTH_MODE === "ai" ? (promptFields.plinthSizes ?? []) : undefined,
  };

  // img2img path: incremental edits on top of the last generated image.
  const useImg2Img =
    ENABLE_IMG2IMG &&
    typeof baseImageUrl === "string" &&
    baseImageUrl.length > 0 &&
    !!rawChangeType &&
    rawChangeType !== "full" &&
    rawChangeType !== "theme";

  try {
    if (useImg2Img) {
      const changeType = rawChangeType as ChangeType;
      const focusedPrompt = buildFocusedPrompt(changeType, promptInput);

      const falRes = await fetch(KONTEXT_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: focusedPrompt,
          image_url: baseImageUrl,
          image_size: "landscape_4_3",
          output_format: "jpeg",
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
        }),
      });

      if (!falRes.ok) {
        const detail = await falRes.text();
        return NextResponse.json(
          { error: "fal.ai kontext request failed", detail },
          { status: 502 }
        );
      }

      const result = await falRes.json();
      const imageUrl: string | undefined = result?.images?.[0]?.url;
      if (!imageUrl) {
        return NextResponse.json(
          { error: "fal.ai kontext returned no image", result },
          { status: 502 }
        );
      }

      return NextResponse.json({ imageUrl, prompt: focusedPrompt, mode: "img2img" });
    }

    // Full generation: build prompt, generate SVG silhouette, upload as reference.
    const { prompt: basePrompt } = generatePrompt(promptInput);
    const negativePrompt = generateNegativePrompt(promptInput.backdropShapes);

    // Append reference-image adherence instructions to the positive prompt.
    const refInstruction =
      "Follow the exact silhouette and panel geometry shown in the reference image. " +
      "Preserve the exact number of backdrop panels and each panel's shape. " +
      "Do not add, remove, or reshape any backdrop panels. " +
      "Render all scene details (balloons, florals, plinths, lighting) around this structure.";
    const prompt = `${basePrompt} ${refInstruction}`;

    // Generate SVG → PNG → upload to fal storage → use as structural reference.
    const shapes = promptInput.backdropShapes ?? [];
    const backdropColor = promptInput.backdropColor ?? "#F0C4C4";
    const svgString = generateBackdropSVG(shapes, backdropColor);
    const pngBuffer = await svgToBase64PNG(svgString);

    fal.config({ credentials: falKey });
    const svgBlob = new Blob([new Uint8Array(pngBuffer)], { type: "image/png" });
    const referenceImageUrl = await fal.storage.upload(svgBlob);

    if (process.env.NODE_ENV === "development") {
      console.log("[generate] backdropShapes:", shapes);
      console.log("[generate] backdropColor:", backdropColor);
      console.log("[generate] referenceImageUrl:", referenceImageUrl);
      console.log("[generate] model:", KONTEXT_MODEL);
      console.log("[generate] prompt:", prompt);
      console.log("[generate] negative_prompt (not sent to kontext):", negativePrompt);
    }

    const falRes = await fetch(KONTEXT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_url: referenceImageUrl,
        image_size: "landscape_4_3",
        output_format: "jpeg",
        num_inference_steps: 35,
        guidance_scale: 4.0,
        num_images: 1,
      }),
    });

    if (!falRes.ok) {
      const detail = await falRes.text();
      return NextResponse.json({ error: "fal.ai request failed", detail }, { status: 502 });
    }

    const result = await falRes.json();
    const imageUrl: string | undefined = result?.images?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "fal.ai returned no image", result }, { status: 502 });
    }

    return NextResponse.json({ imageUrl, prompt, mode: "svg-kontext", plinthMode: PLINTH_MODE });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error generating image", detail: String(err) },
      { status: 500 }
    );
  }
}
