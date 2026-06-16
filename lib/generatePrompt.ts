// ---------------------------------------------------------------------------
// Builds the fal.ai prompt for the photorealistic preview.
// Pure + side-effect free so it can run on the server (route.ts) where the
// FAL_KEY lives. The exact prompt structure is:
//
// "professional event photography, [VENUE_CONTEXT], [BACKDROP_DESCRIPTION],
//  [BALLOON_DESCRIPTION], [EXTRAS_DESCRIPTION], luxury Dubai party setup,
//  soft natural lighting, wide shot, photorealistic, 8k, --ar 4:3"
// ---------------------------------------------------------------------------

import type { ThemeId, PackageId, BalloonStyleId } from "./config";

/** BACKDROP_DESCRIPTION — keyed by theme. */
const THEME_BACKDROP: Record<ThemeId, string> = {
  blush_pink: "soft blush pink arch backdrop with cream and white tones",
  unicorn:
    "pastel rainbow unicorn themed arch backdrop with iridescent decorations",
  safari:
    "earthy safari themed backdrop with animal print accents and jungle elements",
  princess: "pink and gold princess themed backdrop with crown decorations",
  baby_blue: "baby blue and white arch backdrop with silver accents",
  fairy_garden:
    "sage green fairy garden backdrop with dusty rose and butterfly elements",
  football: "football themed backdrop with grass green and team colors",
  space:
    "deep navy space themed backdrop with silver stars and planet elements",
  luxury_neutral: "beige champagne and gold luxury neutral backdrop",
  pastel_rainbow:
    "full pastel rainbow backdrop with soft multi-color elements",
};

/** VENUE_CONTEXT — keyed by package. */
const PACKAGE_VENUE: Record<PackageId, string> = {
  mini: "single backdrop with small balloon garland, one decorative plinth",
  signature:
    "two arch backdrops side by side with organic balloon garland, two plinths, custom name sign",
  luxury:
    "three premium backdrops with full balloon styling, themed props, dessert table styling zone",
};

/** BALLOON_DESCRIPTION — keyed by balloon style ("none" → omitted). */
const BALLOON_DESC: Record<BalloonStyleId, string> = {
  none: "",
  half: "organic balloon garland on one side of the backdrop, clusters touching the ground",
  full: "lush organic balloon garland framing both sides of the backdrop, floor to top, clusters at base",
  premium:
    "premium organic balloon installation completely surrounding the backdrop with varied sizes and flower accents",
};

/** EXTRAS_DESCRIPTION — keyed by extra id. */
const EXTRAS_DESC: Record<string, string> = {
  florals: "fresh floral clusters at base and sides",
  dessert_table: "styled dessert and cake table in foreground",
  neon: "glowing neon sign above backdrop",
  carpet: "white floor runner leading to backdrop",
};

export const NEGATIVE_PROMPT =
  "floating balloons, strings, cartoon, drawing, illustration, people, children, text overlay, watermark";

export interface PromptInput {
  theme: ThemeId;
  package: PackageId;
  balloonStyle: BalloonStyleId;
  /** Extra ids: "florals" | "dessert_table" | "neon" | "carpet". */
  extras?: string[];
}

export function generatePrompt(input: PromptInput): {
  prompt: string;
  negativePrompt: string;
} {
  const venue = PACKAGE_VENUE[input.package] ?? "";
  const backdrop = THEME_BACKDROP[input.theme] ?? "";
  const balloons = BALLOON_DESC[input.balloonStyle] ?? "";
  const extras = (input.extras ?? [])
    .map((id) => EXTRAS_DESC[id])
    .filter(Boolean)
    .join(", ");

  const prompt = [
    "professional event photography",
    venue,
    backdrop,
    balloons,
    extras,
    "luxury Dubai party setup",
    "soft natural lighting",
    "wide shot",
    "photorealistic",
    "8k",
    "--ar 4:3",
  ]
    .filter(Boolean)
    .join(", ");

  return { prompt, negativePrompt: NEGATIVE_PROMPT };
}
