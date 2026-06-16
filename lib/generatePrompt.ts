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
  type BackdropShapeId,
  type BackdropText,
  type CutoutSelection,
  type PlinthSize,
} from "./config";

/** Wrapper prepended/appended to every prompt (Change 3). */
const PROMPT_PREFIX =
  "Professional event photography of a birthday party setup in Dubai, UAE. ";
const PROMPT_SUFFIX =
  " Wide establishing shot showing the complete full setup from the front. Sharp focus on entire scene. Soft natural lighting. Photorealistic 4k quality. Professional event decoration photography.";

/** Strict per-shape backdrop descriptions (Change 2) — exact verbatim strings. */
const SHAPE_DESC: Record<BackdropShapeId, string> = {
  round_arch:
    "ONE large perfectly circular round backdrop panel, flat circle standing upright, organic balloon garland wrapped completely around the circular edge, NOT an arch, round circle shape only",
  straight_arch:
    "ONE tall arch backdrop with straight vertical sides and rounded top like a doorway, flat bottom, straight sides going up then curving to meet at top center, balloon garland on both sides floor to top",
  half_arch:
    "ONE asymmetric half arch backdrop panel, one side is tall with a curved top, the other side is short and straight, asymmetric silhouette, balloon garland clustered on the tall curved side only",
  rect_with_cutout:
    "ONE large rectangular backdrop frame panel with a round arch-shaped open window cutout in the center, solid rectangular frame around an empty arch opening, like a picture frame with arch hole, balloon garland on sides of frame",
  shimmer_wall:
    "ONE flat rectangular sequin shimmer wall backdrop, entire surface covered in silver metallic sequin mirror tiles, highly reflective disco-ball-like sequin panels, glittery shimmer effect",
  double_arch:
    "EXACTLY TWO separate arch backdrop panels placed side by side with a small gap between them, each arch has straight sides and rounded top, balloon garland framing both arches together",
  mixed_panels:
    "THREE backdrop panels of different heights arranged together, tallest panel in center, shorter panels on each side, staggered height silhouette",
  wavy:
    "ONE backdrop panel with wavy curved top edge, organic wavy silhouette along top, soft flowing curves, balloon garland along the wavy top edge",
};

/** Plain rectangle (no current shape id, kept for completeness). */
const RECT_DESC =
  "ONE flat rectangular backdrop panel, perfectly straight edges on all four sides, no curves anywhere, flat wall panel, balloon garland on sides";

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
  "floating balloons, strings, cartoon, drawing, illustration, people, children, text overlay, watermark, " +
  "floating balloons, balloon strings, cartoon illustration, drawing, sketch, people, children, faces, " +
  "text watermark, blurry, distorted shapes, wrong number of backdrops, extra backdrop panels, missing backdrop panels";

export interface PromptInput {
  theme: ThemeId;
  package: PackageId;
  backdropCount: number;
  backdropShape?: BackdropShapeId;
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

  // Backdrop: strict shape description (Change 2) + chosen color.
  const shapeDesc = input.backdropShape
    ? SHAPE_DESC[input.backdropShape] ?? RECT_DESC
    : RECT_DESC;
  const colorName = input.backdropColor ? hexToColorName(input.backdropColor) : "";
  const backdrop = colorName ? `${shapeDesc}, backdrop in ${colorName} tones` : shapeDesc;

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

  const core = [
    `${themeName} theme`,
    backdrop,
    balloons,
    textClause,
    cutoutClause,
    plinthClause,
    extras,
  ]
    .filter(Boolean)
    .join(", ");

  const prompt = `${PROMPT_PREFIX}${core}.${PROMPT_SUFFIX}`;

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
