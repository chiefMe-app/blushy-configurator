// The grown-ups' table (2026-10-31, the owner: "adult table setup kısmı da
// olsun, ama kids kısmının bütün seçimleri yapıldıktan sonra sorulsun"):
// asked once the kids' table is finished (or skipped), optional, in the same
// one-page way. The adult pieces the kids' table left out live here: charger
// plates, a runner, glasses, name cards, chair bows. Drawn pictures and
// placeholder prices until the owner sends her own (2026-10-27: "drawing
// first, render later"). Pure data and sums.
import { NONE, type TableItemKey } from "./tableCatalog";

/** The adults' items, keyed like the kids' table so the drawings are shared (components/studio/table/glyphs.tsx). */
export type AdultItemKey = Extract<TableItemKey, "table" | "chairs" | "tablecloth" | "runner" | "napkins" | "chargers" | "plates" | "cups" | "cutlery" | "centrepiece" | "nameCards" | "chairDecor">;

export interface AdultOption {
  id: string;
  name: string;
  note: string;
  /** AED — placeholders until the owner prices them (TO CONFIRM). */
  price: number;
  unit: "per_table" | "per_guest";
  /** Guests at one table (tables only). */
  seats?: number;
  /** The option takes the item's colour. */
  coloured?: boolean;
}

export interface AdultItem {
  key: AdultItemKey;
  label: string;
  optional: boolean;
  options: AdultOption[];
}

export const ADULT_ITEMS: AdultItem[] = [
  { key: "table", label: "Table", optional: false, options: [
    { id: "banquet", name: "Long table", note: "Guests both sides · 10 a table", price: 150, unit: "per_table", seats: 10 },
    { id: "round", name: "Round table", note: "A circle of 8", price: 150, unit: "per_table", seats: 8 },
  ] },
  { key: "chairs", label: "Chairs", optional: false, options: [
    { id: "gold_chiavari", name: "Gold chiavari", note: "With a white cushion", price: 20, unit: "per_guest" },
    { id: "white_chiavari", name: "White chiavari", note: "With a white cushion", price: 20, unit: "per_guest" },
  ] },
  { key: "tablecloth", label: "Tablecloth", optional: true, options: [
    { id: "classic", name: "Floor-length cloth", note: "In a colour you pick", price: 60, unit: "per_table", coloured: true },
  ] },
  { key: "runner", label: "Runner", optional: true, options: [
    { id: "satin", name: "Satin runner", note: "Down the middle, in a colour you pick", price: 35, unit: "per_table", coloured: true },
    { id: "greenery", name: "Greenery runner", note: "Eucalyptus leaves along the table", price: 150, unit: "per_table" },
  ] },
  { key: "napkins", label: "Napkins", optional: false, options: [
    { id: "folded", name: "Linen napkin", note: "Folded, in a colour you pick", price: 4, unit: "per_guest", coloured: true },
    { id: "bow", name: "Napkin with a bow", note: "Tied with a ribbon", price: 6, unit: "per_guest", coloured: true },
  ] },
  { key: "chargers", label: "Charger plates", optional: true, options: [
    { id: "gold", name: "Gold charger", note: "A gold plate under the plate", price: 12, unit: "per_guest" },
    { id: "rattan", name: "Rattan charger", note: "Woven, natural", price: 10, unit: "per_guest" },
    { id: "beaded", name: "Beaded glass charger", note: "Clear with a beaded rim", price: 12, unit: "per_guest" },
  ] },
  { key: "plates", label: "Plates", optional: false, options: [
    { id: "white_gold", name: "White & gold plates", note: "Porcelain with a gold rim", price: 8, unit: "per_guest" },
    { id: "pastel", name: "Pastel plates", note: "Soft colours round the table", price: 6, unit: "per_guest" },
  ] },
  { key: "cups", label: "Glasses", optional: false, options: [
    { id: "gold_rim", name: "Gold-rim glass", note: "Clear, with a gold rim", price: 6, unit: "per_guest" },
    { id: "iridescent", name: "Iridescent glass", note: "A soft rainbow shine", price: 7, unit: "per_guest" },
  ] },
  { key: "cutlery", label: "Cutlery", optional: false, options: [
    { id: "gold", name: "Gold cutlery", note: "Knife, fork and spoon", price: 8, unit: "per_guest" },
    { id: "silver", name: "Silver cutlery", note: "Knife, fork and spoon", price: 6, unit: "per_guest" },
  ] },
  { key: "centrepiece", label: "Centrepiece", optional: true, options: [
    { id: "florals", name: "Fresh florals", note: "Low arrangements along the table", price: 120, unit: "per_table" },
    { id: "balloons", name: "Balloon bunch", note: "Mini balloons in the theme", price: 60, unit: "per_table" },
  ] },
  { key: "nameCards", label: "Name cards", optional: true, options: [
    { id: "tent", name: "Tent card", note: "A folded card at each place", price: 4, unit: "per_guest" },
    { id: "acrylic", name: "Acrylic name tag", note: "Clear, lettered in white", price: 8, unit: "per_guest" },
  ] },
  { key: "chairDecor", label: "Chair decoration", optional: true, options: [
    { id: "tulle_bow", name: "Tulle bow", note: "Tied on the chair back", price: 10, unit: "per_guest" },
  ] },
];

export const ADULT_SECTIONS: { name: string; items: AdultItemKey[] }[] = [
  { name: "Table & chairs", items: ["table", "chairs"] },
  { name: "Linens", items: ["tablecloth", "runner", "napkins"] },
  { name: "Tableware", items: ["chargers", "plates", "cups", "cutlery"] },
  { name: "Decor", items: ["centrepiece", "nameCards", "chairDecor"] },
];

export const adultItem = (key: AdultItemKey) => ADULT_ITEMS.find((i) => i.key === key)!;
export const adultOption = (key: AdultItemKey, id: string) => adultItem(key).options.find((o) => o.id === id);

/** Which colour each coloured item takes. */
export const ADULT_COLOUR_OF = { tablecloth: "clothColor", runner: "runnerColor", napkins: "napkinColor" } as const satisfies Partial<Record<AdultItemKey, keyof AdultTable>>;

export interface AdultTable {
  /** false: the customer skipped it. */
  enabled: boolean;
  guests: number;
  choices: Record<AdultItemKey, string>;
  clothColor: string;
  runnerColor: string;
  napkinColor: string;
  /** The customer pressed Finish (they may still change it). */
  done?: boolean;
}

export const MIN_GUESTS = 4;
export const MAX_GUESTS = 60;
export const clampGuests = (n: number) => Math.max(MIN_GUESTS, Math.min(MAX_GUESTS, Math.round(Number.isFinite(n) ? n : MIN_GUESTS)));

/** A new grown-ups' table: elegant, in the theme's colours. */
export function defaultAdultTable(theme: { balloonColors: string[]; accent: string }): AdultTable {
  return {
    enabled: true,
    guests: 10,
    choices: {
      table: "banquet", chairs: "gold_chiavari", tablecloth: "classic", runner: "satin", napkins: "folded",
      chargers: "gold", plates: "white_gold", cups: "gold_rim", cutlery: "gold", centrepiece: "florals", nameCards: NONE, chairDecor: NONE,
    },
    clothColor: "#FFFFFF",
    runnerColor: theme.balloonColors[1] ?? theme.accent,
    napkinColor: theme.balloonColors[0] ?? theme.accent,
  };
}

export function adultCounts(a: Pick<AdultTable, "guests" | "choices">) {
  const guests = clampGuests(a.guests), per = adultOption("table", a.choices.table)?.seats ?? 10;
  const tables = Math.ceil(guests / per);
  return { guests, tables, perTable: per };
}

/** One line per chosen item: per table, or per guest. */
export function adultPriceLines(a: AdultTable): { label: string; amount: number }[] {
  if (!a.enabled) return [];
  const { guests, tables } = adultCounts(a);
  const lines: { label: string; amount: number }[] = [];
  for (const item of ADULT_ITEMS) {
    const o = adultOption(item.key, a.choices[item.key]);
    if (!o) continue; // "none"
    const n = o.unit === "per_table" ? tables : guests;
    lines.push({ label: `${o.name} (${n})`, amount: n * o.price });
  }
  return lines;
}

export const adultTotal = (a: AdultTable) => adultPriceLines(a).reduce((s, l) => s + l.amount, 0);

const HEX = /^#[0-9A-F]{6}$/i;

/** A stored grown-ups' table read back over the defaults. */
export function readAdultTable(raw: unknown, theme: { balloonColors: string[]; accent: string }): AdultTable | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const base = defaultAdultTable(theme);
  const stored = (r.choices && typeof r.choices === "object" ? r.choices : {}) as Record<string, unknown>;
  const choices = { ...base.choices };
  for (const item of ADULT_ITEMS) {
    const v = stored[item.key];
    if (typeof v === "string" && (item.options.some((o) => o.id === v) || (item.optional && v === NONE))) choices[item.key] = v;
  }
  const colour = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  return {
    enabled: r.enabled !== false,
    guests: clampGuests(Number(r.guests)),
    choices,
    clothColor: colour(r.clothColor, base.clothColor),
    runnerColor: colour(r.runnerColor, base.runnerColor),
    napkinColor: colour(r.napkinColor, base.napkinColor),
    ...(r.done === true ? { done: true } : {}),
  };
}
