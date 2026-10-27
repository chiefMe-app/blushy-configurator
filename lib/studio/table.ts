// Table Setup studio (Phase 3): the kids' guest table — how many children,
// the tables and chairs they sit at, the cloth and runner, the tableware,
// a centrepiece and what waits at each seat. A design is plain data, kept
// on the device and (later) saved to the account like the backdrop.
//
// Sizes are the real ones the drawing and (later) the Design Pack use.
// Prices are placeholders until the owner sets them ("fiyat konusunu
// şimdilik bırak, daha sonra detaylı çalışacağım", 2026-10-27).
import { THEMES, themeById, type ThemeId } from "@/lib/config";

export type TableShape = "long" | "round";
export type ChairStyle = "white_kids" | "gold_chiavari" | "clear_ghost";
export type RunnerStyle = "none" | "tulle" | "sequin" | "greenery";
export type Tableware = "themed" | "white_gold" | "pastel";
export type Centrepiece = "none" | "balloons" | "florals" | "toppers";

export interface TableDesign {
  v: 1;
  theme: ThemeId;
  kids: number;
  shape: TableShape;
  chairs: ChairStyle;
  clothColor: string;
  runner: RunnerStyle;
  runnerColor: string;
  tableware: Tableware;
  centrepiece: Centrepiece;
  placeCards: boolean;
  favourBoxes: boolean;
  partyHats: boolean;
}

/** The design kept on this device (app/studio/table). */
export const TABLE_DRAFT_KEY = "partymuse.table.draft.v1";

export const MIN_KIDS = 4;
export const MAX_KIDS = 40;

/** Real sizes, cm. A long kids' table seats four a side; a round one eight around. */
export const TABLES: Record<TableShape, { label: string; desc: string; seats: number; widthCm: number; depthCm: number }> = {
  long: { label: "Long tables", desc: "180 × 60 cm, 8 kids each — joined into rows", seats: 8, widthCm: 180, depthCm: 60 },
  round: { label: "Round tables", desc: "⌀ 120 cm, 8 kids each", seats: 8, widthCm: 120, depthCm: 120 },
};

export const CHAIRS: { id: ChairStyle; label: string; colour: string }[] = [
  { id: "white_kids", label: "White kids' chairs", colour: "#FFFFFF" },
  { id: "gold_chiavari", label: "Gold chiavari", colour: "#D4AF37" },
  { id: "clear_ghost", label: "Clear ghost chairs", colour: "#E6EEF5" },
];

export const RUNNERS: { id: RunnerStyle; label: string }[] = [
  { id: "none", label: "No runner" },
  { id: "tulle", label: "Tulle" },
  { id: "sequin", label: "Sequin" },
  { id: "greenery", label: "Greenery" },
];

export const TABLEWARE: { id: Tableware; label: string; desc: string }[] = [
  { id: "themed", label: "Themed", desc: "Plates, cups and napkins in the theme's colours" },
  { id: "white_gold", label: "White & gold", desc: "White plates with a gold rim, gold cutlery" },
  { id: "pastel", label: "Pastel mix", desc: "Soft pastel plates and cups, mixed" },
];

export const CENTREPIECES: { id: Centrepiece; label: string }[] = [
  { id: "none", label: "None" },
  { id: "balloons", label: "Balloon bunch" },
  { id: "florals", label: "Fresh florals" },
  { id: "toppers", label: "Theme toppers" },
];

/** Placeholder prices, AED — to be set by the owner. */
export const TABLE_PRICES = {
  tableWithChairs: 120, // per table, white kids' chairs included
  chairUpgrade: { white_kids: 0, gold_chiavari: 5, clear_ghost: 8 } as Record<ChairStyle, number>, // per chair
  cloth: 40, // per table
  runner: { none: 0, tulle: 30, sequin: 45, greenery: 60 } as Record<RunnerStyle, number>, // per table
  tableware: { themed: 18, white_gold: 15, pastel: 12 } as Record<Tableware, number>, // per child
  centrepiece: { none: 0, balloons: 60, florals: 90, toppers: 40 } as Record<Centrepiece, number>, // per table
  placeCard: 5, // per child
  favourBox: 15, // per child
  partyHat: 4, // per child
};

export function defaultTableDesign(theme: ThemeId = "frozen"): TableDesign {
  const t = themeById(theme) ?? THEMES[0];
  return {
    v: 1,
    theme: t.id,
    kids: 12,
    shape: "long",
    chairs: "white_kids",
    clothColor: "#FFFFFF",
    runner: "tulle",
    runnerColor: t.balloonColors[1] ?? t.accent,
    tableware: "themed",
    centrepiece: "balloons",
    placeCards: true,
    favourBoxes: false,
    partyHats: false,
  };
}

/** The colours offered for cloth and runner: white, the theme's backdrop and balloon colours. */
export function tableSwatches(theme: ThemeId): string[] {
  const t = themeById(theme) ?? THEMES[0];
  return Array.from(new Set(["#FFFFFF", ...t.backdropColors, ...t.balloonColors].map((h) => h.toUpperCase())));
}

export const clampKids = (n: number) => Math.max(MIN_KIDS, Math.min(MAX_KIDS, Math.round(Number.isFinite(n) ? n : MIN_KIDS)));

export interface TableLayout {
  tables: number;
  seats: number;
  /** Children at each table, in order (the last one may have fewer). */
  perTable: number[];
}

/** How many tables, and who sits where: the children shared as evenly as possible. */
export function tableLayout(d: Pick<TableDesign, "kids" | "shape">): TableLayout {
  const kids = clampKids(d.kids);
  const tables = Math.ceil(kids / TABLES[d.shape].seats);
  const base = Math.floor(kids / tables), extra = kids % tables;
  return { tables, seats: tables * TABLES[d.shape].seats, perTable: Array.from({ length: tables }, (_, i) => base + (i < extra ? 1 : 0)) };
}

export interface TablePriceLine { label: string; amount: number }

export function tablePrice(d: TableDesign): { lines: TablePriceLine[]; total: number } {
  const kids = clampKids(d.kids);
  const { tables } = tableLayout(d);
  const P = TABLE_PRICES;
  const chair = CHAIRS.find((c) => c.id === d.chairs)!;
  const lines: TablePriceLine[] = [
    { label: `${tables} ${d.shape === "round" ? "round" : "long"} table${tables > 1 ? "s" : ""} with ${kids} chairs`, amount: tables * P.tableWithChairs },
  ];
  if (P.chairUpgrade[d.chairs]) lines.push({ label: `${chair.label} (${kids})`, amount: kids * P.chairUpgrade[d.chairs] });
  lines.push({ label: `Tablecloth (${tables})`, amount: tables * P.cloth });
  if (d.runner !== "none") lines.push({ label: `${RUNNERS.find((r) => r.id === d.runner)!.label} runner (${tables})`, amount: tables * P.runner[d.runner] });
  lines.push({ label: `${TABLEWARE.find((t) => t.id === d.tableware)!.label} tableware (${kids})`, amount: kids * P.tableware[d.tableware] });
  if (d.centrepiece !== "none") lines.push({ label: `${CENTREPIECES.find((c) => c.id === d.centrepiece)!.label} centrepiece (${tables})`, amount: tables * P.centrepiece[d.centrepiece] });
  if (d.placeCards) lines.push({ label: `Name cards (${kids})`, amount: kids * P.placeCard });
  if (d.favourBoxes) lines.push({ label: `Party favour boxes (${kids})`, amount: kids * P.favourBox });
  if (d.partyHats) lines.push({ label: `Party hats (${kids})`, amount: kids * P.partyHat });
  return { lines, total: lines.reduce((a, l) => a + l.amount, 0) };
}

const HEX = /^#[0-9A-F]{6}$/i;
const oneOf = <T extends string>(v: unknown, ids: readonly T[], d: T): T => (ids.includes(v as T) ? (v as T) : d);

/** A stored design laid over the defaults; anything that does not read back is replaced. */
export function readTableDesign(raw: unknown): TableDesign | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || typeof r.theme !== "string" || !themeById(r.theme as ThemeId)) return null;
  const base = defaultTableDesign(r.theme as ThemeId);
  return {
    v: 1,
    theme: base.theme,
    kids: clampKids(Number(r.kids)),
    shape: oneOf(r.shape, ["long", "round"] as const, base.shape),
    chairs: oneOf(r.chairs, CHAIRS.map((c) => c.id), base.chairs),
    clothColor: typeof r.clothColor === "string" && HEX.test(r.clothColor) ? r.clothColor : base.clothColor,
    runner: oneOf(r.runner, RUNNERS.map((x) => x.id), base.runner),
    runnerColor: typeof r.runnerColor === "string" && HEX.test(r.runnerColor) ? r.runnerColor : base.runnerColor,
    tableware: oneOf(r.tableware, TABLEWARE.map((x) => x.id), base.tableware),
    centrepiece: oneOf(r.centrepiece, CENTREPIECES.map((x) => x.id), base.centrepiece),
    placeCards: r.placeCards === true,
    favourBoxes: r.favourBoxes === true,
    partyHats: r.partyHats === true,
  };
}
