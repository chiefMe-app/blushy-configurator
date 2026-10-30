// The backdrop and the kids' table saved as two designs (2026-10-30, the
// owner: "backdrop design and table setup design seperate"): one party, with
// a 'studio.backdrop' item and a 'studio.table' item, each its own card in My
// designs. The Builder still works on one design holding both; a save splits
// it here, and Open puts a party's items back together. Designs saved before
// held the table inside the backdrop item; they read the same way, and the
// next save moves the table into its own item.
import { defaultConfig, priceBreakdown, themeById, type BuilderConfig } from "@/lib/config";
import { fromDraft, toDraft, type StoredDraft } from "@/lib/draft";
import { readTableSetup, tablePriceLines, type TableSetup } from "@/lib/studio/tableSetup";

export const BACKDROP_ITEM = "studio.backdrop";
export const TABLE_ITEM = "studio.table";

/** The kids' table as saved: the table, and the theme it was set for. */
export interface StoredTable {
  v: 1;
  kind: "table";
  savedAt: string;
  eventType: BuilderConfig["eventType"];
  theme: BuilderConfig["theme"];
  themeSelected: boolean;
  table: TableSetup;
}

export interface Price { total: number; currency: "AED"; confidence: "estimate" }
const price = (total: number): Price => ({ total, currency: "AED", confidence: "estimate" });

/** A table the customer chose to have (not skipped). */
export const hasTable = (config: BuilderConfig): config is BuilderConfig & { table: TableSetup } => !!config.table?.enabled;
/**
 * The backdrop is kept unless the customer skipped it — or only answered nothing
 * about it while designing the table.
 */
export const hasBackdrop = (config: BuilderConfig) =>
  config.decor.backdropChoice === "yes" || (config.decor.backdropChoice !== "skip" && !hasTable(config));

/** The design split into its two saved items; a part the customer does not have is null. */
export function splitDesign(config: BuilderConfig, step: number, decorTab: number, now = new Date()) {
  const withoutTable: BuilderConfig = { ...config, table: undefined };
  // Something is always kept: a design with neither part saves as it is.
  const backdrop = hasBackdrop(config) || !hasTable(config)
    ? { config: toDraft(withoutTable, step, decorTab, now), price_snapshot: price(priceBreakdown(withoutTable).total) }
    : null;
  const table = hasTable(config)
    ? {
        config: { v: 1, kind: "table", savedAt: now.toISOString(), eventType: config.eventType, theme: config.theme, themeSelected: config.themeSelected, table: config.table } satisfies StoredTable,
        price_snapshot: price(tablePriceLines(config.table).reduce((s, l) => s + l.amount, 0)),
      }
    : null;
  return { backdrop, table };
}

/** A saved table read back, or null if it is not one. */
export function readStoredTable(raw: unknown): { theme: BuilderConfig["theme"]; eventType: BuilderConfig["eventType"]; themeSelected: boolean; table: TableSetup } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<StoredTable>;
  if (r.v !== 1 || r.kind !== "table" || typeof r.theme !== "string") return null;
  const theme = themeById(r.theme);
  if (!theme) return null;
  const table = readTableSetup(r.table, theme);
  if (!table?.enabled) return null;
  return { theme: r.theme, eventType: (r.eventType ?? "birthday") as BuilderConfig["eventType"], themeSelected: r.themeSelected !== false, table };
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
  kind: "backdrop" | "table";
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
 * The cards of My designs, newest first: each party's backdrop, then its table.
 * An older backdrop item with a table in it shows that table as its own card too.
 */
export function designCards(items: SavedItem[]): DesignCard[] {
  const cards: DesignCard[] = [];
  for (const item of items) {
    if (item.ref_id === TABLE_ITEM) {
      const t = readStoredTable(item.config);
      if (!t) continue;
      cards.push({ kind: "table", key: item.id, partyId: item.party_id, item, config: tableConfig(t), total: item.price_snapshot?.total, updatedAt: item.updated_at });
      continue;
    }
    const restored = fromDraft(JSON.stringify(item.config));
    if (!restored) continue;
    const c = restored.config;
    const tableApart = items.some((i) => i.party_id === item.party_id && i.ref_id === TABLE_ITEM && readStoredTable(i.config));
    const tableInside = hasTable(c) && !tableApart;
    // A skipped backdrop is no card, unless it is all the party has.
    if (c.decor.backdropChoice !== "skip" || !(tableInside || tableApart)) {
      const total = tableInside ? priceBreakdown({ ...c, table: undefined }).total : item.price_snapshot?.total;
      cards.push({ kind: "backdrop", key: item.id, partyId: item.party_id, item, config: { ...c, table: undefined }, total, updatedAt: item.updated_at });
    }
    if (tableInside) {
      const total = tablePriceLines(c.table!).reduce((s, l) => s + l.amount, 0);
      cards.push({ kind: "table", key: `${item.id}:table`, partyId: item.party_id, item, config: c, total, updatedAt: item.updated_at });
    }
  }
  // The newest party first; in a party, the backdrop, then the table.
  const latest = new Map<string, string>();
  for (const c of cards) if ((latest.get(c.partyId) ?? "") < c.updatedAt) latest.set(c.partyId, c.updatedAt);
  const kindOrder = (c: DesignCard) => (c.kind === "backdrop" ? 0 : 1);
  return cards.sort((a, b) => latest.get(b.partyId)!.localeCompare(latest.get(a.partyId)!) || a.partyId.localeCompare(b.partyId) || kindOrder(a) - kindOrder(b));
}

/** A table on its own, as a Builder design with the backdrop skipped. */
function tableConfig(t: NonNullable<ReturnType<typeof readStoredTable>>): BuilderConfig {
  const base = defaultConfig();
  return { ...base, theme: t.theme, eventType: t.eventType, themeSelected: t.themeSelected, decor: { ...base.decor, backdropChoice: "skip" }, table: t.table };
}

/**
 * One party's items put back together for the Builder: the backdrop's design
 * with the table in it, and which items Save should write to.
 */
export function joinParty(items: SavedItem[], partyId: string): { draft: StoredDraft; itemId?: string; tableItemId?: string } | null {
  const mine = items.filter((i) => i.party_id === partyId);
  const backdropItem = mine.find((i) => i.ref_id !== TABLE_ITEM && fromDraft(JSON.stringify(i.config)));
  const tableItem = mine.find((i) => i.ref_id === TABLE_ITEM && readStoredTable(i.config));
  const saved = tableItem ? readStoredTable(tableItem.config) : null;
  const restored = backdropItem ? fromDraft(JSON.stringify(backdropItem.config)) : null;
  if (!restored && !saved) return null;
  const config = restored ? { ...restored.config, ...(saved ? { table: saved.table } : {}) } : tableConfig(saved!);
  return {
    draft: toDraft(config, restored?.step ?? 2, restored?.decorTab ?? 0),
    itemId: backdropItem?.id,
    tableItemId: tableItem?.id,
  };
}
