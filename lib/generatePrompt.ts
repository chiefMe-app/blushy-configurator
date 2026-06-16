// ---------------------------------------------------------------------------
// Builds the fal.ai prompt for the photorealistic preview.
// Pure + side-effect free so it can run on the server (route.ts) where the
// FAL_KEY lives. Structure:
//
// "professional event photography, [THEME] theme party setup, [COUNT] in
//  [BACKDROP_COLOR], [BALLOON_DESC] in [BALLOON_COLORS] tones,
//  [BACKDROP_TEXT], [CUTOUTS], [PLINTHS], [EXTRAS], luxury Dubai party setup,
//  soft natural lighting, wide shot, photorealistic, 8k, --ar 4:3"
// ---------------------------------------------------------------------------

import {
  themeById,
  resolveBackdropText,
  type ThemeId,
  type PackageId,
  type BalloonStyleId,
  type BackdropText,
  type CutoutSelection,
  type PlinthSize,
} from "./config";

/** Backdrop count → phrase (Change 2). */
function countDescription(count: number): string {
  switch (count) {
    case 1:
      return "single arch backdrop";
    case 2:
      return "two arch backdrops side by side";
    case 3:
      return "three arch backdrops arranged together";
    default:
      return `${count} arch backdrops arranged together`;
  }
}

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

const FONT_DESC: Record<string, string> = {
  script: "elegant flowing script lettering",
  block: "bold block lettering",
  elegant: "elegant serif lettering",
};

export const NEGATIVE_PROMPT =
  "floating balloons, strings, cartoon, drawing, illustration, people, children, text overlay, watermark";

export interface PromptInput {
  theme: ThemeId;
  package: PackageId;
  backdropCount: number;
  backdropColor?: string;
  balloonStyle: BalloonStyleId;
  balloonColors?: string[];
  backdropText?: BackdropText;
  cutouts?: CutoutSelection;
  plinthSizes?: PlinthSize[];
  extras?: string[];
}

export function generatePrompt(input: PromptInput): {
  prompt: string;
  negativePrompt: string;
} {
  const theme = themeById(input.theme);
  const themeName = theme?.name ?? "party";

  // Backdrop: count + theme look + chosen color.
  const colorName = input.backdropColor ? hexToColorName(input.backdropColor) : "";
  const backdrop = [
    countDescription(input.backdropCount),
    colorName ? `in ${colorName} tones` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Balloons: style + chosen colors.
  const balloonStyle = BALLOON_DESC[input.balloonStyle] ?? "";
  const balloonColorNames = (input.balloonColors ?? [])
    .slice(0, 4)
    .map(hexToColorName)
    .filter((v, i, a) => v && a.indexOf(v) === i);
  const balloons = balloonStyle
    ? balloonColorNames.length
      ? `${balloonStyle} in ${balloonColorNames.join(", ")} tones`
      : balloonStyle
    : "";

  // Backdrop text.
  let textClause = "";
  if (input.backdropText?.enabled) {
    const text = resolveBackdropText(input.backdropText);
    if (text) {
      const font = FONT_DESC[input.backdropText.fontStyle] ?? "elegant lettering";
      const color =
        input.backdropText.color === "accent" ? "" : `${input.backdropText.color} `;
      textClause = `with "${text}" in ${color}${font} on the backdrop`;
    }
  }

  // Cutouts.
  let cutoutClause = "";
  if (input.cutouts && input.cutouts.size !== "none") {
    cutoutClause =
      input.cutouts.position === "backdrop"
        ? `${themeName} character cutouts mounted on the backdrop surface`
        : `${themeName} character cutouts standing on the floor beside the backdrop`;
  }

  // Plinths.
  let plinthClause = "";
  const sizes = input.plinthSizes ?? [];
  if (sizes.length > 0) {
    const word = sizes.length === 1 ? "one" : sizes.length === 2 ? "two" : "three";
    const varied = new Set(sizes).size > 1;
    plinthClause = `${word} cylindrical display plinth${sizes.length > 1 ? "s" : ""}${
      varied ? " of varying heights" : ""
    }`;
  }

  const extras = (input.extras ?? [])
    .map((id) => EXTRAS_DESC[id])
    .filter(Boolean)
    .join(", ");

  const prompt = [
    "professional event photography",
    `${themeName} theme party setup`,
    backdrop,
    balloons,
    textClause,
    cutoutClause,
    plinthClause,
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

// --- hex → nearest named color --------------------------------------------

const NAMED_COLORS: { name: string; rgb: [number, number, number] }[] = [
  { name: "white", rgb: [255, 255, 255] },
  { name: "ivory", rgb: [245, 240, 232] },
  { name: "beige", rgb: [232, 220, 196] },
  { name: "champagne gold", rgb: [212, 175, 110] },
  { name: "gold", rgb: [212, 175, 55] },
  { name: "black", rgb: [30, 30, 30] },
  { name: "silver", rgb: [200, 200, 205] },
  { name: "blush pink", rgb: [248, 187, 208] },
  { name: "hot pink", rgb: [255, 105, 180] },
  { name: "fuchsia", rgb: [255, 20, 147] },
  { name: "red", rgb: [229, 57, 53] },
  { name: "coral", rgb: [255, 138, 101] },
  { name: "orange", rgb: [255, 143, 0] },
  { name: "yellow", rgb: [253, 216, 53] },
  { name: "lemon", rgb: [255, 241, 118] },
  { name: "mint green", rgb: [165, 214, 167] },
  { name: "sage green", rgb: [184, 201, 168] },
  { name: "green", rgb: [67, 160, 71] },
  { name: "teal", rgb: [77, 208, 225] },
  { name: "baby blue", rgb: [179, 217, 242] },
  { name: "sky blue", rgb: [66, 165, 245] },
  { name: "blue", rgb: [21, 101, 192] },
  { name: "navy", rgb: [26, 35, 126] },
  { name: "lavender", rgb: [179, 157, 219] },
  { name: "purple", rgb: [156, 39, 176] },
  { name: "lilac", rgb: [206, 147, 216] },
  { name: "brown", rgb: [141, 110, 99] },
];

export function hexToColorName(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return "";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  let best = NAMED_COLORS[0];
  let bestDist = Infinity;
  for (const c of NAMED_COLORS) {
    const d =
      (r - c.rgb[0]) ** 2 + (g - c.rgb[1]) ** 2 + (b - c.rgb[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.name;
}
