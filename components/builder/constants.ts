// Builder constants: step copy, tab copy, theme lists, limits and display
// tokens, moved unchanged from app/builder/page.tsx (Phase 0.1a).
import { getThemeCatalogEntry } from "@/lib/themeCatalog";

// Controlled render limit: at most 2 backdrop pieces per setup.
// 2026-09-09: 2 -> 3 for the Triple Arch layout. calculateExactLayout has
// always handled three panels; only the UI capped it.
export const MAX_BACKDROP_ITEMS = 3;

// Elegant serif for display headings — Cormorant Garamond per the Claude Design
// handoff, with system serif fallbacks.
// 2026-10-22 redesign: headings use the handwritten Kalam face (app/layout.tsx).
export const SERIF = `var(--bz-hand), 'Kalam', 'Segoe Print', cursive`;

// ── Claude Design handoff tokens ─────────────────────────────────────────
// 2026-10-22: re-pointed at the "Sparkly party" palette (app/blushy.css),
// so every existing inline-styled control picks up the new look unchanged.
export const DC = {
  pageBg:    "#FFFFFF",
  cardBd:    "#F5E4E9",
  innerBg:   "#FFFFFF",
  rose:      "#FF0D66",
  roseDeep:  "#A72F62",
  plum:      "#271617",
  muted:     "#7F717C",
  faint:     "#9C8D96",
  chipBg:    "#FFEAF3",
  dashedBd:  "#FF9BC1",
  ctaGrad:   "#FF0D66",
  ctaShadow: "0 5px 0 rgba(255,13,102,.13), 0 11px 25px rgba(255,13,102,.15)",
  cardShadow: "0 8px 25px rgba(103,44,71,.035)",
  selBorder: "2px solid #FF0D66",
  selShadow: "0 4px 0 #FFE1EC",
  amberBg:   "#FFF7DF",
  amberFg:   "#8A6A12",
} as const;

export const STEPS = [
  "Event",
  "Theme",
  "Decor",
  "Package",
  "Add-ons",
  "Venue",
  "Review",
];

// 2026-10-22 redesign: the heading, eyebrow and progress line of each step,
// from the design reference.
export const STEP_COPY: { heading: [string, string]; description: string; eyebrow: string; progress: string }[] = [
  { heading: ["What are we", "celebrating?"], description: "Start with the occasion — then we will guide the sparkle from there.", eyebrow: "LET’S CELEBRATE", progress: "Let’s get this party started!" },
  { heading: ["Pick your party", "magic!"], description: "Tap a theme to set the mood for the whole celebration.", eyebrow: "CHOOSE YOUR VIBE", progress: "Finding your party personality" },
  { heading: ["Build your", "sparkly backdrop."], description: "Shape it, style it and add the pretty bits — no overwhelm required.", eyebrow: "LET’S DECORATE", progress: "Time for balloon magic!" },
  { heading: ["How hands-on", "shall we be?"], description: "Choose the kind of support that fits your party plans.", eyebrow: "YOUR WAY, ALWAYS", progress: "Good choices, good vibes" },
  { heading: ["Sprinkle in", "some extras!"], description: "Optional experiences to make the day even sweeter.", eyebrow: "THE LITTLE DETAILS", progress: "Just a little more sparkle" },
  { heading: ["Where’s the", "party?"], description: "A few simple details and you are almost ready.", eyebrow: "ALMOST THERE", progress: "Nearly done!" },
  { heading: ["Your party looks", "so good!"], description: "Review your picks and send your sparkly plan for a final quote.", eyebrow: "THE BIG REVEAL", progress: "Ready to celebrate!" },
];

// 2026-10-23: the occasions shown as coming soon on the Event step.
/** 2026-10-24: at most two character standees — one each side of the backdrop. */
export const MAX_STANDEES = 2;

export const COMING_SOON_EVENTS: { title: string; sub: string; art: string }[] = [
  { title: "Bridal Corner", sub: "For the bride and her crew", art: "/design/ui/event-bridal.webp" },
  { title: "Graduation", sub: "Hats off to big dreams", art: "/design/ui/event-graduation.webp" },
  { title: "Corporate Setups", sub: "For team wins & milestones", art: "/design/ui/event-corporate.webp" },
];

// 2026-10-23: the Balloons and Extras tabs carry their own page heading.
export const DECOR_STEP_COPY: Partial<Record<number, (typeof STEP_COPY)[number]>> = {
  2: { heading: ["Add some", "balloon magic!"], description: "Choose your balloon style and colours to bring your backdrop to life.", eyebrow: "LET’S DECORATE", progress: "Time for balloon magic!" },
  3: { heading: ["Add those", "extra special touches!"], description: "Make it even more magical with a few extra details.", eyebrow: "LET’S PERSONALISE", progress: "The finishing touches!" },
};

// The Decor step's four tabs (the reference's compact decor builder).
export const DECOR_TABS: { num: string; name: string; kicker: string; title: string; sub: string }[] = [
  { num: "01", name: "Backdrop", kicker: "START HERE", title: "Pick your backdrop ✦", sub: "Choose the shape. We’ll take care of the pretty bits." },
  { num: "02", name: "Style", kicker: "MAKE IT YOURS", title: "Little details, big wow!", sub: "Let’s make your backdrop feel personal in just a few taps." },
  { num: "03", name: "Balloons", kicker: "COLOUR MAGIC", title: "Let’s add balloons!", sub: "Choose the garland and its Sempertex colours." },
  { num: "04", name: "Extras", kicker: "LAST LITTLE TOUCHES", title: "Extra party magic", sub: "Characters, florals, signs and plinths — only the pieces you love." },
];

// Hand-painted theme icons from the design reference (public/design/themes).
// 2026-10-23: the theme list is two lists, Girls and Boys, with the customer's
// crayon icons (public/design/themes-v2). Space is in both — a planet for
// girls, a rocket for boys. Themes in neither list are no longer offered (their
// data stays, so saved designs and renders that use them still work).
export const THEME_GROUPS: { key: "girl" | "boy"; title: string; items: { id: string; icon: string }[] }[] = [
  { key: "girl", title: "For girls", items: [
    { id: "unicorn", icon: "unicorn" }, { id: "frozen", icon: "frozen" }, { id: "barbie", icon: "barbie" },
    { id: "princess", icon: "princess" }, { id: "bluey", icon: "bluey" }, { id: "mermaid", icon: "mermaid" },
    { id: "space", icon: "space-girl" }, { id: "kpop", icon: "kpop" },
    // 2026-10-30 (owner): new themes; the dinosaur for girls too, with its own icon.
    { id: "butterfly_fairy", icon: "butterfly-fairy" }, { id: "ballerina", icon: "ballerina" },
    { id: "dinosaur", icon: "dinosaur-girl" }, { id: "circus", icon: "circus" },
  ] },
  { key: "boy", title: "For boys", items: [
    { id: "dinosaur", icon: "dinosaur" }, { id: "safari", icon: "safari" }, { id: "space", icon: "space-boy" },
    { id: "superhero", icon: "superhero" }, { id: "pokemon", icon: "pokemon" }, { id: "lego", icon: "lego" },
    { id: "minecraft", icon: "minecraft" }, { id: "star_wars", icon: "star-wars" },
    { id: "vehicles", icon: "vehicles" }, { id: "under_the_sea", icon: "under-the-sea" },
    { id: "pirates", icon: "pirates" }, { id: "circus", icon: "circus" },
    // Back in the list with its own icon and its themed cups, plates and napkins (2026-10-30).
    { id: "football", icon: "football" },
  ] },
];

// Illustrated backdrop icons from the design reference (public/design/backdrops),
// by setup template id.
// 2026-10-23: the customer's bright crayon set replaces the pale pink one.
export const SETUP_ICON: Partial<Record<string, string>> = {
  single_arch: "/design/backdrops-v2/single-arch.webp", single_round: "/design/backdrops-v2/single-round.webp",
  single_banner: "/design/backdrops-v2/banner.webp", single_shimmer: "/design/backdrops-v2/shimmer-wall.webp",
  arch_shimmer: "/design/backdrops-v2/arch-shimmer.webp", balloon_ring: "/design/backdrops-v2/balloon-ring.webp",
  arch_open_frame: "/design/backdrops-v2/arch-open-frame.webp", double_arch: "/design/backdrops-v2/double-arch.webp",
  triple_arch: "/design/backdrops-v2/triple-arch.webp",
};

// 2026-10-23: each theme's own example photo of a setup, shown (labelled as an
// example) in the empty preview until the customer generates a real render.
// Frozen only for now — the customer's photos, one per setup. Themes without
// photos keep the plain empty state.
export const THEME_SETUP_PREVIEW: Partial<Record<string, Partial<Record<string, string>>>> = {
  frozen: {
    single_arch: "/design/theme-previews/frozen/single-arch.webp",
    single_round: "/design/theme-previews/frozen/single-round.webp",
    single_banner: "/design/theme-previews/frozen/banner.webp",
    single_shimmer: "/design/theme-previews/frozen/shimmer-wall.webp",
    arch_shimmer: "/design/theme-previews/frozen/arch-shimmer.webp",
    triple_arch: "/design/theme-previews/frozen/triple-arch.webp",
    double_arch: "/design/theme-previews/frozen/double-arch.webp",
    balloon_ring: "/design/theme-previews/frozen/balloon-ring.webp",
    arch_open_frame: "/design/theme-previews/frozen/arch-open-frame.webp",
  },
};

/** Per-theme print suggestion text shown below the Theme Graphic card (theme shapes only, never characters). */
export const THEME_PRINT_SUGGESTIONS: Record<string, string> = {
  frozen: "Ice castle, snowflakes and sparkling stars",
  unicorn: "Unicorn face with gold horn, flower crown and lashes",
  dinosaur: "Jungle palm trees, volcano, dinosaur footprints",
  safari: "African savanna, giraffe silhouette, tropical leaves",
  princess: "Castle turrets, crown, stars and magic wand",
  superhero: "City skyline, lightning bolt, hero shield",
  barbie: "Pink stars, hearts and fashion sketches",
  bluey: "Paw prints, bones and sunny blue skies",
  pokemon: "Lightning bolts, stars and bright red-and-white circles",
  stitch: "Hibiscus flowers, palm leaves and ocean waves",
  mermaid: "Underwater scene, shells, bubbles, coral reef",
  space: "Galaxy stars, planets, rocket ship, moon",
  football: "Football pitch lines, soccer ball, jersey number",
  lego: "Building-brick grid pattern in primary colours",
  kpop: "Stage spotlight, microphone, sparkle star graphics",
  encanto: "Colourful casita, candles and tropical flowers",
  cocomelon: "Watermelon slices, bright polka dots and music notes",
  teddy_bear: "Cute teddy bear illustrations, hearts, soft bow",
  pineapple_tropical: "Gold pineapple outline, tropical monstera leaves, hibiscus",
  blush_garden: "Botanical roses and peonies, delicate foliage",
  luxury_neutral: "Minimal gold line art, abstract botanical, elegant monogram",
  // 2026-10-30: the new themes; the licensed ones above say theme shapes only, never characters.
  butterfly_fairy: "Pastel butterflies, daisies and a fairy toadstool",
  vehicles: "Race cars, fire trucks and road signs",
  under_the_sea: "Friendly sharks, whales, bubbles and seaweed",
  circus: "Striped big top, stars, popcorn and bunting",
  ballerina: "Ballet slippers, tutus, swans and bows",
  pirates: "Pirate ship, treasure chest and an old map",
};

/** Short display labels for plinth size buttons. */
// Real product names (2026-09-03) — the three cylinders sold are L/XL/XXL.
// Keys are the stored size ids, which stay small/medium/large.
export const PLINTH_SHORT: Record<string, string> = {
  small: "L",
  medium: "XL",
  large: "XXL",
  xl: "XXL",
};

export const DEFAULT_SEMPERTEX_IDS = ["fashion-005-white", "pastel-matte-609-pink", "pastel-matte-650-lilac"];

export const getThemeDefault = (themeId: string): string[] => {
  const entry = getThemeCatalogEntry(themeId);
  if (entry && entry.sempertexPaletteIds.length > 0) return entry.sempertexPaletteIds;
  return DEFAULT_SEMPERTEX_IDS;
};

