// ---------------------------------------------------------------------------
// Blushy Birthday Builder — single source of truth for all options + pricing.
// Shared by the client UI and the server-side API routes so they never drift.
// NEVER hardcode prices in components — derive everything from here.
// ---------------------------------------------------------------------------

// =====================  STEP 1 — EVENT TYPE  ================================

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

// =====================  STEP 2 — THEME  ====================================

export type ThemeId =
  | "blush_pink"
  | "fairy_garden"
  | "unicorn"
  | "baby_blue"
  | "safari"
  | "football"
  | "pastel_rainbow"
  | "luxury_neutral"
  | "space"
  | "princess";

export interface Theme {
  id: ThemeId;
  label: string;
  /** Price modifier added on top of the package base (AED). */
  modifier: number;
  description: string;
  /** 3–4 swatch palette shown on the card and used by the canvas. */
  palette: string[];
  /** Runtime --accent CSS variable (RGB triplet). */
  accent: string;
  /** Lighter --accent-soft for tinted backgrounds (RGB triplet). */
  accentSoft: string;
  /** Backdrop panel fill used by the Canvas preview. */
  backdropColor: string;
  /** Words injected into the fal.ai prompt. */
  promptColors: string;
}

export const THEMES: Theme[] = [
  {
    id: "blush_pink",
    label: "Blush Pink",
    modifier: 0,
    description: "Soft pinks, cream, white",
    palette: ["#F8C8DC", "#F6A5C0", "#FBE9E7", "#FFFFFF"],
    accent: "236 72 153",
    accentSoft: "252 231 243",
    backdropColor: "#F7E4EC",
    promptColors: "soft blush pink, cream and white",
  },
  {
    id: "fairy_garden",
    label: "Fairy Garden",
    modifier: 50,
    description: "Sage, dusty rose, butterfly accents",
    palette: ["#B7C9A8", "#E3B5C0", "#F2E2D2", "#FFFFFF"],
    accent: "124 148 104",
    accentSoft: "226 235 215",
    backdropColor: "#DDE6D2",
    promptColors: "sage green, dusty rose and butterflies",
  },
  {
    id: "unicorn",
    label: "Unicorn",
    modifier: 50,
    description: "Pastels, iridescent, rainbow",
    palette: ["#F6A5C0", "#C8A2F0", "#A5D8F8", "#FFF1A8"],
    accent: "168 85 247",
    accentSoft: "243 232 255",
    backdropColor: "#EFE3FB",
    promptColors: "iridescent pastel rainbow, lilac and pink",
  },
  {
    id: "baby_blue",
    label: "Baby Blue",
    modifier: 0,
    description: "Sky blue, white, silver",
    palette: ["#A5D8F8", "#C9E7FB", "#FFFFFF", "#D8DEE6"],
    accent: "59 130 246",
    accentSoft: "219 234 254",
    backdropColor: "#DDEBF7",
    promptColors: "sky blue, white and silver",
  },
  {
    id: "safari",
    label: "Safari",
    modifier: 30,
    description: "Earthy tones, animal print, jungle",
    palette: ["#C2A878", "#8A9A5B", "#E8DCC0", "#6B4F3A"],
    accent: "150 123 80",
    accentSoft: "235 226 205",
    backdropColor: "#E6DCC4",
    promptColors: "earthy safari tones, jungle greens and animal print",
  },
  {
    id: "football",
    label: "Football",
    modifier: 30,
    description: "Team colors, grass green, sporty",
    palette: ["#2E7D32", "#FFFFFF", "#111827", "#E53935"],
    accent: "46 125 50",
    accentSoft: "210 232 211",
    backdropColor: "#D7E8D8",
    promptColors: "grass green, white and bold team colors, sporty",
  },
  {
    id: "pastel_rainbow",
    label: "Pastel Rainbow",
    modifier: 40,
    description: "Full pastel spectrum",
    palette: ["#FBC4D2", "#FDE2A7", "#C9F0D2", "#BBD9F7", "#D6C3F0"],
    accent: "244 114 182",
    accentSoft: "252 231 243",
    backdropColor: "#F6E9F3",
    promptColors: "full pastel rainbow spectrum",
  },
  {
    id: "luxury_neutral",
    label: "Luxury Neutral",
    modifier: 80,
    description: "Beige, champagne, gold, ivory",
    palette: ["#E8DCC8", "#D9C2A0", "#C2A15A", "#FFFDF7"],
    accent: "176 141 87",
    accentSoft: "242 234 221",
    backdropColor: "#EDE4D4",
    promptColors: "beige, champagne, gold and ivory, understated luxury",
  },
  {
    id: "space",
    label: "Space",
    modifier: 60,
    description: "Deep navy, silver, planets, stars",
    palette: ["#1E2A55", "#3B4C8A", "#C0C6D6", "#0B1020"],
    accent: "79 110 197",
    accentSoft: "214 221 240",
    backdropColor: "#1E2A55",
    promptColors: "deep navy, silver, planets and stars",
  },
  {
    id: "princess",
    label: "Princess",
    modifier: 50,
    description: "Pink, gold crown, castle",
    palette: ["#F4A6C8", "#E8C77A", "#FFFFFF", "#F7DCE8"],
    accent: "219 88 154",
    accentSoft: "250 226 238",
    backdropColor: "#F7DCE8",
    promptColors: "princess pink, gold crowns and castle",
  },
];

// =====================  STEP 3 — PACKAGE  ==================================

export type PackageId = "mini" | "signature" | "luxury";

export interface DecorConfig {
  backdropCount: number;
  backdropShape: BackdropShapeId;
  balloonStyle: BalloonStyleId;
  balloonColorCustom: boolean;
  plinths: number;
  nameSign: NameSignId;
  cutouts: CutoutsId;
  cakeTable: boolean;
}

export interface Package {
  id: PackageId;
  label: string;
  base: number;
  popular?: boolean;
  includes: string[];
  bestFor: string;
  /** Decor defaults applied when this package is selected. */
  defaultDecor: DecorConfig;
}

export const PACKAGES: Package[] = [
  {
    id: "mini",
    label: "Mini Setup",
    base: 950,
    includes: ["1 backdrop", "Small balloon garland", "1 plinth"],
    bestFor: "Intimate home setups",
    defaultDecor: {
      backdropCount: 1,
      backdropShape: "round_arch",
      balloonStyle: "half",
      balloonColorCustom: false,
      plinths: 1,
      nameSign: "none",
      cutouts: "none",
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
      backdropCount: 2,
      backdropShape: "double_arch",
      balloonStyle: "full",
      balloonColorCustom: false,
      plinths: 2,
      nameSign: "printed",
      cutouts: "none",
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
      backdropCount: 3,
      backdropShape: "mixed_panels",
      balloonStyle: "premium",
      balloonColorCustom: false,
      plinths: 3,
      nameSign: "acrylic",
      cutouts: "medium",
      cakeTable: true,
    },
  },
];

// =====================  STEP 4 — DECOR  ====================================

export type BackdropShapeId =
  | "round_arch"
  | "straight_arch"
  | "wavy"
  | "double_arch"
  | "mixed_panels";

export type BalloonStyleId = "none" | "half" | "full" | "premium";
export type NameSignId = "none" | "printed" | "acrylic" | "neon";
export type CutoutsId = "none" | "small" | "medium" | "premium";

export interface Option<T extends string> {
  id: T;
  label: string;
  price: number;
}

export const BACKDROP_SHAPES: Option<BackdropShapeId>[] = [
  { id: "round_arch", label: "Round Arch", price: 0 },
  { id: "straight_arch", label: "Straight Arch", price: 0 },
  { id: "wavy", label: "Wavy", price: 0 },
  { id: "double_arch", label: "Double Arch", price: 0 },
  { id: "mixed_panels", label: "Mixed Panels", price: 0 },
];

export const BALLOON_STYLES: Option<BalloonStyleId>[] = [
  { id: "none", label: "None", price: 0 },
  { id: "half", label: "Half Garland", price: 150 },
  { id: "full", label: "Full Garland", price: 250 },
  { id: "premium", label: "Premium Organic", price: 420 },
];

export const NAME_SIGNS: Option<NameSignId>[] = [
  { id: "none", label: "None", price: 0 },
  { id: "printed", label: "Printed", price: 120 },
  { id: "acrylic", label: "Acrylic", price: 200 },
  { id: "neon", label: "Neon-style", price: 350 },
];

export const CUTOUTS: Option<CutoutsId>[] = [
  { id: "none", label: "None", price: 0 },
  { id: "small", label: "Small set", price: 150 },
  { id: "medium", label: "Medium set", price: 250 },
  { id: "premium", label: "Premium set", price: 420 },
];

/** Plinth count → price (index = count). */
export const PLINTH_PRICES = [0, 80, 150, 210];

export const CAKE_TABLE_PRICE = 300;

/**
 * Extra/fewer backdrops beyond the package default cost this each.
 * Package base already covers its default count, so the delta is
 * (selectedCount − packageDefaultCount) × this value.
 */
export const PER_BACKDROP = 350;

// =====================  STEP 5 — ADD-ONS  ==================================

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
  /** "choice" renders as a button group; "text"/"number" render as inputs. */
  type: "choice" | "text" | "number";
  choices?: { value: string; label: string }[];
}

export interface AddOn {
  id: AddOnId;
  label: string;
  description: string;
  basePrice: number;
  /** Display string e.g. "from AED 450" or "AED 220". */
  priceLabel: string;
  /** Price is basePrice × number of children (Return Gifts). */
  perChild?: boolean;
  subOptions?: SubOption[];
  /** Drives the "Recommended" badge. */
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
      {
        key: "placement",
        label: "Indoor or outdoor",
        type: "choice",
        choices: [
          { value: "indoor", label: "Indoor" },
          { value: "outdoor", label: "Outdoor" },
        ],
      },
      { key: "space", label: "Space available", type: "text" },
      {
        key: "age",
        label: "Child age range",
        type: "choice",
        choices: [
          { value: "3_5", label: "3–5" },
          { value: "5_10", label: "5–10" },
          { value: "mixed", label: "Mixed" },
        ],
      },
    ],
  },
  {
    id: "soft_play",
    label: "Soft Play",
    description: "Safe padded play zone for toddlers.",
    basePrice: 380,
    priceLabel: "from AED 380",
  },
  {
    id: "ball_pit",
    label: "Ball Pit",
    description: "Colourful ball pit for endless fun.",
    basePrice: 280,
    priceLabel: "from AED 280",
  },
  {
    id: "popcorn",
    label: "Popcorn Machine",
    description: "Fresh popcorn cart with serving.",
    basePrice: 220,
    priceLabel: "AED 220",
    subOptions: [GUEST_COUNT],
  },
  {
    id: "cotton_candy",
    label: "Cotton Candy Machine",
    description: "Spun-sugar treats on demand.",
    basePrice: 220,
    priceLabel: "AED 220",
    subOptions: [GUEST_COUNT],
  },
  {
    id: "face_painting",
    label: "Face Painting",
    description: "Professional artist, themed designs.",
    basePrice: 350,
    priceLabel: "AED 350",
    recommend: { themes: ["safari", "princess"] },
    subOptions: [
      {
        key: "children",
        label: "Number of children",
        type: "choice",
        choices: [
          { value: "under_10", label: "Under 10" },
          { value: "10_20", label: "10–20" },
          { value: "20_plus", label: "20+" },
        ],
      },
    ],
  },
  {
    id: "mascot",
    label: "Mascot / Entertainer",
    description: "Costumed character or host.",
    basePrice: 650,
    priceLabel: "from AED 650",
  },
  {
    id: "photographer",
    label: "Photographer",
    description: "Capture the day professionally.",
    basePrice: 750,
    priceLabel: "from AED 750",
    recommend: { packages: ["luxury"] },
    subOptions: [DURATION],
  },
  {
    id: "videographer",
    label: "Videographer",
    description: "Cinematic event film.",
    basePrice: 950,
    priceLabel: "from AED 950",
    recommend: { packages: ["luxury"] },
    subOptions: [DURATION],
  },
  {
    id: "cake",
    label: "Cake",
    description: "Custom themed celebration cake.",
    basePrice: 380,
    priceLabel: "from AED 380",
  },
  {
    id: "return_gifts",
    label: "Return Gifts",
    description: "Curated goodie bags per child.",
    basePrice: 15,
    priceLabel: "from AED 15 / child",
    perChild: true,
    subOptions: [{ key: "children", label: "Number of children", type: "number" }],
  },
  {
    id: "kids_tables",
    label: "Kids Tables & Chairs",
    description: "Styled seating for little guests.",
    basePrice: 280,
    priceLabel: "AED 280",
  },
];

// =====================  LOOKUPS  ===========================================

export const eventTypeById = (id: string) => EVENT_TYPES.find((e) => e.id === id);
export const themeById = (id: string) => THEMES.find((t) => t.id === id);
export const packageById = (id: string) => PACKAGES.find((p) => p.id === id);
export const shapeById = (id: string) => BACKDROP_SHAPES.find((s) => s.id === id);
export const balloonStyleById = (id: string) => BALLOON_STYLES.find((b) => b.id === id);
export const nameSignById = (id: string) => NAME_SIGNS.find((n) => n.id === id);
export const cutoutsById = (id: string) => CUTOUTS.find((c) => c.id === id);
export const addOnById = (id: string) => ADDONS.find((a) => a.id === id);

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
  /** Files held in component state only (no storage yet). */
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
  /** Derived; recomputed via computeTotal() — never set by hand. */
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
  const pkg = PACKAGES.find((p) => p.id === "signature")!;
  const cfg: BuilderConfig = {
    eventType: "birthday",
    theme: "blush_pink",
    package: pkg.id,
    decor: { ...pkg.defaultDecor },
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
 * Locale-stable thousands formatter. Using a fixed grouping (not
 * toLocaleString, whose default locale differs between the Node server and the
 * browser) avoids React hydration mismatches.
 */
export function formatAED(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Price contribution of a single selected add-on (handles per-child). */
export function addOnPrice(sel: SelectedAddOn, config: BuilderConfig): number {
  const addon = addOnById(sel.id);
  if (!addon) return 0;
  if (addon.perChild) {
    const fromOption = Number(sel.options?.children ?? "");
    const children = Number.isFinite(fromOption) && fromOption > 0
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

  const pkg = packageById(config.package) ?? PACKAGES[0];
  lines.push({ label: `${pkg.label} (base)`, amount: pkg.base });

  const theme = themeById(config.theme);
  if (theme && theme.modifier > 0) {
    lines.push({ label: `${theme.label} theme`, amount: theme.modifier });
  }

  // Backdrop count delta vs the package default.
  const countDelta = (config.decor.backdropCount - pkg.defaultDecor.backdropCount) * PER_BACKDROP;
  if (countDelta !== 0) {
    const n = config.decor.backdropCount;
    lines.push({ label: `Backdrops (${n})`, amount: countDelta });
  }

  const style = balloonStyleById(config.decor.balloonStyle);
  if (style && style.price > 0) {
    lines.push({ label: `Balloons — ${style.label}`, amount: style.price });
  }

  const plinthPrice = PLINTH_PRICES[config.decor.plinths] ?? 0;
  if (plinthPrice > 0) {
    lines.push({ label: `Plinths (${config.decor.plinths})`, amount: plinthPrice });
  }

  const sign = nameSignById(config.decor.nameSign);
  if (sign && sign.price > 0) {
    lines.push({ label: `Name sign — ${sign.label}`, amount: sign.price });
  }

  const cut = cutoutsById(config.decor.cutouts);
  if (cut && cut.price > 0) {
    lines.push({ label: `Cutouts — ${cut.label}`, amount: cut.price });
  }

  if (config.decor.cakeTable) {
    lines.push({ label: "Cake / dessert table", amount: CAKE_TABLE_PRICE });
  }

  for (const sel of config.addOns) {
    const addon = addOnById(sel.id);
    if (!addon) continue;
    const amount = addOnPrice(sel, config);
    lines.push({ label: addon.label, amount });
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return { lines, total };
}

export function computeTotal(config: BuilderConfig): number {
  return priceBreakdown(config).total;
}

/** Whether an add-on is recommended for the current theme/package. */
export function isAddOnRecommended(addon: AddOn, config: BuilderConfig): boolean {
  if (!addon.recommend) return false;
  if (addon.recommend.packages?.includes(config.package)) return true;
  if (addon.recommend.themes?.includes(config.theme)) return true;
  return false;
}
