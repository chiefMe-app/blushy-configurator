// The sweets beside the cake (2026-11-03, the owner: "cupcake, cookie, cake pops opsiyonları da olmalı … ve donut";
// "macaron da olabilir"; her answers: inside the cake part, on the same table beside the stand; how many, a colour, a theme topper or print,
// sprinkles; prices placeholders). Each is one photo of a few on a gold stand or plate with plain white icing
// (scripts/cake/sources/sweet-<id>.png), its icing coloured through a mask; how many she orders is the count.
import PARTS from "./cakeParts.json";
import { CAKE_FIGURES, type CakeFigure } from "./cake";

export const CAKE_SWEETS = [
  { id: "cupcakes", name: "Cupcakes", note: "A swirl of buttercream, on a gold stand", each: 12, topper: "figure",
    words: (c: string) => `cupcakes in gold foil liners, each with a tall swirl of ${c} buttercream, on a small two-tier gold cupcake stand` },
  { id: "cakepops", name: "Cake pops", note: "Dipped in candy coating, on gold sticks", each: 9, topper: null,
    words: (c: string) => `cake pops dipped in smooth glossy ${c} candy coating on thin gold sticks in a round gold stand` },
  { id: "cookies", name: "Iced cookies", note: "Smooth royal icing, a print or the age on each", each: 10, topper: "print",
    words: (c: string) => `round sugar cookies with smooth flat ${c} royal icing on a gold plate` },
  { id: "donuts", name: "Donuts", note: "Glossy glaze, on a low gold stand", each: 11, topper: null,
    words: (c: string) => `ring donuts with glossy ${c} glaze on a low gold cake stand` },
  // 2026-11-03 (the owner: "macaron da olabilir").
  { id: "macarons", name: "Macarons", note: "French macarons, in front of the cake", each: 8, topper: null,
    words: (c: string) => `French macarons with ${c} shells and filling, set on the table in front of the cake stand` },
] as const;
export type SweetId = (typeof CAKE_SWEETS)[number]["id"];
/** How many: by the half dozen. */
export const SWEET_COUNTS = [6, 12, 24] as const;

export interface CakeSweet {
  id: SweetId;
  count: (typeof SWEET_COUNTS)[number];
  /** The icing's colour (a hex). */
  colour: string;
  sprinkles?: boolean;
  /** Cupcakes: a little figure or cutout on each. */
  topper?: CakeFigure;
  /** Cookies: a picture or the age printed on each. */
  print?: CakeFigure | "age";
}

export const SPRINKLE_PRICE = 1;
export const sweetOf = (id: SweetId) => CAKE_SWEETS.find((s) => s.id === id)!;

/** Each sweet's photo and its icing's, and the size of them. */
export const sweetPicture = (id: SweetId) => ({
  src: `/design/cake/sweet-${id}.webp`, icing: `/design/cake/sweet-${id}-icing.webp`, ...(PARTS.sweets as Record<string, { w: number; h: number }>)[id],
});

/**
 * Where each piece's top is in its photo, as fractions of it (measured by eye: the icing runs together): a cupcake's
 * swirl tip (a topper stands there); a cookie's middle and how wide its face is (its print).
 */
export const SWEET_SPOTS: Partial<Record<SweetId, { x: number; y: number; w: number }[]>> = {
  cupcakes: [
    { x: 0.33, y: 0.03, w: 0.16 }, { x: 0.55, y: 0.04, w: 0.16 }, { x: 0.2, y: 0.09, w: 0.17 }, { x: 0.76, y: 0.12, w: 0.17 }, { x: 0.46, y: 0.17, w: 0.18 },
    { x: 0.12, y: 0.53, w: 0.17 }, { x: 0.82, y: 0.58, w: 0.17 }, { x: 0.31, y: 0.6, w: 0.18 }, { x: 0.56, y: 0.62, w: 0.18 },
  ],
  cookies: [
    { x: 0.505, y: 0.235, w: 0.36 }, { x: 0.84, y: 0.36, w: 0.26 }, { x: 0.195, y: 0.59, w: 0.3 }, { x: 0.73, y: 0.63, w: 0.38 }, { x: 0.395, y: 0.74, w: 0.36 },
  ],
};

/**
 * Where each stands on the table beside the cake stand, in the stand photo's pixels: its middle, its foot, how tall.
 * The tall ones at the back, the low ones in front.
 */
export const SWEET_PLACES: Record<SweetId, { x: number; foot: number; tall: number }> = {
  cupcakes: { x: 178, foot: 1135, tall: 228 },
  cakepops: { x: 722, foot: 1135, tall: 205 },
  cookies: { x: 205, foot: 1232, tall: 112 },
  donuts: { x: 698, foot: 1236, tall: 138 },
  macarons: { x: 448, foot: 1238, tall: 80 },
};

export const sweetPrice = (s: CakeSweet) => s.count * (sweetOf(s.id).each + (s.sprinkles ? SPRINKLE_PRICE : 0));

export function sweetPriceLines(sweets: CakeSweet[] = []): { label: string; amount: number }[] {
  return CAKE_SWEETS.flatMap((k) => {
    const s = sweets.find((x) => x.id === k.id);
    return s ? [{ label: `${k.name} ×${s.count}${s.sprinkles ? ", sprinkles" : ""}`, amount: sweetPrice(s) }] : [];
  });
}

const HEX = /^#[0-9A-F]{6}$/i;

/** Stored sweets read back: each kind once, its count, colour and topper as they may be. */
export function readSweets(raw: unknown): CakeSweet[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const isFigure = (f: unknown): f is CakeFigure => CAKE_FIGURES.some((x) => x.id === f && x.kind !== "deco");
  const out: CakeSweet[] = [];
  for (const r of raw) {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const k = CAKE_SWEETS.find((s) => s.id === o.id);
    if (!k || out.some((s) => s.id === k.id)) continue;
    out.push({
      id: k.id,
      count: SWEET_COUNTS.find((n) => n === o.count) ?? 12,
      colour: typeof o.colour === "string" && HEX.test(o.colour) ? o.colour.toUpperCase() : "#FFFFFF",
      ...(o.sprinkles === true ? { sprinkles: true } : {}),
      ...(k.topper === "figure" && isFigure(o.topper) ? { topper: o.topper } : {}),
      ...(k.topper === "print" && (o.print === "age" || isFigure(o.print)) ? { print: o.print as CakeSweet["print"] } : {}),
    });
  }
  return out;
}

/** A colour's name for the render (the theme's hexes have none): near what it is. */
export function colourWords(hex: string): string {
  const h = hex.toUpperCase();
  if (h === "#FFFFFF") return "white";
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510;
  if (max - min < 24) return l > 0.85 ? "white" : l > 0.4 ? "grey" : "black";
  let hue = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  const name = hue < 15 || hue >= 340 ? (l > 0.7 ? "pink" : "red") : hue < 40 ? (l > 0.7 ? "peach" : "orange") : hue < 65 ? "yellow" : hue < 165 ? (l > 0.7 ? "mint green" : "green")
    : hue < 200 ? (l > 0.7 ? "aqua" : "teal") : hue < 250 ? (l > 0.7 ? "baby blue" : "blue") : hue < 290 ? (l > 0.7 ? "lilac" : "purple") : l > 0.7 ? "pink" : "fuchsia";
  return `${l > 0.78 && !/pink|peach|mint|aqua|baby|lilac/.test(name) ? "pastel " : ""}${name}`;
}
