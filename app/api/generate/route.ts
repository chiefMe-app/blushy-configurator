import { NextRequest, NextResponse } from "next/server";
import { generatePrompt, PLINTH_NEGATIVE, type PromptInput } from "@/lib/generatePrompt";
import type { PlinthSize } from "@/lib/config";

// fal.ai flux-2-pro (synchronous run). FAL_KEY stays server-side only.
const FAL_MODEL = "fal-ai/flux-2-pro";
const FAL_ENDPOINT = `https://fal.run/${FAL_MODEL}`;

// A/B test: "ai" = plinths rendered by the AI model; "svg" = CSS overlay only.
// Change to "svg" to revert to overlay mode.
const PLINTH_MODE: "ai" | "svg" = "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { error: "Image generation is not configured (missing FAL_KEY)." },
      { status: 500 }
    );
  }

  let rawBody: PromptInput & { plinthSizes?: PlinthSize[] };
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

  // Pass plinthSizes to generatePrompt only in AI mode.
  const promptInput: PromptInput = {
    ...rawBody,
    plinthSizes: PLINTH_MODE === "ai" ? (rawBody.plinthSizes ?? []) : undefined,
  };

  const { prompt, negativePrompt } = generatePrompt(promptInput);

  // Merge plinth-specific negative terms in AI mode.
  const finalNegative =
    PLINTH_MODE === "ai"
      ? `${negativePrompt}, ${PLINTH_NEGATIVE}`
      : negativePrompt;

  try {
    const falRes = await fetch(FAL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: "landscape_4_3",
        output_format: "jpeg",
      }),
    });

    if (!falRes.ok) {
      const detail = await falRes.text();
      return NextResponse.json({ error: "fal.ai request failed", detail }, { status: 502 });
    }

    const result = await falRes.json();
    console.log(JSON.stringify(result));
    const imageUrl: string | undefined = result?.images?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "fal.ai returned no image", result }, { status: 502 });
    }

    return NextResponse.json({ imageUrl, prompt, plinthMode: PLINTH_MODE });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error generating image", detail: String(err) },
      { status: 500 }
    );
  }
}
