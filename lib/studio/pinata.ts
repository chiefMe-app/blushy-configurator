// The piñata (2026-11-03, the owner: "şimdi piñata studio'ya geçelim, sonra da cake studio"; her answers: a number
// piñata — the child's age — or a theme shape; opened by pull strings or with a stick, both offered; shown hung on
// a stand in a party room; prices placeholders until she sends hers): the Decor step's fifth part, after the
// giveaways. One piñata, medium or large: its shape (the age in up to three colours, or a fringe shape — the theme's
// own first, never a licensed character), how it opens, and what is inside it as a list. Pure data and sums.
import SHAPES from "./pinataShapes.json";

export const PINATA_KINDS = [
  { id: "number", name: "Number", note: "The age, in the colours you pick" },
  { id: "shape", name: "Theme shape", note: "A fringe shape for your theme" },
] as const;
export type PinataKind = (typeof PINATA_KINDS)[number]["id"];

/** The fringe shapes (public/design/pinata/<id>.webp, scripts/pinata/build-shapes.mts). */
export const PINATA_SHAPES = [
  { id: "unicorn", name: "Unicorn" }, { id: "snowflake", name: "Snowflake" }, { id: "crown", name: "Crown" },
  { id: "heart", name: "Heart" }, { id: "star", name: "Star" }, { id: "rainbow", name: "Rainbow" },
  { id: "butterfly", name: "Butterfly" }, { id: "mermaid", name: "Mermaid tail" }, { id: "dinosaur", name: "Dinosaur" },
  { id: "lion", name: "Lion" }, { id: "puppy", name: "Puppy" }, { id: "kitten", name: "Kitten" },
  { id: "shark", name: "Shark" }, { id: "rocket", name: "Rocket" }, { id: "lightning", name: "Lightning bolt" },
  { id: "football", name: "Football" }, { id: "car", name: "Race car" }, { id: "treasure", name: "Treasure chest" },
  { id: "cupcake", name: "Cupcake" }, { id: "icecream", name: "Ice cream" },
] as const;
export type PinataShape = (typeof PINATA_SHAPES)[number]["id"];

/** Each theme's own shapes, its best first; a theme of a licensed character gets a plain shape that suits it. */
export const THEME_PINATAS: Record<string, PinataShape[]> = {
  frozen: ["snowflake", "crown"], unicorn: ["unicorn", "rainbow"], dinosaur: ["dinosaur"], safari: ["lion"],
  princess: ["crown", "heart"], superhero: ["lightning", "star"], barbie: ["heart", "crown"], bluey: ["puppy"],
  pokemon: ["lightning", "star"], stitch: ["star", "icecream"], mermaid: ["mermaid", "shark"], space: ["rocket", "star"],
  football: ["football"], lego: ["star"], kpop: ["star", "heart"], encanto: ["butterfly", "star"],
  cocomelon: ["cupcake", "star"], teddy_bear: ["heart", "cupcake"], pineapple_tropical: ["icecream", "rainbow"],
  blush_garden: ["butterfly", "heart"], minecraft: ["treasure"], star_wars: ["rocket", "star"],
  butterfly_fairy: ["butterfly", "rainbow"], vehicles: ["car"], under_the_sea: ["shark", "mermaid"],
  circus: ["icecream", "cupcake"], ballerina: ["heart", "crown"], pirates: ["treasure"], puppy_rescue: ["puppy"],
  dollhouse_kitties: ["kitten", "heart"], luxury_neutral: ["star", "heart"],
};
/**
 * A new theme brings its own shape (2026-11-05, the owner: "pinata kar tanesi şeklinde kalmış" — a Frozen snowflake
 * stayed on a Unicorn party): a shape of the old theme's own becomes the new theme's first; one she picked from the
 * rest stays.
 */
export function pinataForTheme(p: Pinata, from: string, to: string): Pinata {
  const old = THEME_PINATAS[from] ?? ["star"], own = THEME_PINATAS[to] ?? ["star"];
  return from !== to && old.includes(p.shape) && !own.includes(p.shape) ? { ...p, shape: own[0], shapeTheme: to } : p;
}
/**
 * The piñata of a design opened again (2026-11-07, the owner: "pinata bozuk" — a Unicorn party's piñata still a
 * Frozen snowflake, made before the theme carried its shape over): the theme its shape was chosen in, when it is
 * not this one, gives way as a theme change does. A piñata kept before that was noted (`shapeTheme`) whose shape is
 * another theme's first — the one that theme starts with — and not this theme's own was that theme's.
 */
export function pinataOnOpen(p: Pinata, themeId: string): Pinata {
  const own = THEME_PINATAS[themeId] ?? ["star"];
  const from = p.shapeTheme ?? (own.includes(p.shape) ? themeId : Object.keys(THEME_PINATAS).find((t) => THEME_PINATAS[t][0] === p.shape) ?? themeId);
  const q = pinataForTheme(p, from, themeId);
  return q !== p ? q : p.shapeTheme ? p : { ...p, shapeTheme: from };
}
/** The shapes in the order shown: the theme's own, then the rest. */
export function pinataShapesFor(themeId: string) {
  const own = THEME_PINATAS[themeId] ?? ["star"];
  return [...own.map((id) => ({ ...PINATA_SHAPES.find((s) => s.id === id)!, own: true })), ...PINATA_SHAPES.filter((s) => !own.includes(s.id)).map((s) => ({ ...s, own: false }))];
}

export const PINATA_OPENINGS = [
  { id: "pull", name: "Pull strings", note: "Ribbons underneath — one opens it. Safe for little ones", price: 0 },
  { id: "stick", name: "Stick & blindfold", note: "The classic: they take turns to break it open", price: 35 },
] as const;
export type PinataOpening = (typeof PINATA_OPENINGS)[number]["id"];

/** What goes in it, by name (no pictures for now). Placeholder prices a piñata. */
export const PINATA_FILLINGS = [
  { id: "candy", name: "Candy", note: "About 1 kg of sweets", price: 60 },
  { id: "chocolates", name: "Chocolates", note: "Wrapped mini chocolates", price: 55 },
  { id: "toys", name: "Small toys", note: "Little toys in the theme", price: 70 },
  { id: "stickers", name: "Stickers & tattoos", note: "In the theme", price: 20 },
  { id: "confetti", name: "Confetti", note: "A burst of paper confetti", price: 15 },
] as const;
export type PinataFilling = (typeof PINATA_FILLINGS)[number]["id"];

/** Its size (2026-11-03, the owner: "size seçilsin, medium ve large iki size olsun"), how tall. */
export const PINATA_SIZES = [
  { id: "medium", name: "Medium", note: "About 50 cm", cm: 50 },
  { id: "large", name: "Large", note: "About 75 cm", cm: 75 },
] as const;
export type PinataSize = (typeof PINATA_SIZES)[number]["id"];

/** A number piñata of one digit, and each digit more; a theme shape — by size (placeholders). */
export const NUMBER_PINATA_PRICE: Record<PinataSize, number> = { medium: 220, large: 320 };
export const EXTRA_DIGIT_PRICE: Record<PinataSize, number> = { medium: 150, large: 220 };
export const SHAPE_PINATA_PRICE: Record<PinataSize, number> = { medium: 250, large: 360 };
/** The piñata itself, by its shape, digits and size. */
export const pinataPrice = (p: Pick<Pinata, "kind" | "number" | "size">) =>
  p.kind === "number" ? NUMBER_PINATA_PRICE[p.size] + Math.max(0, p.number.length - 1) * EXTRA_DIGIT_PRICE[p.size] : SHAPE_PINATA_PRICE[p.size];
export const pinataSize = (id: PinataSize) => PINATA_SIZES.find((s) => s.id === id) ?? PINATA_SIZES[0];
/** Colours a number piñata's fringe comes in, in bands top to bottom. */
export const MAX_PINATA_COLOURS = 3;

export interface Pinata {
  /** false: the customer skipped it. */
  enabled: boolean;
  kind: PinataKind;
  /** The number piñata's digits: the age, 1 to 99. */
  number: string;
  /** Its fringe, in bands top to bottom (1 to 3). */
  colours: string[];
  /** The theme-shape piñata. */
  shape: PinataShape;
  /** The theme the shape was chosen in (2026-11-07): another theme's own shape gives way to this theme's. */
  shapeTheme?: string;
  size: PinataSize;
  opening: PinataOpening;
  fillings: PinataFilling[];
  /** The customer pressed Finish (they may still change it). */
  done?: boolean;
  /** The last render, kept in the customer's folder: pinataRenderKey of what it shows. */
  render?: { key: string; path: string };
}

/** The age as digits, 1 to 99 ("" when none). */
export const cleanAge = (v: unknown) => {
  const n = Math.round(Number(String(v ?? "").replace(/[^0-9]/g, "").slice(0, 2)));
  return n >= 1 && n <= 99 ? String(n) : "";
};

export function defaultPinata(seed: { themeId?: string; age?: string; colours?: string[] } = {}): Pinata {
  const colours = (seed.colours ?? []).filter((h) => HEX.test(h)).slice(0, MAX_PINATA_COLOURS);
  return {
    enabled: true, kind: "number", number: cleanAge(seed.age) || "5", colours: colours.length ? colours : ["#F8BBD0", "#DDD6FE", "#BAE6FD"],
    shape: (THEME_PINATAS[seed.themeId ?? ""] ?? ["star"])[0], size: "medium", opening: "pull", fillings: ["candy", "toys", "confetti"],
    ...(seed.themeId ? { shapeTheme: seed.themeId } : {}),
  };
}

export function pinataPriceLines(p: Pinata): { label: string; amount: number }[] {
  if (!p.enabled) return [];
  const size = pinataSize(p.size).name.toLowerCase();
  const lines = [{ label: p.kind === "number" ? `Number piñata "${p.number}", ${size}` : `${PINATA_SHAPES.find((s) => s.id === p.shape)?.name ?? "Shape"} piñata, ${size}`, amount: pinataPrice(p) }];
  const opening = PINATA_OPENINGS.find((o) => o.id === p.opening)!;
  if (opening.price) lines.push({ label: `Piñata ${opening.name.toLowerCase()}`, amount: opening.price });
  for (const f of PINATA_FILLINGS.filter((x) => p.fillings.includes(x.id))) lines.push({ label: `Piñata filling: ${f.name.toLowerCase()}`, amount: f.price });
  return lines;
}
export const pinataTotal = (p: Pinata) => pinataPriceLines(p).reduce((s, l) => s + l.amount, 0);

const HEX = /^#[0-9A-F]{6}$/i;
const RENDER_PATH = /^[0-9a-z-]{1,64}\/[0-9a-z]{1,40}\.jpg$/i;

/** A stored piñata read back over the defaults. */
export function readPinata(raw: unknown): Pinata | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const base = defaultPinata();
  const kept = r.render as Record<string, unknown> | null;
  const colours = Array.isArray(r.colours) ? r.colours.filter((h): h is string => typeof h === "string" && HEX.test(h)).slice(0, MAX_PINATA_COLOURS) : [];
  return {
    enabled: r.enabled !== false,
    kind: PINATA_KINDS.find((k) => k.id === r.kind)?.id ?? base.kind,
    number: cleanAge(r.number) || base.number,
    colours: colours.length ? colours : base.colours,
    shape: PINATA_SHAPES.find((s) => s.id === r.shape)?.id ?? base.shape,
    ...(typeof r.shapeTheme === "string" && /^[a-z_]{1,40}$/.test(r.shapeTheme) ? { shapeTheme: r.shapeTheme } : {}),
    size: PINATA_SIZES.find((s) => s.id === r.size)?.id ?? base.size,
    opening: PINATA_OPENINGS.find((o) => o.id === r.opening)?.id ?? base.opening,
    fillings: Array.isArray(r.fillings) ? PINATA_FILLINGS.filter((f) => (r.fillings as unknown[]).includes(f.id)).map((f) => f.id) : base.fillings,
    ...(r.done === true ? { done: true } : {}),
    ...(kept && typeof kept === "object" && typeof kept.key === "string" && /^[a-z0-9]{1,13}$/.test(kept.key) && typeof kept.path === "string" && RENDER_PATH.test(kept.path)
      ? { render: { key: kept.key, path: kept.path } } : {}),
  };
}

/** Changes whenever anything that shows in the picture changes (the fillings are a list: they do not show). */
export function pinataRenderKey(p: Pinata, themeId: string): string {
  const shown = p.kind === "number" ? { kind: p.kind, number: p.number, colours: p.colours } : { kind: p.kind, shape: p.shape };
  const s = JSON.stringify([themeId, shown, p.opening, p.size]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** The shape's or digit's picture and its size (public/design/pinata). */
export const shapePicture = (id: string) => ({ src: `/design/pinata/${id}.webp`, ...(SHAPES.shapes as Record<string, { w: number; h: number }>)[id] });
export const digitPicture = (d: string) => ({ src: `/design/pinata/digit-${d}.webp`, ...(SHAPES.digits as Record<string, { w: number; h: number }>)[d] });

/**
 * The room photo (an empty white piñata stand, its hook on the crossbar) and where things go in it: the hook, the
 * floor at the stand's feet, and how many pixels a centimetre is there (the stand is about 2 m: 800 px).
 */
export const PINATA_ROOM = { src: "/design/pinata/room.webp", w: 896, h: 1152, hook: { x: 446, y: 272 }, floor: 1000, legs: [262, 630], perCm: 4 };

/** The piñata's words for the render. */
export function pinataWords(p: Pinata): string {
  return p.kind === "number" ? `a number piñata in the shape of the number ${p.number}, covered in tissue-paper fringe` : `a ${PINATA_SHAPES.find((s) => s.id === p.shape)?.name.toLowerCase()} piñata covered in tissue-paper fringe`;
}
