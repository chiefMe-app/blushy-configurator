// The kids' table in the builder (2026-10-27, F2): part of the party design
// (BuilderConfig.table), chosen in the Decor step after the backdrop, item by
// item from lib/studio/tableCatalog.ts. Pure data and sums — no UI, no config
// import (lib/config.ts uses the price lines).
import { NONE, TABLE_ITEMS, tableOption, type TableItemKey } from "./tableCatalog";

export interface TableSetup {
  /** false: the customer skipped the table. */
  enabled: boolean;
  kids: number;
  /** The option chosen for each item (an option id, or "none" for an optional item). */
  choices: Record<TableItemKey, string>;
  clothColor: string;
  runnerColor: string;
  napkinColor: string;
  /** The last real render of this table (F3), if one was made. */
  render?: TableRender;
}

export interface TableRender {
  /** tableRenderKey of the table this was made from. */
  key: string;
  perspective: string;
  top: string;
}

// fal's own file hosts only: a stored render is never an arbitrary address.
const FAL_URL = /^https:\/\/([a-z0-9-]+\.)*fal\.media\/[\w\-./%]+$/i;

export function readTableRender(raw: unknown): TableRender | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const ok = (v: unknown): v is string => typeof v === "string" && v.length < 600 && FAL_URL.test(v);
  return typeof r.key === "string" && /^[a-z0-9]{1,13}$/.test(r.key) && ok(r.perspective) && ok(r.top)
    ? { key: r.key, perspective: r.perspective, top: r.top } : undefined;
}

export const MIN_KIDS = 4;
export const MAX_KIDS = 40;
export const SEATS_PER_TABLE = 8;

export const clampKids = (n: number) => Math.max(MIN_KIDS, Math.min(MAX_KIDS, Math.round(Number.isFinite(n) ? n : MIN_KIDS)));

const DEFAULT_CHOICES: Record<TableItemKey, string> = {
  table: "long", chairs: "white_kids",
  tablecloth: "classic", runner: "tulle", napkins: "folded",
  plates: "themed", cups: "straw", cutlery: "wooden", chargers: NONE,
  centrepiece: "balloons", chairDecor: NONE, nameCards: "tent", favourBoxes: NONE, partyHats: NONE,
};

/** A new table, in the theme's colours. */
export function defaultTableSetup(theme: { balloonColors: string[]; accent: string }): TableSetup {
  return {
    enabled: true,
    kids: 10,
    choices: { ...DEFAULT_CHOICES },
    clothColor: "#FFFFFF",
    runnerColor: theme.balloonColors[1] ?? theme.accent,
    napkinColor: theme.balloonColors[2] ?? theme.accent,
  };
}

export interface TableCounts {
  tables: number;
  seats: number;
  /** Children at each table, shared as evenly as possible. */
  perTable: number[];
}

export function tableCounts(t: Pick<TableSetup, "kids">): TableCounts {
  const kids = clampKids(t.kids);
  const tables = Math.ceil(kids / SEATS_PER_TABLE);
  const base = Math.floor(kids / tables), extra = kids % tables;
  return { tables, seats: tables * SEATS_PER_TABLE, perTable: Array.from({ length: tables }, (_, i) => base + (i < extra ? 1 : 0)) };
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
    ...(readTableRender(r.render) ? { render: readTableRender(r.render) } : {}),
  };
}
