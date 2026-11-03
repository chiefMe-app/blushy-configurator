// The cake (2026-11-03, the owner: "piñatadan sonra cake studio'ya geçelim, finalize the piñata → Cake olsun"; her
// answers: themed designs — 3–4 for every theme, each one hers to change, its words and the shapes on top — or a
// plain cake; one to three tiers, the decoration, a topper with the name and age, the flavour; the theme's colours,
// each one changeable; shown on a cake stand, close up; prices placeholders until she sends hers): the Decor
// step's sixth part, after the piñata. Pure data and sums.
import PARTS from "./cakeParts.json";
import { cleanAge } from "./pinata";

/** How it is decorated, every tier alike (public/design/cake/tier-<id>.webp, scripts/cake/build-parts.mts). */
export const CAKE_STYLES = [
  { id: "smooth", name: "Smooth", note: "Smooth buttercream, a pearl border", words: "smooth buttercream with a neat piped pearl border round the base of each tier", price: 0 },
  { id: "drip", name: "Drip", note: "A chocolate drip over each tier", words: "smooth buttercream with a glossy dark chocolate drip running down from the top edge of each tier", price: 40 },
  { id: "ruffles", name: "Ruffles", note: "Frilly buttercream ruffles all round", words: "frilly buttercream ruffles in layered rows all round each tier", price: 70 },
  { id: "rosettes", name: "Rosettes", note: "Piped buttercream roses all over", words: "buttercream rosettes piped all over each tier", price: 60 },
] as const;
export type CakeStyle = (typeof CAKE_STYLES)[number]["id"];

/** The tiers: the cake by how many (placeholders), and how many it serves. */
export const CAKE_TIERS = [
  { n: 1, name: "One tier", note: "About 12 slices", price: 380 },
  { n: 2, name: "Two tiers", note: "About 30 slices", price: 780 },
  { n: 3, name: "Three tiers", note: "About 55 slices", price: 1250 },
] as const;
export type CakeTierCount = (typeof CAKE_TIERS)[number]["n"];

/** The handmade sugar-paste figures that go on top (public/design/cake/fig-<id>.webp). */
export const CAKE_FIGURES = [
  { id: "unicorn", name: "Unicorn horn & ears" }, { id: "star", name: "Gold star" }, { id: "snowflake", name: "Snowflake" },
  { id: "crown", name: "Crown" }, { id: "heart", name: "Heart" }, { id: "rainbow", name: "Rainbow" },
  { id: "butterfly", name: "Butterfly" }, { id: "mermaid", name: "Mermaid tail" }, { id: "dinosaur", name: "Dinosaur" },
  { id: "lion", name: "Lion" }, { id: "puppy", name: "Puppy" }, { id: "kitten", name: "Kitten" },
  { id: "shark", name: "Shark" }, { id: "rocket", name: "Rocket" }, { id: "lightning", name: "Lightning bolt" },
  { id: "football", name: "Football" }, { id: "car", name: "Race car" }, { id: "treasure", name: "Treasure chest" },
  { id: "roses", name: "Sugar roses" }, { id: "pineapple", name: "Pineapple" },
] as const;
export type CakeFigure = (typeof CAKE_FIGURES)[number]["id"];
export const MAX_CAKE_FIGURES = 3;

/** Each theme's own figures, its best first; a theme of a licensed character gets plain ones that suit it. */
export const THEME_CAKE_FIGURES: Record<string, CakeFigure[]> = {
  frozen: ["snowflake", "crown", "star"], unicorn: ["unicorn", "rainbow", "star"], dinosaur: ["dinosaur", "star"], safari: ["lion", "star"],
  princess: ["crown", "heart", "roses"], superhero: ["lightning", "star"], barbie: ["heart", "crown", "roses"], bluey: ["puppy", "heart"],
  pokemon: ["lightning", "star"], stitch: ["star", "pineapple"], mermaid: ["mermaid", "shark", "star"], space: ["rocket", "star"],
  football: ["football", "star"], lego: ["star", "heart"], kpop: ["star", "heart"], encanto: ["butterfly", "roses", "star"],
  cocomelon: ["star", "heart"], teddy_bear: ["heart", "star"], pineapple_tropical: ["pineapple", "rainbow"],
  blush_garden: ["roses", "butterfly"], minecraft: ["treasure", "star"], star_wars: ["rocket", "star"],
  butterfly_fairy: ["butterfly", "rainbow", "roses"], vehicles: ["car", "star"], under_the_sea: ["shark", "mermaid"],
  circus: ["lion", "star"], ballerina: ["roses", "crown", "heart"], pirates: ["treasure", "star"], puppy_rescue: ["puppy", "heart"],
  dollhouse_kitties: ["kitten", "heart"], luxury_neutral: ["roses", "star"],
};
export const themeFigures = (themeId: string): CakeFigure[] => THEME_CAKE_FIGURES[themeId] ?? ["star", "heart"];
/** The figures in the order shown: the theme's own, then the rest. */
export function cakeFiguresFor(themeId: string) {
  const own = themeFigures(themeId);
  return [...own.map((id) => ({ ...CAKE_FIGURES.find((f) => f.id === id)!, own: true })), ...CAKE_FIGURES.filter((f) => !own.includes(f.id)).map((f) => ({ ...f, own: false }))];
}

/** What it tastes of, by name (not shown). Placeholder prices a cake. */
export const CAKE_FLAVOURS = [
  { id: "vanilla", name: "Vanilla", note: "Vanilla sponge, vanilla buttercream", price: 0 },
  { id: "chocolate", name: "Chocolate", note: "Chocolate sponge, chocolate ganache", price: 0 },
  { id: "red-velvet", name: "Red velvet", note: "With cream cheese frosting", price: 40 },
  { id: "lemon", name: "Lemon & raspberry", note: "Lemon sponge, raspberry jam", price: 30 },
  { id: "caramel", name: "Salted caramel", note: "Caramel sponge and sauce", price: 30 },
] as const;
export type CakeFlavour = (typeof CAKE_FLAVOURS)[number]["id"];

/** The topper's colours: a mirror-acrylic look. */
export const TOPPER_COLOURS = [
  { id: "gold", name: "Gold", hex: "#C9A13B", light: "#F3DC8A", words: "bright shiny mirror-gold" },
  { id: "silver", name: "Silver", hex: "#A3A9B3", light: "#EEF1F5", words: "bright shiny mirror-silver" },
  { id: "rose-gold", name: "Rose gold", hex: "#C98B7C", light: "#F4CFC4", words: "shiny mirror rose-gold" },
  { id: "white", name: "White", hex: "#F4F4F4", light: "#FFFFFF", words: "white" },
  { id: "black", name: "Black", hex: "#1F1F1F", light: "#4A4A4A", words: "glossy black" },
] as const;
export type TopperColour = (typeof TOPPER_COLOURS)[number]["id"];

export const FIGURE_PRICE = 45;
export const TOPPER_PRICE = 60;

export interface CakeTopper {
  on: boolean;
  name: string;
  /** The age, 1 to 99 ("": none). */
  age: string;
  /** A lettering font (lib/studio/tableFonts.ts). */
  font: string;
  colour: TopperColour;
}

export interface Cake {
  /** false: the customer skipped it. */
  enabled: boolean;
  /** The design it started from: one of the theme's (cakeDesigns) or "plain". */
  design: string;
  tiers: CakeTierCount;
  style: CakeStyle;
  /** Each tier's colour, the bottom one first (three kept; as many as it has tiers used). */
  colours: string[];
  /** On top, 0 to 3. */
  figures: CakeFigure[];
  topper: CakeTopper;
  flavour: CakeFlavour;
  /** The customer pressed Finish (they may still change it). */
  done?: boolean;
  /** The last render, kept in the customer's folder: cakeRenderKey of what it shows. */
  render?: { key: string; path: string };
}

const HEX = /^#[0-9A-F]{6}$/i;
const RENDER_PATH = /^[0-9a-z-]{1,64}\/[0-9a-z]{1,40}\.jpg$/i;
const WHITE = "#FFFFFF";

/** What a cake starts from: the theme, the name and age the party already has, the theme's colours. */
export interface CakeSeed { themeId?: string; themeName?: string; name?: string; age?: string; colours?: string[] }

/** Three colours from the theme (white when it has none). */
const seedColours = (seed: CakeSeed) => {
  const c = (seed.colours ?? []).filter((h) => HEX.test(h)).map((h) => h.toUpperCase());
  return [c[0] ?? "#F8BBD0", c[1] ?? c[0] ?? WHITE, c[2] ?? c[0] ?? "#F8BBD0"];
};
const seedTopper = (seed: CakeSeed): CakeTopper => ({ on: true, name: (seed.name ?? "").trim().slice(0, 18), age: cleanAge(seed.age) || "5", font: "birthstone-bounce", colour: "gold" });

/**
 * The theme's designs (her: "temalılara örnek olsun 3–4 tane, dizaynı müşteri customize edebilsin"): four
 * starting points in the theme's colours and figures — and a plain cake. Each is only where the cake starts.
 */
export function cakeDesigns(seed: CakeSeed): { id: string; name: string; note: string; cake: Omit<Cake, "enabled"> }[] {
  const [a, b, c] = seedColours(seed);
  const figs = themeFigures(seed.themeId ?? "");
  const topper = seedTopper(seed);
  const theme = seed.themeName ?? "Theme";
  const base = { topper, flavour: "vanilla" as CakeFlavour };
  return [
    { id: "classic", name: `${theme} classic`, note: "One tier, smooth, its figure on top", cake: { ...base, design: "classic", tiers: 1, style: "smooth", colours: [a, b, c], figures: figs.slice(0, 1) } },
    { id: "drip", name: `${theme} drip`, note: "Two tiers with a chocolate drip", cake: { ...base, design: "drip", tiers: 2, style: "drip", colours: [a, b, c], figures: figs.slice(0, 2) } },
    { id: "ruffle", name: `${theme} ruffles`, note: "Two tiers of frilly ruffles", cake: { ...base, design: "ruffle", tiers: 2, style: "ruffles", colours: [b === WHITE ? a : b, WHITE, c], figures: figs.slice(0, 1) } },
    { id: "grand", name: `${theme} grand`, note: "Three tiers of rosettes", cake: { ...base, design: "grand", tiers: 3, style: "rosettes", colours: [a, b, c], figures: figs.slice(0, 3) } },
    { id: "plain", name: "Plain cake", note: "White and simple — make it yours", cake: { ...base, design: "plain", tiers: 1, style: "smooth", colours: [WHITE, WHITE, WHITE], figures: [], topper: { ...topper, on: false } } },
  ];
}

export function defaultCake(seed: CakeSeed = {}): Cake {
  return { enabled: true, ...cakeDesigns(seed)[0].cake };
}

/** The colours it shows, bottom tier first. */
export const tierColours = (k: Pick<Cake, "tiers" | "colours">) => Array.from({ length: k.tiers }, (_, i) => k.colours[i] ?? k.colours[0] ?? WHITE);

export const cakeStyle = (id: CakeStyle) => CAKE_STYLES.find((s) => s.id === id) ?? CAKE_STYLES[0];
export const topperColour = (id: TopperColour) => TOPPER_COLOURS.find((c) => c.id === id) ?? TOPPER_COLOURS[0];
/** The cake itself: its tiers and its decoration on each. */
export const cakePrice = (k: Pick<Cake, "tiers" | "style">) => (CAKE_TIERS.find((t) => t.n === k.tiers)?.price ?? CAKE_TIERS[0].price) + cakeStyle(k.style).price * k.tiers;
/** The topper shows when it is on and says something. */
export const topperShows = (k: Pick<Cake, "topper">) => k.topper.on && !!(k.topper.name.trim() || k.topper.age);

export function cakePriceLines(k: Cake): { label: string; amount: number }[] {
  if (!k.enabled) return [];
  const lines = [{ label: `Cake: ${CAKE_TIERS.find((t) => t.n === k.tiers)!.name.toLowerCase()}, ${cakeStyle(k.style).name.toLowerCase()}`, amount: cakePrice(k) }];
  for (const f of k.figures) lines.push({ label: `Cake figure: ${CAKE_FIGURES.find((x) => x.id === f)!.name.toLowerCase()}`, amount: FIGURE_PRICE });
  if (topperShows(k)) lines.push({ label: "Cake topper with the name", amount: TOPPER_PRICE });
  const flavour = CAKE_FLAVOURS.find((x) => x.id === k.flavour)!;
  if (flavour.price) lines.push({ label: `Cake flavour: ${flavour.name.toLowerCase()}`, amount: flavour.price });
  return lines;
}
export const cakeTotal = (k: Cake) => cakePriceLines(k).reduce((s, l) => s + l.amount, 0);

/** A stored cake read back over the defaults. */
export function readCake(raw: unknown): Cake | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const base = defaultCake();
  const kept = r.render as Record<string, unknown> | null;
  const t = (r.topper && typeof r.topper === "object" ? r.topper : {}) as Record<string, unknown>;
  const colours = Array.isArray(r.colours) ? r.colours.filter((h): h is string => typeof h === "string" && HEX.test(h)).slice(0, 3).map((h) => h.toUpperCase()) : [];
  const figures = Array.isArray(r.figures) ? Array.from(new Set(r.figures.filter((f): f is CakeFigure => CAKE_FIGURES.some((x) => x.id === f)))).slice(0, MAX_CAKE_FIGURES) : base.figures;
  return {
    enabled: r.enabled !== false,
    design: typeof r.design === "string" && /^[a-z]{1,16}$/.test(r.design) ? r.design : base.design,
    tiers: CAKE_TIERS.find((x) => x.n === r.tiers)?.n ?? base.tiers,
    style: CAKE_STYLES.find((s) => s.id === r.style)?.id ?? base.style,
    colours: colours.length ? [...colours, ...base.colours].slice(0, 3) : base.colours,
    figures,
    topper: {
      on: typeof t.on === "boolean" ? t.on : base.topper.on,
      name: typeof t.name === "string" ? t.name.replace(/[<>]/g, "").trim().slice(0, 18) : base.topper.name,
      age: t.age === "" ? "" : cleanAge(t.age) || base.topper.age,
      font: typeof t.font === "string" && /^[a-z0-9-]{1,40}$/.test(t.font) ? t.font : base.topper.font,
      colour: TOPPER_COLOURS.find((c) => c.id === t.colour)?.id ?? base.topper.colour,
    },
    flavour: CAKE_FLAVOURS.find((f) => f.id === r.flavour)?.id ?? base.flavour,
    ...(r.done === true ? { done: true } : {}),
    ...(kept && typeof kept === "object" && typeof kept.key === "string" && /^[a-z0-9]{1,13}$/.test(kept.key) && typeof kept.path === "string" && RENDER_PATH.test(kept.path)
      ? { render: { key: kept.key, path: kept.path } } : {}),
  };
}

/** Changes whenever anything that shows in the picture changes (the flavour is inside: it does not show). */
export function cakeRenderKey(k: Cake, themeId: string): string {
  const topper = topperShows(k) ? [k.topper.name, k.topper.age, k.topper.font, k.topper.colour] : null;
  const s = JSON.stringify([themeId, k.tiers, k.style, tierColours(k), k.figures, topper]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** A tier's picture, its size and where its top and bottom circles' middles are (public/design/cake). */
export const tierPicture = (style: CakeStyle) => ({ src: `/design/cake/tier-${style}.webp`, ...(PARTS.tiers as Record<string, { w: number; h: number; top: number; bottom: number }>)[style] });
export const figurePicture = (id: CakeFigure) => ({ src: `/design/cake/fig-${id}.webp`, ...(PARTS.figures as Record<string, { w: number; h: number }>)[id] });

/**
 * The photo of the empty stand on its table (240 px of wall added above it), its plate — the middle of its top and
 * how wide it is — and the bottom of the view, below the stand's foot.
 */
export const CAKE_STAND = { src: "/design/cake/stand.webp", w: 896, h: 1392, plate: { x: 447, y: 906, w: 377 }, bottom: 1170 };
/** How wide each tier is on the stand, the bottom one first, by how many there are. */
export const TIER_WIDTHS: Record<CakeTierCount, number[]> = { 1: [280], 2: [305, 220], 3: [300, 225, 160] };

/** The cake's words for the render. */
export function cakeWords(k: Cake): string {
  const n = ["", "one-tier", "two-tier", "three-tier"][k.tiers];
  return `a ${n} round birthday cake, ${cakeStyle(k.style).words}`;
}
