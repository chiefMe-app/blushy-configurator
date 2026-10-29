// The kids' table in the builder (2026-10-27, F2): part of the party design
// (BuilderConfig.table), chosen in the Decor step after the backdrop, item by
// item from lib/studio/tableCatalog.ts. Pure data and sums — no UI, no config
// import (lib/config.ts uses the price lines).
import { CHAIR_COLOURS, NONE, PLATE_SHAPES, TABLE_ITEMS, onFloor, tableOption, type PlateShape, type TableItemKey } from "./tableCatalog";
import { DEFAULT_TABLE_FONT, TABLE_FONTS } from "./tableFonts";

export interface TableSetup {
  /** false: the customer skipped the table. */
  enabled: boolean;
  kids: number;
  /** The option chosen for each item (an option id, or "none" for an optional item). */
  choices: Record<TableItemKey, string>;
  clothColor: string;
  runnerColor: string;
  napkinColor: string;
  /** The plain pieces' colours (2026-10-28): plates, cups, the napkin band, the kids' chair (one of PLAIN_COLOURS). */
  plateColor: string;
  cupColor: string;
  holderColor: string;
  chairColor: string;
  /** The plain placemats' and plain bottle labels' colours (2026-10-29). */
  placematColor: string;
  labelColor: string;
  /** The plain plates' shape. */
  plateShape: PlateShape;
  /** The small plain plate's own colour (2026-10-29, the owner: "içindeki tabağın rengi farklı seçilebilsin"); the big one is plateColor. */
  smallPlateColor: string;
  /** The lettering of the words on the placemats and on the bottle labels (2026-10-29, ./tableFonts). */
  placematFont: string;
  labelFont: string;
  /** The colour of the printed words on the placemats and bottle labels, once the customer picks one (wordsColour). */
  textColor?: string;
  /** The customer's own words printed on the placemats ("Arya turns 6"), the cutlery holders and the bottle labels. */
  words?: TableWords;
  /** Where the render is set (2026-10-27: "outdoorda bakalım"); a garden unless chosen. */
  scene?: TableScene;
  /** The last close-up render of this table (F3), if one was made. */
  render?: TableRender;
}

export type TableScene = "garden" | "indoor";

// One close-up of a place setting (2026-10-28: "3 render çok fazla zaman
// alıyor ve pahalıya geliyor … sadece illüstrasyon olsun masa düzeni ve bir
// tane close up render"): the layout is only ever the drawings.
export interface TableRender {
  /** tableRenderKey of the table this was made from. */
  key: string;
  /** Where it is kept: the customer's folder of the private renders bucket (lib/renderStore.ts). */
  close: string;
}

// A stored render is only ever a file in the customer's own folder — never a
// link (2026-10-27: fal's picture host did not resolve on the owner's network,
// so the pictures are kept in Supabase, which the site already reaches).
const RENDER_PATH = /^[0-9a-z-]{1,64}\/[0-9a-z]{1,40}\.jpg$/i;

export function readTableRender(raw: unknown): TableRender | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const ok = (v: unknown): v is string => typeof v === "string" && RENDER_PATH.test(v);
  // Three-view renders kept before 2026-10-28 read back by their close-up.
  return typeof r.key === "string" && /^[a-z0-9]{1,13}$/.test(r.key) && ok(r.close) ? { key: r.key, close: r.close } : undefined;
}

export const MIN_KIDS = 4;
export const MAX_KIDS = 40;

export const clampKids = (n: number) => Math.max(MIN_KIDS, Math.min(MAX_KIDS, Math.round(Number.isFinite(n) ? n : MIN_KIDS)));

const DEFAULT_CHOICES: Record<TableItemKey, string> = {
  table: "standard", chairs: "white_kids",
  // The owner's tables show bare unless a cloth is chosen (2026-10-28).
  tablecloth: NONE, napkins: "printed",
  placemats: "watercolour", plates: "iridescent", cups: "plain", cutlery: "wooden", cutleryHolder: NONE,
  centrepiece: "balloons", bottleLabel: NONE, partyHats: "cone",
  // Not offered at the kids' table (the grown-ups' table will have them).
  runner: NONE, chargers: NONE, chairDecor: NONE, nameCards: NONE,
};

/** The items that carry the customer's words. */
export type WordsKey = "placemats" | "cutleryHolder" | "bottleLabel";
export type TableWords = Partial<Record<WordsKey, string>>;
export const WORDS_ITEMS: { key: WordsKey; label: string; placeholder: string }[] = [
  { key: "placemats", label: "Words on the placemats", placeholder: "e.g. Arya turns 6" },
  { key: "cutleryHolder", label: "Name on the cutlery holders", placeholder: "e.g. Arya" },
  { key: "bottleLabel", label: "Words on the bottle labels", placeholder: "e.g. Arya turns 6" },
];
/** Which lettering each printed item's words take. */
export const FONT_OF = { placemats: "placematFont", bottleLabel: "labelFont" } as const;
/** The words on an item, when the item is chosen. */
export const wordsOn = (t: Pick<TableSetup, "choices" | "words">, key: WordsKey) => (t.choices[key] !== NONE ? t.words?.[key]?.trim() || undefined : undefined);

/** Words: no markup or control characters, single spaces, at most 40. */
export const MAX_PLACEMAT_TEXT = 40;
export function cleanPlacematText(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/[\u0000-\u001f<>{}[\]\\/"`$^*=|~#%@+;:_]/g, "").replace(/\s+/g, " ").slice(0, MAX_PLACEMAT_TEXT);
  return t.trim() ? t : undefined;
}

/** Which colour each coloured item takes. */
export type ColourField = "clothColor" | "napkinColor" | "plateColor" | "cupColor" | "holderColor" | "chairColor" | "placematColor" | "labelColor";
export const COLOUR_OF: Partial<Record<TableItemKey, ColourField>> = {
  tablecloth: "clothColor", napkins: "napkinColor", plates: "plateColor", cups: "cupColor", cutleryHolder: "holderColor", chairs: "chairColor",
  placemats: "placematColor", bottleLabel: "labelColor",
};
/** The colour an item's chosen option takes, if it takes one (the cloth always; of the others, the plain options). */
export function itemColour(t: TableSetup, key: TableItemKey): string | undefined {
  const field = COLOUR_OF[key], item = TABLE_ITEMS.find((i) => i.key === key);
  return field && (item?.coloured || tableOption(key, t.choices[key])?.coloured) ? t[field] : undefined;
}
/** The kids' chair's first colour: the owner's own blue chair. */
export const DEFAULT_CHAIR_COLOR = "#38BDF8";

/**
 * The printed words' colour: the customer's, or the theme's accent (chosen to
 * read well on white, lib/config.ts) — so it follows a change of theme until
 * the customer picks one (2026-10-28: "her temaya uygun text rengi değişmeli").
 */
export const wordsColour = (t: Pick<TableSetup, "textColor">, theme: { accent: string }) => t.textColor ?? theme.accent;

/** A new table, in the theme's colours. */
export function defaultTableSetup(theme: { balloonColors: string[]; accent: string }): TableSetup {
  return {
    enabled: true,
    kids: 10,
    choices: { ...DEFAULT_CHOICES },
    clothColor: "#FFFFFF",
    runnerColor: theme.balloonColors[1] ?? theme.accent,
    napkinColor: theme.balloonColors[2] ?? theme.accent,
    plateColor: theme.balloonColors[1] ?? theme.accent,
    cupColor: theme.balloonColors[2] ?? theme.accent,
    holderColor: theme.balloonColors[1] ?? theme.accent,
    chairColor: DEFAULT_CHAIR_COLOR,
    placematColor: theme.balloonColors[1] ?? theme.accent,
    labelColor: theme.balloonColors[1] ?? theme.accent,
    plateShape: "round",
    smallPlateColor: theme.balloonColors[2] ?? theme.accent,
    placematFont: DEFAULT_TABLE_FONT,
    labelFont: DEFAULT_TABLE_FONT,
  };
}

export interface TableCounts {
  tables: number;
  seats: number;
  /** Children at each table, shared as evenly as possible. */
  perTable: number[];
}

/** Children at one table of the chosen kind (the catalog's `seats`). */
export const seatsPerTable = (t: Pick<TableSetup, "choices">) => tableOption("table", t.choices.table)?.seats ?? 10;

export function tableCounts(t: Pick<TableSetup, "kids" | "choices">): TableCounts {
  const kids = clampKids(t.kids), per = seatsPerTable(t);
  const tables = Math.ceil(kids / per);
  const base = Math.floor(kids / tables), extra = kids % tables;
  return { tables, seats: tables * per, perTable: Array.from({ length: tables }, (_, i) => base + (i < extra ? 1 : 0)) };
}

export interface TableLine { label: string; amount: number }

/** One line per chosen item: per table, or per child. */
export function tablePriceLines(t: TableSetup): TableLine[] {
  if (!t.enabled) return [];
  const kids = clampKids(t.kids), { tables } = tableCounts(t);
  const lines: TableLine[] = [];
  for (const item of TABLE_ITEMS) {
    const o = tableOption(item.key, t.choices[item.key]);
    if (!o) continue; // "none"
    if (item.key === "chairs" && onFloor(t.choices)) continue; // floor cushions come with the low table
    const n = o.unit === "per_table" ? tables : kids;
    lines.push({ label: `${o.name} (${n})`, amount: n * o.price });
  }
  return lines;
}

export const tableTotal = (t: TableSetup) => tablePriceLines(t).reduce((a, l) => a + l.amount, 0);

const HEX = /^#[0-9A-F]{6}$/i;

/** A stored table read back over the defaults; anything that does not read back is replaced. */
export function readTableSetup(raw: unknown, theme: { balloonColors: string[]; accent: string }): TableSetup | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const base = defaultTableSetup(theme);
  const stored = (r.choices && typeof r.choices === "object" ? r.choices : {}) as Record<string, unknown>;
  const choices = { ...base.choices };
  for (const item of TABLE_ITEMS) {
    const v = stored[item.key];
    if (typeof v === "string" && (item.options.some((o) => o.id === v) || (item.optional && v === NONE))) choices[item.key] = v;
  }
  const colour = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  return {
    enabled: r.enabled !== false,
    kids: clampKids(Number(r.kids)),
    choices,
    clothColor: colour(r.clothColor, base.clothColor),
    runnerColor: colour(r.runnerColor, base.runnerColor),
    napkinColor: colour(r.napkinColor, base.napkinColor),
    plateColor: colour(r.plateColor, base.plateColor),
    cupColor: colour(r.cupColor, base.cupColor),
    holderColor: colour(r.holderColor, base.holderColor),
    // The chair's pictures come only in its own colours.
    chairColor: CHAIR_COLOURS.find((c) => typeof r.chairColor === "string" && c === r.chairColor.toUpperCase()) ?? base.chairColor,
    placematColor: colour(r.placematColor, base.placematColor),
    labelColor: colour(r.labelColor, base.labelColor),
    plateShape: PLATE_SHAPES.find((p) => p.id === r.plateShape)?.id ?? base.plateShape,
    smallPlateColor: colour(r.smallPlateColor, base.smallPlateColor),
    placematFont: TABLE_FONTS.find((f) => f.id === r.placematFont)?.id ?? base.placematFont,
    labelFont: TABLE_FONTS.find((f) => f.id === r.labelFont)?.id ?? base.labelFont,
    ...(typeof r.textColor === "string" && HEX.test(r.textColor) ? { textColor: r.textColor } : {}),
    ...(readWords(r) ? { words: readWords(r) } : {}),
    ...(r.scene === "garden" || r.scene === "indoor" ? { scene: r.scene } : {}),
    ...(readTableRender(r.render) ? { render: readTableRender(r.render) } : {}),
  };
}

/** Stored words, cleaned; placematText is how the placemat words were kept on the first day (2026-10-28). */
function readWords(r: Record<string, unknown>): TableWords | undefined {
  const stored = (r.words && typeof r.words === "object" ? r.words : {}) as Record<string, unknown>;
  const out: TableWords = {};
  for (const { key } of WORDS_ITEMS) {
    const v = cleanPlacematText(stored[key] ?? (key === "placemats" ? r.placematText : undefined))?.trim();
    if (v) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
