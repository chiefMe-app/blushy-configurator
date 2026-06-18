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
  type PlinthSize,
  type EventTypeId,
} from "./config";

/** Wrapper prepended/appended to every prompt (Change 3). */
const PROMPT_PREFIX =
  "Professional event photography of a birthday party setup in Dubai, UAE. ";
const PROMPT_SUFFIX =
  " Wide establishing shot showing the complete full setup from the front. Sharp focus on entire scene. Soft natural lighting. Photorealistic 4k quality. Professional event decoration photography.";

/** Strict per-shape backdrop descriptions (Change 2) — exact verbatim strings. */
const SHAPE_DESC: Record<BackdropShapeId, string> = {
  round_arch:
    "ONE perfectly circular round disc backdrop panel, complete full circle shape, like a large circle standing upright, no flat bottom edge, perfectly round on all sides, diameter approximately 200cm, NOT an arch shape",
  straight_arch:
    "ONE arch backdrop panel, straight vertical sides, semicircular rounded top, like a doorway or window arch shape, flat bottom, two straight sides meeting a half-circle top, approximately 200cm tall 120cm wide, NOT a circle",
  half_arch:
    "ONE asymmetric backdrop panel, LEFT side is tall with a curved rounded top reaching approximately 220cm height, RIGHT side is short straight edge approximately 120cm height, the top edge curves from tall left down to short right, like a wave or half moon cut asymmetrically, NOT a circle, NOT a full arch, asymmetric silhouette",
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
    "Blue cartoon theme party, bright blue white and red color scheme, playful family-friendly decoration with paw print motifs",
  pokemon:
    "Pokemon theme party, yellow backdrop with red Pokeball graphic, bright cheerful primary colors, adventure theme",
  stitch:
    "Tropical blue character theme party, blue tropical Hawaiian backdrop, hibiscus flowers, tropical island aesthetic",
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
  frozen: "Frozen castle, snowflakes, icy character silhouettes",
  unicorn: "Unicorn face with gold horn, flower crown and lashes",
  dinosaur: "Jungle palm trees, volcano, dinosaur footprints",
  safari: "African savanna, giraffe silhouette, tropical leaves",
  princess: "Castle turrets, crown, stars and magic wand",
  superhero: "City skyline, lightning bolt, hero shield",
  barbie: "Barbie logo, stars, fashion illustration",
  bluey: "cartoon themed decorations with paw prints",
  pokemon: "Pokeball graphic, Pokemon themed elements, lightning bolt",
  stitch: "tropical blue themed character decoration with hibiscus flowers and Hawaii text",
  mermaid: "Underwater scene, shells, bubbles, coral reef",
  space: "Galaxy stars, planets, rocket ship, moon",
  football: "Football pitch lines, soccer ball, jersey number",
  lego: "Lego brick grid pattern and colorful Lego minifigure face graphics printed directly on flat rectangular panel surface",
  kpop: "Stage spotlight, microphone, sparkle star graphics",
  encanto: "Casita house, magical candle, Colombian flowers",
  cocomelon: "Watermelon slices, colorful cartoon character decoration, bright polka dots",
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

/** Floral-free overrides — used when florals are not explicitly selected and
 *  event type is not bridal_shower or boutique_wedding. */
const THEME_DESC_NO_FLORAL: Partial<Record<string, string>> = {
  stitch:
    "Tropical blue character theme party, blue tropical Hawaiian backdrop, hibiscus motifs, tropical island aesthetic",
  encanto:
    "Encanto Disney theme party, vibrant warm colors, magical candle and Casita house motifs, Colombian-inspired colorful decoration",
  blush_garden:
    "Blush garden elegant theme party, soft pink and cream backdrop, lush greenery and garden-style decoration, romantic luxury aesthetic",
};

const THEME_PRINT_DESC_NO_FLORAL: Partial<Record<string, string>> = {
  unicorn: "Unicorn face with gold horn, leafy crown and lashes",
  encanto: "Casita house, magical candle, Colombian foliage",
  pineapple_tropical: "Gold pineapple outline, tropical monstera leaves, hibiscus motifs",
  blush_garden: "Garden greenery and leaves, delicate foliage",
};

const BALLOON_DESC_PREMIUM_NO_FLORAL =
  "premium organic balloon installation completely surrounding the backdrop with varied sizes and greenery accents";

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
  "cartoon style, anime style, illustration, digital art, drawing, sketch, vector art, clipart, watercolor, " +
  "CGI render, 3d render, plastic looking, toy-like, floating objects, distorted proportions, blurry, " +
  "low quality, grainy, watermark, logo overlay, text overlay, unrealistic lighting";

export interface PromptInput {
  theme: ThemeId;
  package: PackageId;
  eventType?: EventTypeId;
  backdropCount: number;
  backdropShape?: BackdropShapeId;
  backdropColor?: string;
  balloonStyle: BalloonStyleId;
  balloonColors?: string[];
  backdropText?: BackdropText;
  backdropPrint?: BackdropPrint;
  cutouts?: CutoutSelection;
  extras?: string[];
  plinthSizes?: PlinthSize[];
}

/** Florals are permitted when explicitly added as an extra, or for wedding/bridal events. */
function allowFlorals(input: PromptInput): boolean {
  if ((input.extras ?? []).includes("florals")) return true;
  return input.eventType === "bridal_shower" || input.eventType === "boutique_wedding";
}

export const PLINTH_NEGATIVE =
  "wide drum, flat platform, stage, podium, short cylinder, width greater than height";

export type ChangeType =
  | "full"
  | "theme"
  | "shape"
  | "balloons"
  | "colors"
  | "print"
  | "extras";

export function generatePrompt(input: PromptInput): {
  prompt: string;
  negativePrompt: string;
} {
  const theme = themeById(input.theme);
  const themeName = theme?.name ?? "party";

  const florals = allowFlorals(input);

  // Theme: use floral-free override when florals are not permitted.
  const themeDesc =
    (!florals && THEME_DESC_NO_FLORAL[input.theme]) ||
    THEME_DESC[input.theme] ||
    `${themeName} theme`;

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

  // Balloons: style + chosen colors. Premium uses no-floral description when florals not allowed.
  const balloonStyle =
    (!florals && input.balloonStyle === "premium"
      ? BALLOON_DESC_PREMIUM_NO_FLORAL
      : BALLOON_DESC[input.balloonStyle]) ?? "";
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
        const desc =
        (!florals && THEME_PRINT_DESC_NO_FLORAL[input.theme]) ||
        THEME_PRINT_DESC[input.theme] ||
        "themed decorative illustration";
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
      cutoutClause = `large oversized feature ${themeName} themed standee decoration as centerpiece on floor, plus smaller themed standee decorations arranged around setup`;
    } else if (input.cutouts.position === "backdrop") {
      cutoutClause = `${themeName} themed decorations mounted directly on the backdrop surface`;
    } else {
      cutoutClause = `${themeName} themed standee decorations standing on floor beside the backdrop`;
    }
  }

  const extras = (input.extras ?? [])
    .map((id) => EXTRAS_DESC[id])
    .filter(Boolean)
    .join(", ");

  // Plinths (AI mode only — omit entirely in SVG mode).
  let plinthClause = "";
  if (input.plinthSizes && input.plinthSizes.length > 0) {
    const count = Math.min(3, input.plinthSizes.length);
    const positionDesc =
      count === 1
        ? "centered in front of the backdrop"
        : count === 2
          ? "spaced evenly in front of the backdrop"
          : "arranged in a row in front of the backdrop";
    plinthClause =
      `${count} narrow tall white cylindrical plinth pedestal${count > 1 ? "s" : ""}, ` +
      `height 3x greater than diameter, slim elegant display column like a museum pedestal, ` +
      `matte white surface, standing on floor in front of backdrop, ${positionDesc}`;
  }

  const core = [
    themeDesc,
    backdrop,
    balloons,
    textClause,
    printClause,
    cutoutClause,
    plinthClause,
    extras,
  ]
    .filter(Boolean)
    .join(", ");

  const prompt = `${PROMPT_PREFIX}${core}.${PROMPT_SUFFIX}`;

  return { prompt, negativePrompt: NEGATIVE_PROMPT };
}

/** Focused edit instruction for img2img (kontext) — describes only what changed. */
export function buildFocusedPrompt(changeType: ChangeType, input: PromptInput): string {
  const theme = themeById(input.theme);
  const themeName = theme?.name ?? "party";
  const florals = allowFlorals(input);

  switch (changeType) {
    case "theme": {
      const themeDesc =
        (!florals && THEME_DESC_NO_FLORAL[input.theme]) ||
        THEME_DESC[input.theme] ||
        `${themeName} theme`;
      return (
        `Change the color scheme and theme decoration to: ${themeDesc}. ` +
        `Keep the same backdrop shape, balloon arrangement, and overall composition.`
      );
    }
    case "shape": {
      const shapeDesc = input.backdropShape ? SHAPE_DESC[input.backdropShape] : RECT_DESC;
      const colorName = input.backdropColor ? hexToColorName(input.backdropColor) : "";
      const colorPart =
        !SHAPE_LOCKED_THEMES.has(input.theme) && colorName ? ` in ${colorName} tones` : "";
      return (
        `Change the backdrop panel shape to: ${shapeDesc}${colorPart}. ` +
        `Keep the same theme colors, balloons, and overall composition.`
      );
    }
    case "balloons": {
      const styleDesc =
        !florals && input.balloonStyle === "premium"
          ? BALLOON_DESC_PREMIUM_NO_FLORAL
          : (BALLOON_DESC[input.balloonStyle] ?? "");
      const colorNames = (input.balloonColors ?? [])
        .slice(0, 4)
        .map(hexToColorName)
        .filter((v, i, a) => v && a.indexOf(v) === i);
      const colorPart = colorNames.length ? ` in ${colorNames.join(", ")} tones` : "";
      return (
        `Change the balloon garland to: ${styleDesc}${colorPart}. ` +
        `Keep the backdrop, theme colors, and all other elements identical.`
      );
    }
    case "colors": {
      const colorName = input.backdropColor ? hexToColorName(input.backdropColor) : "";
      const balloonNames = (input.balloonColors ?? [])
        .slice(0, 4)
        .map(hexToColorName)
        .filter((v, i, a) => v && a.indexOf(v) === i);
      const parts: string[] = [];
      if (colorName) parts.push(`change the backdrop color to ${colorName} tones`);
      if (balloonNames.length)
        parts.push(`change balloon colors to ${balloonNames.join(", ")} tones`);
      return (
        (parts.length ? parts.join(", ") : "Update the color scheme") +
        `. Keep the backdrop shape and balloon arrangement identical.`
      );
    }
    case "print": {
      let printDesc = "remove any backdrop print, show plain backdrop surface";
      if (input.backdropPrint && input.backdropPrint.type !== "none") {
        if (input.backdropPrint.type === "name_only") {
          printDesc = "child's name printed in elegant script font on the backdrop surface";
        } else if (input.backdropPrint.type === "theme_print") {
          const desc =
            (!florals && THEME_PRINT_DESC_NO_FLORAL[input.theme]) ||
            THEME_PRINT_DESC[input.theme] ||
            "themed decorative illustration";
          printDesc = `${desc} as a flat 2D printed vinyl graphic on the backdrop surface`;
        } else if (input.backdropPrint.type === "custom_upload") {
          printDesc = "custom graphic design printed on the backdrop surface";
        }
      }
      return `Update the backdrop surface: ${printDesc}. Keep everything else identical.`;
    }
    case "extras":
    default: {
      const extras = (input.extras ?? [])
        .map((id) => EXTRAS_DESC[id])
        .filter(Boolean)
        .join(", ");
      return extras
        ? `Add ${extras} to the scene. Keep the backdrop and balloons identical.`
        : `Remove any additional decorative elements. Keep the backdrop and balloons identical.`;
    }
  }
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
