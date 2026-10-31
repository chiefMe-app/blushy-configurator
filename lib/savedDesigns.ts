// The backdrop and the kids' table saved as two designs (2026-10-30, the
// owner: "backdrop design and table setup design seperate"): one party, with
// a 'studio.backdrop' item and a 'studio.table' item, each its own card in My
// designs. The Builder still works on one design holding both; a save splits
// it here, and Open puts a party's items back together. Designs saved before
// held the table inside the backdrop item; they read the same way, and the
// next save moves the table into its own item. 2026-10-31: the grown-ups'
// table is kept with the kids' table (one "Table setup"), and the welcome
// board is a third design, 'studio.welcome'.
import { defaultConfig, priceBreakdown, themeById, type BuilderConfig } from "@/lib/config";
import { fromDraft, toDraft, type StoredDraft } from "@/lib/draft";
import { readTableSetup, tablePriceLines, type TableSetup } from "@/lib/studio/tableSetup";
import { adultTotal, readAdultTable, type AdultTable } from "@/lib/studio/adultTable";
import { readWelcomeBoard, welcomeTotal, type WelcomeBoard } from "@/lib/studio/welcomeBoard";

export const BACKDROP_ITEM = "studio.backdrop";
export const TABLE_ITEM = "studio.table";
export const WELCOME_ITEM = "studio.welcome";

/** The tables as saved: the kids' table, the grown-ups' table, and the theme they were set for. */
export interface StoredTable {
  v: 1;
  kind: "table";
  savedAt: string;
  eventType: BuilderConfig["eventType"];
  theme: BuilderConfig["theme"];
  themeSelected: boolean;
  /** The kids' table (it may be skipped when only the grown-ups' table is kept). */
  table?: TableSetup;
  adultTable?: AdultTable;
}

/** The welcome board as saved. */
export interface StoredWelcome {
  v: 1;
  kind: "welcome";
  savedAt: string;
  eventType: BuilderConfig["eventType"];
  theme: BuilderConfig["theme"];
  themeSelected: boolean;
  welcomeBoard: WelcomeBoard;
}

export interface Price { total: number; currency: "AED"; confidence: "estimate" }
const price = (total: number): Price => ({ total, currency: "AED", confidence: "estimate" });

/** A kids' or grown-ups' table the customer chose to have (not skipped). */
export const hasTable = (config: Pick<BuilderConfig, "table" | "adultTable">) => !!config.table?.enabled || !!config.adultTable?.enabled;
export const hasWelcome = (config: Pick<BuilderConfig, "welcomeBoard">) => !!config.welcomeBoard?.enabled;
/**
 * The backdrop is kept unless the customer skipped it — or only answered nothing
 * about it while designing the other parts.
 */
export const hasBackdrop = (config: BuilderConfig) =>
  config.decor.backdropChoice === "yes" || (config.decor.backdropChoice !== "skip" && !hasTable(config) && !hasWelcome(config));

const tablesTotal = (t: Pick<BuilderConfig, "table" | "adultTable">) =>
  (t.table ? tablePriceLines(t.table).reduce((s, l) => s + l.amount, 0) : 0) + (t.adultTable ? adultTotal(t.adultTable) : 0);

/** The design split into its saved items; a part the customer does not have is null. */
export function splitDesign(config: BuilderConfig, step: number, decorTab: number, now = new Date()) {
  const backdropOnly: BuilderConfig = { ...config, table: undefined, adultTable: undefined, welcomeBoard: undefined };
  const meta = { v: 1 as const, savedAt: now.toISOString(), eventType: config.eventType, theme: config.theme, themeSelected: config.themeSelected };
  // Something is always kept: a design with no part saves as it is.
  const backdrop = hasBackdrop(config) || (!hasTable(config) && !hasWelcome(config))
    ? { config: toDraft(backdropOnly, step, decorTab, now), price_snapshot: price(priceBreakdown(backdropOnly).total) }
    : null;
  const table = hasTable(config)
    ? {
        config: { ...meta, kind: "table", ...(config.table ? { table: config.table } : {}), ...(config.adultTable ? { adultTable: config.adultTable } : {}) } satisfies StoredTable,
        price_snapshot: price(tablesTotal(config)),
      }
    : null;
  const welcome = config.welcomeBoard?.enabled
    ? { config: { ...meta, kind: "welcome", welcomeBoard: config.welcomeBoard } satisfies StoredWelcome, price_snapshot: price(welcomeTotal(config.welcomeBoard)) }
    : null;
  return { backdrop, table, welcome };
}

type Saved = { theme: BuilderConfig["theme"]; eventType: BuilderConfig["eventType"]; themeSelected: boolean };
const readMeta = (raw: unknown, kind: string): (Saved & { r: Record<string, unknown>; theme0: NonNullable<ReturnType<typeof themeById>> }) | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || r.kind !== kind || typeof r.theme !== "string") return null;
  const theme0 = themeById(r.theme as BuilderConfig["theme"]);
  if (!theme0) return null;
  return { r, theme0, theme: r.theme as BuilderConfig["theme"], eventType: (r.eventType ?? "birthday") as BuilderConfig["eventType"], themeSelected: r.themeSelected !== false };
};

/** Saved tables read back, or null if they are not (or neither table is kept). */
export function readStoredTable(raw: unknown): (Saved & { table?: TableSetup; adultTable?: AdultTable }) | null {
  const m = readMeta(raw, "table");
  if (!m) return null;
  const table = readTableSetup(m.r.table, m.theme0);
  const adultTable = readAdultTable(m.r.adultTable, m.theme0);
  if (!table?.enabled && !adultTable?.enabled) return null;
  return { theme: m.theme, eventType: m.eventType, themeSelected: m.themeSelected, ...(table ? { table } : {}), ...(adultTable ? { adultTable } : {}) };
}

/** A saved welcome board read back, or null. */
export function readStoredWelcome(raw: unknown): (Saved & { welcomeBoard: WelcomeBoard }) | null {
  const m = readMeta(raw, "welcome");
  if (!m) return null;
  const welcomeBoard = readWelcomeBoard(m.r.welcomeBoard, m.theme0);
  if (!welcomeBoard?.enabled) return null;
  return { theme: m.theme, eventType: m.eventType, themeSelected: m.themeSelected, welcomeBoard };
}

/** A row of party_items, as My designs reads it. */
export interface SavedItem {
  id: string;
  party_id: string;
  ref_id: string;
  updated_at: string;
  config: unknown;
  price_snapshot: { total?: number } | null;
  parties?: { title: string } | null;
}

/** One card in My designs. */
export interface DesignCard {
  kind: "backdrop" | "table" | "welcome";
  key: string;
  partyId: string;
  /** The item the card stands for (an older design's table lives in its backdrop item). */
  item: SavedItem;
  /** The whole design, as the card shows it. */
  config: BuilderConfig;
  total?: number;
  updatedAt: string;
}

/**
 * The cards of My designs, newest first: each party's backdrop, then its
 * tables, then its welcome board. An older backdrop item with a table in it
 * shows that table as its own card too.
 */
export function designCards(items: SavedItem[]): DesignCard[] {
  const cards: DesignCard[] = [];
  for (const item of items) {
    if (item.ref_id === TABLE_ITEM) {
      const t = readStoredTable(item.config);
      if (!t) continue;
      cards.push({ kind: "table", key: item.id, partyId: item.party_id, item, config: partConfig(t), total: item.price_snapshot?.total, updatedAt: item.updated_at });
      continue;
    }
    if (item.ref_id === WELCOME_ITEM) {
      const w = readStoredWelcome(item.config);
      if (!w) continue;
      cards.push({ kind: "welcome", key: item.id, partyId: item.party_id, item, config: partConfig(w), total: item.price_snapshot?.total, updatedAt: item.updated_at });
      continue;
    }
    const restored = fromDraft(JSON.stringify(item.config));
    if (!restored) continue;
    const c = restored.config;
    const others = (ref: string, read: (raw: unknown) => unknown) => items.some((i) => i.party_id === item.party_id && i.ref_id === ref && read(i.config));
    const tableApart = others(TABLE_ITEM, readStoredTable);
    const tableInside = !!c.table?.enabled && !tableApart;
    // A skipped backdrop is no card, unless it is all the party has.
    if (c.decor.backdropChoice !== "skip" || !(tableInside || tableApart || others(WELCOME_ITEM, readStoredWelcome))) {
      const total = tableInside ? priceBreakdown({ ...c, table: undefined }).total : item.price_snapshot?.total;
      cards.push({ kind: "backdrop", key: item.id, partyId: item.party_id, item, config: { ...c, table: undefined }, total, updatedAt: item.updated_at });
    }
    if (tableInside) {
      const total = tablePriceLines(c.table!).reduce((s, l) => s + l.amount, 0);
      cards.push({ kind: "table", key: `${item.id}:table`, partyId: item.party_id, item, config: c, total, updatedAt: item.updated_at });
    }
  }
  // The newest party first; in a party, the backdrop, the tables, the board.
  const latest = new Map<string, string>();
  for (const c of cards) if ((latest.get(c.partyId) ?? "") < c.updatedAt) latest.set(c.partyId, c.updatedAt);
  const kindOrder = (c: DesignCard) => ["backdrop", "table", "welcome"].indexOf(c.kind);
  return cards.sort((a, b) => latest.get(b.partyId)!.localeCompare(latest.get(a.partyId)!) || a.partyId.localeCompare(b.partyId) || kindOrder(a) - kindOrder(b));
}

/** A part on its own, as a Builder design with the backdrop skipped. */
function partConfig(p: Saved & Partial<Pick<BuilderConfig, "table" | "adultTable" | "welcomeBoard">>): BuilderConfig {
  const base = defaultConfig();
  return {
    ...base, theme: p.theme, eventType: p.eventType, themeSelected: p.themeSelected, decor: { ...base.decor, backdropChoice: "skip" },
    ...(p.table ? { table: p.table } : {}), ...(p.adultTable ? { adultTable: p.adultTable } : {}), ...(p.welcomeBoard ? { welcomeBoard: p.welcomeBoard } : {}),
  };
}

/**
 * One party's items put back together for the Builder: the backdrop's design
 * with the tables and the board in it, and which items Save should write to.
 */
export function joinParty(items: SavedItem[], partyId: string): { draft: StoredDraft; itemId?: string; tableItemId?: string; welcomeItemId?: string } | null {
  const mine = items.filter((i) => i.party_id === partyId);
  const backdropItem = mine.find((i) => i.ref_id !== TABLE_ITEM && i.ref_id !== WELCOME_ITEM && fromDraft(JSON.stringify(i.config)));
  const tableItem = mine.find((i) => i.ref_id === TABLE_ITEM && readStoredTable(i.config));
  const welcomeItem = mine.find((i) => i.ref_id === WELCOME_ITEM && readStoredWelcome(i.config));
  const tables = tableItem ? readStoredTable(tableItem.config) : null;
  const welcome = welcomeItem ? readStoredWelcome(welcomeItem.config) : null;
  const restored = backdropItem ? fromDraft(JSON.stringify(backdropItem.config)) : null;
  const first = tables ?? welcome;
  if (!restored && !first) return null;
  const config: BuilderConfig = {
    ...(restored ? restored.config : partConfig(first!)),
    ...(tables ? { table: tables.table, adultTable: tables.adultTable } : {}),
    ...(welcome ? { welcomeBoard: welcome.welcomeBoard } : {}),
  };
  return {
    draft: toDraft(config, restored?.step ?? 2, restored?.decorTab ?? 0),
    itemId: backdropItem?.id,
    tableItemId: tableItem?.id,
    welcomeItemId: welcomeItem?.id,
  };
}
