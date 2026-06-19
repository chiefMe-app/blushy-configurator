import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import {
  generatePrompt,
  buildFocusedPrompt,
  generateNegativePrompt,
  type PromptInput,
  type ChangeType,
} from "@/lib/generatePrompt";

// Default text-to-image model.
const FAL_T2I_ENDPOINT = "https://fal.run/fal-ai/flux-2-pro";

// Experimental: reference-image-guided generation.
const KONTEXT_ENDPOINT = "https://fal.run/fal-ai/flux-pro/kontext";

// A/B test: "ai" = plinths rendered by the AI model; "svg" = CSS overlay only.
const PLINTH_MODE: "ai" | "svg" = "ai";

// Safety switch: when false, all requests use full t2i regardless of changeType.
const ENABLE_IMG2IMG = false;

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = PromptInput & {
  baseImageUrl?: string;
  changeType?: string;
  referenceImageBase64?: string;
  useSilhouetteReference?: boolean;
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

  const {
    baseImageUrl,
    changeType: rawChangeType,
    referenceImageBase64,
    useSilhouetteReference,
    ...promptFields
  } = rawBody;

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

    // Full generation.
    const { prompt } = generatePrompt(promptInput);
    const negativePrompt = generateNegativePrompt(promptInput.backdropShapes);

    // Experimental: SVG silhouette reference path.
    // Only active when the client explicitly opts in and provides a PNG.
    if (useSilhouetteReference === true && referenceImageBase64) {
      const refPrompt =
        prompt +
        " Follow the exact silhouette and shape of the reference image." +
        " Preserve the panel geometry shown in the reference image." +
        " The selected backdrop panels must match the reference silhouette exactly." +
        " Do not change the number of panels. Do not change the panel shapes.";

      const pngBuffer = Buffer.from(referenceImageBase64, "base64");
      fal.config({ credentials: falKey });
      const file = new Blob([new Uint8Array(pngBuffer)], { type: "image/png" });
      const referenceImageUrl = await fal.storage.upload(file);

      if (process.env.NODE_ENV === "development") {
        console.log("[generate][experimental] referenceImageUrl:", referenceImageUrl);
        console.log("[generate][experimental] prompt:", refPrompt);
      }

      const falRes = await fetch(KONTEXT_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: refPrompt,
          image_url: referenceImageUrl,
          image_size: "landscape_4_3",
          output_format: "jpeg",
          num_images: 1,
        }),
      });

      if (!falRes.ok) {
        const detail = await falRes.text();
        return NextResponse.json({ error: "fal.ai kontext failed", detail }, { status: 502 });
      }

      const result = await falRes.json();
      const imageUrl: string | undefined = result?.images?.[0]?.url;
      if (!imageUrl) {
        return NextResponse.json({ error: "fal.ai kontext returned no image", result }, { status: 502 });
      }

      return NextResponse.json({ imageUrl, prompt: refPrompt, mode: "svg-kontext", plinthMode: PLINTH_MODE });
    }

    // Default: strict text-to-image.
    if (process.env.NODE_ENV === "development") {
      console.log("[generate] backdropShapes:", promptInput.backdropShapes);
      console.log("[generate] prompt:", prompt);
      console.log("[generate] negative_prompt:", negativePrompt);
    }

    const falRes = await fetch(FAL_T2I_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        image_size: "landscape_4_3",
        output_format: "jpeg",
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

    return NextResponse.json({ imageUrl, prompt, mode: "t2i", plinthMode: PLINTH_MODE });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error generating image", detail: String(err) },
      { status: 500 }
    );
  }
}
