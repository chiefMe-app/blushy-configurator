// The helium balloons (2026-11-04, the owner's answers when the cake was done: "oldu sanki artık geçelim diğer
// section'a" — weighted bouquets, ceiling balloons and a personalised bubble; theme-shape, age-number, name-letter
// and plain star / heart / round foils; shown in an empty pastel party room, made a real photo; prices placeholders
// until she sends hers): the Decor step's seventh part, after Cake & Sweets. Pure data and sums.
import PARTS from "./heliumParts.json";
import { cleanAge } from "./pinata";

/** The printed theme-shape foils (public/design/helium/<id>.webp, scripts/helium/build.mts). */
export const THEME_FOILS = [
  { id: "unicorn", name: "Unicorn" }, { id: "snowflake", name: "Snowflake" }, { id: "crown", name: "Crown" },
  { id: "rainbow", name: "Rainbow" }, { id: "dinosaur", name: "Dinosaur" }, { id: "lion", name: "Lion" },
  { id: "lightning", name: "Lightning bolt" }, { id: "heart-red", name: "Starry heart" }, { id: "puppy", name: "Puppy" },
  { id: "icecream", name: "Ice cream" }, { id: "mermaid", name: "Mermaid tail" }, { id: "shark", name: "Shark" },
  { id: "rocket", name: "Rocket" }, { id: "football", name: "Football" }, { id: "butterfly", name: "Butterfly" },
  { id: "cupcake", name: "Cupcake" }, { id: "treasure", name: "Treasure chest" }, { id: "kitten", name: "Kitten" },
] as const;
export type ThemeFoil = (typeof THEME_FOILS)[number]["id"];
/** The plain foils, silver in the photo and coloured in the builder. */
export const PLAIN_FOILS = [
  { id: "star", name: "Star" }, { id: "heart", name: "Heart" }, { id: "round", name: "Round" }, { id: "cloud", name: "Cloud" },
] as const;
export type PlainFoil = (typeof PLAIN_FOILS)[number]["id"];
export type FoilId = ThemeFoil | PlainFoil;
export const isPlainFoil = (id: string): id is PlainFoil => PLAIN_FOILS.some((f) => f.id === id);
export const foilName = (id: FoilId) => [...THEME_FOILS, ...PLAIN_FOILS].find((f) => f.id === id)?.name ?? "Star";

/** Each theme's own foils, its best first; a theme of a licensed character gets plain shapes that suit it. */
export const THEME_FOIL_PICKS: Record<string, ThemeFoil[]> = {
  frozen: ["snowflake", "crown"], unicorn: ["unicorn", "rainbow"], dinosaur: ["dinosaur"], safari: ["lion"],
  princess: ["crown"], superhero: ["lightning"], barbie: ["heart-red", "crown"], bluey: ["puppy"],
  pokemon: ["lightning"], stitch: ["icecream"], mermaid: ["mermaid", "shark"], space: ["rocket"],
  football: ["football"], lego: ["rocket"], kpop: ["heart-red"], encanto: ["butterfly"],
  cocomelon: ["cupcake"], teddy_bear: ["cupcake"], pineapple_tropical: ["icecream", "rainbow"],
  blush_garden: ["butterfly"], minecraft: ["treasure"], star_wars: ["rocket"], butterfly_fairy: ["butterfly", "rainbow"],
  under_the_sea: ["shark", "mermaid"], circus: ["icecream", "cupcake"], ballerina: ["crown"], pirates: ["treasure"],
  puppy_rescue: ["puppy"], dollhouse_kitties: ["kitten"],
};
/** The foils in the order shown: the theme's own, then the plain ones, then the other theme shapes. */
export function foilsFor(themeId: string) {
  const own = THEME_FOIL_PICKS[themeId] ?? [];
  return [
    ...own.map((id) => ({ ...THEME_FOILS.find((f) => f.id === id)!, own: true, plain: false })),
    ...PLAIN_FOILS.map((f) => ({ ...f, own: false, plain: true })),
    ...THEME_FOILS.filter((f) => !own.includes(f.id)).map((f) => ({ ...f, own: false, plain: false })),
  ];
}

/** The foils' colours: the plain foils, the number and the letters (silver is the photo's own). */
export const FOIL_COLOURS = [
  { hex: "#C7C9C7", name: "Silver" }, { hex: "#D9B45A", name: "Gold" }, { hex: "#D9A08E", name: "Rose gold" },
  { hex: "#F49AC1", name: "Pink" }, { hex: "#8DB8F0", name: "Blue" }, { hex: "#B9A4F2", name: "Lilac" },
  { hex: "#7FD8B4", name: "Mint" }, { hex: "#F7F7F7", name: "White" },
] as const;
export const SILVER = FOIL_COLOURS[0].hex;
export const foilColourName = (hex: string) => FOIL_COLOURS.find((c) => c.hex === hex.toUpperCase())?.name ?? "Silver";

/** A bouquet by how many latex balloons it has, under its foil (placeholder prices a bouquet). */
export const BOUQUET_SIZES = [
  { id: "small", name: "Small", balloons: 5, price: 120 },
  { id: "medium", name: "Medium", balloons: 7, price: 165 },
  { id: "large", name: "Large", balloons: 9, price: 210 },
] as const;
export type BouquetSize = (typeof BOUQUET_SIZES)[number]["id"];
export const bouquetSize = (id: BouquetSize) => BOUQUET_SIZES.find((s) => s.id === id) ?? BOUQUET_SIZES[1];
export const MAX_BOUQUETS = 6;
/** The foil on top of each bouquet: a printed theme shape, or a plain one. */
export const THEME_FOIL_PRICE = 30;
export const PLAIN_FOIL_PRICE = 15;
export const MAX_LATEX_COLOURS = 4;

/** Loose balloons against the ceiling, their ribbons hanging (placeholders). */
export const CEILING_COUNTS = [
  { count: 0, price: 0 }, { count: 25, price: 275 }, { count: 50, price: 500 }, { count: 100, price: 900 },
] as const;
export type CeilingCount = (typeof CEILING_COUNTS)[number]["count"];

/** The age as giant foil digits standing on the floor, a digit each. */
export const NUMBER_SIZES = [
  { id: "80", name: "80 cm", cm: 80, price: 85 },
  { id: "100", name: "100 cm", cm: 100, price: 120 },
] as const;
export type NumberSize = (typeof NUMBER_SIZES)[number]["id"];

/** The name in 40 cm foil letters, a letter each. */
export const LETTER_PRICE = 25;
export const LETTER_CM = 40;
export const MAX_LETTERS = 10;

/** A clear bubble balloon with the child's name on it, filled. */
export const BUBBLE_PRICE = 180;
export const BUBBLE_CM = 60;
export const BUBBLE_FILLINGS = [
  { id: "confetti", name: "Gold confetti", price: 0 },
  { id: "mini", name: "Mini balloons", price: 40 },
  { id: "feathers", name: "White feathers", price: 30 },
] as const;
export type BubbleFilling = (typeof BUBBLE_FILLINGS)[number]["id"];
export const MAX_BUBBLE_NAME = 12;

export interface Helium {
  /** false: the customer skipped it. */
  enabled: boolean;
  /** The latex balloons' colours, for the bouquets and the ceiling (1 to 4). */
  colours: string[];
  /** How many bouquets (0 to 6), their size and the foil on each. */
  bouquets: number;
  size: BouquetSize;
  topper: FoilId | "none";
  /** A plain foil's colour. */
  topperColour: string;
  number: { on: boolean; value: string; size: NumberSize; colour: string };
  letters: { on: boolean; text: string; colour: string };
  ceiling: CeilingCount;
  bubble: { on: boolean; name: string; filling: BubbleFilling; colour: string };
  /** The customer pressed Finish (they may still change it). */
  done?: boolean;
  /** The last render, kept in the customer's folder: heliumRenderKey of what it shows. */
  render?: { key: string; path: string };
}

const HEX = /^#[0-9A-F]{6}$/i;
const RENDER_PATH = /^[0-9a-z-]{1,64}\/[0-9a-z]{1,40}\.jpg$/i;

/** A name as foil letters: letters only, at most ten. */
export const cleanLetters = (v: unknown) => String(v ?? "").replace(/[^A-Za-z]/g, "").slice(0, MAX_LETTERS).toUpperCase();
/** The bubble's name: as typed, at most twelve characters. */
export const cleanBubbleName = (v: unknown) => String(v ?? "").replace(/[^A-Za-z0-9À-ɏ '&!.-]/g, "").slice(0, MAX_BUBBLE_NAME);

export function defaultHelium(seed: { themeId?: string; age?: string; name?: string; colours?: string[] } = {}): Helium {
  const colours = (seed.colours ?? []).filter((h) => HEX.test(h)).slice(0, 3);
  const own = THEME_FOIL_PICKS[seed.themeId ?? ""]?.[0];
  return {
    enabled: true,
    colours: colours.length ? colours : ["#F8BBD0", "#DDD6FE", "#BAE6FD"],
    bouquets: 2, size: "medium", topper: own ?? "star", topperColour: FOIL_COLOURS[1].hex,
    number: { on: true, value: cleanAge(seed.age) || "5", size: "80", colour: FOIL_COLOURS[1].hex },
    letters: { on: false, text: cleanLetters(seed.name), colour: FOIL_COLOURS[1].hex },
    ceiling: 0,
    bubble: { on: false, name: cleanBubbleName(seed.name), filling: "confetti", colour: "#F472B6" },
  };
}

export const topperPrice = (t: Helium["topper"]) => (t === "none" ? 0 : isPlainFoil(t) ? PLAIN_FOIL_PRICE : THEME_FOIL_PRICE);
export const numberPrice = (n: Helium["number"]) => (NUMBER_SIZES.find((s) => s.id === n.size)?.price ?? 85) * n.value.length;
export const ceilingPrice = (c: CeilingCount) => CEILING_COUNTS.find((x) => x.count === c)?.price ?? 0;

export function heliumPriceLines(h: Helium): { label: string; amount: number }[] {
  if (!h.enabled) return [];
  const lines: { label: string; amount: number }[] = [];
  if (h.bouquets > 0) {
    const s = bouquetSize(h.size);
    const each = s.price + topperPrice(h.topper);
    const foil = h.topper === "none" ? "" : `, ${foilName(h.topper).toLowerCase()} foil`;
    lines.push({ label: `${h.bouquets} helium bouquet${h.bouquets > 1 ? "s" : ""}, ${s.balloons} balloons${foil}`, amount: each * h.bouquets });
  }
  if (h.number.on && h.number.value) lines.push({ label: `Foil number "${h.number.value}", ${h.number.size} cm`, amount: numberPrice(h.number) });
  if (h.letters.on && h.letters.text) lines.push({ label: `Foil letters "${h.letters.text}"`, amount: LETTER_PRICE * h.letters.text.length });
  if (h.ceiling) lines.push({ label: `${h.ceiling} ceiling balloons`, amount: ceilingPrice(h.ceiling) });
  if (h.bubble.on) {
    const f = BUBBLE_FILLINGS.find((x) => x.id === h.bubble.filling)!;
    lines.push({ label: `Name bubble balloon${h.bubble.name ? ` "${h.bubble.name}"` : ""}, ${f.name.toLowerCase()}`, amount: BUBBLE_PRICE + f.price });
  }
  return lines;
}
export const heliumTotal = (h: Helium) => heliumPriceLines(h).reduce((s, l) => s + l.amount, 0);
/** Nothing chosen yet: no bouquet, number, letters, ceiling or bubble. */
export const heliumEmpty = (h: Helium) => !h.bouquets && !(h.number.on && h.number.value) && !(h.letters.on && h.letters.text) && !h.ceiling && !h.bubble.on;

const foilColour = (v: unknown, fallback: string) => (typeof v === "string" && FOIL_COLOURS.some((c) => c.hex === v.toUpperCase()) ? v.toUpperCase() : fallback);

/** A stored helium part read back over the defaults. */
export function readHelium(raw: unknown): Helium | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const base = defaultHelium();
  const obj = (v: unknown) => (v && typeof v === "object" ? v as Record<string, unknown> : {});
  const n = obj(r.number), l = obj(r.letters), b = obj(r.bubble);
  const kept = r.render as Record<string, unknown> | null;
  const colours = Array.isArray(r.colours) ? r.colours.filter((h): h is string => typeof h === "string" && HEX.test(h)).slice(0, MAX_LATEX_COLOURS) : [];
  const topper = typeof r.topper === "string" && (r.topper === "none" || [...THEME_FOILS, ...PLAIN_FOILS].some((f) => f.id === r.topper)) ? r.topper as Helium["topper"] : base.topper;
  return {
    enabled: r.enabled !== false,
    colours: colours.length ? colours : base.colours,
    bouquets: Math.max(0, Math.min(MAX_BOUQUETS, Math.round(Number(r.bouquets ?? base.bouquets)) || 0)),
    size: BOUQUET_SIZES.find((s) => s.id === r.size)?.id ?? base.size,
    topper,
    topperColour: foilColour(r.topperColour, base.topperColour),
    number: {
      on: n.on === true, value: cleanAge(n.value) || base.number.value,
      size: NUMBER_SIZES.find((s) => s.id === n.size)?.id ?? base.number.size, colour: foilColour(n.colour, base.number.colour),
    },
    letters: { on: l.on === true, text: cleanLetters(l.text), colour: foilColour(l.colour, base.letters.colour) },
    ceiling: CEILING_COUNTS.find((c) => c.count === r.ceiling)?.count ?? 0,
    bubble: {
      on: b.on === true, name: cleanBubbleName(b.name),
      filling: BUBBLE_FILLINGS.find((f) => f.id === b.filling)?.id ?? base.bubble.filling,
      colour: typeof b.colour === "string" && HEX.test(b.colour) ? b.colour.toUpperCase() : base.bubble.colour,
    },
    ...(r.done === true ? { done: true } : {}),
    ...(kept && typeof kept === "object" && typeof kept.key === "string" && /^[a-z0-9]{1,13}$/.test(kept.key) && typeof kept.path === "string" && RENDER_PATH.test(kept.path)
      ? { render: { key: kept.key, path: kept.path } } : {}),
  };
}

/** Changes whenever anything that shows in the picture changes. */
export function heliumRenderKey(h: Helium, themeId: string): string {
  const { done: _d, render: _r, enabled: _e, ...shown } = h;
  const s = JSON.stringify([themeId, shown]);
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 0x01000193);
  return (x >>> 0).toString(36);
}

/** A foil's or latex balloon's picture and its size (public/design/helium). */
export const heliumPicture = (id: string) => ({ src: `/design/helium/${id}.webp`, ...(PARTS as Record<string, { w: number; h: number }>)[id] });
export const LATEX = ["latex-a", "latex-b", "latex-c", "latex-d"] as const;

/**
 * The empty room (scripts/helium/sources/room.png): its ceiling meets the wall at `ceiling`, the wall meets the
 * floor at `base`; things stand on the floor at `floor`; a centimetre is `perCm` pixels at the wall (about 2.4 m
 * tall: at the photo's own 2.8 m the balloons were lost in it); the picture shows `view` of it, the room's middle.
 */
export const HELIUM_ROOM = { src: "/design/helium/room.webp", w: 1344, h: 1008, ceiling: 155, base: 810, floor: 880, perCm: 2.7, view: { x: 130, y: 20, w: 1084, h: 940 } };

/** What is in the picture, in words, for the render. */
export function heliumWords(h: Helium): string[] {
  const out: string[] = [];
  if (h.bouquets > 0) {
    const s = bouquetSize(h.size);
    const foil = h.topper === "none" ? "" : isPlainFoil(h.topper)
      ? ` with a ${foilColourName(h.topperColour).toLowerCase()} ${h.topper} foil balloon on top`
      : ` with a printed ${foilName(h.topper).toLowerCase()} shaped foil balloon on top`;
    out.push(`${h.bouquets} helium balloon bouquet${h.bouquets > 1 ? "s" : ""} standing on the floor, each ${s.balloons} matte latex balloons${foil}, their ribbons gathered down to a small balloon weight on the floor`);
  }
  if (h.number.on && h.number.value) out.push(`a giant ${foilColourName(h.number.colour).toLowerCase()} foil number ${h.number.value} balloon, ${h.number.size} cm tall, standing on the floor`);
  if (h.letters.on && h.letters.text) out.push(`the name ${h.letters.text} in ${foilColourName(h.letters.colour).toLowerCase()} foil letter balloons, 40 cm each, in a row on the wall`);
  if (h.ceiling) out.push(`about ${h.ceiling} loose latex helium balloons floating against the ceiling, their thin ribbons hanging down`);
  if (h.bubble.on) {
    const f = { confetti: "gold confetti", mini: "small pastel balloons", feathers: "white feathers" }[h.bubble.filling];
    out.push(`a big clear bubble balloon filled with ${f}${h.bubble.name ? `, the name "${h.bubble.name}" on it in vinyl script lettering` : ""}, floating on a ribbon tied to a weight`);
  }
  return out;
}
