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

/** Strict per-shape backdrop descriptions — exact verbatim strings. */
const SHAPE_DESC: Record<BackdropShapeId, string> = {
  round_arch:
    "EXACTLY ONE circular round backdrop disc, diameter 180cm, single circle only, standing upright like a large circular panel, perfectly circular on all sides, even if multiple backdrops are selected show only ONE round circular backdrop, NOT an arch shape, NOT two circles, just one single round disc",
  half_arch:
    "ONE asymmetric backdrop panel that is 100cm wide and 200cm tall on the left side, the right side is only 120cm tall, the top edge is a single smooth curve that starts at 200cm height on the left and sweeps down to 120cm height on the right, like a ski slope or quarter circle curve from top-left to mid-right, the bottom edge is perfectly flat and straight, total width 100cm, left height 200cm, right height 120cm, this shape looks like the letter J rotated or a skateboard ramp profile, NOT a full arch, NOT symmetric, NOT round",
  shimmer_wall:
    "ONE flat rectangular sequin shimmer wall backdrop, 100cm wide and 200cm tall, entire surface covered in silver metallic sequin mirror tiles, highly reflective disco-ball-like sequin panels, glittery shimmer effect",
  wavy:
    "ONE wavy-edged backdrop panel, 100cm wide and 200cm tall, organic wavy curved top edge with 2-3 gentle waves, soft flowing silhouette, NOT sharp zigzag",
  mixed_panels:
    "THREE flat rectangular backdrop panels of different heights arranged side by side touching each other, tallest panel in center 200cm tall 100cm wide, side panels shorter 150cm tall 100cm wide each, clean modern minimalist arrangement, NOT an arch, NOT curved tops, flat rectangular panels only",
};

/**
 * Per-count descriptions for half_arch — fully self-contained including dimensions.
 * Used instead of SHAPE_DESC + SHAPE_MULTI_LABEL + backdropDimensions for this shape.
 */
const HALF_ARCH_DESC: Record<number, string> = {
  1: "ONE asymmetric backdrop panel that is 100cm wide and 200cm tall on the left side, the right side is only 120cm tall, the top edge is a single smooth curve that starts at 200cm height on the left and sweeps down to 120cm height on the right, like a ski slope or quarter circle curve from top-left to mid-right, the bottom edge is perfectly flat and straight, total width 100cm, left height 200cm, right height 120cm, this shape looks like the letter J rotated or a skateboard ramp profile, NOT a full arch, NOT symmetric, NOT round",
  2: "TWO asymmetric backdrop panels side by side, each panel 100cm wide and 200cm tall at tallest point, left panel: left edge 200cm tall, right edge 110cm tall, curved top sweeping down from left to right, right panel: mirrored, left edge 110cm tall, right edge 200cm tall, curved top sweeping up from left to right, together they form a V shape or valley silhouette, NOT full arches, NOT symmetric individually",
  3: "THREE flat backdrop panels arranged together touching each other, each panel 100cm wide, center panel is a full straight arch 200cm tall, left panel is asymmetric 190cm on outside 120cm on inside curved top, right panel is asymmetric mirrored",
};

/** Plain rectangle (no current shape id, kept for completeness). */
const RECT_DESC =
  "ONE flat rectangular backdrop panel, perfectly straight edges on all four sides, no curves anywhere, flat wall panel, balloon garland on sides";

/**
 * THEME_MOOD — color scheme, atmosphere, and overall vibe ONLY.
 * MUST NOT mention any graphic, illustration, print, or visual on the backdrop surface.
 * Graphics are handled separately by THEME_PRINT and only injected when
 * backdropPrint.type === "theme_print".
 */
const THEME_MOOD: Record<string, string> = {
  frozen:    "Frozen theme party, icy pale blue and white color scheme, silver accents, winter magical atmosphere",
  unicorn:   "Unicorn theme party, soft pink and pastel color scheme, rainbow pastel balloons, magical whimsical atmosphere",
  dinosaur:  "Dinosaur theme party, sage green and terracotta color scheme, earthy jungle atmosphere",
  safari:    "Safari theme party, warm beige and earthy tones, tropical atmosphere",
  princess:  "Princess theme party, soft pink and gold color scheme, elegant fairy tale atmosphere",
  superhero: "Superhero theme party, bold red blue yellow primary colors, energetic action atmosphere",
  barbie:    "Barbie theme party, hot pink fuchsia color scheme, glamorous feminine atmosphere",
  bluey:     "Blue cartoon theme party, bright blue white and red color scheme, playful cheerful atmosphere",
  pokemon:   "Pokemon theme party, yellow and red color scheme, adventurous energetic atmosphere",
  stitch:    "Tropical theme party, blue and tropical teal color scheme, Hawaiian tropical atmosphere",
  mermaid:   "Mermaid theme party, iridescent teal and purple color scheme, underwater ocean atmosphere",
  space:     "Space theme party, deep navy and silver color scheme, cosmic galaxy atmosphere",
  football:  "Football theme party, green and white color scheme, sporty energetic atmosphere",
  lego:      "Lego theme party, bold primary red blue yellow color scheme, playful building block atmosphere",
  kpop:      "K-Pop theme party, pastel purple and pink color scheme, sparkly idol concert atmosphere",
  encanto:   "Encanto theme party, warm vibrant Colombian colors, magical family atmosphere",
  cocomelon: "Cocomelon theme party, bright primary colors, cheerful nursery rhyme atmosphere",
  teddy_bear:         "Teddy Bear theme party, soft beige and dusty pink color scheme, cozy warm nursery atmosphere",
  pineapple_tropical: "Tropical Pineapple theme party, yellow and pastel color scheme, vibrant tropical atmosphere",
  blush_garden:   "Blush Garden theme party, soft pink and cream color scheme, romantic botanical atmosphere",
  luxury_neutral: "Luxury Neutral theme party, warm beige champagne and gold color scheme, sophisticated minimal atmosphere",
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

/**
 * Shapes that are inherently multi-panel — their SHAPE_DESC already bakes in the
 * count, so we use it verbatim regardless of backdropCount.
 */
const MULTI_PANEL_SHAPES = new Set<BackdropShapeId>(["mixed_panels"]);

/** Returns the effective panel count from the selected shapes array. */
function effectiveCount(shapes: BackdropShapeId[]): number {
  if (shapes.includes("mixed_panels")) return 3;
  return Math.max(1, Math.min(3, shapes.length));
}

/**
 * Short plural label used when a single-panel shape appears in multiple copies
 * (e.g. two round circles side by side).
 */
const SHAPE_MULTI_LABEL: Record<BackdropShapeId, string> = {
  round_arch:   "circular round disc backdrop panels",
  half_arch:    "asymmetric half arch backdrop panels",
  shimmer_wall: "flat rectangular sequin shimmer wall backdrop panels",
  wavy:         "wavy-top backdrop panels",
  mixed_panels: "backdrop panels of different heights",
};

/** Short per-panel description used when building multi-shape composite scenes. */
const PANEL_SHORT_DESC: Record<BackdropShapeId, string> = {
  half_arch:    "asymmetric half arch panel, 100cm wide, 200cm tall on left curving down to 120cm on right, NOT a full arch",
  round_arch:   "circular round disc backdrop, 180cm diameter, single perfect circle",
  shimmer_wall: "rectangular shimmer sequin wall panel, 100cm wide 200cm tall, fully covered in reflective metallic sequin tiles",
  wavy:         "wavy-top backdrop panel, 100cm wide 200cm tall, organic wavy curved top edge with 2-3 gentle waves",
  mixed_panels: "three flat rectangular panels of different heights side by side, center panel 200cm, side panels 150cm each",
};

/**
 * Build the shape-description fragment, taking backdropCount into account.
 * - Multi-panel shapes (double_arch, mixed_panels) use SHAPE_DESC verbatim.
 * - Single-panel shapes with count > 1 describe N panels of the same type.
 * The selected shape ALWAYS wins; count is an additive modifier only.
 */
function buildBackdropDesc(shape: BackdropShapeId | undefined, count: number): string {
  const c = Math.max(1, Math.min(3, count));

  if (shape === "half_arch") return HALF_ARCH_DESC[c] ?? HALF_ARCH_DESC[1];
  if (shape && MULTI_PANEL_SHAPES.has(shape)) return SHAPE_DESC[shape];

  const baseDesc = shape ? SHAPE_DESC[shape] : RECT_DESC;
  if (c === 1) return baseDesc;

  const countWord = c === 2 ? "TWO" : "THREE";
  const arrangement = c === 2 ? "placed side by side with a small gap" : "arranged in a row with small gaps";
  const label = shape ? SHAPE_MULTI_LABEL[shape] : "backdrop panels";
  return `${countWord} ${label}, ${arrangement}`;
}

/**
 * Physical dimension clause appended after the shape description.
 * Gives the AI concrete proportions to render.
 */
function backdropDimensions(count: number, shape: BackdropShapeId | undefined): string {
  if (shape === "half_arch" || shape === "round_arch" || shape === "mixed_panels") return "";
  const c = Math.max(1, Math.min(3, count));
  const perPanel = "each backdrop panel is 100cm wide and 200cm tall, human scale proportions, NOT oversized, approximately 2 meters tall and 1 meter wide per panel";
  if (c === 1) return perPanel.replace("each backdrop panel", "the backdrop panel");
  return perPanel;
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
  blush_garden: "Blush Garden theme party, soft pink and cream color scheme, romantic lush garden atmosphere",
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
  let descPart: string;
  let dimPart: string;
  if (shapes.length <= 1) {
    const shape = shapes[0];
    descPart = buildBackdropDesc(shape, count);
    dimPart = backdropDimensions(count, shape);
  } else {
    const panels = shapes
      .map((s, i) => `panel ${i + 1}: ${PANEL_SHORT_DESC[s]}`)
      .join("; ");
    const countWord = count === 2 ? "TWO" : "THREE";
    descPart = `${countWord} distinct backdrop panels side by side — ${panels}`;
    dimPart = "each panel approximately 100cm wide and 200cm tall, human scale";
  }
  return [descPart, dimPart, colorName ? `backdrop in ${colorName} tones` : ""]
    .filter(Boolean)
    .join(", ");
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
    round_arch:   "round circular disc",
    half_arch:    "asymmetric half arch (tall left, short right)",
    shimmer_wall: "rectangular shimmer wall",
    wavy:         "wavy top",
    mixed_panels: "mixed height flat rectangular panels",
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
    cutoutClause,
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
      ? "full arch, complete arch, symmetric arch, round top, equal height sides, doorway arch, both sides same height"
      : input.backdropShapes.length === 1 && input.backdropShapes[0] === "round_arch"
        ? "two circles, multiple circles, arch shape, multiple backdrops, two backdrops"
        : "";

  const negParts = [NEGATIVE_PROMPT, countNegative, shapeNegative].filter(Boolean);
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
