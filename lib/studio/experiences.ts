// The party's experiences (2026-11-04), the builder's own step after Decor and before Package — the old Add-ons
// moved there (the owner: "Add experiences … popcorn, cotton candy, photographer, entertainment, inflatables, face
// painting", then "+ atölye"). Cake, return gifts and the kids' tables left the list: their studios cover them.
// Services, not designed pieces: each one a photo, a price and the few things the supplier needs to know; no render.
// Prices are PLACEHOLDERS until she sends hers; the pictures are flux-2 stand-ins until she sends her photos.

export type ExperienceId =
  | "popcorn" | "cotton_candy"
  | "photographer"
  | "magician" | "character_host" | "bubble_show" | "dj"
  | "bouncy_castle" | "soft_play" | "ball_pit"
  | "face_painting"
  | "slime" | "cupcake" | "painting";

/** How an experience is priced: one price, by the guests, by the children or by the hours. */
type Pricing =
  | { by: "fixed"; price: number }
  | { by: "guests" | "children"; tiers: { upTo: number; price: number }[] }
  | { by: "hours" };

export interface Experience {
  id: ExperienceId;
  group: ExperienceGroupId;
  name: string;
  blurb: string;
  /** public/design/experiences/<pic>.webp */
  pic: string;
  pricing: Pricing;
  /** How long it runs, said on the card. */
  time?: string;
}

export type ExperienceGroupId = "treats" | "photo" | "entertainment" | "inflatables" | "face" | "workshops";
export const EXPERIENCE_GROUPS: { id: ExperienceGroupId; name: string; note: string }[] = [
  { id: "treats", name: "Sweet treat carts", note: "Served fresh at the party, with someone looking after the cart" },
  { id: "photo", name: "Photographer", note: "Every moment kept, edited photos sent after the party" },
  { id: "entertainment", name: "Entertainment", note: "A show or a host to keep the kids laughing — pick one or more" },
  { id: "inflatables", name: "Inflatables & soft play", note: "Set up and taken away by us, safe for little ones" },
  { id: "face", name: "Face painting", note: "Skin-safe paints, designs to match your theme" },
  { id: "workshops", name: "Workshops", note: "A little class at the party, everything they need on the table" },
];

const BY_GUESTS = [{ upTo: 20, price: 220 }, { upTo: 50, price: 320 }, { upTo: Infinity, price: 450 }];
const BY_KIDS = (a: number, b: number, c: number) => [{ upTo: 10, price: a }, { upTo: 20, price: b }, { upTo: Infinity, price: c }];

export const EXPERIENCES: Experience[] = [
  { id: "popcorn", group: "treats", name: "Popcorn cart", blurb: "A white popcorn cart, fresh popcorn in little boxes", pic: "popcorn", pricing: { by: "guests", tiers: BY_GUESTS }, time: "2 hrs" },
  { id: "cotton_candy", group: "treats", name: "Cotton candy cart", blurb: "Fluffy cotton candy spun on the spot", pic: "cotton-candy", pricing: { by: "guests", tiers: BY_GUESTS }, time: "2 hrs" },
  { id: "photographer", group: "photo", name: "Party photographer", blurb: "A professional photographer for the party", pic: "photographer", pricing: { by: "hours" } },
  { id: "magician", group: "entertainment", name: "Magic show", blurb: "Tricks, giggles and a little magic for the kids", pic: "magician", pricing: { by: "fixed", price: 650 }, time: "45 min" },
  { id: "character_host", group: "entertainment", name: "Costumed party host", blurb: "A host dressed to match your theme, games and dancing", pic: "character-host", pricing: { by: "fixed", price: 650 }, time: "1 hr" },
  { id: "bubble_show", group: "entertainment", name: "Bubble show", blurb: "Giant bubbles floating over the kids", pic: "bubble-show", pricing: { by: "fixed", price: 550 }, time: "45 min" },
  { id: "dj", group: "entertainment", name: "DJ & party games", blurb: "Music, lights and party games", pic: "dj", pricing: { by: "fixed", price: 700 }, time: "2 hrs" },
  { id: "bouncy_castle", group: "inflatables", name: "Bouncy castle", blurb: "A pastel bouncy castle with turrets", pic: "bouncy-castle", pricing: { by: "fixed", price: 450 } },
  { id: "soft_play", group: "inflatables", name: "Soft play", blurb: "Foam blocks, a slide and steps for toddlers", pic: "soft-play", pricing: { by: "fixed", price: 380 } },
  { id: "ball_pit", group: "inflatables", name: "Ball pit", blurb: "A round ball pit in pastel balls", pic: "ball-pit", pricing: { by: "fixed", price: 280 } },
  { id: "face_painting", group: "face", name: "Face painting", blurb: "A face painter, one or more by the number of children", pic: "face-painting", pricing: { by: "children", tiers: BY_KIDS(350, 550, 750) }, time: "2 hrs" },
  { id: "slime", group: "workshops", name: "Slime workshop", blurb: "Each child makes a pot of glittery slime to take home", pic: "slime", pricing: { by: "children", tiers: BY_KIDS(400, 650, 900) }, time: "45 min" },
  { id: "cupcake", group: "workshops", name: "Cupcake decorating", blurb: "Frosting, sprinkles and a cupcake each to decorate", pic: "cupcake", pricing: { by: "children", tiers: BY_KIDS(400, 650, 900) }, time: "45 min" },
  { id: "painting", group: "workshops", name: "Little painters", blurb: "A small canvas and paints each, theirs to keep", pic: "painting", pricing: { by: "children", tiers: BY_KIDS(400, 650, 900) }, time: "45 min" },
];

export const experienceById = (id: string) => EXPERIENCES.find((e) => e.id === id);

/** The photographer's hours and their prices, and the short film of the day. */
export const PHOTO_HOURS = [{ hours: 1, price: 450 }, { hours: 2, price: 750 }, { hours: 3, price: 1000 }] as const;
export const VIDEO_PRICE = 500;
/** The popcorn boxes: plain white, or printed in the theme's pattern (the kids' table's placemat print). */
export const THEMED_BOXES_PRICE = 60;
export const CANDY_COLOURS = [
  { id: "pink", name: "Pink", hex: "#F9B4CF" },
  { id: "blue", name: "Blue", hex: "#A9D8F5" },
  { id: "both", name: "Pink & blue", hex: "" },
] as const;

/** The face painter's designs for a theme (never a licensed character), and the host's costume. */
const THEME_TOUCH: Record<string, { faces: string[]; host: string }> = {
  frozen: { faces: ["Snowflake crown", "Ice princess sparkle", "Frosty swirls"], host: "an ice princess" },
  unicorn: { faces: ["Unicorn horn", "Rainbow", "Glitter stars"], host: "a unicorn fairy" },
  dinosaur: { faces: ["Dinosaur", "Dino scales", "Volcano"], host: "a dino explorer" },
  safari: { faces: ["Tiger", "Lion", "Leopard spots"], host: "a safari ranger" },
  princess: { faces: ["Princess tiara", "Hearts", "Glitter flowers"], host: "a princess" },
  superhero: { faces: ["Hero mask", "Lightning bolt", "Spider web"], host: "a caped superhero" },
  barbie: { faces: ["Pink hearts", "Glitter lips", "Sparkle stars"], host: "a glam pop star" },
  bluey: { faces: ["Puppy", "Paw prints", "Stars"], host: "a puppy pal" },
  pokemon: { faces: ["Lightning bolt", "Little monster", "Stars"], host: "a monster trainer" },
  stitch: { faces: ["Alien antennae", "Hibiscus flower", "Ocean waves"], host: "a beach hula dancer" },
  mermaid: { faces: ["Mermaid scales", "Seashells", "Pearls"], host: "a mermaid" },
  space: { faces: ["Rocket", "Planets & stars", "Alien"], host: "an astronaut" },
  football: { faces: ["Football", "Team flag stripes", "Trophy"], host: "a football coach" },
  lego: { faces: ["Colour blocks", "Robot", "Rainbow"], host: "a brick builder" },
  kpop: { faces: ["Sparkle stars", "Hearts", "Glitter lightning"], host: "a pop star" },
  encanto: { faces: ["Flowers", "Butterflies", "Candle glow"], host: "a magical storyteller" },
  cocomelon: { faces: ["Watermelon", "Ladybird", "Rainbow"], host: "a nursery-rhyme singer" },
  teddy_bear: { faces: ["Teddy bear", "Hearts", "Bow"], host: "a teddy bear friend" },
  pineapple_tropical: { faces: ["Pineapple", "Palm leaves", "Flowers"], host: "a tropical hula host" },
  blush_garden: { faces: ["Flowers", "Butterfly", "Ladybird"], host: "a garden fairy" },
  minecraft: { faces: ["Pixel creeper face", "Pixel sword", "Blocks"], host: "a pixel adventurer" },
  star_wars: { faces: ["Galaxy stars", "Light saber", "Robot"], host: "a galaxy knight" },
  butterfly_fairy: { faces: ["Butterfly", "Fairy wings", "Flowers"], host: "a garden fairy" },
  vehicles: { faces: ["Race car", "Chequered flag", "Lightning bolt"], host: "a racing driver" },
  under_the_sea: { faces: ["Fish", "Octopus", "Starfish"], host: "a deep-sea diver" },
  circus: { faces: ["Clown", "Tiger", "Stars"], host: "a circus ringmaster" },
  ballerina: { faces: ["Swan", "Tiara", "Glitter flowers"], host: "a ballerina" },
  pirates: { faces: ["Pirate eye patch", "Skull & crossbones", "Treasure map"], host: "a pirate captain" },
  puppy_rescue: { faces: ["Puppy", "Paw prints", "Hero badge"], host: "a rescue pup" },
  dollhouse_kitties: { faces: ["Kitty", "Hearts", "Glitter stars"], host: "a kitty friend" },
};
const TOUCH = { faces: ["Butterfly", "Tiger", "Rainbow"], host: "a fairy" };
export const faceDesigns = (themeId: string) => (THEME_TOUCH[themeId] ?? TOUCH).faces;
export const hostCostume = (themeId: string) => (THEME_TOUCH[themeId] ?? TOUCH).host;

export interface Experiences {
  /** The picked experiences, in the order she picked them. */
  picked: ExperienceId[];
  /** How many children and grown-ups come: the prices by guests or children go by them. */
  children: number;
  adults: number;
  photoHours: 1 | 2 | 3;
  video: boolean;
  popcornBoxes: "plain" | "themed";
  candyColour: (typeof CANDY_COLOURS)[number]["id"];
  /** The inflatables indoors or out (the supplier needs to know). */
  place: "indoor" | "outdoor";
}

/** Nothing picked; the guests from the tables she set, if she set them. */
export function defaultExperiences(seed: { children?: number; adults?: number } = {}): Experiences {
  return {
    picked: [], children: seed.children || 10, adults: seed.adults || 10,
    photoHours: 2, video: false, popcornBoxes: "themed", candyColour: "both", place: "indoor",
  };
}

const tier = (tiers: { upTo: number; price: number }[], n: number) => (tiers.find((t) => n <= t.upTo) ?? tiers[tiers.length - 1]).price;

/** An experience's price for her party. */
export function experiencePrice(e: Experience, x: Experiences): number {
  const p = e.pricing;
  if (p.by === "fixed") return p.price;
  if (p.by === "guests") return tier(p.tiers, x.children + x.adults) + (e.id === "popcorn" && x.popcornBoxes === "themed" ? THEMED_BOXES_PRICE : 0);
  if (p.by === "children") return tier(p.tiers, x.children);
  return PHOTO_HOURS.find((h) => h.hours === x.photoHours)!.price + (x.video ? VIDEO_PRICE : 0);
}

/** What the price line says: the experience and what was chosen for it. */
function experienceLabel(e: Experience, x: Experiences): string {
  switch (e.id) {
    case "popcorn": return `Popcorn cart, ${x.popcornBoxes === "themed" ? "boxes in your theme" : "plain white boxes"}, ${x.children + x.adults} guests`;
    case "cotton_candy": return `Cotton candy cart, ${CANDY_COLOURS.find((c) => c.id === x.candyColour)!.name.toLowerCase()}, ${x.children + x.adults} guests`;
    case "photographer": return `Photographer, ${x.photoHours} hr${x.photoHours > 1 ? "s" : ""}${x.video ? " + video film" : ""}`;
    case "bouncy_castle": case "soft_play": case "ball_pit": return `${e.name}, ${x.place}`;
    default: return e.pricing.by === "children" ? `${e.name}, ${x.children} children` : e.name;
  }
}

export function experiencePriceLines(x: Experiences): { label: string; amount: number }[] {
  return x.picked.map(experienceById).filter((e): e is Experience => !!e).map((e) => ({ label: experienceLabel(e, x), amount: experiencePrice(e, x) }));
}
export const experiencesTotal = (x: Experiences) => experiencePriceLines(x).reduce((s, l) => s + l.amount, 0);

/** The old Add-ons (before 2026-11-04) as experiences: a draft kept then keeps what it had. */
const FROM_ADDON: Record<string, ExperienceId> = {
  popcorn: "popcorn", cotton_candy: "cotton_candy", photographer: "photographer", videographer: "photographer",
  mascot: "character_host", bouncy_castle: "bouncy_castle", soft_play: "soft_play", ball_pit: "ball_pit", face_painting: "face_painting",
};
export function experiencesFromAddOns(addOns: { id: string }[]): Experiences | undefined {
  const picked = Array.from(new Set(addOns.map((a) => FROM_ADDON[a.id]).filter(Boolean)));
  if (!picked.length) return undefined;
  return { ...defaultExperiences(), picked, video: addOns.some((a) => a.id === "videographer") };
}

const count = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(200, Math.round(v))) : fallback);

/** A stored experiences part read back over the defaults. */
export function readExperiences(raw: unknown): Experiences | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const base = defaultExperiences();
  const picked = Array.isArray(r.picked) ? Array.from(new Set(r.picked.filter((id): id is ExperienceId => typeof id === "string" && !!experienceById(id)))) : [];
  return {
    picked,
    children: count(r.children, base.children),
    adults: count(r.adults, base.adults),
    photoHours: PHOTO_HOURS.some((h) => h.hours === r.photoHours) ? r.photoHours as Experiences["photoHours"] : base.photoHours,
    video: r.video === true,
    popcornBoxes: r.popcornBoxes === "plain" ? "plain" : "themed",
    candyColour: CANDY_COLOURS.some((c) => c.id === r.candyColour) ? r.candyColour as Experiences["candyColour"] : base.candyColour,
    place: r.place === "outdoor" ? "outdoor" : "indoor",
  };
}
