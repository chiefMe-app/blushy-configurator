import { NextRequest, NextResponse } from "next/server";
import { generatePrompt, type PromptInput } from "@/lib/generatePrompt";

// fal.ai flux-2-pro (synchronous run). FAL_KEY stays server-side only.
const FAL_MODEL = "fal-ai/flux-2-pro";
const FAL_ENDPOINT = `https://fal.run/${FAL_MODEL}`;

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

  let body: PromptInput;
  try {
    body = (await req.json()) as PromptInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.theme || !body.package) {
    return NextResponse.json(
      { error: "Missing required fields: theme, package." },
      { status: 400 }
    );
  }

  const { prompt, negativePrompt } = generatePrompt(body);

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

    return NextResponse.json({ imageUrl, prompt });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error generating image", detail: String(err) },
      { status: 500 }
    );
  }
}
