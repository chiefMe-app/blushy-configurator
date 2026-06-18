import { NextRequest, NextResponse } from "next/server";
import {
  generatePrompt,
  buildFocusedPrompt,
  PLINTH_NEGATIVE,
  type PromptInput,
  type ChangeType,
} from "@/lib/generatePrompt";

// Text-to-image: full scene generation.
const FAL_MODEL = "fal-ai/flux-2-pro";
const FAL_ENDPOINT = `https://fal.run/${FAL_MODEL}`;

// Image-to-image: incremental edits on top of existing image.
const KONTEXT_MODEL = "fal-ai/flux-pro/kontext";
const KONTEXT_ENDPOINT = `https://fal.run/${KONTEXT_MODEL}`;

// A/B test: "ai" = plinths rendered by the AI model; "svg" = CSS overlay only.
// Change to "svg" to revert to overlay mode.
const PLINTH_MODE: "ai" | "svg" = "ai";

// Safety switch: when false, all requests use full text-to-image regardless of
// changeType. Re-enable once shape/count stability is confirmed.
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

  // Use img2img (kontext) only when explicitly enabled and the change is minor.
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
          strength: 0.65,
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
      console.log("kontext result:", JSON.stringify(result));
      const imageUrl: string | undefined = result?.images?.[0]?.url;
      if (!imageUrl) {
        return NextResponse.json(
          { error: "fal.ai kontext returned no image", result },
          { status: 502 }
        );
      }

      return NextResponse.json({ imageUrl, prompt: focusedPrompt, mode: "img2img" });
    }

    // Full text-to-image generation.
    const { prompt, negativePrompt } = generatePrompt(promptInput);
    const finalNegative =
      PLINTH_MODE === "ai" ? `${negativePrompt}, ${PLINTH_NEGATIVE}` : negativePrompt;

    const falRes = await fetch(FAL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: finalNegative,
        image_size: "landscape_4_3",
        output_format: "jpeg",
      }),
    });

    if (!falRes.ok) {
      const detail = await falRes.text();
      return NextResponse.json({ error: "fal.ai request failed", detail }, { status: 502 });
    }

    const result = await falRes.json();
    console.log("t2i result:", JSON.stringify(result));
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
