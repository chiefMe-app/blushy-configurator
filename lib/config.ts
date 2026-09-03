// ---------------------------------------------------------------------------
// Blushy Birthday Builder - single source of truth for all options + pricing.
// Shared by the client UI and the server-side API routes so they never drift.
// NEVER hardcode prices in components - derive everything from here.
// ---------------------------------------------------------------------------

// =====================  STEP - EVENT TYPE  =================================

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
  { id: "birthday", label: "Birthday", emoji: "-", description: "The classic celebration" },
  { id: "baby_shower", label: "Baby Shower", emoji: "-", description: "Welcome the little one" },
  { id: "bridal_shower", label: "Bridal Shower", emoji: "-", description: "Celebrate the bride" },
  { id: "boutique_wedding", label: "Boutique Wedding Corner", emoji: "-", description: "Intimate wedding styling" },
  { id: "corporate_mini", label: "Corporate Mini Setup", emoji: "-", description: "Branded & polished" },
];

// =====================  STEP - THEME  ======================================

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
  /** UI accent (hex) - chosen for good contrast on a white background. */
  accent: string;
}

/**
 * Backdrop panels always start white, whatever the theme (2026-09-03 product
 * decision). Picking a theme used to also tint the boards — Frozen set them to
 * #E8F4FD — so a customer who only wanted themed BALLOONS silently got pale
 * blue boards too. The theme now drives the balloon palette only; the boards
 * stay white until the customer changes them, and `theme.backdropColors` is
 * still offered as suggested swatches when they do.
 */
export const DEFAULT_BACKDROP_COLOR = "#FFFFFF";

export const THEMES: Theme[] = [
  { id: "frozen", name: "Frozen", emoji: "--", desc: "Icy satin, silver frost", backdropColors: ["#E8F4FD", "#B3D9F2", "#FFFFFF"], balloonColors: ["#B3D9F2", "#E8F4FD", "#C8E6FA", "#FFFFFF", "#A8D4EF"], priceModifier: 50, accent: "#4A90D9" },
  { id: "unicorn", name: "Unicorn", emoji: "-", desc: "Pearlescent pastels, soft iridescence", backdropColors: ["#F9D5DF", "#E8C8F0", "#FFFFFF"], balloonColors: ["#F9D5DF", "#C4F0E8", "#E8C8F0", "#FFF0A0", "#FFFFFF"], priceModifier: 50, accent: "#C77DD6" },
  { id: "dinosaur", name: "Dinosaur", emoji: "-", desc: "Sage botanicals, muted terracotta", backdropColors: ["#E8F5E9", "#C8DFC8", "#F5F0E8"], balloonColors: ["#80CBC4", "#A5D6A7", "#BCAAA4", "#EF9A9A", "#78909C"], priceModifier: 30, accent: "#4CAF82" },
  { id: "safari", name: "Safari", emoji: "-", desc: "Warm linen, sun-washed neutrals", backdropColors: ["#FFF8E1", "#FFE0B2", "#F5F0E8"], balloonColors: ["#FFCC80", "#A5D6A7", "#FFAB40", "#8D6E63", "#FFF176"], priceModifier: 30, accent: "#B5762A" },
  { id: "princess", name: "Princess", emoji: "-", desc: "Blush satin, pearl & soft gold", backdropColors: ["#FCE4EC", "#FFF9C4", "#FFFFFF"], balloonColors: ["#F48FB1", "#CE93D8", "#FFD54F", "#FFFFFF", "#F8BBD0"], priceModifier: 50, accent: "#E84F8B" },
  { id: "superhero", name: "Superhero", emoji: "-", desc: "Bold editorial color, graphic energy", backdropColors: ["#E3F2FD", "#FFEBEE", "#F3E5F5"], balloonColors: ["#EF5350", "#1565C0", "#FDD835", "#43A047", "#9C27B0"], priceModifier: 40, accent: "#1565C0" },
  { id: "barbie", name: "Barbie", emoji: "-", desc: "Glam pink, glossy studio shine", backdropColors: ["#FF69B4", "#FFB6C1", "#FFFFFF"], balloonColors: ["#FF69B4", "#FF1493", "#FFB6C1", "#FFFFFF", "#FF69B4"], priceModifier: 60, accent: "#FF1493" },
  { id: "bluey", name: "Bluey", emoji: "-", desc: "Soft blues, warm honey accents", backdropColors: ["#E3F2FD", "#BBDEFB", "#FFFFFF"], balloonColors: ["#42A5F5", "#EF5350", "#FFF176", "#81C784", "#FFFFFF"], priceModifier: 40, accent: "#2E86DE" },
  { id: "pokemon", name: "Pokemon", emoji: "-", desc: "Sunny gold, crimson accents", backdropColors: ["#FFFDE7", "#FFF9C4", "#FFFFFF"], balloonColors: ["#FDD835", "#EF5350", "#1565C0", "#FFFFFF", "#FF8F00"], priceModifier: 50, accent: "#E0382B" },
  { id: "stitch", name: "Stitch", emoji: "-", desc: "Ocean blues, tropical calm", backdropColors: ["#E3F2FD", "#B3E5FC", "#E8F5E9"], balloonColors: ["#42A5F5", "#1565C0", "#81C784", "#FFFFFF", "#29B6F6"], priceModifier: 40, accent: "#2196D6" },
  { id: "mermaid", name: "Mermaid", emoji: "----", desc: "Teal pearl, underwater light", backdropColors: ["#E0F7FA", "#B2EBF2", "#F3E5F5"], balloonColors: ["#80DEEA", "#4DD0E1", "#CE93D8", "#B2EBF2", "#FFFFFF"], priceModifier: 50, accent: "#1FB6C4" },
  { id: "space", name: "Space", emoji: "-", desc: "Deep navy, starlit metallics", backdropColors: ["#1A237E", "#283593", "#311B92"], balloonColors: ["#9FA8DA", "#7986CB", "#B39DDB", "#FFD54F", "#FFFFFF"], priceModifier: 60, accent: "#3949AB" },
  { id: "football", name: "Football", emoji: "-", desc: "Fresh pitch green, crisp white", backdropColors: ["#E8F5E9", "#FFFFFF", "#F5F5F5"], balloonColors: ["#43A047", "#FFFFFF", "#1565C0", "#EF5350", "#FDD835"], priceModifier: 30, accent: "#2E9E4F" },
  { id: "lego", name: "Lego", emoji: "-", desc: "Primary color blocks, clean geometry", backdropColors: ["#FFFFFF", "#EF5350", "#1565C0"], balloonColors: ["#EF5350", "#1565C0", "#FDD835", "#43A047", "#FFFFFF"], priceModifier: 40, accent: "#1565C0" },
  { id: "kpop", name: "K-Pop", emoji: "-", desc: "Neon stage glow, chrome sparkle", backdropColors: ["#F3E5F5", "#E8EAF6", "#FCE4EC"], balloonColors: ["#CE93D8", "#9FA8DA", "#F48FB1", "#FFFFFF", "#80DEEA"], priceModifier: 70, accent: "#B14FD8" },
  { id: "encanto", name: "Encanto", emoji: "-", desc: "Vibrant blooms, golden warmth", backdropColors: ["#FFF8E1", "#FCE4EC", "#E8F5E9"], balloonColors: ["#FF8F00", "#E91E63", "#43A047", "#FFD54F", "#9C27B0"], priceModifier: 50, accent: "#E0561E" },
  { id: "cocomelon", name: "Cocomelon", emoji: "-", desc: "Fresh melon tones, soft greens", backdropColors: ["#E8F5E9", "#E3F2FD", "#FFFFFF"], balloonColors: ["#EF5350", "#43A047", "#42A5F5", "#FDD835", "#FFFFFF"], priceModifier: 30, accent: "#3AA655" },
  { id: "teddy_bear", name: "Teddy Bear", emoji: "-", desc: "Cream boucle, cocoa warmth", backdropColors: ["#F5EDE0", "#F2C4CE", "#EDE0D4"], balloonColors: ["#D4A574", "#F2C4CE", "#C4A882", "#FFFFFF", "#E8D5C4"], priceModifier: 30, accent: "#C08552" },
  { id: "pineapple_tropical", name: "Tropical", emoji: "-", desc: "Golden light, palm greens", backdropColors: ["#FFF9C4", "#FCE4EC", "#FFFFFF"], balloonColors: ["#FDD835", "#CE93D8", "#F48FB1", "#A5D6A7", "#FFFFFF"], priceModifier: 40, accent: "#E0561E" },
  { id: "blush_garden", name: "Blush Garden", emoji: "-", desc: "Blush florals, romantic softness", backdropColors: ["#FCE4EC", "#F8BBD0", "#FFFFFF"], balloonColors: ["#F48FB1", "#F8BBD0", "#FFFFFF", "#CE93D8", "#FFE0B2"], priceModifier: 0, accent: "#E5739A" },
  { id: "luxury_neutral", name: "Luxury Neutral", emoji: "-", desc: "Champagne satin, gold foil", backdropColors: ["#F5F0E8", "#EDE0D0", "#FFFFFF"], balloonColors: ["#D4B896", "#EDE0D0", "#FFD54F", "#FFFFFF", "#C8A882"], priceModifier: 80, accent: "#B08D57" },
];

// =====================  STEP - SERVICE PACKAGE  ============================

/**
 * Service packages define what the customer receives and how the setup is
 * handled. They do NOT affect or reset the user's design configuration.
 */
export type ServicePackageId =
  | "design_only"
  | "full_design"
  | "delivery_backdrop"
  | "delivery_full";

export type ServicePackageGroup = "design" | "execution";

export interface ServicePackage {
  id:       ServicePackageId;
  group:    ServicePackageGroup;
  name:     string;
  includes: string[];
  price:    number;
}

export const SERVICE_PACKAGES: ServicePackage[] = [
  // -- Design Packages ---------------------------------------------------
  {
    id:    "design_only",
    group: "design",
    name:  "Design Only",
    price: 250,
    includes: [
      "Final Design Render",
      "Production Layout Preview",
      "Backdrop design specification",
      "Basic item & spec summary",
    ],
  },
  {
    id:    "full_design",
    group: "design",
    name:  "Full Design Package",
    price: 450,
    includes: [
      "Final Design Render",
      "Production Layout Preview",
      "Backdrop design specification",
      "Table setup design",
      "Basic styling direction",
      "Complete item & spec summary",
    ],
  },
  // -- Execution Packages ------------------------------------------------
  {
    id:    "delivery_backdrop",
    group: "execution",
    name:  "Backdrop Design + Delivery",
    price: 450,
    includes: [
      "Final backdrop design",
      "Backdrop production specification",
      "Delivery & execution coordination",
      "Production-ready item list",
    ],
  },
  {
    id:    "delivery_full",
    group: "execution",
    name:  "Backdrop + Table Setup + Delivery",
    price: 750,
    includes: [
      "Final backdrop design",
      "Table setup design",
      "Backdrop production specification",
      "Table setup specification",
      "Delivery & execution coordination",
      "Production-ready item list",
    ],
  },
];

export function servicePackageById(id: ServicePackageId): ServicePackage | undefined {
  return SERVICE_PACKAGES.find((p) => p.id === id);
}

// =====================  STEP - PACKAGE (legacy, kept for order compat) ===

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
        { id: "medium", type: "arch", sizeId: "medium", widthCm: 100, heightCm: 200, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
      ],
      balloonStyle: "full",
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
        { id: "large", type: "arch", sizeId: "large", widthCm: 120, heightCm: 220, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
        { id: "small", type: "arch", sizeId: "small", widthCm: 80,  heightCm: 180, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
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
        { id: "large",  type: "arch", sizeId: "large",  widthCm: 120, heightCm: 220, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
        { id: "medium", type: "arch", sizeId: "medium", widthCm: 100, heightCm: 200, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
        { id: "small",  type: "arch", sizeId: "small",  widthCm: 80,  heightCm: 180, color: "", text: { enabled: false, value: "", fontStyle: "script" as const, color: "white" }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
      ],
      balloonStyle: "full",
      plinths: 3,
      plinthSizes: ["large", "medium", "medium"] as PlinthSize[],
      cutouts: { size: "medium", position: "floor" },
      backdropPrint: { type: "none" },
      backdropText: { enabled: true, type: "birthday", name: "", customText: "", fontStyle: "elegant", color: "gold", fontSize: 4, lineHeight: 140, verticalOffset: 30, horizontalOffset: 50, align: "center" },
      cakeTable: true,
    },
  },
];

// =====================  STEP - DECOR  ======================================

// "shimmer_wall" and "open_arch_frame" are no longer selectable in the
// product (see BACKDROP_SHAPES / setupLayoutCatalog.ts) but stay in this
// union so old saved BackdropItem data still type-checks and can be
// sanitized/remapped instead of crashing.
export type BackdropShapeId =
  | "arch"
  | "round"
  | "rect"
  | "shimmer_wall"
  | "open_arch_frame"
  | "wavy";

export type ArchSizeId = "small" | "medium" | "large";

export interface ArchSize {
  id:       ArchSizeId;
  label:    string;
  ftLabel:  string;
  widthCm:  number;
  heightCm: number;
}

export const ARCH_SIZES: ArchSize[] = [
  { id: "small",  label: "Small",             ftLabel: "2.6 x 5.9 ft", widthCm: 80,  heightCm: 180 },
  { id: "medium", label: "Medium / Standard", ftLabel: "3.3 x 6.6 ft", widthCm: 100, heightCm: 200 },
  { id: "large",  label: "Large",             ftLabel: "4.0 x 7.2 ft", widthCm: 120, heightCm: 220 },
];

export type RectSizeId = "rect_100x200" | "rect_80x180";

export interface RectSize {
  id: RectSizeId;
  label: string;
  widthCm: number;
  heightCm: number;
}

export const RECT_SIZES: RectSize[] = [
  { id: "rect_100x200", label: "100 - 200 cm", widthCm: 100, heightCm: 200 },
  { id: "rect_80x180",  label: "80 - 180 cm",  widthCm: 80,  heightCm: 180 },
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
  source?: "preset" | "custom";
  assetId?: string;
}

/**
 * Source of truth for a single backdrop panel - shape, exact dimensions,
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
    widthCm = 200; heightCm = 200;
  } else if (type === "shimmer_wall") {
    widthCm = 200; heightCm = 200;
  } else if (type === "open_arch_frame") {
    // Hollow open arch frame prop — arch-like footprint
    widthCm = 100; heightCm = 200;
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
export type CutoutSize = "none" | "small" | "medium" | "premium"; // legacy compatibility
export type CutoutPosition = "floor" | "backdrop";

export type CutoutMode = "none" | "standees";
export type CutoutStandeeSize = "large" | "medium" | "small";
export type CutoutSource = "preset" | "custom";

export interface CutoutStandeeItem {
  size: CutoutStandeeSize;
  label: string;
  heightCm: 150 | 100 | 60;
  quantity: number;
  unitPrice: number;
}

export interface CutoutAssetQuantities {
  large: number;
  medium: number;
  small: number;
}

/** One selected standee design with per-size quantities (multi-select model). */
export interface CutoutSelectedAsset {
  assetId: string;
  label: string;
  previewUrl?: string;
  quantities: CutoutAssetQuantities;
}

export interface CutoutSelection {
  /** Legacy set model. Keep temporarily for existing package defaults / old code paths. */
  size: CutoutSize;
  position: CutoutPosition;

  /** New quantity-based production model. */
  mode?: CutoutMode;
  source?: CutoutSource;
  /** Legacy single-asset selection — superseded by selectedAssets. */
  presetAssetId?: string;
  /** Legacy per-size totals — kept in sync from selectedAssets for pricing/guides. */
  items?: CutoutStandeeItem[];
  /** Multi-select model: several designs, each with its own size quantities. */
  selectedAssets?: CutoutSelectedAsset[];
}
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
  { id: "none", label: "Plain - No Print", price: 0, desc: "Solid color only" },
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
  /** 1-10 scale; maps to CSS font-size. Default 4. */
  fontSize: number;
  /** 100-250; divide by 100 for CSS line-height. Default 140. */
  lineHeight: number;
  /** 0-100; vertical position within the backdrop safe area. Default 30. */
  verticalOffset: number;
  /** 0-100; horizontal center of the text block within the safe area. Default 50. */
  horizontalOffset: number;
  align: TextAlign;
}

export interface CutoutSelection {
  size: CutoutSize;
  position: CutoutPosition;
}

/**
 * Extra balloon clusters from natural language edits.
 * Stored in scene state so production specs can reflect requested quantity and placement.
 * TODO: Add pricing rule for extra clusters if needed.
 */
export type BalloonClusterLocation =
  | "bottom_left"
  | "bottom_right"
  | "bottom_empty_side"
  | "left_side"
  | "right_side"
  | "top_cluster";

export type BalloonClusterType = "floor_cluster" | "side_cluster" | "top_cluster";

export interface ExtraBalloonCluster {
  id:              string;
  type:            BalloonClusterType;
  targetPanelId?:  string;
  location:        BalloonClusterLocation;
  count:           number;
  colors:          string[];
  sizeMix:         "organic";
  source:          "user_prompt";
}

export type ShimmerColorId = "gold" | "silver" | "black" | "pink" | "iridescent" | "blue" | "red";

export const SHIMMER_COLORS: Option<ShimmerColorId>[] = [
  { id: "gold",       label: "Gold",       price: 0 },
  { id: "silver",     label: "Silver",     price: 0 },
  { id: "black",      label: "Black",      price: 0 },
  { id: "pink",       label: "Pink",       price: 0 },
  { id: "iridescent", label: "Iridescent", price: 0 },
  { id: "blue",       label: "Blue",       price: 0 },
  { id: "red",        label: "Red",        price: 0 },
];

/** Approximate sequin-disc hex per shimmer color, used for the layout-reference guide tiles. */
export const SHIMMER_COLOR_HEX: Record<ShimmerColorId, string> = {
  gold:       "#D4AF6A",
  silver:     "#D8D8E4",
  black:      "#3A3A40",
  pink:       "#E8AFC4",
  iridescent: "#CFE0DC",
  blue:       "#7FA8D9",
  red:        "#C24B4B",
};

export interface DecorConfig {
  /** Source of truth for all backdrop panels - type, count, and arch sizes. */
  backdropItems: BackdropItem[];
  balloonStyle: BalloonStyleId;
  /** User-chosen backdrop color (hex) - defaults to the theme suggestion. */
  backdropColor: string;
  /** User-chosen balloon colors (hex, up to 5) - defaults to the theme palette. */
  balloonColors: string[];
  plinths: number;
  plinthSizes: PlinthSize[];
  cutouts: CutoutSelection;
  backdropPrint: BackdropPrint;
  backdropText: BackdropText;
  cakeTable: boolean;
  /** Selected shimmer wall color/material - only relevant when a shimmer_wall is in backdropItems. */
  shimmerColor?: ShimmerColorId;
  /**
   * Extra balloon clusters from natural language / customer edits.
   * Extra balloon clusters from natural language edits are stored in scene state
   * so production specs can reflect the requested quantity and placement.
   */
  extraBalloonClusters?: ExtraBalloonCluster[];
  /**
   * Selected Sempertex balloon colors (metadata, not just hex) - used to build an
   * exact-palette render instruction. Empty/undefined falls back to theme palette.
   */
  sempertexSelection?: SempertexSelection[];
}

export interface SempertexSelection {
  code: string;
  colorName: string;
  finish: string;
  family: string;
  hex: string;
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
  // "wavy" removed from product - not selectable. Kept in BackdropShapeId for backward compat.
  // "shimmer_wall" removed from product (2026-07-12) - shimmer pipeline too
  // unreliable, focus shifted to arch-based designs. Kept in BackdropShapeId
  // for backward compat with old saved configs.
];

/**
 * Balloons are sold as one garland or none (2026-09-03, product decision).
 * The old Half Garland / Premium Organic tiers were retired; "full" is the
 * surviving garland and keeps its id, price and behaviour so saved configs
 * and the render pipeline are unaffected. Legacy "half"/"premium" values in
 * stored configs are folded into it by normalizeBalloonStyle() below rather
 * than being dropped, which would have silently priced them at zero.
 */
export const BALLOON_STYLES: Option<BalloonStyleId>[] = [
  { id: "none", label: "None", price: 0 },
  { id: "full", label: "Balloon Garland", price: 250 },
];

/** Retired tier ids, folded into the surviving garland. */
export function normalizeBalloonStyle(id: string): BalloonStyleId {
  return id === "half" || id === "premium" ? "full" : (id as BalloonStyleId);
}

export const PLINTH_SIZES: Option<PlinthSize>[] = [
  // Real product sizes (2026-09-03): L 60cm x ⌀33, XL 75cm x ⌀36, XXL 90cm x ⌀40.
  // Ids stay small/medium/large so saved configs keep resolving; see
  // PLINTH_DIMS in layoutDimensions.ts for the matching cm figures.
  { id: "small",  label: "L - 60cm",   price: 60  },
  { id: "medium", label: "XL - 75cm",  price: 80  },
  { id: "large",  label: "XXL - 90cm", price: 110 },
];

/** Legacy cutout sets - kept only for backward compatibility. */
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

export const CUTOUT_STANDEE_OPTIONS: Omit<CutoutStandeeItem, "quantity">[] = [
  { size: "large", label: "Large standalone cutout", heightCm: 150, unitPrice: 180 },
  { size: "medium", label: "Medium standalone cutout", heightCm: 100, unitPrice: 120 },
  { size: "small", label: "Small standalone cutout", heightCm: 60, unitPrice: 70 },
];

export function emptyCutoutStandees(): CutoutStandeeItem[] {
  return CUTOUT_STANDEE_OPTIONS.map((o) => ({ ...o, quantity: 0 }));
}

export function emptyCutoutQuantities(): CutoutAssetQuantities {
  return { large: 0, medium: 0, small: 0 };
}

export function cutoutAssetTotal(asset: CutoutSelectedAsset): number {
  return Math.max(0, asset.quantities.large) + Math.max(0, asset.quantities.medium) + Math.max(0, asset.quantities.small);
}

export function normalizeCutouts(cutouts: CutoutSelection): CutoutSelection {
  // ── Multi-asset model ──────────────────────────────────────────────────
  let selectedAssets = cutouts.selectedAssets ?? [];

  // Back-compat: old single-asset configs (presetAssetId + items quantities)
  // map to one selected asset so saved configs keep working.
  const legacyItemTotal = cutouts.items?.reduce((s, i) => s + Math.max(0, i.quantity), 0) ?? 0;
  if (selectedAssets.length === 0 && cutouts.presetAssetId && legacyItemTotal > 0) {
    const q = (size: CutoutStandeeSize) =>
      Math.max(0, cutouts.items?.find((i) => i.size === size)?.quantity ?? 0);
    selectedAssets = [{
      assetId: cutouts.presetAssetId,
      label: cutouts.presetAssetId,
      quantities: { large: q("large"), medium: q("medium"), small: q("small") },
    }];
  }

  const assetTotal = selectedAssets.reduce((s, a) => s + cutoutAssetTotal(a), 0);

  // Legacy items stay in sync as flattened per-size totals — pricing, layout
  // guide counts, and older consumers all read from items.
  const itemsFromAssets: CutoutStandeeItem[] = CUTOUT_STANDEE_OPTIONS.map((o) => ({
    ...o,
    quantity: selectedAssets.reduce((s, a) => s + Math.max(0, a.quantities[o.size] ?? 0), 0),
  }));

  if (cutouts.mode === "standees" || assetTotal > 0) {
    return {
      ...cutouts,
      size: "none",
      mode: "standees",
      position: cutouts.position ?? "floor",
      source: cutouts.source ?? "preset",
      selectedAssets,
      items: selectedAssets.length > 0
        ? itemsFromAssets
        : (cutouts.items?.length ? cutouts.items : emptyCutoutStandees()),
    };
  }

  if (cutouts.size && cutouts.size !== "none") {
    const legacyItems =
      cutouts.size === "small"
        ? [
            { ...CUTOUT_STANDEE_OPTIONS[1], quantity: 1 },
            { ...CUTOUT_STANDEE_OPTIONS[2], quantity: 1 },
          ]
        : cutouts.size === "medium"
          ? [
              { ...CUTOUT_STANDEE_OPTIONS[0], quantity: 1 },
              { ...CUTOUT_STANDEE_OPTIONS[1], quantity: 2 },
              { ...CUTOUT_STANDEE_OPTIONS[2], quantity: 1 },
            ]
          : [
              { ...CUTOUT_STANDEE_OPTIONS[0], quantity: 2 },
              { ...CUTOUT_STANDEE_OPTIONS[1], quantity: 2 },
              { ...CUTOUT_STANDEE_OPTIONS[2], quantity: 2 },
            ];

    return {
      ...cutouts,
      mode: "standees",
      source: "preset",
      items: legacyItems,
    };
  }

  return {
    size: "none",
    mode: "none",
    position: cutouts.position ?? "floor",
    source: "preset",
    selectedAssets,
    items: emptyCutoutStandees(),
  };
}

export function cutoutTotalCount(cutouts: CutoutSelection): number {
  return normalizeCutouts(cutouts).items?.reduce((sum, item) => sum + Math.max(0, item.quantity), 0) ?? 0;
}

export function cutoutHasStandees(cutouts: CutoutSelection): boolean {
  return cutoutTotalCount(cutouts) > 0;
}

export function cutoutStandeePrice(cutouts: CutoutSelection): number {
  return normalizeCutouts(cutouts).items?.reduce(
    (sum, item) => sum + Math.max(0, item.quantity) * item.unitPrice,
    0,
  ) ?? 0;
}

export const CAKE_TABLE_PRICE = 300;

/** Price per backdrop panel. Each selected panel adds this to the total. */
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

// =====================  STEP - ADD-ONS  ====================================

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
    { value: "20_50", label: "20-50" },
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
      { key: "age", label: "Child age range", type: "choice", choices: [{ value: "3_5", label: "3-5" }, { value: "5_10", label: "5-10" }, { value: "mixed", label: "Mixed" }] },
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
    subOptions: [{ key: "children", label: "Number of children", type: "choice", choices: [{ value: "under_10", label: "Under 10" }, { value: "10_20", label: "10-20" }, { value: "20_plus", label: "20+" }] }],
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

export function cutoutPrice(input: CutoutSize | CutoutSelection): number {
  if (typeof input === "string") {
    return cutoutSetBySize(input)?.price ?? 0;
  }
  return cutoutStandeePrice(input);
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
  /** True once the user has manually picked a theme. Gates theme pricing/selected UI. */
  themeSelected: boolean;
  /** Legacy field - kept for order compatibility. Does not reset decor. */
  package: PackageId;
  /** User-selected service package - defines what they receive, not their design. */
  servicePackageId: ServicePackageId;
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
    themeSelected: false, // no theme selected by default - user must choose
    package: pkg.id,
    servicePackageId: "design_only",
    decor: {
      ...pkg.defaultDecor,
      backdropItems: [],        // no default backdrop - user chooses
      // Nothing is pre-added to the quote (2026-07-20): the package's
      // defaultDecor pre-selected a half garland + one plinth, so the
      // Estimated total opened at AED 480 for choices the user had not made
      // yet. Start at the service package price only and grow as they pick.
      balloonStyle: "none",
      plinths: 0,
      plinthSizes: [],
      backdropColor: DEFAULT_BACKDROP_COLOR,
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
  label:   string;
  amount:  number;
  /** Groups lines for display in the pricing breakdown. */
  section: "design" | "package" | "addons";
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

  // -- Service package ----------------------------------------------------
  // Defines what the customer receives - separate from the design items below.
  const svcPkg = servicePackageById(config.servicePackageId) ?? SERVICE_PACKAGES[0];
  lines.push({ label: svcPkg.name, amount: svcPkg.price, section: "package" });

  // -- Design / decor items ------------------------------------------------
  const theme = themeById(config.theme);
  if (config.themeSelected && theme && theme.priceModifier > 0) {
    lines.push({ label: `${theme.name} theme`, amount: theme.priceModifier, section: "design" });
  }

  // Backdrop panel pricing: each selected panel costs PER_BACKDROP.
  // Service packages no longer include a free backdrop - panels are priced individually.
  for (let i = 0; i < d.backdropItems.length; i++) {
    const item = d.backdropItems[i];
    const sInfo = shapeById(item.type);
    const sLabel = sInfo?.label ?? item.type;
    const shimmerExtra = item.type === "shimmer_wall" ? 80 : 0;
    const cost = PER_BACKDROP + shimmerExtra;
    lines.push({
      // sLabel already ends in "Backdrop" for most shapes — don't repeat it.
      label: d.backdropItems.length === 1 ? sLabel : `${sLabel} - panel ${i + 1}`,
      amount: cost,
      section: "design",
    });
  }

  const style = balloonStyleById(normalizeBalloonStyle(d.balloonStyle));
  if (style && style.price > 0) {
    lines.push({ label: `Balloons - ${style.label}`, amount: style.price, section: "design" });
  }

  const plinthSum = plinthsTotal(d.plinthSizes);
  if (plinthSum > 0) {
    lines.push({ label: `Plinths (${d.plinthSizes.length})`, amount: plinthSum, section: "design" });
  }

  // Pricing bug fixed 2026-07-20: this passed d.cutouts.size, which is always
  // "none" in the per-character standee model, so selected standees never
  // reached the quote. Price the whole selection instead — cutoutPrice()
  // handles both the legacy set sizes and the standee list.
  const normalizedCutouts = normalizeCutouts(d.cutouts);
  const cut = cutoutPrice(normalizedCutouts);
  if (cut > 0) {
    const standeeCount = cutoutTotalCount(normalizedCutouts);
    lines.push({
      label: normalizedCutouts.mode === "standees"
        ? `Character standees (${standeeCount})`
        : `${cutoutSetBySize(normalizedCutouts.size)?.label ?? "Character cutouts"}`,
      amount: cut,
      section: "design",
    });
  }

  const printOpt = backdropPrintById(d.backdropPrint?.type ?? "none");
  if (printOpt && printOpt.price > 0) {
    lines.push({ label: printOpt.label, amount: printOpt.price, section: "design" });
  }

  if (d.cakeTable) {
    lines.push({ label: "Cake / dessert table", amount: CAKE_TABLE_PRICE, section: "design" });
  }

  // -- Add-ons -------------------------------------------------------------
  // Available for all service packages - never cleared by package selection.
  for (const sel of config.addOns) {
    const addon = addOnById(sel.id);
    if (!addon) continue;
    lines.push({ label: addon.label, amount: addOnPrice(sel, config), section: "addons" });
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
