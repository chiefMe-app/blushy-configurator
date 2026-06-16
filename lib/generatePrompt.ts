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
  type BackdropPrint,
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

/** Strict per-theme descriptions (Change 2) — exact verbatim strings. */
const THEME_DESC: Record<string, string> = {
  frozen:
    "Frozen Disney theme party, icy pale blue and white backdrop, snowflake and ice crystal decorations, Frozen movie aesthetic",
  unicorn:
    "Unicorn theme party, round circular pink backdrop panel — unicorn face graphic is a flat printed vinyl sticker on the pink circular backdrop surface, 2D flat illustration printed on panel, horn ears and lashes are part of the flat print, NOT 3D sculpted, NOT separate pieces",
  dinosaur:
    "Dinosaur theme party, arch backdrop — jungle and palm tree scene is a flat printed vinyl graphic on the backdrop panel surface, 2D flat printed illustration, sage green and terracotta red color scheme, NOT real trees or 3D elements",
  safari:
    "Safari jungle theme party, warm beige backdrop, tropical leaves and animal silhouettes, earthy neutral tones",
  princess:
    "Princess theme party, soft pink and gold backdrop, castle turret silhouettes, crown and star decorations",
  superhero:
    "Superhero theme party, bold red blue yellow primary colors, city skyline silhouette on backdrop, comic book hero aesthetic",
  barbie:
    "Barbie theme party, hot pink fuchsia backdrop, glamorous Barbie-inspired decoration, pink and white balloon garland",
  bluey:
    "Bluey cartoon theme party, bright blue white and red color scheme, playful family-friendly decoration",
  pokemon:
    "Pokemon theme party, yellow backdrop with red Pokeball graphic, bright cheerful primary colors, adventure theme",
  stitch:
    "Lilo and Stitch theme party, blue tropical Hawaiian backdrop, hibiscus flowers, tropical island aesthetic",
  mermaid:
    "Mermaid theme party, iridescent teal and purple backdrop, seashell and pearl details, underwater ocean atmosphere",
  space:
    "Space galaxy theme party, deep dark navy backdrop with stars and planets painted on, rocket ship and moon elements, silver and gold accents",
  football:
    "Football soccer theme party, white or green backdrop with soccer ball and pitch line graphics, sporty clean aesthetic",
  lego:
    "Lego theme party, flat rectangular backdrop panel — lego brick grid and minifigure graphics are flat 2D printed vinyl on the rectangular backdrop panel surface, printed banner style, bold primary colors red blue yellow, NOT an arch shape",
  kpop:
    "K-Pop idol theme party, pastel purple and pink backdrop, sparkle and star stage elements, concert idol aesthetic",
  encanto:
    "Encanto Disney theme party, vibrant warm colors, magical candle and Casita house motifs, Colombian-inspired floral decoration",
  cocomelon:
    "Cocomelon theme party, bright primary colors, watermelon pattern backdrop, cheerful nursery rhyme decoration",
  teddy_bear:
    "Teddy Bear theme party, soft beige and dusty pink backdrop, cute illustrated teddy bear characters, cozy nursery warm tones",
  pineapple_tropical:
    "Tropical Pineapple theme party, white or blush backdrop with large gold pineapple outline decoration, tropical monstera leaves, vibrant pastel balloon garland",
  blush_garden:
    "Blush garden elegant theme party, soft pink and cream backdrop, botanical roses and peonies floral decoration, romantic luxury aesthetic",
  luxury_neutral:
    "Luxury neutral elegant theme party, warm beige champagne and ivory backdrop, gold metallic line accents, sophisticated minimal premium decoration",
};

/**
 * Themes whose description hard-specifies the backdrop shape (round / rectangular).
 * For these we omit the separate shape fragment so it can't contradict the theme.
 */
const SHAPE_LOCKED_THEMES = new Set<ThemeId>(["unicorn", "lego"]);

/** Per-theme vinyl print descriptions for the theme_print option. */
const THEME_PRINT_DESC: Record<string, string> = {
  frozen: "Frozen castle, snowflakes, Anna & Elsa silhouette",
  unicorn: "Unicorn face with gold horn, flower crown and lashes",
  dinosaur: "Jungle palm trees, volcano, dinosaur footprints",
  safari: "African savanna, giraffe silhouette, tropical leaves",
  princess: "Castle turrets, crown, stars and magic wand",
  superhero: "City skyline, lightning bolt, hero shield",
  barbie: "Barbie logo, stars, fashion illustration",
  bluey: "Bluey and Bingo characters with paw prints",
  pokemon: "Pokeball graphic, Pikachu silhouette, lightning bolt",
  stitch: "Stitch with hibiscus flowers and Hawaii text",
  mermaid: "Underwater scene, shells, bubbles, coral reef",
  space: "Galaxy stars, planets, rocket ship, moon",
  football: "Football pitch lines, soccer ball, jersey number",
  lego: "Lego brick grid pattern and colorful Lego minifigure face graphics printed directly on flat rectangular panel surface",
  kpop: "Stage spotlight, microphone, sparkle star graphics",
  encanto: "Casita house, magical candle, Colombian flowers",
  cocomelon: "Watermelon slices, JJ character, bright polka dots",
  teddy_bear: "Cute teddy bear illustrations, hearts, soft bow",
  pineapple_tropical: "Gold pineapple outline, tropical monstera leaves, hibiscus",
  blush_garden: "Botanical roses and peonies, delicate foliage",
  luxury_neutral: "Minimal gold line art, abstract botanical, elegant monogram",
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

const FONT_DESC: Record<string, string> = {
  script: "elegant flowing script lettering",
  block: "bold block lettering",
  elegant: "elegant serif lettering",
};

export const NEGATIVE_PROMPT =
  "floating balloons, balloon strings, cartoon, illustration, drawing, people, children, watermark, blurry, distorted, " +
  "wrong number of backdrops, missing backdrop, " +
  "3D decorations on backdrop, floating decorations, sculpted backdrop elements, separate 3D objects on backdrop surface, raised elements on backdrop";

export interface PromptInput {
  theme: ThemeId;
  package: PackageId;
  backdropCount: number;
  backdropShape?: BackdropShapeId;
  backdropColor?: string;
  balloonStyle: BalloonStyleId;
  balloonColors?: string[];
  backdropText?: BackdropText;
  backdropPrint?: BackdropPrint;
  cutouts?: CutoutSelection;
  extras?: string[];
}

export function generatePrompt(input: PromptInput): {
  prompt: string;
  negativePrompt: string;
} {
  const theme = themeById(input.theme);
  const themeName = theme?.name ?? "party";

  // Theme: strict verbatim description.
  const themeDesc = THEME_DESC[input.theme] ?? `${themeName} theme`;

  // Backdrop: strict shape description + chosen color. Omitted for themes that
  // hard-specify their own shape (unicorn=round, lego=rectangular).
  const shapeLocked = SHAPE_LOCKED_THEMES.has(input.theme);
  const shapeDesc = input.backdropShape
    ? SHAPE_DESC[input.backdropShape] ?? RECT_DESC
    : RECT_DESC;
  const colorName = input.backdropColor ? hexToColorName(input.backdropColor) : "";
  const backdrop = shapeLocked
    ? ""
    : colorName
      ? `${shapeDesc}, backdrop in ${colorName} tones`
      : shapeDesc;

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

  // Backdrop print.
  let printClause = "";
  if (input.backdropPrint && input.backdropPrint.type !== "none") {
    if (input.backdropPrint.type === "name_only") {
      printClause = "child's name printed in elegant script font on backdrop surface";
    } else if (input.backdropPrint.type === "theme_print") {
      const flatVinyl =
        "flat 2D printed vinyl graphic applied directly onto the backdrop panel surface, like a printed banner or wallpaper, the graphic is flat and integrated into the backdrop material, NOT a 3D object, NOT floating, NOT separate from the backdrop, printed directly on panel";
      if (input.theme === "lego") {
        printClause = `${THEME_PRINT_DESC["lego"]}, ${flatVinyl}`;
      } else {
        const desc = THEME_PRINT_DESC[input.theme] ?? "themed decorative illustration";
        printClause = `${desc} printed as high quality vinyl graphic on backdrop panel surface, ${flatVinyl}`;
      }
    } else if (input.backdropPrint.type === "custom_upload") {
      printClause = "custom graphic design printed on backdrop surface";
    }
  }

  // Cutouts.
  let cutoutClause = "";
  if (input.cutouts && input.cutouts.size !== "none") {
    if (input.cutouts.size === "premium" && input.cutouts.position === "floor") {
      cutoutClause = `large oversized feature ${themeName} character cutout as centerpiece on floor, plus smaller character cutouts arranged around setup`;
    } else if (input.cutouts.position === "backdrop") {
      cutoutClause = `${themeName} character illustrations mounted directly on the backdrop surface`;
    } else {
      cutoutClause = `${themeName} character cardboard cutouts standing on floor beside the backdrop`;
    }
  }

  const extras = (input.extras ?? [])
    .map((id) => EXTRAS_DESC[id])
    .filter(Boolean)
    .join(", ");

  const core = [
    themeDesc,
    backdrop,
    balloons,
    textClause,
    printClause,
    cutoutClause,
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
