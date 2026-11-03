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
/** 2026-11-03 (the owner: "her yere yapıştırabilsin", up to 8): figures anywhere on the cake, copies too. */
export const MAX_CAKE_FIGURES = 8;

/**
 * A figure where she put it (2026-11-03, the owner: "sürükle bırak … duplicate"): standing on the top, or stuck
 * on a tier's side. Kept in the cake's own measures, so it stays in its place when the tiers change:
 * on top — x across the top tier (−0.5 to 0.5), y its foot from the back of the top to the front (−1 to 1);
 * on a side — y its middle up the cake (0 the bottom, 1 the top), x across the tier there. s: its size (1: 100 px).
 */
export interface CakeItem { id: CakeFigure; on: "top" | "side"; x: number; y: number; s: number }

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
  /** Where she moved it: across the top tier (−0.4 to 0.4) and how high its words stand over the top, in px (none: put by itself). */
  x?: number;
  up?: number;
  /** Its size (1: as drawn). */
  s?: number;
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
  /** The figures, the back one first (0 to 8). */
  figures: CakeItem[];
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
  const own = themeFigures(seed.themeId ?? "");
  const figs = (n: number, tiers: CakeTierCount, style: CakeStyle) => topItems(own.slice(0, n), cakeStack({ tiers, style }));
  const topper = seedTopper(seed);
  const theme = seed.themeName ?? "Theme";
  const base = { topper, flavour: "vanilla" as CakeFlavour };
  return [
    { id: "classic", name: `${theme} classic`, note: "One tier, smooth, its figure on top", cake: { ...base, design: "classic", tiers: 1, style: "smooth", colours: [a, b, c], figures: figs(1, 1, "smooth") } },
    { id: "drip", name: `${theme} drip`, note: "Two tiers with a chocolate drip", cake: { ...base, design: "drip", tiers: 2, style: "drip", colours: [a, b, c], figures: figs(2, 2, "drip") } },
    { id: "ruffle", name: `${theme} ruffles`, note: "Two tiers of frilly ruffles", cake: { ...base, design: "ruffle", tiers: 2, style: "ruffles", colours: [b === WHITE ? a : b, WHITE, c], figures: figs(1, 2, "ruffles") } },
    { id: "grand", name: `${theme} grand`, note: "Three tiers of rosettes", cake: { ...base, design: "grand", tiers: 3, style: "rosettes", colours: [a, b, c], figures: figs(3, 3, "rosettes") } },
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
  // Each figure on it, its copies counted.
  for (const f of CAKE_FIGURES) {
    const n = k.figures.filter((i) => i.id === f.id).length;
    if (n) lines.push({ label: `Cake figure: ${f.name.toLowerCase()}${n > 1 ? ` ×${n}` : ""}`, amount: n * FIGURE_PRICE });
  }
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
  const tiers = CAKE_TIERS.find((x) => x.n === r.tiers)?.n ?? base.tiers;
  const style = CAKE_STYLES.find((s) => s.id === r.style)?.id ?? base.style;
  const isFigure = (f: unknown): f is CakeFigure => CAKE_FIGURES.some((x) => x.id === f);
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const list = Array.isArray(r.figures) ? r.figures.slice(0, MAX_CAKE_FIGURES) : null;
  // A cake kept before the figures could be moved (a list of names): set on top, as they were.
  const figures = !list ? base.figures : list.every((f) => typeof f === "string")
    ? topItems(Array.from(new Set(list.filter(isFigure))).slice(0, 3), cakeStack({ tiers, style }))
    : list.flatMap((f) => {
      const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
      if (!isFigure(o.id)) return [];
      const top = o.on !== "side";
      return [{ id: o.id, on: top ? "top" as const : "side" as const, x: num(o.x, -0.5, 0.5, 0), y: top ? num(o.y, -1, 1, 0.4) : num(o.y, 0, 1, 0.5), s: num(o.s, 0.3, 2.5, 0.8) }];
    });
  const up = num(t.up, 0, 400, NaN), tx = num(t.x, -0.4, 0.4, NaN), ts = num(t.s, 0.6, 1.6, NaN);
  return {
    enabled: r.enabled !== false,
    design: typeof r.design === "string" && /^[a-z]{1,16}$/.test(r.design) ? r.design : base.design,
    tiers,
    style,
    colours: colours.length ? [...colours, ...base.colours].slice(0, 3) : base.colours,
    figures,
    topper: {
      on: typeof t.on === "boolean" ? t.on : base.topper.on,
      name: typeof t.name === "string" ? t.name.replace(/[<>]/g, "").trim().slice(0, 18) : base.topper.name,
      age: t.age === "" ? "" : cleanAge(t.age) || base.topper.age,
      font: typeof t.font === "string" && /^[a-z0-9-]{1,40}$/.test(t.font) ? t.font : base.topper.font,
      colour: TOPPER_COLOURS.find((c) => c.id === t.colour)?.id ?? base.topper.colour,
      ...(Number.isNaN(tx) ? {} : { x: tx }), ...(Number.isNaN(up) ? {} : { up }), ...(Number.isNaN(ts) ? {} : { s: ts }),
    },
    flavour: CAKE_FLAVOURS.find((f) => f.id === r.flavour)?.id ?? base.flavour,
    ...(r.done === true ? { done: true } : {}),
    ...(kept && typeof kept === "object" && typeof kept.key === "string" && /^[a-z0-9]{1,13}$/.test(kept.key) && typeof kept.path === "string" && RENDER_PATH.test(kept.path)
      ? { render: { key: kept.key, path: kept.path } } : {}),
  };
}

/** Changes whenever anything that shows in the picture changes (the flavour is inside: it does not show). */
export function cakeRenderKey(k: Cake, themeId: string): string {
  const r2 = (v: number | undefined) => (v === undefined ? null : Math.round(v * 100) / 100);
  const topper = topperShows(k) ? [k.topper.name, k.topper.age, k.topper.font, k.topper.colour, r2(k.topper.x), r2(k.topper.up), r2(k.topper.s)] : null;
  const figures = k.figures.map((f) => [f.id, f.on, r2(f.x), r2(f.y), r2(f.s)]);
  const s = JSON.stringify([themeId, k.tiers, k.style, tierColours(k), figures, topper]);
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

/** The cake stacked on the stand: each tier's box and the circles it stands on and ends in, and its top's. */
export function cakeStack(k: Pick<Cake, "tiers" | "style">) {
  const { plate } = CAKE_STAND;
  const pic = tierPicture(k.style);
  const widths = TIER_WIDTHS[k.tiers];
  const k0 = widths[0] / pic.w;
  let plane = plate.y;
  let depth = 0;
  const tiers = widths.map((w) => {
    // A smaller tier is drawn less short than its width says: a cake's tiers are about as tall as each other.
    const kx = w / pic.w, ky = Math.sqrt(kx * k0);
    const t = { x: plate.x - w / 2, y: plane - pic.bottom * ky, w, h: pic.h * ky, bottom: plane, top: plane - (pic.bottom - pic.top) * ky };
    plane = t.top;
    depth = pic.top * ky * 0.85;
    return t;
  });
  const last = tiers[tiers.length - 1];
  return { pic, tiers, base: plate.y, top: last.top, topW: last.w, depth };
}
export type CakeStack = ReturnType<typeof cakeStack>;

/** One px a size of 1 is. */
export const FIGURE_TALL = 100;

/** The tier at a height (its side), or the nearest. */
const tierAt = (st: CakeStack, y: number) => st.tiers.find((t) => y >= t.top && y <= t.bottom) ?? (y < st.top ? st.tiers[st.tiers.length - 1] : st.tiers[0]);

/** Where a figure is drawn, in the stand photo's pixels. */
export function placeItem(it: CakeItem, st: CakeStack) {
  const f = figurePicture(it.id);
  const h = FIGURE_TALL * it.s, w = (f.w / f.h) * h;
  if (it.on === "top") {
    const foot = st.top + it.y * st.depth;
    return { x: CAKE_STAND.plate.x + it.x * st.topW - w / 2, y: foot - h, w, h };
  }
  const mid = st.base - it.y * (st.base - st.top);
  return { x: CAKE_STAND.plate.x + it.x * tierAt(st, mid).w - w / 2, y: mid - h / 2, w, h };
}

/** A figure moved so its middle is at (cx, cy): on the top when its foot is on it, else stuck on the side there. */
export function itemAt(it: CakeItem, st: CakeStack, cx: number, cy: number): CakeItem {
  const h = FIGURE_TALL * it.s;
  const foot = cy + h / 2;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const dx = cx - CAKE_STAND.plate.x;
  if (foot <= st.top + st.depth) {
    return { ...it, on: "top", x: clamp(dx / st.topW, -0.5, 0.5), y: clamp((foot - st.top) / st.depth, -1, 1) };
  }
  const y = clamp((st.base - cy) / (st.base - st.top), 0.03, 0.98);
  const mid = st.base - y * (st.base - st.top);
  return { ...it, on: "side", x: clamp(dx / tierAt(st, mid).w, -0.45, 0.45), y };
}

/** Figures set on the top as a cake shop would: one in the middle, two apart, three in a row. */
export function topItems(ids: CakeFigure[], st: CakeStack): CakeItem[] {
  const n = ids.length;
  // On a small top tier they keep a size of their own, standing to its edges.
  const ref = Math.max(st.topW, 210);
  const tall = ref * [0, 0.62, 0.5, 0.44][Math.min(3, n)];
  const room = ref * [0, 0.62, 0.5, 0.4][Math.min(3, n)];
  const at = [[], [0], [-0.24, 0.24], [-0.3, 0, 0.3]][Math.min(3, n)];
  return ids.slice(0, 3).map((id, i) => {
    const f = figurePicture(id);
    const s = (Math.min(tall, (room * f.h) / f.w) * (n === 3 && i === 1 ? 1.1 : 1)) / FIGURE_TALL;
    return { id, on: "top", x: (at[i] * (st.topW + ref)) / 2 / st.topW, y: n === 3 && i === 1 ? 0.7 : 0.4, s: Math.round(s * 100) / 100 };
  });
}

/** One more figure: on the top where there is room, else on the bottom tier's front. */
export function addItem(k: Pick<Cake, "tiers" | "style" | "figures">, id: CakeFigure): CakeItem[] {
  if (k.figures.length >= MAX_CAKE_FIGURES) return k.figures;
  const st = cakeStack(k);
  const f = figurePicture(id);
  const free = (spots: number[], taken: number[]) => spots.find((x) => taken.every((t) => Math.abs(t - x) > 0.18)) ?? spots[k.figures.length % spots.length];
  const top = k.figures.filter((i) => i.on === "top");
  if (top.length < 3) {
    const ref = Math.max(st.topW, 210);
    const s = Math.min(ref * 0.5, (ref * 0.5 * f.h) / f.w) / FIGURE_TALL;
    return [...k.figures, { id, on: "top", x: free([0, -0.32, 0.32], top.map((i) => i.x)), y: 0.4, s: Math.round(s * 100) / 100 }];
  }
  const t0 = st.tiers[0];
  const y = (st.base - (t0.top + t0.bottom) / 2) / (st.base - st.top);
  const side = k.figures.filter((i) => i.on === "side");
  const s = Math.min(t0.h * 0.42, (t0.w * 0.22 * f.h) / f.w) / FIGURE_TALL;
  return [...k.figures, { id, on: "side", x: free([0, -0.28, 0.28, -0.14, 0.14], side.map((i) => i.x)), y, s: Math.round(s * 100) / 100 }];
}

/** The cake's words for the render. */
export function cakeWords(k: Cake): string {
  const n = ["", "one-tier", "two-tier", "three-tier"][k.tiers];
  return `a ${n} round birthday cake, ${cakeStyle(k.style).words}`;
}
