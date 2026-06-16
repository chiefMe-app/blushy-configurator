import { NextRequest, NextResponse } from "next/server";
import { generatePrompt } from "@/lib/generatePrompt";
import type { ThemeId, PackageId, BalloonStyleId } from "@/lib/config";

// fal.ai flux/dev (synchronous run). FAL_KEY stays server-side only.
const FAL_MODEL = "fal-ai/flux/dev";
const FAL_ENDPOINT = `https://fal.run/${FAL_MODEL}`;

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateBody {
  theme: ThemeId;
  package: PackageId;
  balloonStyle: BalloonStyleId;
  /** Trigger field only — not used in the prompt mapping. */
  backdropShape?: string;
  extras?: string[];
}

export async function POST(req: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { error: "Image generation is not configured (missing FAL_KEY)." },
      { status: 500 }
    );
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.theme || !body.package) {
    return NextResponse.json(
      { error: "Missing required fields: theme, package." },
      { status: 400 }
    );
  }

  const { prompt, negativePrompt } = generatePrompt({
    theme: body.theme,
    package: body.package,
    balloonStyle: body.balloonStyle,
    extras: body.extras,
  });

  try {
    const falRes = await fetch(FAL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        image_size: "landscape_4_3",
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!falRes.ok) {
      const detail = await falRes.text();
      return NextResponse.json(
        { error: "fal.ai request failed", detail },
        { status: 502 }
      );
    }

    const data = await falRes.json();
    const imageUrl: string | undefined = data?.images?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: "fal.ai returned no image", data }, { status: 502 });
    }

    return NextResponse.json({ imageUrl, prompt });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error generating image", detail: String(err) },
      { status: 500 }
    );
  }
}
