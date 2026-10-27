// ---------------------------------------------------------------------------
// Blushy Birthday Builder - single source of truth for all options + pricing.
// Shared by the client UI and the server-side API routes so they never drift.
// NEVER hardcode prices in components - derive everything from here.
// ---------------------------------------------------------------------------
import { tablePriceLines, type TableSetup } from "./studio/tableSetup";

// =====================  STEP - EVENT TYPE  =================================

/** What a backdrop's lettering says and how it looks until the customer changes it. */
export const DEFAULT_TEXT_VALUE = "Happy Birthday";
export const DEFAULT_TEXT_COLOR: TextColor = "silver";

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
  | "luxury_neutral"
  | "minecraft"
  | "star_wars";

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

/**
 * 2026-09-08: three swatches per theme was too few — the customer asked for
 * about ten, "the ones people actually use", naming cream and light pink.
 * Rather than invent seven more hexes for each of the twenty-one themes, the
 * theme's own suggestions still come FIRST and are then topped up from this
 * shared list of standard event-backdrop colours. So the palette still leads
 * with the theme while every theme offers the same dependable staples.
 */
export const UNIVERSAL_BACKDROP_COLORS: string[] = [
  "#FFFFFF", // white
  "#F7F1E6", // cream
  "#F7D9E1", // light pink
  "#F2E4DC", // blush nude
  "#E9DCC9", // sand
  "#E4DAEE", // lilac
  "#D8E5F0", // dusty blue
  "#DCE5D8", // sage
  "#C7C1B9", // greige
  "#2F2F35", // charcoal
];

/** Up to ten swatches for a theme: its own suggestions first, then the staples. */
export function backdropSwatchesForTheme(theme: Pick<Theme, "backdropColors">): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const hex of [...theme.backdropColors, ...UNIVERSAL_BACKDROP_COLORS]) {
    const key = hex.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hex);
    if (out.length >= 10) break;
  }
  return out;
}

export const THEMES: Theme[] = [
  { id: "frozen", name: "Frozen", emoji: "--", desc: "Icy satin, silver frost", backdropColors: ["#E8F4FD", "#B3D9F2", "#FFFFFF"], balloonColors: ["#FFFFFF", "#BAE6FD", "#DCD7F2", "#C7C9C7", "#F0F4F8"], priceModifier: 50, accent: "#4A90D9" },
  { id: "unicorn", name: "Unicorn", emoji: "-", desc: "Pearlescent pastels, soft iridescence", backdropColors: ["#F9D5DF", "#E8C8F0", "#FFFFFF"], balloonColors: ["#F8BBD0", "#DDD6FE", "#FEF08A", "#BBF7D0", "#FFFFFF"], priceModifier: 50, accent: "#C77DD6" },
  { id: "dinosaur", name: "Dinosaur", emoji: "-", desc: "Sage botanicals, muted terracotta", backdropColors: ["#E8F5E9", "#C8DFC8", "#F5F0E8"], balloonColors: ["#15803D", "#84CC16", "#C9A96E", "#D4A017", "#F5EDD6"], priceModifier: 30, accent: "#4CAF82" },
  { id: "safari", name: "Safari", emoji: "-", desc: "Warm linen, sun-washed neutrals", backdropColors: ["#FFF8E1", "#FFE0B2", "#F5F0E8"], balloonColors: ["#C9A96E", "#F5EDD6", "#FFC200", "#7B3F00", "#6EE7B7"], priceModifier: 30, accent: "#B5762A" },
  { id: "princess", name: "Princess", emoji: "-", desc: "Blush satin, pearl & soft gold", backdropColors: ["#FCE4EC", "#FFF9C4", "#FFFFFF"], balloonColors: ["#F8BBD0", "#FBCFE8", "#FFFFFF", "#FDE68A", "#E9D5FF"], priceModifier: 50, accent: "#E84F8B" },
  { id: "superhero", name: "Superhero", emoji: "-", desc: "Bold editorial color, graphic energy", backdropColors: ["#E3F2FD", "#FFEBEE", "#F3E5F5"], balloonColors: ["#EF4444", "#2563EB", "#FFD700", "#1F2937", "#C7C9C7"], priceModifier: 40, accent: "#1565C0" },
  { id: "barbie", name: "Barbie", emoji: "-", desc: "Glam pink, glossy studio shine", backdropColors: ["#FF69B4", "#FFB6C1", "#FFFFFF"], balloonColors: ["#FF1DCE", "#F9A8D4", "#F8BBD0", "#FFFFFF", "#D8899B"], priceModifier: 60, accent: "#FF1493" },
  { id: "bluey", name: "Bluey", emoji: "-", desc: "Soft blues, warm honey accents", backdropColors: ["#E3F2FD", "#BBDEFB", "#FFFFFF"], balloonColors: ["#3B82F6", "#7DD3FC", "#BFDBFE", "#FFC200", "#F5EDD6"], priceModifier: 40, accent: "#2E86DE" },
  { id: "pokemon", name: "Pokemon", emoji: "-", desc: "Sunny gold, crimson accents", backdropColors: ["#FFFDE7", "#FFF9C4", "#FFFFFF"], balloonColors: ["#FFD700", "#EF4444", "#FFFFFF", "#1F2937", "#FFC200"], priceModifier: 50, accent: "#E0382B" },
  { id: "stitch", name: "Stitch", emoji: "-", desc: "Ocean blues, tropical calm", backdropColors: ["#E3F2FD", "#B3E5FC", "#E8F5E9"], balloonColors: ["#3B82F6", "#0EA5E9", "#7DD3FC", "#1E3A8A", "#F8BBD0"], priceModifier: 40, accent: "#2196D6" },
  { id: "mermaid", name: "Mermaid", emoji: "----", desc: "Teal pearl, underwater light", backdropColors: ["#E0F7FA", "#B2EBF2", "#F3E5F5"], balloonColors: ["#00CED1", "#0F766E", "#A7F3D0", "#C084FC", "#FFFFFF"], priceModifier: 50, accent: "#1FB6C4" },
  { id: "space", name: "Space", emoji: "-", desc: "Deep navy, starlit metallics", backdropColors: ["#1A237E", "#283593", "#311B92"], balloonColors: ["#1E3A8A", "#7C3AED", "#1F2937", "#C7C9C7", "#FDE68A"], priceModifier: 60, accent: "#3949AB" },
  { id: "football", name: "Football", emoji: "-", desc: "Fresh pitch green, crisp white", backdropColors: ["#E8F5E9", "#FFFFFF", "#F5F5F5"], balloonColors: ["#22C55E", "#16A34A", "#FFFFFF", "#1F2937", "#FDE68A"], priceModifier: 30, accent: "#2E9E4F" },
  { id: "lego", name: "Lego", emoji: "-", desc: "Primary color blocks, clean geometry", backdropColors: ["#FFFFFF", "#EF5350", "#1565C0"], balloonColors: ["#EF4444", "#FFD700", "#2563EB", "#22C55E", "#FF8C00"], priceModifier: 40, accent: "#1565C0" },
  { id: "kpop", name: "K-Pop", emoji: "-", desc: "Neon stage glow, chrome sparkle", backdropColors: ["#F3E5F5", "#E8EAF6", "#FCE4EC"], balloonColors: ["#A21CAF", "#A855F7", "#FF10F0", "#1F2937", "#C7C9C7"], priceModifier: 70, accent: "#B14FD8" },
  { id: "encanto", name: "Encanto", emoji: "-", desc: "Vibrant blooms, golden warmth", backdropColors: ["#FFF8E1", "#FCE4EC", "#E8F5E9"], balloonColors: ["#A21CAF", "#FF1DCE", "#FFC200", "#00CED1", "#15803D"], priceModifier: 50, accent: "#E0561E" },
  { id: "cocomelon", name: "Cocomelon", emoji: "-", desc: "Fresh melon tones, soft greens", backdropColors: ["#E8F5E9", "#E3F2FD", "#FFFFFF"], balloonColors: ["#22C55E", "#84CC16", "#FF6B6B", "#FEF08A", "#FFFFFF"], priceModifier: 30, accent: "#3AA655" },
  { id: "teddy_bear", name: "Teddy Bear", emoji: "-", desc: "Cream boucle, cocoa warmth", backdropColors: ["#F5EDE0", "#F2C4CE", "#EDE0D4"], balloonColors: ["#C9A96E", "#6F4E37", "#F5EDD6", "#FFF8E7", "#FFD1A4"], priceModifier: 30, accent: "#C08552" },
  { id: "pineapple_tropical", name: "Tropical", emoji: "-", desc: "Golden light, palm greens", backdropColors: ["#FFF9C4", "#FCE4EC", "#FFFFFF"], balloonColors: ["#FFC200", "#22C55E", "#FF6B6B", "#00CED1", "#FFFFFF"], priceModifier: 40, accent: "#E0561E" },
  { id: "blush_garden", name: "Blush Garden", emoji: "-", desc: "Blush florals, romantic softness", backdropColors: ["#FCE4EC", "#F8BBD0", "#FFFFFF"], balloonColors: ["#F8BBD0", "#FDA4AF", "#FBCFE8", "#FFFFFF", "#F5E6C8"], priceModifier: 0, accent: "#E5739A" },
  // 2026-10-23: added for the Boys list. Balloon colours are the Sempertex
  // shades named in themeCatalog (sempertexPaletteIds), in the same order.
  { id: "minecraft", name: "Minecraft", emoji: "-", desc: "Pixel greens, earthy blocks", backdropColors: ["#FFFFFF", "#E8F5E9", "#DCE5D8"], balloonColors: ["#22C55E", "#15803D", "#84CC16", "#6F4E37", "#1F2937"], priceModifier: 40, accent: "#2E9E4F" },
  { id: "star_wars", name: "Star Wars", emoji: "-", desc: "Galactic black, chrome, saber glow", backdropColors: ["#FFFFFF", "#1F2937", "#D1D5DB"], balloonColors: ["#1F2937", "#C7C9C7", "#FFFFFF", "#EF4444", "#3B82F6"], priceModifier: 40, accent: "#2563EB" },
  { id: "luxury_neutral", name: "Luxury Neutral", emoji: "-", desc: "Champagne satin, gold foil", backdropColors: ["#F5F0E8", "#EDE0D0", "#FFFFFF"], balloonColors: ["#F5E6C8", "#FEF3C7", "#F5EDD6", "#FDE68A", "#C9A96E"], priceModifier: 80, accent: "#B08D57" },
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
        { id: "medium", type: "arch", sizeId: "medium", widthCm: 100, heightCm: 200, color: "", text: { enabled: false, value: DEFAULT_TEXT_VALUE, fontStyle: "script" as const, color: DEFAULT_TEXT_COLOR }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
      ],
      balloonStyle: "full",
      plinths: 1,
      // 2026-09-09: one plinth is the XXL (see the PLINTH_LADDER in the
      // configure page — 1 = XXL, 2 = XXL+XL, 3 = XXL+XL+L).
      plinthSizes: ["large"],
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
        { id: "large", type: "arch", sizeId: "large", widthCm: 120, heightCm: 220, color: "", text: { enabled: false, value: DEFAULT_TEXT_VALUE, fontStyle: "script" as const, color: DEFAULT_TEXT_COLOR }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
        { id: "small", type: "arch", sizeId: "small", widthCm: 80,  heightCm: 180, color: "", text: { enabled: false, value: DEFAULT_TEXT_VALUE, fontStyle: "script" as const, color: DEFAULT_TEXT_COLOR }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
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
        { id: "large",  type: "arch", sizeId: "large",  widthCm: 120, heightCm: 220, color: "", text: { enabled: false, value: DEFAULT_TEXT_VALUE, fontStyle: "script" as const, color: DEFAULT_TEXT_COLOR }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
        { id: "medium", type: "arch", sizeId: "medium", widthCm: 100, heightCm: 200, color: "", text: { enabled: false, value: DEFAULT_TEXT_VALUE, fontStyle: "script" as const, color: DEFAULT_TEXT_COLOR }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
        { id: "small",  type: "arch", sizeId: "small",  widthCm: 80,  heightCm: 180, color: "", text: { enabled: false, value: DEFAULT_TEXT_VALUE, fontStyle: "script" as const, color: DEFAULT_TEXT_COLOR }, graphic: { enabled: false, theme: "", style: "illustrated" as const } },
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
export type BalloonRingStyleId = "full" | "half" | "none";

export const BALLOON_RING_STYLES: { id: BalloonRingStyleId; label: string; desc: string }[] = [
  { id: "full", label: "Fully wrapped", desc: "Balloons all the way round the hoop" },
  { id: "half", label: "Half wrapped",  desc: "Bare gold metal hoop, balloons on one side" },
  // 2026-09-09: the hoop on its own, no balloons at all.
  { id: "none", label: "No balloons",   desc: "Bare gold metal hoop only" },
];

export type BackdropShapeId =
  | "arch"
  | "half_arch"
  | "round"
  | "rect"
  | "banner"
  | "balloon_ring"
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
  // 2026-09-10: 100 -> 120 wide, at the customer's request ("backdrop genislik
  // 120cm yapalim") — the reference arch is proportionally wider than 100x220.
  { id: "large",  label: "Large",             ftLabel: "3.9 x 7.2 ft", widthCm: 120, heightCm: 220 },
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
  /** 2026-10-24: how big the lettering is on its board ("textin buyuklugu
   *  kucuklugu degissin"). Undefined is medium, the size it always had. */
  size?: TextSize;
  /**
   * 2026-10-26: the Typography System — a Heading over a Name, each in its own
   * font and size (lib/typography). When present, the lettering is drawn from
   * this; `value`, `fontStyle` and `size` are kept in step with it for
   * everything that still reads them. Designs saved before it have none and
   * are drawn exactly as before.
   */
  lettering?: BoardLettering;
}

/** One line of board lettering in the Typography System. */
export interface LetteringLine {
  text: string;
  /** lib/typography/registry.ts font id. */
  fontId: string;
  weight: number;
  size: TextSize;
}

export interface BoardLettering {
  /** The preset whose two fonts are in use, or null once either font is changed. */
  presetId: string | null;
  /** The preset the customer started from ("Back to …"). */
  basedOn: string;
  heading: LetteringLine;
  name: LetteringLine;
}

export type TextSize = "small" | "medium" | "large";
// 2026-10-24 (later): "suan ki small large olmali, medium ve small daha da
// kucuk olmali" — the first Small is now Large, and the other two step down.
// A scale of the size the lettering is fitted to across its board's clear
// width. With "Happy Birthday" kept on one line (messageLines) the fitted size
// is already about the first Small, so Large is the fit itself.
export const TEXT_SIZES: { id: TextSize; label: string; scale: number }[] = [
  { id: "small",  label: "Small",  scale: 0.64 },
  { id: "medium", label: "Medium", scale: 0.8 },
  { id: "large",  label: "Large",  scale: 1 },
];

/**
 * How a message breaks into lines: "Happy Birthday" always stays together on
 * the first line, with the rest (the name) on the line below — "herzaman
 * happy birthday yanyana isim altta olmali". Other messages: null (callers
 * wrap them their own way).
 */
export function messageLines(text: string): string[] | null {
  const m = text.trim().match(/^(happy\s+birthday)[\s,!.]*(.*)$/i);
  if (!m) return null;
  return m[2].trim() ? [m[1].replace(/\s+/g, " "), m[2].trim()] : [m[1].replace(/\s+/g, " ")];
}
export const textSizeScale = (s?: TextSize) => TEXT_SIZES.find((t) => t.id === (s ?? "medium"))?.scale ?? 0.8;

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
  enabled: false, value: DEFAULT_TEXT_VALUE, fontStyle: "script", color: DEFAULT_TEXT_COLOR,
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
  } else if (type === "balloon_ring") {
    // A freestanding 2m balloon ring — a hoop of balloons with an open centre.
    widthCm = 200; heightCm = 200;
  } else if (type === "banner") {
    // 2m x 2m printed banner backdrop. Square, so it lands in a square render
    // frame the same way the round backdrop does.
    widthCm = 200; heightCm = 200;
  } else if (type === "round") {
    widthCm = 200; heightCm = 200;
  } else if (type === "shimmer_wall") {
    widthCm = 200; heightCm = 200;
  } else if (type === "open_arch_frame") {
    // Hollow open arch frame prop — arch-like footprint
    widthCm = 100; heightCm = 200;
  } else if (type === "half_arch") {
    // 2026-09-09: the side pieces of the Triple Arch — an arch sliced down the
    // middle, curve facing outward, standing shoulder to shoulder with the
    // centre board. Shorter and narrower than the centre arch, as in the
    // customer reference.
    // 2026-09-09: the customer set these — side boards 180cm tall against a
    // 200cm centre board. (An earlier 150cm was my own guess at making the
    // stepped silhouette read; the real product dimension is 180.)
    widthCm = 90; heightCm = 180;
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
/**
 * Lettering colour. Either one of the four preset ids below, or any CSS hex
 * the customer picks for themselves ("#7B2D8E"). Widened from the fixed union
 * on 2026-09-03 at customer request — the four presets were too limiting.
 * Always read through resolveTextColorHex/describeTextColor rather than
 * comparing against the preset ids, so a custom hex is never silently dropped.
 */
export type TextColor = string;

export const TEXT_COLOR_PRESET_HEX: Record<string, string> = {
  white: "#FFFFFF", gold: "#D4AF37", black: "#1E1E1E",
  // 2026-10-20: silver lettering, and the default — customer request
  // ("Silver yazili olsun"). Mid-tone so it shows on a white board.
  silver: "#A7ABB1",
  // 2026-10-22: mirror rose-gold acrylic, for the themes whose lettering is
  // rose gold (see THEME_TEXT_COLOR).
  rose_gold: "#C9907E",
};

/**
 * 2026-10-22: the lettering colour follows the theme ("yazinin rengi theme e
 * gore degismeli"). Every one is a mirror-polished metal, like the customer's
 * reference lettering; Frozen's is silver.
 */
export const THEME_TEXT_COLOR: Record<string, TextColor> = {
  frozen: "silver", unicorn: "rose_gold", dinosaur: "gold", safari: "gold",
  princess: "rose_gold", superhero: "silver", barbie: "rose_gold", bluey: "silver",
  pokemon: "gold", stitch: "silver", mermaid: "rose_gold", space: "silver",
  football: "gold", lego: "gold", kpop: "silver", encanto: "gold", cocomelon: "gold",
  minecraft: "gold", star_wars: "silver",
};
export function themeTextColor(themeId: string | undefined): TextColor {
  return (themeId && THEME_TEXT_COLOR[themeId]) || DEFAULT_TEXT_COLOR;
}


/** Default stand-in for the "accent" preset when no theme accent is supplied. */
export const DEFAULT_TEXT_ACCENT_HEX = "#E39BB4";

/** Resolve a stored text colour to a concrete hex. */
export function resolveTextColorHex(color: TextColor | undefined, accentHex?: string): string {
  if (!color) return TEXT_COLOR_PRESET_HEX.white;
  if (color === "accent") return accentHex || DEFAULT_TEXT_ACCENT_HEX;
  if (TEXT_COLOR_PRESET_HEX[color]) return TEXT_COLOR_PRESET_HEX[color];
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : TEXT_COLOR_PRESET_HEX.white;
}

/** Is this a colour the customer picked themselves, rather than a preset? */
export function isCustomTextColor(color: TextColor | undefined): boolean {
  return !!color && color !== "accent" && !TEXT_COLOR_PRESET_HEX[color];
}

// Named anchors for describing an arbitrary hex to the render model in words.
// The model is told the colour by name, not by hex — hex in a prompt is
// unreliable, a plain colour name is not.
const TEXT_COLOR_NAMES: { name: string; hex: string }[] = [
  { name: "deep black",        hex: "#1E1E1E" },
  { name: "charcoal gray",     hex: "#555555" },
  { name: "clean white",       hex: "#FFFFFF" },
  { name: "silver gray",       hex: "#C0C0C0" },
  { name: "metallic gold",     hex: "#D4AF37" },
  { name: "warm cream",        hex: "#F5E6C8" },
  { name: "rose gold",         hex: "#E0A899" },
  { name: "soft blush pink",   hex: "#E39BB4" },
  { name: "hot pink",          hex: "#E5197F" },
  { name: "deep red",          hex: "#C1121F" },
  { name: "burnt orange",      hex: "#E07A28" },
  { name: "sunny yellow",      hex: "#F2C64B" },
  { name: "fresh green",       hex: "#3FA34D" },
  { name: "deep emerald",      hex: "#0B6E4F" },
  { name: "sky blue",          hex: "#7FC4E8" },
  { name: "royal blue",        hex: "#1D4ED8" },
  { name: "navy blue",         hex: "#12224A" },
  { name: "soft lilac",        hex: "#C9AEE4" },
  { name: "deep purple",       hex: "#5B2A86" },
  { name: "chocolate brown",   hex: "#5C4033" },
];

/** Plain-English name for a text colour, for use in a render prompt. */
export function describeTextColor(color: TextColor | undefined, accentHex?: string): string {
  // Silver is a finish, not just a grey: named as metal so it is not painted
  // as flat grey ink.
  if (color === "silver") return "mirror-polished silver";
  if (color === "gold") return "mirror-polished gold";
  if (color === "rose_gold") return "mirror-polished rose gold";
  const hex = resolveTextColorHex(color, accentHex);
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  let best = TEXT_COLOR_NAMES[0], bestD = Infinity;
  for (const c of TEXT_COLOR_NAMES) {
    const cr = parseInt(c.hex.slice(1, 3), 16), cg = parseInt(c.hex.slice(3, 5), 16), cb = parseInt(c.hex.slice(5, 7), 16);
    // Weighted RGB distance — closer to how the eye ranks colour difference
    // than a plain euclidean one, and enough to pick the right name.
    const d = 2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 3 * (b - cb) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best.name;
}
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
  /**
   * Fresh florals and greenery tucked into the balloon garland — eucalyptus,
   * dried grasses and a few soft blooms in the theme colours. Applies to every
   * setup; only meaningful when a garland is selected.
   */
  garlandFlorals?: boolean;
  /**
   * 2026-09-09: how the Balloon Ring is dressed.
   * "full"  — balloons all the way round, the metal frame hidden (the original).
   * "half"  — a bare gold metal hoop with the garland covering roughly half of
   *           it, the style in the customer's own Instagram reference.
   */
  balloonRingStyle?: BalloonRingStyleId;
  /** Illuminated marquee number standing on the floor beside the backdrop. */
  numberLight?: NumberLight;
  /**
   * Neon LED sign mounted on the backdrop — or in the open centre of a balloon
   * ring, which is the setup it was asked for.
   */
  neonSign?: NeonSign;
  /**
   * 2026-10-27 (0.5c): the last render, kept in the customer's account
   * (Storage path renders/<user id>/<key>.jpg) — shown again while the
   * design's render key (lib/renderKey.ts) still equals `key`. Not part of
   * the scene, so it never changes what a render is made of.
   */
  savedRender?: { path: string; key: string };
}

export interface NeonSign {
  enabled: boolean;
  /** The words the sign spells. Short free text, capped before it reaches a prompt. */
  text: string;
  /**
   * Which backdrop panel carries the sign, by index into backdropItems. Only
   * meaningful on a two-piece setup; undefined means the first panel.
   */
  panelIndex?: number;
}

export const DEFAULT_NEON_SIGN: NeonSign = { enabled: false, text: "Happy Birthday" };

/** Ready-made neon phrases; the customer can also type their own. */
export const NEON_SIGN_PRESETS: string[] = [
  "Happy Birthday",
  "Oh Baby",
  "Let's Party",
  "Bride To Be",
  "Congrats",
];

/** Neon LED sign — one made-to-order unit.
 *  2026-10-25: placeholder price, to be set by the customer ("simdilik bir
 *  fiyat yaz sonra degistiririz"). Every item now shows a price. */
export const NEON_SIGN_PRICE = 250;

export interface NumberLight {
  enabled: boolean;
  /** What the light-up number reads, e.g. "1" or "10". Digits only, 1-2 of them. */
  value: string;
  /** 2026-10-24: a light-up marquee number (the default), or a foil number
   *  balloon on a small balloon bunch in the theme's colours. */
  style?: NumberStyle;
  /** 2026-10-25: the foil number's colour, chosen by the customer. Unset is
   *  the theme's own (foilNumberColour of the balloon palette). */
  foilColor?: string;
}

/** Foil number colours on offer (besides the theme's own). */
export const FOIL_NUMBER_COLOURS: { hex: string; label: string }[] = [
  { hex: "#C7C9C7", label: "silver" },
  { hex: "#D4AF37", label: "gold" },
  { hex: "#C9907E", label: "rose gold" },
  { hex: "#3B82F6", label: "blue" },
  { hex: "#93C5FD", label: "pale blue" },
  { hex: "#F472B6", label: "pink" },
  { hex: "#A78BFA", label: "lilac" },
  { hex: "#34D399", label: "mint green" },
];

/** The foil number's colour for a design: the customer's pick, else the theme's. */
export function foilColourFor(n: NumberLight | undefined, palette: string[]): string {
  return n?.foilColor || foilNumberColour(palette);
}

export type NumberStyle = "marquee" | "foil";

export const DEFAULT_NUMBER_LIGHT: NumberLight = { enabled: false, value: "1" };

/** Marquee number stand — one 100cm illuminated digit unit (placeholder price, 2026-10-25). */
export const NUMBER_LIGHT_PRICE = 200;
/** Foil number balloon bunch — an 80cm foil number on a balloon cluster.
 *  AED 150, the customer's price (2026-10-25). */
export const FOIL_NUMBER_BUNCH_PRICE = 150;

/** The foil number's colour: the palette's most colourful balloon (Frozen:
 *  icy blue), or silver when the palette has no colour in it. */
export function foilNumberColour(palette: string[]): string {
  let best = "#C7C9C7", bestScore = 0.08;
  for (const hex of palette) {
    const h = hex.replace("#", "");
    if (h.length < 6) continue;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const score = mx ? (mx - mn) / mx : 0;
    if (score > bestScore) { best = hex; bestScore = score; }
  }
  return best;
}
/** Florals and greenery worked through the garland (placeholder price, 2026-10-25). */
export const GARLAND_FLORALS_PRICE = 120;

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
  // 2026-09-05: 2m x 2m printed banner. Price left at 0 alongside the other
  // shapes — no price was given for it, so it is not being invented here.
  { id: "banner",       label: "Banner Backdrop 2x2m", price: 0 },
  // 2026-09-05: brought back so the Arch + Open Frame setup can be offered. The
  // guide and prompt branches for it were never removed, only the way in.
  { id: "open_arch_frame", label: "Open Arch Frame",   price: 0 },
  // 2026-09-09: half arch side panel, for the Triple Arch setup.
  { id: "half_arch",    label: "Half Arch Panel",      price: 0 },
  // 2026-09-05: shimmer wall is offered again, and a hollow balloon ring is new.
  { id: "shimmer_wall", label: "Shimmer Wall",         price: 0 },
  { id: "balloon_ring", label: "Balloon Ring",         price: 0 },
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
  { id: "silver", label: "Silver", swatch: "#A7ABB1" },
  { id: "gold", label: "Gold", swatch: "#D4AF37" },
  { id: "rose_gold", label: "Rose Gold", swatch: "#C9907E" },
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
  /** 2026-10-27 (F2): the kids' table, designed after the backdrop; absent until visited. */
  table?: TableSetup;
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
      // 2026-07-20 had this open on nothing at all: the package's defaultDecor
      // pre-selected a half garland + one plinth, so the Estimated total opened
      // at AED 480 for choices the user had not made yet.
      // 2026-09-08: the customer wants the two things every setup actually has
      // pre-selected — a balloon garland and one cake plinth — so no setup ever
      // opens in the "no balloons" state.
      // 2026-09-09: that one plinth is the XXL, per the ladder (1 = XXL,
      // 2 = XXL+XL, 3 = XXL+XL+L). This is the default the app actually reads —
      // an earlier edit changed a package preset by the same name instead, and
      // the configure page still opened on XL.
      balloonStyle: "full",
      plinths: 1,
      plinthSizes: ["large"],
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
  section: "design" | "table" | "package" | "addons";
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

  // 2026-10-25: lettering and theme graphics are chosen per board on the
  // Style tab, which shows "+AED 80" / "+AED 150" — but only the old
  // whole-backdrop print reached the total, so those were never charged.
  // They are priced per board now; the old print line stays for designs that
  // still carry it and have no per-board choice.
  const printable = (it: BackdropItem) => !["shimmer_wall", "balloon_ring", "open_arch_frame"].includes(it.type);
  const textPrice = backdropPrintById("name_only")?.price ?? 0;
  const graphicPrice = backdropPrintById("theme_print")?.price ?? 0;
  const lettered = d.backdropItems.filter((it) => printable(it) && it.text?.enabled && (it.text.value ?? "").trim());
  const graphics = d.backdropItems.filter((it) => printable(it) && it.graphic?.enabled);
  if (lettered.length > 0) lines.push({ label: lettered.length > 1 ? `Lettering (${lettered.length} boards)` : "Lettering", amount: textPrice * lettered.length, section: "design" });
  if (graphics.length > 0) lines.push({ label: graphics.length > 1 ? `Theme graphic (${graphics.length} boards)` : "Theme graphic", amount: graphicPrice * graphics.length, section: "design" });
  const printOpt = backdropPrintById(d.backdropPrint?.type ?? "none");
  if (printOpt && printOpt.price > 0 && lettered.length === 0 && graphics.length === 0) {
    lines.push({ label: printOpt.label, amount: printOpt.price, section: "design" });
  }

  // 2026-10-25: the Extras, which were shown without a price and not charged.
  if (d.garlandFlorals && normalizeBalloonStyle(d.balloonStyle) !== "none") {
    lines.push({ label: "Florals & greenery", amount: GARLAND_FLORALS_PRICE, section: "design" });
  }
  if (d.neonSign?.enabled && (d.neonSign.text ?? "").trim()) {
    lines.push({ label: "Neon LED sign", amount: NEON_SIGN_PRICE, section: "design" });
  }
  if (d.numberLight?.enabled && (d.numberLight.value ?? "").replace(/[^0-9]/g, "")) {
    const foil = d.numberLight.style === "foil";
    lines.push({ label: foil ? "Foil number balloon bunch" : "Light-up marquee number", amount: foil ? FOIL_NUMBER_BUNCH_PRICE : NUMBER_LIGHT_PRICE, section: "design" });
  }

  if (d.cakeTable) {
    lines.push({ label: "Cake / dessert table", amount: CAKE_TABLE_PRICE, section: "design" });
  }

  // -- The kids' table (2026-10-27, F2) ---------------------------------------
  if (config.table) for (const l of tablePriceLines(config.table)) lines.push({ ...l, section: "table" });

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
