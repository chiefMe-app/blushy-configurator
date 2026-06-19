// ---------------------------------------------------------------------------
// Builds the fal.ai prompt for the photorealistic preview.
// Pure + side-effect free so it can run on the server (route.ts) where the
// FAL_KEY lives.
// ---------------------------------------------------------------------------

import {
  themeById,
  resolveBackdropText,
  ARCH_SIZES,
  RECT_SIZES,
  type ThemeId,
  type PackageId,
  type BalloonStyleId,
  type BackdropShapeId,
  type BackdropItem,
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

const PROMPT_PREFIX =
  "Professional event photography of a birthday party setup in Dubai, UAE. ";
const PROMPT_SUFFIX =
  " Wide establishing shot showing the complete full setup from the front. Sharp focus on entire scene. Soft natural lighting. Photorealistic 4k quality. Professional event decoration photography.";

/** Per-shape descriptions used in single-panel and multi-panel context. */
const SHAPE_DESC: Record<BackdropShapeId, string> = {
  arch:
    "one symmetrical full arch vertical panel with a rounded top center, standing directly on the floor",
  round:
    "one perfect circular round vertical backdrop panel, standing directly on the floor",
  rect:
    "one rectangular vertical backdrop panel with straight edges, standing directly on the floor",
  shimmer_wall:
    "one vertical shimmer wall panel with reflective fringe texture, standing directly on the floor",
  wavy:
    "one wavy organic-shaped vertical backdrop panel with soft curved edges, standing directly on the floor",
};

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
  kpop:      "spotlight beam and star graphics on backdrop",
  encanto:   "magical candle and tropical flower graphics on backdrop",
  cocomelon: "watermelon pattern and colorful polka dots on backdrop",
  teddy_bear:         "cute teddy bear illustrations on backdrop",
  pineapple_tropical: "gold pineapple outline and tropical leaves on backdrop",
  blush_garden:   "roses peonies and botanical foliage on backdrop",
  luxury_neutral: "minimal gold line art and abstract botanical on backdrop",
};

const SHAPE_LOCKED_THEMES = new Set<ThemeId>();

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

const BALLOON_DESC: Record<BalloonStyleId, string> = {
  none: "",
  half: "organic balloon garland on one side of the backdrop, clusters touching the ground",
  full: "lush organic balloon garland framing both sides of the backdrop, floor to top, clusters at base",
  premium:
    "premium organic balloon installation completely surrounding the backdrop with varied sizes and flower accents",
};

const THEME_MOOD_NO_FLORAL: Partial<Record<string, string>> = {
  blush_garden: "soft blush pink, ivory and dusty rose color palette, romantic clean atmosphere",
};

const THEME_PRINT_NO_FLORAL: Partial<Record<string, string>> = {
  unicorn:     "unicorn face with gold horn leafy crown and lashes printed on backdrop surface",
  encanto:     "magical candle and tropical foliage graphics on backdrop",
  blush_garden: "garden leaves and delicate foliage on backdrop",
};

const BALLOON_DESC_PREMIUM_NO_FLORAL =
  "premium organic balloon installation completely surrounding the backdrop with varied sizes and greenery accents";

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

export function generateNegativePrompt(items?: BackdropItem[]): string {
  const shapes = items?.map((i) => i.type) ?? [];
  const isSingle = !items || items.length <= 1;
  const hasRound = shapes.includes("round");

  const base =
    "floating balloons, balloon strings, cartoon, illustration, drawing, people, children, " +
    "watermark, blurry, distorted, wide platform, raised stage, podium, " +
    "wide base pedestal, circular stage floor, round platform on ground, oversized plinth base, " +
    "plinth wider than 50cm, square pedestal, rectangular pedestal";

  const countNeg = isSingle
    ? "wrong number of backdrops, second backdrop panel, extra backdrop panel, multiple backdrop panels, double arch"
    : "wrong number of backdrop panels, extra unselected backdrop panel, missing selected backdrop panel";

  const roundNeg = hasRound && isSingle ? ", two circles, multiple circles, arch shape" : "";

  return `${base}, ${countNeg}${roundNeg}`;
}

export interface PromptInput {
  theme: ThemeId;
  package: PackageId;
  eventType?: EventTypeId;
  backdropItems: BackdropItem[];
  backdropColor?: string;
  balloonStyle: BalloonStyleId;
  balloonColors?: string[];
  backdropText?: BackdropText;
  backdropPrint?: BackdropPrint;
  cutouts?: CutoutSelection;
  extras?: string[];
  plinthSizes?: PlinthSize[];
}

function allowFlorals(input: PromptInput): boolean {
  if ((input.extras ?? []).includes("florals")) return true;
  return input.eventType === "bridal_shower" || input.eventType === "boutique_wedding";
}

export const PLINTH_NEGATIVE =
  "wide drum, flat platform, stage, podium, short cylinder, width greater than height";

/** Build size-aware description for a single arch item, including per-panel color. */
function buildArchItemDesc(item: BackdropItem, panelColorName = ""): string {
  const colorPart = panelColorName ? ` in ${panelColorName} color` : "";
  if (item.heightCm && item.widthCm) {
    return (
      `one symmetrical full arch vertical panel with a rounded top center, ` +
      `${item.heightCm}cm tall, ${item.widthCm}cm wide${colorPart}, standing directly on the floor`
    );
  }
  const size = ARCH_SIZES.find((s) => s.id === item.sizeId);
  if (size) {
    return (
      `one symmetrical full arch vertical panel with a rounded top center, ` +
      `${size.heightFt}ft / ${size.heightM}m (${size.heightCm}cm) tall${colorPart}, ` +
      `standing directly on the floor`
    );
  }
  return SHAPE_DESC.arch + colorPart;
}

/** Build dimension-aware description for a rectangular panel — explicitly NOT arch-shaped. */
function buildRectItemDesc(item: BackdropItem, panelColorName = ""): string {
  const colorPart = panelColorName ? ` in ${panelColorName} color` : "";
  if (item.heightCm && item.widthCm) {
    return (
      `one rectangular vertical backdrop panel with a straight horizontal top edge and straight vertical sides, ` +
      `${item.heightCm}cm tall, ${item.widthCm}cm wide${colorPart}, ` +
      `NOT arch-shaped, NOT rounded or curved top, NOT oval — this panel has a completely flat top, ` +
      `standing directly on the floor`
    );
  }
  const size = RECT_SIZES.find((s) => s.id === item.sizeId);
  if (size) {
    return (
      `one rectangular vertical backdrop panel with a straight horizontal top edge and straight vertical sides, ` +
      `${size.heightCm}cm tall, ${size.widthCm}cm wide${colorPart}, ` +
      `NOT arch-shaped, NOT rounded or curved top, NOT oval — this panel has a completely flat top, ` +
      `standing directly on the floor`
    );
  }
  return SHAPE_DESC.rect + colorPart;
}

/** Build description for any panel, including per-panel color, text, and graphic. */
function itemDesc(item: BackdropItem, panelColorName = ""): string {
  let base: string;
  if (item.type === "arch") base = buildArchItemDesc(item, panelColorName);
  else if (item.type === "rect") base = buildRectItemDesc(item, panelColorName);
  else {
    const colorPart = panelColorName ? ` in ${panelColorName} color` : "";
    base = SHAPE_DESC[item.type] + colorPart;
  }

  // Per-panel graphic presence
  const graphicPart = item.graphic?.enabled
    ? ` with ${item.graphic.style} themed graphic printed on its surface`
    : " with plain solid color surface and no printed graphics";

  // Per-panel text presence
  const textVal = item.text?.enabled && item.text?.value?.trim();
  const textPart = textVal
    ? ` with the text "${textVal}" in ${FONT_DESC[item.text.fontStyle] ?? "elegant lettering"}`
    : "";

  return base + graphicPart + textPart;
}

function effectiveItems(items: BackdropItem[]): BackdropItem[] {
  return items.slice(0, Math.max(1, Math.min(3, items.length)));
}

function buildSceneBackdrop(items: BackdropItem[], globalColorName: string): string {
  const active = effectiveItems(items);
  const count = active.length;

  if (count === 1) {
    // Per-item color takes priority; fall back to global
    const itemColorName = active[0].color ? hexToColorName(active[0].color) : globalColorName;
    return itemDesc(active[0], itemColorName);
  }

  const countWord = count === 2 ? "two" : "three";
  // Describe each panel individually with its own type, size, and color
  const panelDescriptions = active.map((item) => {
    const c = item.color ? hexToColorName(item.color) : globalColorName;
    return `PANEL: ${itemDesc(item, c)}`;
  }).join("; ");

  return (
    `STRICT SCENE STRUCTURE: exactly ${countWord} separate backdrop panels arranged side by side. ` +
    `${panelDescriptions}. ` +
    `Each panel is DISTINCT — different shape, different size, different color as described above. ` +
    `Each selected panel must remain clearly visible. ` +
    `Do not add extra panels. All panels stand directly on the floor with no base platform.`
  );
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

  const themeDesc =
    (!florals && THEME_MOOD_NO_FLORAL[input.theme]) ||
    THEME_MOOD[input.theme] ||
    `${themeName} theme`;

  const shapeLocked = SHAPE_LOCKED_THEMES.has(input.theme);
  const colorName = input.backdropColor ? hexToColorName(input.backdropColor) : "";
  const backdrop = shapeLocked ? "" : buildSceneBackdrop(input.backdropItems, colorName);

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

  const activeItems = effectiveItems(input.backdropItems);
  const panelCount = activeItems.length;
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

  // Plain-surface clause only fires when no panel has a graphic enabled and no global print.
  const anyPanelGraphicOn = activeItems.some((i) => i.graphic?.enabled);
  const plainBackdropClause =
    !anyPanelGraphicOn && (!input.backdropPrint || input.backdropPrint.type === "none")
      ? "backdrop panel surfaces are completely plain solid color, " +
        "NO illustrations, NO characters, NO prints, NO patterns on any panel surface, " +
        "clean flat matte painted panels"
      : "";

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

  const noCutoutsClause =
    !input.cutouts || input.cutouts.size === "none"
      ? "NO character cutouts, NO standing figures, NO cardboard standees anywhere in the scene"
      : "";

  const extras = (input.extras ?? [])
    .map((id) => EXTRAS_DESC[id])
    .filter(Boolean)
    .join(", ");

  const PLINTH_SIZE_LABEL: Record<string, string> = {
    small: "small",
    medium: "medium-height",
    large: "large",
    xl: "extra-large",
  };
  const PLINTH_BASE =
    "elegant narrow white display column similar to a museum sculpture pedestal or flower stand, " +
    "very narrow cylindrical tube shape, tall and slender, slim narrow white cylindrical column pedestals with 40cm diameter only, " +
    "very narrow base, tall and slender like a flower vase or display column, " +
    "NOT a wide platform, NOT a podium, diameter must be much smaller than height";
  const PLINTH_FLOOR_RULE =
    "The backdrop stands directly on the floor with no raised base. " +
    "Pedestals are separate narrow vertical columns, not connected to each other and not forming a platform.";
  let plinthClause = "";
  if (input.plinthSizes && input.plinthSizes.length > 0) {
    const count = Math.min(3, input.plinthSizes.length);
    const sizes = input.plinthSizes.slice(0, count);
    if (count === 1) {
      plinthClause =
        `one ${PLINTH_SIZE_LABEL[sizes[0]] ?? "medium-height"} narrow cylindrical white display column pedestal, ` +
        `${PLINTH_BASE}. ${PLINTH_FLOOR_RULE}`;
    } else if (count === 2) {
      plinthClause =
        `two separate narrow cylindrical white display column pedestals of different heights, ` +
        `one ${PLINTH_SIZE_LABEL[sizes[0]] ?? "medium-height"} and one ${PLINTH_SIZE_LABEL[sizes[1]] ?? "large"}, ` +
        `${PLINTH_BASE}. ${PLINTH_FLOOR_RULE}`;
    } else {
      plinthClause =
        `three separate narrow cylindrical white display column pedestals grouped beside the backdrop, ` +
        `${PLINTH_BASE}. ${PLINTH_FLOOR_RULE}`;
    }
  }

  const effectivePanels = panelCount;
  const panelWord =
    effectivePanels === 1 ? "ONE (1)" : effectivePanels === 2 ? "TWO (2)" : "THREE (3)";

  const SHAPE_LABEL: Record<BackdropShapeId, string> = {
    arch:         "arch (semicircular top)",
    round:        "round circular disc",
    rect:         "flat rectangular",
    shimmer_wall: "rectangular shimmer wall",
    wavy:         "wavy top",
  };

  // Per-item label includes type + size for the strict requirements block
  function itemLabel(item: BackdropItem): string {
    if (item.type === "arch") {
      const size = ARCH_SIZES.find((s) => s.id === item.sizeId);
      return size ? `arch ${size.label} (semicircular top)` : "arch (semicircular top)";
    }
    if (item.type === "rect") {
      const size = RECT_SIZES.find((s) => s.id === item.sizeId);
      return size
        ? `rectangular ${size.label} (flat straight top, NOT arch)`
        : "rectangular (flat straight top, NOT arch)";
    }
    return SHAPE_LABEL[item.type];
  }

  const shapeLabelStr =
    activeItems.length === 1
      ? itemLabel(activeItems[0])
      : activeItems.map(itemLabel).join(" + ");
  const panelShapeDesc =
    activeItems.length === 1
      ? `with ${shapeLabelStr} shape`
      : `with mixed shapes: ${shapeLabelStr}`;

  const strictRequirements =
    effectivePanels === 1
      ? `STRICT REQUIREMENTS: This image must show EXACTLY ONE (1) backdrop panel ${panelShapeDesc}, ` +
        `one backdrop panel only, no second backdrop, no extra panels. This overrides everything else.`
      : effectivePanels === 2
        ? `STRICT REQUIREMENTS: This image must show EXACTLY TWO (2) backdrop panels ${panelShapeDesc}, ` +
          `two backdrop panels side by side. This overrides everything else.`
        : `STRICT REQUIREMENTS: This image must show EXACTLY THREE (3) backdrop panels ${panelShapeDesc}, ` +
          `three backdrop panels arranged together. This overrides everything else.`;

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

  const shapes = activeItems.map((i) => i.type);
  const _hasRound = shapes.includes("round");
  const _hasRect  = shapes.includes("rect");
  const shapeNegative = [
    effectivePanels === 1 && _hasRound
      ? "two circles, multiple circles, arch shape"
      : "",
    _hasRect
      ? "arch-shaped panel, rounded top panel, curved top panel, arched backdrop, semicircular top"
      : "",
  ].filter(Boolean).join(", ");

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
      const shapeDesc = buildSceneBackdrop(input.backdropItems, colorName);
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
      const pCount = effectiveItems(input.backdropItems).length;
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

