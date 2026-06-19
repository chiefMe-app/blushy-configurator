// ---------------------------------------------------------------------------
// Blushy Birthday Builder — single source of truth for all options + pricing.
// Shared by the client UI and the server-side API routes so they never drift.
// NEVER hardcode prices in components — derive everything from here.
// ---------------------------------------------------------------------------

// =====================  STEP — EVENT TYPE  =================================

export type EventTypeId =
  | "birthday"
  | "baby_shower"
  | "bridal_shower"
  | "boutique_wedding"
  | "corporate_mini";

export interface EventType {
  id: EventTypeId;
  label: string;
  emoji: string;
  description: string;
}

export const EVENT_TYPES: EventType[] = [
  { id: "birthday", label: "Birthday", emoji: "🎂", description: "The classic celebration" },
  { id: "baby_shower", label: "Baby Shower", emoji: "🍼", description: "Welcome the little one" },
  { id: "bridal_shower", label: "Bridal Shower", emoji: "💍", description: "Celebrate the bride" },
  { id: "boutique_wedding", label: "Boutique Wedding Corner", emoji: "💐", description: "Intimate wedding styling" },
  { id: "corporate_mini", label: "Corporate Mini Setup", emoji: "🏢", description: "Branded & polished" },
];

// =====================  STEP — THEME  ======================================

export type ThemeId =
  | "frozen"
  | "unicorn"
  | "dinosaur"
  | "safari"
  | "princess"
  | "superhero"
  | "barbie"
  | "bluey"
  | "pokemon"
  | "stitch"
  | "mermaid"
  | "space"
  | "football"
  | "lego"
  | "kpop"
  | "encanto"
  | "cocomelon"
  | "teddy_bear"
  | "pineapple_tropical"
  | "blush_garden"
  | "luxury_neutral";

export interface Theme {
  id: ThemeId;
  name: string;
  emoji: string;
  desc: string;
  /** Suggested backdrop colors (first is the default). */
  backdropColors: string[];
  /** Suggested balloon palette (Sempertex). */
  balloonColors: string[];
  priceModifier: number;
  /** UI accent (hex) — chosen for good contrast on a white background. */
  accent: string;
}

export const THEMES: Theme[] = [
  { id: "frozen", name: "Frozen", emoji: "❄️", desc: "Icy blues, silver, snowflakes", backdropColors: ["#E8F4FD", "#B3D9F2", "#FFFFFF"], balloonColors: ["#B3D9F2", "#E8F4FD", "#C8E6FA", "#FFFFFF", "#A8D4EF"], priceModifier: 50, accent: "#4A90D9" },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", desc: "Pastels, iridescent, rainbow magic", backdropColors: ["#F9D5DF", "#E8C8F0", "#FFFFFF"], balloonColors: ["#F9D5DF", "#C4F0E8", "#E8C8F0", "#FFF0A0", "#FFFFFF"], priceModifier: 50, accent: "#C77DD6" },
  { id: "dinosaur", name: "Dinosaur", emoji: "🦕", desc: "Earthy greens, terracotta, jungle", backdropColors: ["#E8F5E9", "#C8DFC8", "#F5F0E8"], balloonColors: ["#80CBC4", "#A5D6A7", "#BCAAA4", "#EF9A9A", "#78909C"], priceModifier: 30, accent: "#4CAF82" },
  { id: "safari", name: "Safari", emoji: "🦁", desc: "Warm browns, animal print, jungle", backdropColors: ["#FFF8E1", "#FFE0B2", "#F5F0E8"], balloonColors: ["#FFCC80", "#A5D6A7", "#FFAB40", "#8D6E63", "#FFF176"], priceModifier: 30, accent: "#B5762A" },
  { id: "princess", name: "Princess", emoji: "👑", desc: "Pink, gold, castle, crown", backdropColors: ["#FCE4EC", "#FFF9C4", "#FFFFFF"], balloonColors: ["#F48FB1", "#CE93D8", "#FFD54F", "#FFFFFF", "#F8BBD0"], priceModifier: 50, accent: "#E84F8B" },
  { id: "superhero", name: "Superhero", emoji: "🦸", desc: "Bold primaries, action, pow!", backdropColors: ["#E3F2FD", "#FFEBEE", "#F3E5F5"], balloonColors: ["#EF5350", "#1565C0", "#FDD835", "#43A047", "#9C27B0"], priceModifier: 40, accent: "#1565C0" },
  { id: "barbie", name: "Barbie", emoji: "💗", desc: "Hot pink, fuchsia, glam", backdropColors: ["#FF69B4", "#FFB6C1", "#FFFFFF"], balloonColors: ["#FF69B4", "#FF1493", "#FFB6C1", "#FFFFFF", "#FF69B4"], priceModifier: 60, accent: "#FF1493" },
  { id: "bluey", name: "Bluey", emoji: "🐾", desc: "Blue heeler, family fun, playful", backdropColors: ["#E3F2FD", "#BBDEFB", "#FFFFFF"], balloonColors: ["#42A5F5", "#EF5350", "#FFF176", "#81C784", "#FFFFFF"], priceModifier: 40, accent: "#2E86DE" },
  { id: "pokemon", name: "Pokémon", emoji: "⚡", desc: "Yellow, red Pokéball, adventure", backdropColors: ["#FFFDE7", "#FFF9C4", "#FFFFFF"], balloonColors: ["#FDD835", "#EF5350", "#1565C0", "#FFFFFF", "#FF8F00"], priceModifier: 50, accent: "#E0382B" },
  { id: "stitch", name: "Stitch", emoji: "💙", desc: "Blue, tropical, Hawaiian", backdropColors: ["#E3F2FD", "#B3E5FC", "#E8F5E9"], balloonColors: ["#42A5F5", "#1565C0", "#81C784", "#FFFFFF", "#29B6F6"], priceModifier: 40, accent: "#2196D6" },
  { id: "mermaid", name: "Mermaid", emoji: "🧜‍♀️", desc: "Teals, iridescent, ocean magic", backdropColors: ["#E0F7FA", "#B2EBF2", "#F3E5F5"], balloonColors: ["#80DEEA", "#4DD0E1", "#CE93D8", "#B2EBF2", "#FFFFFF"], priceModifier: 50, accent: "#1FB6C4" },
  { id: "space", name: "Space", emoji: "🚀", desc: "Deep navy, stars, planets", backdropColors: ["#1A237E", "#283593", "#311B92"], balloonColors: ["#9FA8DA", "#7986CB", "#B39DDB", "#FFD54F", "#FFFFFF"], priceModifier: 60, accent: "#3949AB" },
  { id: "football", name: "Football", emoji: "⚽", desc: "Team colors, grass green, sporty", backdropColors: ["#E8F5E9", "#FFFFFF", "#F5F5F5"], balloonColors: ["#43A047", "#FFFFFF", "#1565C0", "#EF5350", "#FDD835"], priceModifier: 30, accent: "#2E9E4F" },
  { id: "lego", name: "Lego", emoji: "🧱", desc: "Bright primary colors, brick fun", backdropColors: ["#FFFFFF", "#EF5350", "#1565C0"], balloonColors: ["#EF5350", "#1565C0", "#FDD835", "#43A047", "#FFFFFF"], priceModifier: 40, accent: "#1565C0" },
  { id: "kpop", name: "K-Pop", emoji: "🎤", desc: "Neon, sparkle, idol vibes", backdropColors: ["#F3E5F5", "#E8EAF6", "#FCE4EC"], balloonColors: ["#CE93D8", "#9FA8DA", "#F48FB1", "#FFFFFF", "#80DEEA"], priceModifier: 70, accent: "#B14FD8" },
  { id: "encanto", name: "Encanto", emoji: "🌺", desc: "Vibrant Colombian colors, magical", backdropColors: ["#FFF8E1", "#FCE4EC", "#E8F5E9"], balloonColors: ["#FF8F00", "#E91E63", "#43A047", "#FFD54F", "#9C27B0"], priceModifier: 50, accent: "#E0561E" },
  { id: "cocomelon", name: "Cocomelon", emoji: "🍉", desc: "Bright primaries, watermelon, fun", backdropColors: ["#E8F5E9", "#E3F2FD", "#FFFFFF"], balloonColors: ["#EF5350", "#43A047", "#42A5F5", "#FDD835", "#FFFFFF"], priceModifier: 30, accent: "#3AA655" },
  { id: "teddy_bear", name: "Teddy Bear", emoji: "🧸", desc: "Soft beige, dusty pink, cozy", backdropColors: ["#F5EDE0", "#F2C4CE", "#EDE0D4"], balloonColors: ["#D4A574", "#F2C4CE", "#C4A882", "#FFFFFF", "#E8D5C4"], priceModifier: 30, accent: "#C08552" },
  { id: "pineapple_tropical", name: "Tropical 🍍", emoji: "🌺", desc: "Pineapple, palm leaves, vibrant", backdropColors: ["#FFF9C4", "#FCE4EC", "#FFFFFF"], balloonColors: ["#FDD835", "#CE93D8", "#F48FB1", "#A5D6A7", "#FFFFFF"], priceModifier: 40, accent: "#E0561E" },
  { id: "blush_garden", name: "Blush Garden", emoji: "🌸", desc: "Soft pinks, florals, romantic", backdropColors: ["#FCE4EC", "#F8BBD0", "#FFFFFF"], balloonColors: ["#F48FB1", "#F8BBD0", "#FFFFFF", "#CE93D8", "#FFE0B2"], priceModifier: 0, accent: "#E5739A" },
  { id: "luxury_neutral", name: "Luxury Neutral", emoji: "🤍", desc: "Beige, champagne, gold, ivory", backdropColors: ["#F5F0E8", "#EDE0D0", "#FFFFFF"], balloonColors: ["#D4B896", "#EDE0D0", "#FFD54F", "#FFFFFF", "#C8A882"], priceModifier: 80, accent: "#B08D57" },
];

// =====================  STEP — PACKAGE  ====================================

export type PackageId = "mini" | "signature" | "luxury";

/** Package-driven decor defaults (colors come from the theme, not the package). */
export type PackageDecorDefaults = Omit<DecorConfig, "backdropColor" | "balloonColors">;

export interface Package {
  id: PackageId;
  label: string;
  base: number;
  popular?: boolean;
  includes: string[];
  bestFor: string;
  defaultDecor: PackageDecorDefaults;
}

export const PACKAGES: Package[] = [
  {
    id: "mini",
    label: "Mini Setup",
    base: 950,
    includes: ["1 backdrop", "Small balloon garland", "1 plinth"],
    bestFor: "Intimate home setups",
    defaultDecor: {
      backdropItems: [
        { id: "arch_66ft", type: "arch", sizeId: "arch_66ft", widthCm: 130, heightCm: 200, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
      ],
      balloonStyle: "half",
      plinths: 1,
      plinthSizes: ["medium"],
      cutouts: { size: "none", position: "floor" },
      backdropPrint: { type: "none" },
      backdropText: { enabled: false, type: "birthday", name: "", customText: "", fontStyle: "script", color: "white", fontSize: 4, lineHeight: 140, verticalOffset: 30, horizontalOffset: 50, align: "center" },
      cakeTable: false,
    },
  },
  {
    id: "signature",
    label: "Signature Setup",
    base: 1850,
    popular: true,
    includes: ["2 backdrops", "Organic balloon styling", "2 plinths", "Custom name sign"],
    bestFor: "Villa gardens, restaurant corners",
    defaultDecor: {
      backdropItems: [
        { id: "arch_72ft", type: "arch", sizeId: "arch_72ft", widthCm: 143, heightCm: 220, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
        { id: "arch_6ft",  type: "arch", sizeId: "arch_6ft",  widthCm: 117, heightCm: 180, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
      ],
      balloonStyle: "full",
      plinths: 2,
      plinthSizes: ["medium", "medium"],
      cutouts: { size: "none", position: "floor" },
      backdropPrint: { type: "none" },
      backdropText: { enabled: true, type: "birthday", name: "", customText: "", fontStyle: "script", color: "white", fontSize: 4, lineHeight: 140, verticalOffset: 30, horizontalOffset: 50, align: "center" },
      cakeTable: false,
    },
  },
  {
    id: "luxury",
    label: "Luxury Setup",
    base: 2950,
    includes: [
      "3 backdrops",
      "Full premium balloon styling",
      "Themed props + cutouts",
      "Dessert/cake styling zone",
    ],
    bestFor: "Full venue takeovers",
    defaultDecor: {
      backdropItems: [
        { id: "arch_72ft", type: "arch", sizeId: "arch_72ft", widthCm: 143, heightCm: 220, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
        { id: "arch_66ft", type: "arch", sizeId: "arch_66ft", widthCm: 130, heightCm: 200, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
        { id: "wavy",      type: "wavy",                      widthCm: 100, heightCm: 200, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
      ],
      balloonStyle: "premium",
      plinths: 3,
      plinthSizes: ["large", "medium", "medium"] as PlinthSize[],
      cutouts: { size: "medium", position: "floor" },
      backdropPrint: { type: "none" },
      backdropText: { enabled: true, type: "birthday", name: "", customText: "", fontStyle: "elegant", color: "gold", fontSize: 4, lineHeight: 140, verticalOffset: 30, horizontalOffset: 50, align: "center" },
      cakeTable: true,
    },
  },
];

// =====================  STEP — DECOR  ======================================

export type BackdropShapeId =
  | "arch"
  | "round"
  | "rect"
  | "shimmer_wall"
  | "wavy";

export type ArchSizeId =
  | "arch_4ft"
  | "arch_5ft"
  | "arch_6ft"
  | "arch_66ft"
  | "arch_72ft";

export interface ArchSize {
  id: ArchSizeId;
  label: string;
  heightFt: number;
  heightM: number;
  heightCm: number;
  /** Approximate panel width (arch is wider than it is deep). */
  widthCm: number;
}

export const ARCH_SIZES: ArchSize[] = [
  { id: "arch_4ft",  label: "4FT / 1.2M",   heightFt: 4,   heightM: 1.2, heightCm: 120, widthCm: 78  },
  { id: "arch_5ft",  label: "5FT / 1.5M",   heightFt: 5,   heightM: 1.5, heightCm: 150, widthCm: 98  },
  { id: "arch_6ft",  label: "6FT / 1.8M",   heightFt: 6,   heightM: 1.8, heightCm: 180, widthCm: 117 },
  { id: "arch_66ft", label: "6.6FT / 2M",   heightFt: 6.6, heightM: 2.0, heightCm: 200, widthCm: 130 },
  { id: "arch_72ft", label: "7.2FT / 2.2M", heightFt: 7.2, heightM: 2.2, heightCm: 220, widthCm: 143 },
];

export type RectSizeId = "rect_100x200" | "rect_80x180";

export interface RectSize {
  id: RectSizeId;
  label: string;
  widthCm: number;
  heightCm: number;
}

export const RECT_SIZES: RectSize[] = [
  { id: "rect_100x200", label: "100 × 200 cm", widthCm: 100, heightCm: 200 },
  { id: "rect_80x180",  label: "80 × 180 cm",  widthCm: 80,  heightCm: 180 },
];

export interface BackdropItemText {
  enabled: boolean;
  value: string;
  fontStyle: FontStyle;
  color: TextColor;
}

export interface BackdropItemGraphic {
  enabled: boolean;
  theme: string;
  style: GraphicStyle;
}

/**
 * Source of truth for a single backdrop panel — shape, exact dimensions,
 * per-panel color, text, and graphic settings.
 */
export interface BackdropItem {
  /** Stable unique ID for this panel (sizeId for sized panels, type for others). */
  id: string;
  type: BackdropShapeId;
  /** For arch: ArchSizeId. For rect: RectSizeId. Undefined for unsized types. */
  sizeId?: string;
  widthCm: number;
  heightCm: number;
  /** Per-panel backdrop color. Falls back to global backdropColor when empty. */
  color: string;
  text: BackdropItemText;
  graphic: BackdropItemGraphic;
}

const DEFAULT_ITEM_TEXT: BackdropItemText = {
  enabled: false, value: "", fontStyle: "script", color: "white",
};
const DEFAULT_ITEM_GRAPHIC: BackdropItemGraphic = {
  enabled: false, theme: "", style: "illustrated",
};

/** Create a fully-populated BackdropItem from type and optional sizeId. */
export function makeBackdropItem(
  type: BackdropShapeId,
  sizeId?: string,
  color = "",
): BackdropItem {
  let widthCm = 100;
  let heightCm = 200;
  if (type === "arch" && sizeId) {
    const s = ARCH_SIZES.find((a) => a.id === sizeId);
    if (s) { widthCm = s.widthCm; heightCm = s.heightCm; }
  } else if (type === "rect" && sizeId) {
    const s = RECT_SIZES.find((r) => r.id === sizeId);
    if (s) { widthCm = s.widthCm; heightCm = s.heightCm; }
  } else if (type === "round") {
    widthCm = 120; heightCm = 120;
  } else if (type === "shimmer_wall") {
    widthCm = 80; heightCm = 210;
  }
  return {
    id:      sizeId ?? type,
    type,
    sizeId,
    widthCm,
    heightCm,
    color,
    text:    { ...DEFAULT_ITEM_TEXT },
    graphic: { ...DEFAULT_ITEM_GRAPHIC },
  };
}

export type BalloonStyleId = "none" | "half" | "full" | "premium";

export type PlinthSize = "small" | "medium" | "large";
export type CutoutSize = "none" | "small" | "medium" | "premium";
export type CutoutPosition = "floor" | "backdrop";
export type BackdropTextType = "birthday" | "custom";
export type FontStyle = "script" | "block" | "elegant";
export type TextColor = "white" | "gold" | "black" | "accent";
export type TextAlign = "left" | "center" | "right";
export type BackdropPrintType = "none" | "name_only" | "theme_print" | "custom_upload";
export type GraphicStyle = "illustrated" | "realistic" | "minimal" | "pattern" | "full_scene";

export interface GraphicStyleOption {
  id: GraphicStyle;
  label: string;
  desc: string;
}

export const GRAPHIC_STYLES: GraphicStyleOption[] = [
  { id: "illustrated", label: "Illustrated", desc: "Soft cartoon-style artwork" },
  { id: "realistic",   label: "Realistic",   desc: "Photographic quality print" },
  { id: "minimal",     label: "Minimal",     desc: "Clean line art, elegant" },
  { id: "pattern",     label: "Pattern",     desc: "Repeating themed pattern" },
  { id: "full_scene",  label: "Full Scene",  desc: "Complete themed background scene" },
];

export interface BackdropPrint {
  type: BackdropPrintType;
  graphicStyle?: GraphicStyle;
}

export interface BackdropPrintOption {
  id: BackdropPrintType;
  label: string;
  price: number;
  desc: string;
}

export const BACKDROP_PRINTS: BackdropPrintOption[] = [
  { id: "none", label: "Plain — No Print", price: 0, desc: "Solid color only" },
  { id: "name_only", label: "Name Only", price: 80, desc: "Child's name in elegant font" },
  { id: "theme_print", label: "Theme Graphic", price: 150, desc: "Full themed illustration printed on backdrop" },
  { id: "custom_upload", label: "Custom Design", price: 200, desc: "Upload your own design" },
];

export interface BackdropText {
  enabled: boolean;
  type: BackdropTextType;
  name: string;
  customText: string;
  fontStyle: FontStyle;
  color: TextColor;
  /** 1–10 scale; maps to CSS font-size. Default 4. */
  fontSize: number;
  /** 100–250; divide by 100 for CSS line-height. Default 140. */
  lineHeight: number;
  /** 0–100; vertical position within the backdrop safe area. Default 30. */
  verticalOffset: number;
  /** 0–100; horizontal center of the text block within the safe area. Default 50. */
  horizontalOffset: number;
  align: TextAlign;
}

export interface CutoutSelection {
  size: CutoutSize;
  position: CutoutPosition;
}

export interface DecorConfig {
  /** Source of truth for all backdrop panels — type, count, and arch sizes. */
  backdropItems: BackdropItem[];
  balloonStyle: BalloonStyleId;
  /** User-chosen backdrop color (hex) — defaults to the theme suggestion. */
  backdropColor: string;
  /** User-chosen balloon colors (hex, up to 5) — defaults to the theme palette. */
  balloonColors: string[];
  plinths: number;
  plinthSizes: PlinthSize[];
  cutouts: CutoutSelection;
  backdropPrint: BackdropPrint;
  backdropText: BackdropText;
  cakeTable: boolean;
}

export interface Option<T extends string> {
  id: T;
  label: string;
  price: number;
}

export const BACKDROP_SHAPES: Option<BackdropShapeId>[] = [
  { id: "arch",         label: "Arch Backdrop",        price: 0 },
  { id: "round",        label: "Round Backdrop",       price: 0 },
  { id: "rect",         label: "Rectangular Backdrop", price: 0 },
  { id: "shimmer_wall", label: "Shimmer Wall",         price: 80 },
  { id: "wavy",         label: "Wavy Backdrop",        price: 0 },
];

export const BALLOON_STYLES: Option<BalloonStyleId>[] = [
  { id: "none", label: "None", price: 0 },
  { id: "half", label: "Half Garland", price: 150 },
  { id: "full", label: "Full Garland", price: 250 },
  { id: "premium", label: "Premium Organic", price: 420 },
];

export const PLINTH_SIZES: Option<PlinthSize>[] = [
  { id: "small", label: "S — 90cm", price: 60 },
  { id: "medium", label: "M — 100cm", price: 80 },
  { id: "large", label: "L — 110cm", price: 110 },
];

/** Cutout sets — shown as cards in the Add-ons step. */
export interface CutoutSet {
  size: Exclude<CutoutSize, "none">;
  label: string;
  desc: string;
  price: number;
}

export const CUTOUT_SETS: CutoutSet[] = [
  { size: "small", label: "Small Set", desc: "2 character cutouts", price: 150 },
  { size: "medium", label: "Medium Set", desc: "4 character cutouts", price: 250 },
  { size: "premium", label: "Premium Set", desc: "6 cutouts + large feature piece", price: 420 },
];

export const CAKE_TABLE_PRICE = 300;

/** Extra/fewer backdrops beyond the package default cost this each. */
export const PER_BACKDROP = 350;

/** Effective panel count from the selected backdrop items. */
export function backdropPanelCount(items: BackdropItem[]): number {
  return Math.max(1, items.length);
}

export const FONT_STYLES: { id: FontStyle; label: string }[] = [
  { id: "script", label: "Script / Cursive" },
  { id: "block", label: "Bold Block" },
  { id: "elegant", label: "Elegant Serif" },
];

export const TEXT_COLORS: { id: TextColor; label: string; swatch: string }[] = [
  { id: "white", label: "White", swatch: "#FFFFFF" },
  { id: "gold", label: "Gold", swatch: "#D4AF37" },
  { id: "black", label: "Black", swatch: "#222222" },
  { id: "accent", label: "Theme accent", swatch: "" },
];

// =====================  STEP — ADD-ONS  ====================================

export type AddOnId =
  | "bouncy_castle"
  | "soft_play"
  | "ball_pit"
  | "popcorn"
  | "cotton_candy"
  | "face_painting"
  | "mascot"
  | "photographer"
  | "videographer"
  | "cake"
  | "return_gifts"
  | "kids_tables";

export interface SubOption {
  key: string;
  label: string;
  type: "choice" | "text" | "number";
  choices?: { value: string; label: string }[];
}

export interface AddOn {
  id: AddOnId;
  label: string;
  description: string;
  basePrice: number;
  priceLabel: string;
  perChild?: boolean;
  subOptions?: SubOption[];
  recommend?: { packages?: PackageId[]; themes?: ThemeId[] };
}

const GUEST_COUNT: SubOption = {
  key: "guests",
  label: "Approx. guest count",
  type: "choice",
  choices: [
    { value: "under_20", label: "Under 20" },
    { value: "20_50", label: "20–50" },
    { value: "50_plus", label: "50+" },
  ],
};

const DURATION: SubOption = {
  key: "duration",
  label: "Duration",
  type: "choice",
  choices: [
    { value: "1hr", label: "1 hr" },
    { value: "2hr", label: "2 hrs" },
    { value: "3hr", label: "3 hrs" },
  ],
};

export const ADDONS: AddOn[] = [
  {
    id: "bouncy_castle",
    label: "Bouncy Castle",
    description: "A bouncing favourite for the kids.",
    basePrice: 450,
    priceLabel: "from AED 450",
    subOptions: [
      { key: "placement", label: "Indoor or outdoor", type: "choice", choices: [{ value: "indoor", label: "Indoor" }, { value: "outdoor", label: "Outdoor" }] },
      { key: "space", label: "Space available", type: "text" },
      { key: "age", label: "Child age range", type: "choice", choices: [{ value: "3_5", label: "3–5" }, { value: "5_10", label: "5–10" }, { value: "mixed", label: "Mixed" }] },
    ],
  },
  { id: "soft_play", label: "Soft Play", description: "Safe padded play zone for toddlers.", basePrice: 380, priceLabel: "from AED 380" },
  { id: "ball_pit", label: "Ball Pit", description: "Colourful ball pit for endless fun.", basePrice: 280, priceLabel: "from AED 280" },
  { id: "popcorn", label: "Popcorn Machine", description: "Fresh popcorn cart with serving.", basePrice: 220, priceLabel: "AED 220", subOptions: [GUEST_COUNT] },
  { id: "cotton_candy", label: "Cotton Candy Machine", description: "Spun-sugar treats on demand.", basePrice: 220, priceLabel: "AED 220", subOptions: [GUEST_COUNT] },
  {
    id: "face_painting",
    label: "Face Painting",
    description: "Professional artist, themed designs.",
    basePrice: 350,
    priceLabel: "AED 350",
    recommend: { themes: ["safari", "princess"] },
    subOptions: [{ key: "children", label: "Number of children", type: "choice", choices: [{ value: "under_10", label: "Under 10" }, { value: "10_20", label: "10–20" }, { value: "20_plus", label: "20+" }] }],
  },
  { id: "mascot", label: "Mascot / Entertainer", description: "Costumed character or host.", basePrice: 650, priceLabel: "from AED 650" },
  { id: "photographer", label: "Photographer", description: "Capture the day professionally.", basePrice: 750, priceLabel: "from AED 750", recommend: { packages: ["luxury"] }, subOptions: [DURATION] },
  { id: "videographer", label: "Videographer", description: "Cinematic event film.", basePrice: 950, priceLabel: "from AED 950", recommend: { packages: ["luxury"] }, subOptions: [DURATION] },
  { id: "cake", label: "Cake", description: "Custom themed celebration cake.", basePrice: 380, priceLabel: "from AED 380" },
  { id: "return_gifts", label: "Return Gifts", description: "Curated goodie bags per child.", basePrice: 15, priceLabel: "from AED 15 / child", perChild: true, subOptions: [{ key: "children", label: "Number of children", type: "number" }] },
  { id: "kids_tables", label: "Kids Tables & Chairs", description: "Styled seating for little guests.", basePrice: 280, priceLabel: "AED 280" },
];

// =====================  LOOKUPS  ===========================================

export const eventTypeById = (id: string) => EVENT_TYPES.find((e) => e.id === id);
export const themeById = (id: string) => THEMES.find((t) => t.id === id);
export const packageById = (id: string) => PACKAGES.find((p) => p.id === id);
export const shapeById = (id: string) => BACKDROP_SHAPES.find((s) => s.id === id);
export const balloonStyleById = (id: string) => BALLOON_STYLES.find((b) => b.id === id);
export const plinthSizeById = (id: string) => PLINTH_SIZES.find((p) => p.id === id);
export const cutoutSetBySize = (size: string) => CUTOUT_SETS.find((c) => c.size === size);
export const backdropPrintById = (id: string) => BACKDROP_PRINTS.find((p) => p.id === id);
export const addOnById = (id: string) => ADDONS.find((a) => a.id === id);

export function cutoutPrice(size: CutoutSize): number {
  return cutoutSetBySize(size)?.price ?? 0;
}

// =====================  STATE SHAPE  =======================================

export interface SelectedAddOn {
  id: AddOnId;
  options?: Record<string, string>;
}

export interface VenueDetails {
  date: string;
  time: string;
  area: string;
  venueType: string;
  isOutdoor: boolean;
  guestCount: number;
  childrenCount: number;
  photos: File[];
}

export interface CustomerDetails {
  name: string;
  whatsapp: string;
}

export interface BuilderConfig {
  eventType: EventTypeId;
  theme: ThemeId;
  package: PackageId;
  decor: DecorConfig;
  addOns: SelectedAddOn[];
  venue: VenueDetails;
  customer: CustomerDetails;
  estimatedTotal: number;
}

export const VENUE_TYPES = [
  "Villa Garden",
  "Indoor Hall",
  "Restaurant",
  "Home",
  "Beach",
  "Other",
] as const;

export function defaultConfig(): BuilderConfig {
  const theme = THEMES.find((t) => t.id === "blush_garden")!;
  const pkg = PACKAGES.find((p) => p.id === "mini")!;
  const cfg: BuilderConfig = {
    eventType: "birthday",
    theme: theme.id,
    package: pkg.id,
    decor: {
      ...pkg.defaultDecor,
      backdropColor: theme.backdropColors[0],
      balloonColors: theme.balloonColors.slice(0, 5),
    },
    addOns: [],
    venue: {
      date: "",
      time: "",
      area: "",
      venueType: "",
      isOutdoor: true,
      guestCount: 0,
      childrenCount: 0,
      photos: [],
    },
    customer: { name: "", whatsapp: "" },
    estimatedTotal: 0,
  };
  cfg.estimatedTotal = computeTotal(cfg);
  return cfg;
}

// =====================  PRICING  ===========================================

export interface PriceLine {
  label: string;
  amount: number;
}

/**
 * Locale-stable thousands formatter. Avoids React hydration mismatches that
 * toLocaleString causes (server vs browser default locale differ).
 */
export function formatAED(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function plinthsTotal(sizes: PlinthSize[]): number {
  return sizes.reduce((sum, s) => sum + (plinthSizeById(s)?.price ?? 0), 0);
}

export function addOnPrice(sel: SelectedAddOn, config: BuilderConfig): number {
  const addon = addOnById(sel.id);
  if (!addon) return 0;
  if (addon.perChild) {
    const fromOption = Number(sel.options?.children ?? "");
    const children =
      Number.isFinite(fromOption) && fromOption > 0
        ? fromOption
        : config.venue.childrenCount || 0;
    return addon.basePrice * children;
  }
  return addon.basePrice;
}

export function priceBreakdown(config: BuilderConfig): {
  lines: PriceLine[];
  total: number;
} {
  const lines: PriceLine[] = [];
  const d = config.decor;

  const pkg = packageById(config.package) ?? PACKAGES[0];
  lines.push({ label: `${pkg.label} (base)`, amount: pkg.base });

  const theme = themeById(config.theme);
  if (theme && theme.priceModifier > 0) {
    lines.push({ label: `${theme.name} theme`, amount: theme.priceModifier });
  }

  // Backdrop panel pricing: first panel included, each additional is PER_BACKDROP.
  // Shimmer wall adds +80 per shimmer panel regardless of position.
  for (let i = 0; i < d.backdropItems.length; i++) {
    const item = d.backdropItems[i];
    const sInfo = shapeById(item.type);
    const sLabel = sInfo?.label ?? item.type;
    const panelCost = i === 0 ? 0 : PER_BACKDROP;
    const shimmerExtra = item.type === "shimmer_wall" ? 80 : 0;
    const total = panelCost + shimmerExtra;
    if (total > 0) {
      lines.push({
        label: i === 0 ? `${sLabel} backdrop` : `${sLabel} — panel ${i + 1}`,
        amount: total,
      });
    }
  }

  const style = balloonStyleById(d.balloonStyle);
  if (style && style.price > 0) {
    lines.push({ label: `Balloons — ${style.label}`, amount: style.price });
  }

  const plinthSum = plinthsTotal(d.plinthSizes);
  if (plinthSum > 0) {
    lines.push({ label: `Plinths (${d.plinthSizes.length})`, amount: plinthSum });
  }

  const cut = cutoutPrice(d.cutouts.size);
  if (cut > 0) {
    lines.push({ label: `${cutoutSetBySize(d.cutouts.size)?.label}`, amount: cut });
  }

  const printOpt = backdropPrintById(d.backdropPrint?.type ?? "none");
  if (printOpt && printOpt.price > 0) {
    lines.push({ label: printOpt.label, amount: printOpt.price });
  }

  if (d.cakeTable) {
    lines.push({ label: "Cake / dessert table", amount: CAKE_TABLE_PRICE });
  }

  for (const sel of config.addOns) {
    const addon = addOnById(sel.id);
    if (!addon) continue;
    lines.push({ label: addon.label, amount: addOnPrice(sel, config) });
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return { lines, total };
}

export function computeTotal(config: BuilderConfig): number {
  return priceBreakdown(config).total;
}

export function isAddOnRecommended(addon: AddOn, config: BuilderConfig): boolean {
  if (!addon.recommend) return false;
  if (addon.recommend.packages?.includes(config.package)) return true;
  if (addon.recommend.themes?.includes(config.theme)) return true;
  return false;
}

// =====================  COLOR / ACCENT HELPERS  ============================

export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Lighten a hex toward white and return an "r g b" triplet (for --accent-soft). */
export function softTriplet(hex: string, amt = 0.85): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (c: number) => Math.round(c + (255 - c) * amt);
  return `${f(r)} ${f(g)} ${f(b)}`;
}

/** Resolve a backdrop text's literal string. */
export function resolveBackdropText(t: BackdropText): string {
  if (!t.enabled) return "";
  if (t.type === "birthday") return `Happy Birthday ${t.name}`.trim();
  return t.customText.trim();
}
