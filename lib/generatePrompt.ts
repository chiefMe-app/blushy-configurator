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
  type GraphicStyle,
} from "./config";

const GRAPHIC_STYLE_MODIFIER: Record<GraphicStyle, string> = {
  illustrated: "soft illustrated cartoon artwork style, hand-drawn friendly aesthetic",
  realistic:   "photorealistic high quality printed graphic, detailed and lifelike",
  minimal:     "clean minimal line art, elegant simple outlines, white space, sophisticated",
  pattern:     "repeating seamless pattern covering entire backdrop, tiled themed motifs across whole surface",
  full_scene:  "full immersive background scene illustration covering entire backdrop surface, detailed environment and setting",
};

/** Wrapper prepended/appended to every prompt (Change 3). */
const PROMPT_PREFIX =
  "Professional event photography of a birthday party setup in Dubai, UAE. ";
const PROMPT_SUFFIX =
  " Wide establishing shot showing the complete full setup from the front. Sharp focus on entire scene. Soft natural lighting. Photorealistic 4k quality. Professional event decoration photography.";

/** Strict per-shape backdrop descriptions — verbatim, dimensions included. */
const SHAPE_DESC: Record<BackdropShapeId, string> = {
  arch:
    "ONE arch backdrop panel: two straight vertical sides, semicircular rounded top, like a doorway or window arch, flat bottom edge, straight sides rise up then meet in a perfect half-circle at the top, width 100cm, height 200cm tall to top of arch curve, matte flat painted surface panel",
  half_arch:
    "ONE half arch backdrop panel: LEFT vertical edge is 200cm tall, RIGHT vertical edge is only 110cm tall, the top edge is a single smooth diagonal curve sweeping from the tall left (200cm) down to the short right (110cm), like a skateboard ramp silhouette or quarter-pipe profile, flat bottom edge, total width 100cm, the overall shape resembles a right triangle with a curved hypotenuse, NOT symmetric, NOT a full arch, matte flat painted surface panel",
  round:
    "ONE perfectly circular round backdrop disc panel, complete full circle shape, diameter 180cm, flat circular panel standing upright on the floor, no flat bottom edge, perfectly round on all sides, matte flat painted surface",
  rect:
    "ONE rectangular backdrop panel, perfectly straight edges on all four sides, width 100cm, height 200cm, flat wall panel, no curves anywhere, matte flat painted surface",
  shimmer_wall:
    "ONE rectangular shimmer wall backdrop panel, entire surface covered with silver metallic sequin mirror tiles, highly reflective disco-ball sequin effect, width 100cm, height 200cm",
  wavy:
    "ONE wavy backdrop panel, width 100cm, height 200cm at tallest point, top edge has 2-3 gentle organic waves, soft flowing curved silhouette along top, NOT sharp zigzag, smooth gentle waves only, matte flat painted surface",
};

/**
 * THEME_MOOD — color scheme, atmosphere, and overall vibe ONLY.
 * MUST NOT mention any graphic, illustration, print, or visual on the backdrop surface.
 * Graphics are handled separately by THEME_PRINT and only injected when
 * backdropPrint.type === "theme_print".
 */
const THEME_MOOD: Record<string, string> = {
  frozen:    "icy pale blue, silver and white color palette, cool crisp atmosphere",
  unicorn:   "soft pink, pastel mint, pastel yellow, pastel blue and white color palette, delicate pastel tones, light airy atmosphere",
  dinosaur:  "sage green, terracotta and dusty rose color palette, earthy natural atmosphere",
  safari:    "warm amber, earthy brown and olive green color palette, natural warm atmosphere",
  princess:  "soft pink, champagne gold and ivory color palette, elegant feminine atmosphere",
  superhero: "bold red, royal blue and bright yellow color palette, energetic dynamic atmosphere",
  barbie:    "hot pink and fuchsia color palette, glamorous fashion-forward atmosphere",
  bluey:     "bright blue, white and red color palette, playful cheerful atmosphere",
  pokemon:   "bright yellow, red and white color palette, adventurous energetic atmosphere",
  stitch:    "bright turquoise blue and tropical teal color palette, vibrant island atmosphere",
  mermaid:   "iridescent teal, sea foam green and soft purple color palette, dreamy ocean atmosphere",
  space:     "deep navy, silver and dark purple color palette, cool dark mysterious atmosphere",
  football:  "bright green, white and black color palette, sporty energetic atmosphere",
  lego:      "bold primary red, bright blue and bright yellow color palette, clean bright playful atmosphere",
  kpop:      "pastel purple, soft pink and iridescent color palette, vibrant pop atmosphere",
  encanto:   "warm terracotta, vibrant yellow and rich teal color palette, warm festive atmosphere",
  cocomelon: "bright red, yellow and green color palette, cheerful bright playful atmosphere",
  teddy_bear:         "soft beige, dusty rose and warm cream color palette, cozy nursery atmosphere",
  pineapple_tropical: "bright yellow, pastel mint and coral color palette, fresh vibrant summer atmosphere",
  blush_garden:   "soft blush pink, ivory and dusty rose color palette, romantic delicate atmosphere",
  luxury_neutral: "warm beige, champagne and gold color palette, sophisticated minimal elegant atmosphere",
};

/**
 * THEME_PRINT — the graphic printed on the backdrop surface.
 * Used ONLY when backdropPrint.type === "theme_print".
 * Describes the visual illustration only — no color/mood/shape info.
 */
const THEME_PRINT: Record<string, string> = {
  frozen:    "snowflake and ice crystal pattern printed on backdrop",
  unicorn:   "unicorn face with gold horn flower crown and lashes printed on backdrop surface",
  dinosaur:  "palm tree volcano and jungle scene printed on backdrop",
  safari:    "African savanna animal silhouettes printed on backdrop",
  princess:  "castle turrets crown and stars printed on backdrop",
  superhero: "city skyline and hero shield printed on backdrop",
  barbie:    "Barbie-inspired fashion graphics printed on backdrop",
  bluey:     "cartoon dog paw prints and playful graphics on backdrop",
  pokemon:   "Pokeball pattern and lightning bolt graphics on backdrop",
  stitch:    "tropical hibiscus and island graphics on backdrop",
  mermaid:   "seashell coral and wave graphics on backdrop",
  space:     "stars planets and rocket graphics on backdrop",
  football:  "football pitch lines and soccer ball on backdrop",
  lego:      "Lego brick grid pattern and minifigure graphics printed directly on flat rectangular panel surface",
  kpop:      "stage spotlight and star graphics on backdrop",
  encanto:   "magical candle and tropical flower graphics on backdrop",
  cocomelon: "watermelon pattern and colorful polka dots on backdrop",
  teddy_bear:         "cute teddy bear illustrations on backdrop",
  pineapple_tropical: "gold pineapple outline and tropical leaves on backdrop",
  blush_garden:   "roses peonies and botanical foliage on backdrop",
  luxury_neutral: "minimal gold line art and abstract botanical on backdrop",
};

/**
 * Themes whose mood description hard-specifies the backdrop shape.
 * Now empty: THEME_MOOD contains no shape info, so the shape fragment from
 * buildBackdropDesc() is always safe to include for every theme.
 */
const SHAPE_LOCKED_THEMES = new Set<ThemeId>();

/** Returns the effective panel count from the selected shapes array. */
function effectiveCount(shapes: BackdropShapeId[]): number {
  return Math.max(1, Math.min(3, shapes.length));
}

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

/**
 * Floral-free mood overrides.
 * Only needed for moods that contain flagged floral words ("botanical" etc.)
 * and where florals are not explicitly selected.
 */
const THEME_MOOD_NO_FLORAL: Partial<Record<string, string>> = {
  blush_garden: "soft blush pink, ivory and dusty rose color palette, romantic clean atmosphere",
};

/**
 * Floral-free print overrides — used when florals are not selected and the
 * THEME_PRINT description contains flagged floral words.
 */
const THEME_PRINT_NO_FLORAL: Partial<Record<string, string>> = {
  unicorn:     "unicorn face with gold horn leafy crown and lashes printed on backdrop surface",
  encanto:     "magical candle and tropical foliage graphics on backdrop",
  blush_garden: "garden leaves and delicate foliage on backdrop",
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
  backdropShapes: BackdropShapeId[];
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

function buildSceneBackdrop(shapes: BackdropShapeId[], colorName: string): string {
  const count = effectiveCount(shapes);
  const colorSuffix = colorName ? `, backdrop in ${colorName} tones` : "";

  if (count === 1) {
    return `${SHAPE_DESC[shapes[0]]}${colorSuffix}`;
  }

  const positions = count === 2 ? ["LEFT", "RIGHT"] : ["LEFT", "CENTER", "RIGHT"];
  const panelLines = shapes.slice(0, count).map((s, i) => {
    let desc = SHAPE_DESC[s];
    // Round disc is smaller when sharing the scene with other panels
    if (s === "round" && shapes.length > 1) {
      desc = desc.replace("diameter 180cm", "diameter 150cm");
    }
    return `${positions[i]} panel: ${desc}`;
  });

  const countWord = count === 2 ? "TWO" : "THREE";
  const arrangement =
    count === 2
      ? "panels placed close together with small gap between them, total scene width approximately 220cm"
      : "panels arranged touching or with small gaps";

  return `${countWord} backdrop panels arranged side by side: ${panelLines.join(". ")}. ${arrangement}${colorSuffix}`;
}

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

  // Theme mood: color/atmosphere only — no graphics. Floral-free when needed.
  const themeDesc =
    (!florals && THEME_MOOD_NO_FLORAL[input.theme]) ||
    THEME_MOOD[input.theme] ||
    `${themeName} theme`;

  // Backdrop: shape + count + dimensions + color. Shape selection always wins;
  // count is an additive modifier. Omitted for shape-locked themes (unicorn, lego).
  const shapeLocked = SHAPE_LOCKED_THEMES.has(input.theme);
  const colorName = input.backdropColor ? hexToColorName(input.backdropColor) : "";
  const backdrop = shapeLocked
    ? ""
    : buildSceneBackdrop(input.backdropShapes, colorName);

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

  // Backdrop print — only added when explicitly selected.
  // backdropPrint.type === "none" → nothing printed on backdrop surface (plain backdrop).
  const panelCount = effectiveCount(input.backdropShapes);
  const flatVinyl =
    panelCount > 1
      ? "flat 2D printed vinyl graphic applied directly onto the CENTER backdrop panel only, " +
        "the other backdrop panels remain plain solid color with NO print on them, " +
        "NOT a 3D object, NOT floating, printed directly on center panel surface only"
      : "flat 2D printed vinyl graphic applied directly onto the backdrop panel surface, " +
        "integrated into the backdrop material, NOT a 3D object, NOT floating, printed directly on panel";
  let printClause = "";
  if (input.backdropPrint?.type === "name_only") {
    printClause =
      panelCount > 1
        ? "child's name printed in elegant script font on the center backdrop panel only, other panels plain"
        : "child's name printed in elegant script font on backdrop surface";
  } else if (input.backdropPrint?.type === "theme_print") {
    const desc =
      (!florals && THEME_PRINT_NO_FLORAL[input.theme]) ||
      THEME_PRINT[input.theme] ||
      "themed decorative illustration";
    const styleKey = (input.backdropPrint.graphicStyle ?? "illustrated") as GraphicStyle;
    const styleMod = GRAPHIC_STYLE_MODIFIER[styleKey];
    printClause = `${desc}, ${styleMod}, ${flatVinyl}`;
  } else if (input.backdropPrint?.type === "custom_upload") {
    printClause =
      panelCount > 1
        ? "custom graphic design printed on the center backdrop panel only, other panels plain"
        : "custom graphic design printed on backdrop surface";
  }

  // Plain backdrop — explicit instruction when no print is selected so the AI
  // does not hallucinate characters, clouds, or decorative elements onto the surface.
  const plainBackdropClause =
    !input.backdropPrint || input.backdropPrint.type === "none"
      ? "backdrop panel surface is completely plain and empty, solid color only, " +
        "NO illustrations, NO characters, NO prints, NO patterns, NO text, NO clouds, " +
        "NO stars, NO decorative elements on the backdrop surface itself, " +
        "clean flat matte painted panel"
      : "";

  // Cutouts.
  let cutoutClause = "";
  if (input.cutouts && input.cutouts.size !== "none") {
    if (input.cutouts.size === "premium" && input.cutouts.position === "floor") {
      cutoutClause =
        `large oversized feature ${themeName} themed standee as centerpiece on floor, ` +
        `plus several smaller ${themeName} themed standee decorations arranged around the setup, ` +
        `each standee featuring a DIFFERENT character, design, and pose — no two identical`;
    } else if (input.cutouts.position === "backdrop") {
      cutoutClause =
        `${themeName} themed decorations mounted directly on the backdrop surface, ` +
        `each decoration a DIFFERENT design and character — varied and unique, no two the same`;
    } else {
      cutoutClause =
        `${themeName} themed standee decorations standing on floor beside the backdrop, ` +
        `each standee featuring a DIFFERENT character design and pose — varied and unique, no two identical`;
    }
  }

  // No cutouts — suppress AI from inventing standees or characters.
  const noCutoutsClause =
    !input.cutouts || input.cutouts.size === "none"
      ? "NO character cutouts, NO standing figures, NO cardboard standees anywhere in the scene"
      : "";

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

  // Strict count+shape requirement — shown FIRST so the model sees it before any other detail.
  const effectivePanels = effectiveCount(input.backdropShapes);
  const panelWord = effectivePanels === 1 ? "ONE (1)" : effectivePanels === 2 ? "TWO (2)" : "THREE (3)";
  const SHAPE_LABEL: Partial<Record<BackdropShapeId, string>> = {
    arch:         "arch (semicircular top)",
    half_arch:    "asymmetric half arch (tall left, short right)",
    round:        "round circular disc",
    rect:         "flat rectangular",
    shimmer_wall: "rectangular shimmer wall",
    wavy:         "wavy top",
  };
  const shapeLabelStr = input.backdropShapes.length === 1
    ? (SHAPE_LABEL[input.backdropShapes[0]] ?? "rectangular")
    : input.backdropShapes.map((s) => SHAPE_LABEL[s] ?? "rectangular").join(" + ");
  const panelShapeDesc = input.backdropShapes.length === 1
    ? `with ${shapeLabelStr} shape`
    : `with mixed shapes: ${shapeLabelStr}`;
  const strictRequirements =
    `STRICT REQUIREMENTS: This image must show EXACTLY ${panelWord} backdrop panel(s) ` +
    `${panelShapeDesc}. This overrides everything else.`;

  const humanScale =
    "These are standard party backdrop panels, human-sized decorative panels, NOT giant walls, NOT oversized installations";

  const core = [
    strictRequirements,
    humanScale,
    themeDesc,
    backdrop,
    balloons,
    textClause,
    printClause,
    plainBackdropClause,
    cutoutClause,
    noCutoutsClause,
    plinthClause,
    extras,
  ]
    .filter(Boolean)
    .join(", ");

  const prompt = `${PROMPT_PREFIX}${core}.${PROMPT_SUFFIX}`;

  const countNegative =
    effectivePanels === 1
      ? "two backdrops, multiple panels, split backdrop, double backdrop, three panels"
      : effectivePanels === 2
        ? "single backdrop, one panel, three panels, triple backdrop"
        : "single backdrop, one panel, two panels, double backdrop";

  const shapeNegative =
    input.backdropShapes.length === 1 && input.backdropShapes[0] === "half_arch"
      ? "full arch, complete arch, symmetric arch, equal height sides, both sides same height, doorway arch"
      : input.backdropShapes.length === 1 && input.backdropShapes[0] === "round"
        ? "two circles, multiple circles, arch shape, multiple backdrops, two backdrops"
        : "";

  const printNegative =
    !input.backdropPrint || input.backdropPrint.type === "none"
      ? "printed graphic on backdrop, illustration on backdrop, character on backdrop, " +
        "unicorn on backdrop, pattern on backdrop, clouds on backdrop, stars on backdrop, " +
        "decorative elements on backdrop surface"
      : "";

  const cutoutNegative =
    !input.cutouts || input.cutouts.size === "none"
      ? "character cutout, cardboard standee, standing figure, foam cutout"
      : "";

  const negParts = [NEGATIVE_PROMPT, countNegative, shapeNegative, printNegative, cutoutNegative].filter(Boolean);
  return { prompt, negativePrompt: negParts.join(", ") };
}

/** Focused edit instruction for img2img (kontext) — describes only what changed. */
export function buildFocusedPrompt(changeType: ChangeType, input: PromptInput): string {
  const theme = themeById(input.theme);
  const themeName = theme?.name ?? "party";
  const florals = allowFlorals(input);

  switch (changeType) {
    case "theme": {
      const themeDesc =
        (!florals && THEME_MOOD_NO_FLORAL[input.theme]) ||
        THEME_MOOD[input.theme] ||
        `${themeName} theme`;
      return (
        `Change the color scheme and theme decoration to: ${themeDesc}. ` +
        `Keep the same backdrop shape, balloon arrangement, and overall composition.`
      );
    }
    case "shape": {
      const colorName =
        !SHAPE_LOCKED_THEMES.has(input.theme) && input.backdropColor
          ? hexToColorName(input.backdropColor)
          : "";
      const shapeDesc = buildSceneBackdrop(input.backdropShapes, colorName);
      return (
        `Change the backdrop panel shape to: ${shapeDesc}. ` +
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
      const pCount = effectiveCount(input.backdropShapes);
      const centerOnly =
        pCount > 1
          ? " on the center backdrop panel only — other panels remain plain solid color with no print"
          : " on the backdrop surface";
      let printDesc = "remove any backdrop print, show plain bare backdrop panels with no graphics on any panel";
      if (input.backdropPrint?.type === "name_only") {
        printDesc = `child's name printed in elegant script font${centerOnly}`;
      } else if (input.backdropPrint?.type === "theme_print") {
        const desc =
          (!florals && THEME_PRINT_NO_FLORAL[input.theme]) ||
          THEME_PRINT[input.theme] ||
          "themed decorative illustration";
        const styleKey = (input.backdropPrint.graphicStyle ?? "illustrated") as GraphicStyle;
        const styleMod = GRAPHIC_STYLE_MODIFIER[styleKey];
        printDesc = `${desc}, ${styleMod}, flat 2D printed vinyl graphic${centerOnly}`;
      } else if (input.backdropPrint?.type === "custom_upload") {
        printDesc = `custom graphic design printed${centerOnly}`;
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
