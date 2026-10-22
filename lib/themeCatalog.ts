/**
 * Central theme catalog — single source of truth for all 21 themes.
 * Replaces the fragmented SEMPERTEX_THEME_DEFAULTS (client) and
 * THEME_SEMPERTEX_DEFAULT_CODES (server) maps that were out of sync.
 *
 * sempertexPaletteIds must reference valid IDs from lib/sempertexCatalog.ts.
 */

import type { ThemeId } from "./config";

export interface ThemeGraphicPreset {
  id: string;
  assetId?: string;
  label: string;
  desc: string;
  description?: string;
  promptDescription?: string;
  /** Optional preview image shown on the graphic preset card. */
  previewUrl?: string;
}

/**
 * Character standee / cutout preset backed by a real PNG asset in
 * public/cutouts/[themeId]/[assetId].png. Separate concept from
 * ThemeGraphicPreset (printed backdrop graphics) — do not reuse one
 * for the other.
 */
export interface ThemeCutoutPreset {
  id: string;
  assetId: string;
  label: string;
  desc: string;
  previewUrl: string;
}

export interface ThemeCatalogEntry {
  id: ThemeId;
  name: string;
  icon: string;
  price: number;
  description: string;
  /** Local SVG cover art for the theme card (public/theme-covers/). */
  coverImageUrl?: string;
  swatchHexes: string[];
  sempertexPaletteIds: string[];
  renderDescription: string;
  graphicPresets: [ThemeGraphicPreset, ThemeGraphicPreset, ThemeGraphicPreset];
  /** Real-asset standee presets; themes without assets omit this. */
  cutoutPresets?: ThemeCutoutPreset[];
}

/** Compute stable asset ID: "{themeId with _ → -}-01/02/03" */
export function getPresetAssetId(themeId: string, presetIndex: number): string {
  return `${themeId.replace(/_/g, "-")}-0${presetIndex + 1}`;
}

export const THEME_CATALOG: ThemeCatalogEntry[] = [
  {
    id: "frozen",
    coverImageUrl: "/theme-covers/frozen.svg",
    name: "Frozen",
    icon: "❄️",
    price: 50,
    description: "Icy blues, silver, snowflakes",
    swatchHexes: ["#FFFFFF", "#BAE6FD", "#DCD7F2"],
    // 2026-09-05: 839 Arctic Blue removed at the customers request. It and 640
    // Blue are both pale blues — #B9D9EB against #BAE6FD — close enough that a
    // render cannot show them as two distinct colours, so the palette spent two
    // of its five slots on one visible colour. Four slots, four colours the eye
    // can actually separate: white, pastel blue, pastel purple, silver.
    // 2026-10-21: and clear, as in every one of the customer's Frozen
    // setup references (clear bubble balloons all through the garland).
    sempertexPaletteIds: ["fashion-005-white", "pastel-matte-640-blue", "silk-850-light-amethyst", "reflex-981-silver", "fashion-390-clear"],
    renderDescription: "Frozen winter wonderland theme with icy blues, white, and silver; snowflake and ice crystal motifs",
    graphicPresets: [
      { id: "frozen_castle",    assetId: "frozen-01", label: "Frozen Castle",    desc: "Arendelle castle with snowflakes" },
      { id: "frozen_elsa",      assetId: "frozen-02", label: "Elsa & Anna",      desc: "Silhouettes of Elsa and Anna" },
      { id: "frozen_snowflake", assetId: "frozen-03", label: "Snowflake Pattern", desc: "Repeating ice crystal pattern" },
    ],
    cutoutPresets: [
      { id: "frozen-01", assetId: "frozen-01", label: "Elsa & Anna Duo",     desc: "Two-character feature standee", previewUrl: "/cutouts/frozen/frozen-01.png" },
      { id: "frozen-02", assetId: "frozen-02", label: "Elsa & Anna Classic", desc: "Main character duo standee",     previewUrl: "/cutouts/frozen/frozen-02.png" },
      { id: "frozen-03", assetId: "frozen-03", label: "Elsa Solo",           desc: "Single Elsa feature standee",    previewUrl: "/cutouts/frozen/frozen-03.png" },
      { id: "frozen-04", assetId: "frozen-04", label: "Anna Solo",           desc: "Single Anna feature standee",    previewUrl: "/cutouts/frozen/frozen-04.png" },
    ],
  },
  {
    id: "unicorn",
    coverImageUrl: "/theme-covers/unicorn.svg",
    name: "Unicorn",
    icon: "🦄",
    price: 50,
    description: "Pastels, iridescent, rainbow magic",
    swatchHexes: ["#F8BBD0", "#DDD6FE", "#FEF08A"],
    sempertexPaletteIds: ["pastel-matte-609-pink", "pastel-matte-650-lilac", "pastel-matte-620-yellow", "pastel-matte-630-green", "fashion-005-white"],
    renderDescription: "Magical unicorn theme with pastel rainbow colors, iridescent shimmer, and sparkle magic",
    graphicPresets: [
      { id: "unicorn_face",    assetId: "unicorn-01", label: "Unicorn Portrait", desc: "Unicorn face with gold horn and flower crown" },
      { id: "unicorn_full",    assetId: "unicorn-02", label: "Full Unicorn",     desc: "Prancing unicorn with rainbow mane" },
      { id: "unicorn_rainbow", assetId: "unicorn-03", label: "Rainbow Magic",    desc: "Rainbow with clouds and glitter stars" },
    ],
  },
  {
    id: "dinosaur",
    coverImageUrl: "/theme-covers/dinosaur.svg",
    name: "Dinosaur",
    icon: "🦕",
    price: 30,
    description: "Earthy greens, terracotta, jungle",
    swatchHexes: ["#15803D", "#84CC16", "#C9A96E"],
    sempertexPaletteIds: ["fashion-032-forest-green", "fashion-031-lime-green", "fashion-073-latte", "fashion-023-mustard", "fashion-071-white-sand"],
    renderDescription: "Fun dinosaur theme with jungle greens, earthy terracotta tones, and tropical foliage",
    graphicPresets: [
      { id: "dino_trex",        assetId: "dinosaur-01", label: "T-Rex",          desc: "Roaring T-Rex with jungle palms" },
      { id: "dino_stegosaurus", assetId: "dinosaur-02", label: "Stegosaurus",    desc: "Stegosaurus in tropical greenery" },
      { id: "dino_pattern",     assetId: "dinosaur-03", label: "Dino Pattern",   desc: "Cute repeating dinosaur pattern" },
    ],
  },
  {
    id: "safari",
    coverImageUrl: "/theme-covers/safari.svg",
    name: "Safari",
    icon: "🦒",
    price: 30,
    description: "Warm browns, animal print, jungle",
    swatchHexes: ["#C9A96E", "#F5EDD6", "#FFC200"],
    sempertexPaletteIds: ["fashion-073-latte", "fashion-071-white-sand", "fashion-021-honey-yellow", "fashion-076-chocolate", "fashion-027-eucalyptus"],
    renderDescription: "Safari adventure theme with warm sandy yellows, animal prints, and African savanna imagery",
    graphicPresets: [
      { id: "safari_giraffe", assetId: "safari-01", label: "Giraffe",       desc: "Giraffe with acacia trees" },
      { id: "safari_lion",    assetId: "safari-02", label: "Lion",          desc: "Lion pride on African savanna" },
      { id: "safari_pattern", assetId: "safari-03", label: "Animal Print",  desc: "Repeating animal print pattern" },
    ],
  },
  {
    id: "princess",
    coverImageUrl: "/theme-covers/princess.svg",
    name: "Princess",
    icon: "👸",
    price: 50,
    description: "Pink, gold, castle, crown",
    swatchHexes: ["#F8BBD0", "#FBCFE8", "#FFFFFF"],
    sempertexPaletteIds: ["pastel-matte-609-pink", "silk-809-pink-blossom", "fashion-005-white", "reflex-970-gold", "pastel-dusk-150-lavender"],
    renderDescription: "Royal princess theme with soft pinks, gold crowns, castle turrets, and fairy-tale magic",
    graphicPresets: [
      { id: "princess_castle",   assetId: "princess-01", label: "Castle",        desc: "Fairy tale castle with turrets" },
      { id: "princess_crown",    assetId: "princess-02", label: "Crown & Stars", desc: "Golden crown with sparkling stars" },
      { id: "princess_carriage", assetId: "princess-03", label: "Carriage",      desc: "Cinderella carriage with horses" },
    ],
  },
  {
    id: "superhero",
    coverImageUrl: "/theme-covers/superhero.svg",
    name: "Superhero",
    icon: "🦸",
    price: 40,
    description: "Bold primaries, action, pow!",
    swatchHexes: ["#EF4444", "#2563EB", "#FFD700"],
    sempertexPaletteIds: ["fashion-015-red", "fashion-041-royal-blue", "fashion-020-yellow", "fashion-080-black", "reflex-981-silver"],
    renderDescription: "Bold superhero theme with primary comic-book colors, action bursts, and hero silhouettes",
    graphicPresets: [
      { id: "superhero_shield",     assetId: "superhero-01", label: "Shield",          desc: "Superhero shield and lightning bolt" },
      { id: "superhero_silhouette", assetId: "superhero-02", label: "Hero Silhouette", desc: "Superhero in flight silhouette" },
      { id: "superhero_comic",      assetId: "superhero-03", label: "Comic Burst",     desc: "Comic burst with action words" },
    ],
  },
  {
    id: "barbie",
    coverImageUrl: "/theme-covers/barbie.svg",
    name: "Barbie",
    icon: "💗",
    price: 60,
    description: "Hot pink, fuchsia, glam",
    swatchHexes: ["#FF1DCE", "#F9A8D4", "#F8BBD0"],
    sempertexPaletteIds: ["fashion-012-fuchsia", "fashion-009-pink", "pastel-matte-609-pink", "fashion-005-white", "reflex-909-pink"],
    renderDescription: "Glamorous Barbie theme with hot pink, fuchsia, dreamy pink tones, and iconic Barbie styling",
    graphicPresets: [
      { id: "barbie_logo",       assetId: "barbie-01", label: "Barbie Logo",   desc: "Classic Barbie logo in pink" },
      { id: "barbie_doll",       assetId: "barbie-02", label: "Barbie Portrait", desc: "Barbie fashion illustration" },
      { id: "barbie_dreamhouse", assetId: "barbie-03", label: "Dreamhouse",    desc: "Pink Dreamhouse and accessories" },
    ],
  },
  {
    id: "bluey",
    coverImageUrl: "/theme-covers/bluey.svg",
    name: "Bluey",
    icon: "🐾",
    price: 40,
    description: "Blue heeler, family fun, playful",
    swatchHexes: ["#3B82F6", "#7DD3FC", "#BFDBFE"],
    sempertexPaletteIds: ["fashion-040-blue", "satin-440-blue", "pastel-dusk-140-blue", "fashion-021-honey-yellow", "fashion-071-white-sand"],
    renderDescription: "Bluey Blue Heeler theme with bright blue tones, playful family scenes, and Aussie sunshine energy",
    graphicPresets: [
      { id: "bluey_family",   assetId: "bluey-01", label: "Bluey Family",  desc: "Bluey and Bingo with the family" },
      { id: "bluey_portrait", assetId: "bluey-02", label: "Bluey Portrait", desc: "Bluey character close-up" },
      { id: "bluey_pattern",  assetId: "bluey-03", label: "Paw Pattern",   desc: "Bluey paw prints and star pattern" },
    ],
  },
  {
    id: "pokemon",
    coverImageUrl: "/theme-covers/pokemon.svg",
    name: "Pokémon",
    icon: "⚡",
    price: 50,
    description: "Yellow, red Pokéball, adventure",
    swatchHexes: ["#FFD700", "#EF4444", "#FFFFFF"],
    sempertexPaletteIds: ["fashion-020-yellow", "fashion-015-red", "fashion-005-white", "fashion-080-black", "fashion-021-honey-yellow"],
    renderDescription: "Pokémon adventure theme with Pikachu yellow, Pokéball red, and exciting trainer energy",
    graphicPresets: [
      { id: "pokemon_pikachu",  assetId: "pokemon-01", label: "Pikachu",         desc: "Pikachu with lightning bolt" },
      { id: "pokemon_pokeball", assetId: "pokemon-02", label: "Pokéball",        desc: "Classic Pokéball design" },
      { id: "pokemon_starters", assetId: "pokemon-03", label: "Starter Pokémon", desc: "Charizard, Squirtle, and Bulbasaur" },
    ],
  },
  {
    id: "stitch",
    coverImageUrl: "/theme-covers/stitch.svg",
    name: "Stitch",
    icon: "🌺",
    price: 40,
    description: "Blue, tropical, Hawaiian",
    swatchHexes: ["#3B82F6", "#0EA5E9", "#7DD3FC"],
    sempertexPaletteIds: ["fashion-040-blue", "fashion-038-caribbean-blue", "satin-440-blue", "fashion-044-navy-blue", "pastel-matte-609-pink"],
    renderDescription: "Lilo and Stitch Hawaiian theme with ocean blues, tropical island vibes, and aloha spirit",
    graphicPresets: [
      { id: "stitch_portrait", assetId: "stitch-01", label: "Stitch Portrait",  desc: "Stitch with big ears and blue eyes" },
      { id: "stitch_tropical", assetId: "stitch-02", label: "Tropical Hawaii",  desc: "Stitch with Hawaiian flowers and palms" },
      { id: "stitch_aloha",    assetId: "stitch-03", label: "Aloha Stitch",     desc: "Stitch surfing on a tropical wave" },
    ],
  },
  {
    id: "mermaid",
    coverImageUrl: "/theme-covers/mermaid.svg",
    name: "Mermaid",
    icon: "🧜",
    price: 50,
    description: "Teals, iridescent, ocean magic",
    swatchHexes: ["#00CED1", "#0F766E", "#A7F3D0"],
    sempertexPaletteIds: ["fashion-037-aquamarine", "fashion-035-deep-teal", "silk-826-cool-mint", "fashion-050-lilac", "fashion-005-white"],
    renderDescription: "Magical mermaid theme with iridescent teals, aquamarine, pearl whites, and enchanting underwater ocean magic",
    graphicPresets: [
      { id: "mermaid_portrait",    assetId: "mermaid-01", label: "Mermaid",       desc: "Beautiful mermaid with pearl crown" },
      { id: "mermaid_underwater",  assetId: "mermaid-02", label: "Under the Sea", desc: "Coral reef with fish and seahorses" },
      { id: "mermaid_scales",      assetId: "mermaid-03", label: "Scale Pattern", desc: "Iridescent mermaid scale pattern" },
    ],
  },
  {
    id: "space",
    coverImageUrl: "/theme-covers/space.svg",
    name: "Space",
    icon: "🚀",
    price: 60,
    description: "Deep navy, stars, planets",
    swatchHexes: ["#1E3A8A", "#7C3AED", "#1F2937"],
    sempertexPaletteIds: ["fashion-044-navy-blue", "fashion-051-violet", "fashion-080-black", "reflex-981-silver", "reflex-970-gold"],
    renderDescription: "Deep space theme with dark navy, cosmic purple, glowing golden stars, and mysterious planets",
    graphicPresets: [
      { id: "space_rocket",     assetId: "space-01", label: "Rocket Launch", desc: "Rocket launching through space with planets" },
      { id: "space_astronaut",  assetId: "space-02", label: "Astronaut",     desc: "Astronaut floating in space" },
      { id: "space_galaxy",     assetId: "space-03", label: "Galaxy",        desc: "Milky Way with stars and nebula" },
    ],
  },
  {
    id: "football",
    coverImageUrl: "/theme-covers/football.svg",
    name: "Football",
    icon: "⚽",
    price: 30,
    description: "Team colors, grass green, sporty",
    swatchHexes: ["#22C55E", "#16A34A", "#FFFFFF"],
    sempertexPaletteIds: ["fashion-030-green", "fashion-029-shamrock-green", "fashion-005-white", "fashion-080-black", "reflex-970-gold"],
    renderDescription: "Football sports theme with vibrant green pitch, football motifs, and energetic team spirit",
    graphicPresets: [
      { id: "football_ball",    assetId: "football-01", label: "Football",  desc: "Football with grass pitch" },
      { id: "football_stadium", assetId: "football-02", label: "Stadium",   desc: "Stadium with goal and crowd" },
      { id: "football_trophy",  assetId: "football-03", label: "Trophy",    desc: "Champion trophy with ribbons" },
    ],
  },
  {
    id: "lego",
    coverImageUrl: "/theme-covers/lego.svg",
    name: "Lego",
    icon: "🧱",
    price: 40,
    description: "Bright primary colors, brick fun",
    swatchHexes: ["#EF4444", "#FFD700", "#2563EB"],
    sempertexPaletteIds: ["fashion-015-red", "fashion-020-yellow", "fashion-041-royal-blue", "fashion-030-green", "fashion-061-orange"],
    renderDescription: "Colorful LEGO theme with bold primary brick colors and building adventure creativity",
    graphicPresets: [
      { id: "lego_city",    assetId: "lego-01", label: "LEGO City",   desc: "LEGO city skyline with bricks" },
      { id: "lego_minifig", assetId: "lego-02", label: "Minifigure",  desc: "LEGO minifigure characters" },
      { id: "lego_bricks",  assetId: "lego-03", label: "Brick Pattern", desc: "Repeating LEGO brick pattern" },
    ],
  },
  {
    id: "kpop",
    coverImageUrl: "/theme-covers/kpop.svg",
    name: "K-Pop",
    icon: "🎤",
    price: 70,
    description: "Neon, sparkle, idol vibes",
    swatchHexes: ["#A21CAF", "#A855F7", "#FF10F0"],
    sempertexPaletteIds: ["fashion-056-purple-orchid", "reflex-951-violet", "neon-212-fuchsia", "fashion-080-black", "reflex-981-silver"],
    renderDescription: "K-Pop idol theme with neon purple, sparkling stage lights, fan light sticks, and glam concert energy",
    graphicPresets: [
      { id: "kpop_stage",      assetId: "kpop-01", label: "Concert Stage",  desc: "K-Pop concert stage with lights" },
      { id: "kpop_idol",       assetId: "kpop-02", label: "Idol Silhouette", desc: "Idol silhouette with sparkle effects" },
      { id: "kpop_lightstick", assetId: "kpop-03", label: "Light Sticks",   desc: "Fan light sticks and star confetti" },
    ],
  },
  {
    id: "encanto",
    coverImageUrl: "/theme-covers/encanto.svg",
    name: "Encanto",
    icon: "🌺",
    price: 50,
    description: "Vibrant Colombian colors, magical",
    swatchHexes: ["#A21CAF", "#FF1DCE", "#FFC200"],
    sempertexPaletteIds: ["fashion-056-purple-orchid", "fashion-012-fuchsia", "fashion-021-honey-yellow", "fashion-037-aquamarine", "fashion-032-forest-green"],
    renderDescription: "Magical Encanto theme with vibrant Colombian colors, tropical flowers, casita magic, and Madrigal family charm",
    graphicPresets: [
      { id: "encanto_casita",  assetId: "encanto-01", label: "La Casita",      desc: "The magical Madrigal house" },
      { id: "encanto_mirabel", assetId: "encanto-02", label: "Mirabel",        desc: "Mirabel with glowing magic" },
      { id: "encanto_flowers", assetId: "encanto-03", label: "Tropical Blooms", desc: "Colombian flowers and butterflies" },
    ],
  },
  {
    id: "cocomelon",
    coverImageUrl: "/theme-covers/cocomelon.svg",
    name: "Cocomelon",
    icon: "🍉",
    price: 30,
    description: "Bright primaries, watermelon, fun",
    swatchHexes: ["#22C55E", "#84CC16", "#FF6B6B"],
    sempertexPaletteIds: ["fashion-030-green", "fashion-031-lime-green", "fashion-059-tropical-coral", "pastel-matte-620-yellow", "fashion-005-white"],
    renderDescription: "Bright Cocomelon nursery theme with watermelon colors, cheerful baby vibes, and playful JJ energy",
    graphicPresets: [
      { id: "cocomelon_jj",          assetId: "cocomelon-01", label: "JJ",             desc: "JJ the baby with big smile" },
      { id: "cocomelon_watermelon",   assetId: "cocomelon-02", label: "Watermelon",    desc: "Watermelon with leaves and vines" },
      { id: "cocomelon_pattern",      assetId: "cocomelon-03", label: "Nursery Pattern", desc: "Watermelon slice repeating pattern" },
    ],
  },
  {
    id: "teddy_bear",
    coverImageUrl: "/theme-covers/teddy_bear.svg",
    name: "Teddy Bear",
    icon: "🧸",
    price: 30,
    description: "Soft beige, dusty pink, cozy",
    swatchHexes: ["#C9A96E", "#6F4E37", "#F5EDD6"],
    sempertexPaletteIds: ["fashion-073-latte", "fashion-074-coffee", "fashion-071-white-sand", "pastel-dusk-107-cream", "fashion-060-peach-blush"],
    renderDescription: "Cozy teddy bear theme with soft beige, dusty pink, warm cream tones, and plush toy charm",
    graphicPresets: [
      { id: "teddy_classic", assetId: "teddy-bear-01", label: "Teddy Bear",   desc: "Classic plush teddy bear with bow" },
      { id: "teddy_picnic",  assetId: "teddy-bear-02", label: "Teddy Picnic", desc: "Teddy bear tea party scene" },
      { id: "teddy_pattern", assetId: "teddy-bear-03", label: "Bear Pattern", desc: "Cute teddy bear repeating pattern" },
    ],
  },
  {
    id: "pineapple_tropical",
    coverImageUrl: "/theme-covers/pineapple_tropical.svg",
    name: "Tropical 🍍",
    icon: "🍍",
    price: 40,
    description: "Pineapple, palm leaves, vibrant",
    swatchHexes: ["#FFC200", "#22C55E", "#FF6B6B"],
    sempertexPaletteIds: ["fashion-021-honey-yellow", "fashion-030-green", "fashion-059-tropical-coral", "fashion-037-aquamarine", "fashion-005-white"],
    renderDescription: "Tropical summer theme with pineapples, palm leaves, bright sunshine yellows, and vibrant tropical pinks",
    graphicPresets: [
      { id: "tropical_pineapple", assetId: "pineapple-tropical-01", label: "Pineapple",        desc: "Tropical pineapple with palm leaves" },
      { id: "tropical_flamingo",  assetId: "pineapple-tropical-02", label: "Flamingo",         desc: "Pink flamingo in tropical setting" },
      { id: "tropical_pattern",   assetId: "pineapple-tropical-03", label: "Tropical Pattern", desc: "Palm leaves and tropical fruit pattern" },
    ],
  },
  {
    id: "blush_garden",
    coverImageUrl: "/theme-covers/blush_garden.svg",
    name: "Blush Garden",
    icon: "🌸",
    price: 0,
    description: "Soft pinks, florals, romantic",
    swatchHexes: ["#F8BBD0", "#FDA4AF", "#FBCFE8"],
    sempertexPaletteIds: ["pastel-matte-609-pink", "pastel-dusk-110-rose", "silk-809-pink-blossom", "fashion-005-white", "reflex-971-champagne"],
    renderDescription: "Romantic blush garden theme with soft floral pinks, botanical greenery, and delicate garden elegance",
    graphicPresets: [
      { id: "garden_roses",     assetId: "blush-garden-01", label: "Rose Garden",    desc: "Full-bloom garden roses arrangement" },
      { id: "garden_botanical", assetId: "blush-garden-02", label: "Botanical Arch", desc: "Greenery and blush botanical frame" },
      { id: "garden_floral",    assetId: "blush-garden-03", label: "Floral Pattern", desc: "Delicate floral repeating pattern" },
    ],
  },
  {
    id: "luxury_neutral",
    coverImageUrl: "/theme-covers/luxury_neutral.svg",
    name: "Luxury Neutral",
    icon: "✨",
    price: 80,
    description: "Beige, champagne, gold, ivory",
    swatchHexes: ["#F5E6C8", "#FEF3C7", "#F5EDD6"],
    sempertexPaletteIds: ["reflex-971-champagne", "silk-873-cream-pearl", "fashion-071-white-sand", "reflex-970-gold", "fashion-073-latte"],
    renderDescription: "Sophisticated luxury neutral theme with champagne, ivory pearl, and burnished gold elegance",
    graphicPresets: [
      { id: "luxury_wreath",  assetId: "luxury-neutral-01", label: "Gold Wreath",    desc: "Golden leaf wreath with monogram" },
      { id: "luxury_marble",  assetId: "luxury-neutral-02", label: "Marble & Gold",  desc: "Marble texture with gold accents" },
      { id: "luxury_pattern", assetId: "luxury-neutral-03", label: "Luxury Pattern", desc: "Damask or herringbone gold pattern" },
    ],
  },
];

export function getThemeCatalogEntry(id: string): ThemeCatalogEntry | undefined {
  return THEME_CATALOG.find((t) => t.id === id);
}

export const FALLBACK_GRAPHIC_PRESETS: [ThemeGraphicPreset, ThemeGraphicPreset, ThemeGraphicPreset] = [
  { id: "illustrated_scene", assetId: "generic-01", label: "Illustrated Scene", desc: "Themed character illustration" },
  { id: "pattern_print",     assetId: "generic-02", label: "Pattern Print",     desc: "Repeating theme pattern" },
  { id: "minimal_logo",      assetId: "generic-03", label: "Minimal Logo",      desc: "Clean minimal theme graphic" },
];

/**
 * Real-asset cutout presets for a theme, or null when the theme has no
 * PNG assets yet (callers fall back to generic text-only preset cards).
 */
export function getThemeCutoutPresets(themeId: string): ThemeCutoutPreset[] | null {
  const theme = THEME_CATALOG.find((t) => t.id === themeId);
  return theme?.cutoutPresets?.length ? theme.cutoutPresets : null;
}

export function getThemeGraphicPresets(themeId: string): ThemeGraphicPreset[] {
  const safeThemeId = themeId || "default";
  const theme = THEME_CATALOG.find((t) => t.id === safeThemeId);

  if (theme?.graphicPresets?.length) {
    return theme.graphicPresets;
  }

  return [
    {
  id: `${safeThemeId}-01`,
  assetId: `${safeThemeId}-01`,
  label: "Main Character",
  desc: "Main illustrated theme character style",
  description: "Main illustrated theme character style",
  promptDescription: `main illustrated ${safeThemeId} birthday theme character cutout style`,
},
    {
  id: `${safeThemeId}-02`,
  assetId: `${safeThemeId}-02`,
  label: "Scene Style",
  desc: "Themed scenic illustration style",
  description: "Themed scenic illustration style",
  promptDescription: `${safeThemeId} themed scenic birthday illustration cutout style`,
},
{
  id: `${safeThemeId}-03`,
  assetId: `${safeThemeId}-03`,
  label: "Pattern Style",
  desc: "Themed icon and pattern style",
  description: "Themed icon and pattern style",
  promptDescription: `${safeThemeId} themed pattern and icon birthday cutout style`,
},
  ];
}
