import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const FAL_T2I   = "https://fal.run/fal-ai/flux-2-pro";
const FAL_REMBG = "https://fal.run/fal-ai/imageutils/rembg";

const SET_COUNTS: Record<string, number> = { small: 2, medium: 4, premium: 7 };

// ---------------------------------------------------------------------------
// Commercial-safe standee prompts per theme (7 slots: 6 regular + 1 feature).
// No trademarked character names or official artwork.
// ---------------------------------------------------------------------------
const THEME_PROMPTS: Record<string, string[]> = {
  frozen: [
    "single ice princess inspired party standee prop, sparkly blue ballgown, silver tiara, full body front-facing, isolated on pure white background, no scene no backdrop no balloons no floor",
    "single cute snowman party standee, top hat with ribbon, colorful scarf, coal button smile, stick arms, full body front-facing, isolated on pure white background, no scene",
    "single ice castle tower party prop standee, blue and silver turrets with flag, isolated on pure white background, no scene",
    "single large decorative snowflake party standee prop, blue and silver crystal arms, isolated on pure white background, no scene",
    "single ice crystal gem party prop, faceted blue diamond shape, isolated on pure white background, no scene",
    "single winter star burst party prop, silver and ice blue points, isolated on pure white background, no scene",
    "single oversized deluxe ice queen inspired party standee, grand glittery blue gown, crystal crown, hero centerpiece prop, full body, isolated on pure white background, no scene",
  ],
  unicorn: [
    "single rainbow unicorn party standee prop, colorful flowing mane, golden horn, full body front-facing, isolated on pure white background, no scene",
    "single rainbow arch party prop standee, pastel colors, cloud base, isolated on pure white background, no scene",
    "single large glitter star party standee prop, pink and gold, isolated on pure white background, no scene",
    "single pastel pink heart party prop standee, isolated on pure white background, no scene",
    "single magic wand party prop standee, star tip, pink sparkles, isolated on pure white background, no scene",
    "single fluffy white cloud party prop, rainbow accent, isolated on pure white background, no scene",
    "single oversized unicorn hero standee, full body rainbow mane, golden horn, grand centerpiece party prop, isolated on pure white background, no scene",
  ],
  princess: [
    "single ornate royal crown party standee prop, pink and gold jewels, isolated on pure white background, no scene",
    "single fairy tale castle party prop standee, pink turrets, flag on tower, isolated on pure white background, no scene",
    "single magic wand with star party prop, pink sparkly, isolated on pure white background, no scene",
    "single golden carriage silhouette party standee prop, pink and gold, isolated on pure white background, no scene",
    "single large pink rose flower party standee prop, isolated on pure white background, no scene",
    "single pink glitter heart party prop standee, isolated on pure white background, no scene",
    "single grand princess inspired party standee, pink ballgown, tiara, full body hero centerpiece, isolated on pure white background, no scene",
  ],
  barbie: [
    "single glam fashion doll inspired party standee, sparkly pink dress, full body front-facing, isolated on pure white background, no scene",
    "single high heel shoe party prop standee, hot pink glitter, isolated on pure white background, no scene",
    "single pink crown tiara party prop standee, isolated on pure white background, no scene",
    "single pink star burst party prop standee, glam, isolated on pure white background, no scene",
    "single pink shopping bag party prop standee, handles, isolated on pure white background, no scene",
    "single pink glitter heart party prop standee, isolated on pure white background, no scene",
    "single oversized glam fashion doll inspired hero standee, grand pink gown, full body centerpiece, isolated on pure white background, no scene",
  ],
  dinosaur: [
    "single cute cartoon T-Rex dinosaur party standee, green friendly face, full body front-facing, isolated on pure white background, no scene",
    "single cute long-neck dinosaur party standee, green spots, full body, isolated on pure white background, no scene",
    "single tropical palm tree party prop standee, green leaves, isolated on pure white background, no scene",
    "single large dinosaur footprint party prop standee, isolated on pure white background, no scene",
    "single cracked dinosaur egg party prop standee, isolated on pure white background, no scene",
    "single small cartoon volcano party prop standee, isolated on pure white background, no scene",
    "single oversized fierce T-Rex hero standee, full body cartoon dinosaur, grand centerpiece party prop, isolated on pure white background, no scene",
  ],
  safari: [
    "single cute cartoon lion face party standee, fluffy mane, front-facing, isolated on pure white background, no scene",
    "single cartoon giraffe party standee, spots, full body friendly, isolated on pure white background, no scene",
    "single tropical palm tree party prop standee, coconuts, isolated on pure white background, no scene",
    "single safari animal paw print party prop standee, isolated on pure white background, no scene",
    "single safari binoculars party prop standee, brown tan, isolated on pure white background, no scene",
    "single cartoon elephant party standee prop, grey friendly, isolated on pure white background, no scene",
    "single oversized lion hero party standee, majestic mane, full body cartoon lion, grand centerpiece, isolated on pure white background, no scene",
  ],
  mermaid: [
    "single mermaid inspired party standee, colorful shimmery tail, full body front-facing, isolated on pure white background, no scene",
    "single large decorative seashell party prop, pink pearl inside, isolated on pure white background, no scene",
    "single large starfish party prop standee, orange texture, isolated on pure white background, no scene",
    "single coral party prop standee, pink orange, isolated on pure white background, no scene",
    "single ocean wave party prop standee, teal and white foam, isolated on pure white background, no scene",
    "single treasure chest party prop standee, gold coins, isolated on pure white background, no scene",
    "single oversized mermaid hero standee, grand shimmery tail, full body, grand centerpiece party prop, isolated on pure white background, no scene",
  ],
  space: [
    "single cartoon rocket ship party standee, red silver fins, full body, isolated on pure white background, no scene",
    "single planet with rings party prop standee, colorful Saturn-like, isolated on pure white background, no scene",
    "single large yellow star party prop standee, glowing, isolated on pure white background, no scene",
    "single crescent moon party prop standee, yellow smiling, isolated on pure white background, no scene",
    "single astronaut helmet party prop standee, white visor, isolated on pure white background, no scene",
    "single friendly cartoon alien party standee, green round body, full body, isolated on pure white background, no scene",
    "single oversized rocket hero standee, detailed fins flames, grand centerpiece party prop, isolated on pure white background, no scene",
  ],
  teddy_bear: [
    "single cute brown teddy bear party standee, bow tie, full body front-facing, isolated on pure white background, no scene",
    "single large red heart party prop standee, isolated on pure white background, no scene",
    "single pink bow ribbon party prop standee, large, isolated on pure white background, no scene",
    "single honey pot party prop standee, yellow with bee, isolated on pure white background, no scene",
    "single colorful balloon bouquet party prop standee, isolated on pure white background, no scene",
    "single gold glitter star party prop standee, isolated on pure white background, no scene",
    "single oversized teddy bear hero standee, extra fluffy brown bear, bow tie, grand centerpiece party prop, isolated on pure white background, no scene",
  ],
};

const GENERIC_PROMPTS = [
  "single party star standee prop, gold glitter, isolated on pure white background, no scene",
  "single party heart standee prop, pink, isolated on pure white background, no scene",
  "single party balloon cluster standee prop, colorful, isolated on pure white background, no scene",
  "single party crown standee prop, gold, isolated on pure white background, no scene",
  "single confetti burst standee prop, multicolor, isolated on pure white background, no scene",
  "single sparkle star standee prop, rainbow glitter, isolated on pure white background, no scene",
  "single oversized gold star hero standee, grand centerpiece party prop, isolated on pure white background, no scene",
];

export interface CutoutAsset {
  id: string;
  url: string;
  widthCm: number;
  heightCm: number;
  isFeature: boolean;
  recommendedPosition: "floor" | "backdrop";
}

async function generateImage(prompt: string, falKey: string): Promise<string | null> {
  try {
    const res = await fetch(FAL_T2I, {
      method: "POST",
      headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        negative_prompt:
          "full scene, room, interior, venue, floor, balloons, backdrop, people group, crowd, " +
          "multiple objects, background scene, gradient background, busy background, shadow on background",
        image_size: "portrait_4_3",
        output_format: "jpeg",
        num_images: 1,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.images?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

async function removeBackground(imageUrl: string, falKey: string): Promise<string> {
  try {
    const res = await fetch(FAL_REMBG, {
      method: "POST",
      headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl }),
    });
    if (!res.ok) return imageUrl; // fall back to original
    const data = await res.json();
    return data?.image?.url ?? imageUrl;
  } catch {
    return imageUrl; // fall back gracefully
  }
}

async function generateCutoutAsset(
  prompt: string,
  idx: number,
  isFeature: boolean,
  falKey: string,
): Promise<CutoutAsset | null> {
  const imageUrl = await generateImage(prompt, falKey);
  if (!imageUrl) return null;

  const transparentUrl = await removeBackground(imageUrl, falKey);

  return {
    id: `cutout_${idx}_${Date.now()}`,
    url: transparentUrl,
    widthCm:  isFeature ? 50 : 30,
    heightCm: isFeature ? 120 : 80,
    isFeature,
    recommendedPosition: isFeature ? "floor" : "floor",
  };
}

export async function POST(req: NextRequest) {
  // ── Production guard ──────────────────────────────────────────────────────
  // This endpoint calls fal-ai/flux-2-pro (expensive) to generate cutout sets.
  // Standees are now served as deterministic PNG overlays, so this generation
  // path is disabled unless explicitly enabled, to prevent accidental Pro usage.
  if (process.env.ENABLE_CUTOUT_GENERATION !== "true") {
    console.warn(
      "[api/generate-cutouts] BLOCKED: fal-ai/flux-2-pro cutout generation is disabled. " +
      "Set ENABLE_CUTOUT_GENERATION=true to re-enable."
    );
    return NextResponse.json({ error: "cutout_generation_disabled" }, { status: 410 });
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json({ error: "Missing FAL_KEY." }, { status: 500 });
  }

  let body: { themeId?: string; cutoutSetSize?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { themeId = "luxury_neutral", cutoutSetSize = "small" } = body;
  const count  = SET_COUNTS[cutoutSetSize] ?? 2;
  const prompts = THEME_PROMPTS[themeId] ?? GENERIC_PROMPTS;

  // Build per-asset jobs: last slot is the feature piece for premium
  const jobs = Array.from({ length: count }, (_, i) => {
    const isFeature = cutoutSetSize === "premium" && i === count - 1;
    const prompt    = prompts[i] ?? prompts[prompts.length - 1];
    return generateCutoutAsset(prompt, i, isFeature, falKey);
  });

  // Generate all assets in parallel
  const results = await Promise.all(jobs);
  const assets  = results.filter((a): a is CutoutAsset => a !== null);

  if (process.env.NODE_ENV === "development") {
    console.log(`[generate-cutouts] theme=${themeId} size=${cutoutSetSize} generated=${assets.length}/${count}`);
  }

  return NextResponse.json({ assets, themeId, cutoutSetSize });
}
