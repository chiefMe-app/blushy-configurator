// The grown-ups' table and the welcome board (2026-10-31): their prices, the
// party total, the device copy, reading stored values back safely, and saving
// them as designs of their own.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { THEMES, defaultConfig, priceBreakdown, themeById, type BuilderConfig } from "@/lib/config";
import { fromDraft, toDraft } from "@/lib/draft";
import { NONE } from "@/lib/studio/tableCatalog";
import { defaultTableSetup, readTableSetup } from "@/lib/studio/tableSetup";
import { ADULT_ITEMS, ADULT_SECTIONS, adultCounts, adultPriceLines, adultTotal, defaultAdultTable, readAdultTable } from "@/lib/studio/adultTable";
import { boardArt, cleanBoardText, defaultWelcomeBoard, readWelcomeBoard, welcomePriceLines, welcomeTotal } from "@/lib/studio/welcomeBoard";
import { designCards, joinParty, readStoredTable, splitDesign, TABLE_ITEM, WELCOME_ITEM, type SavedItem } from "@/lib/savedDesigns";

const frozen = themeById("frozen")!;
const base = (): BuilderConfig => ({ ...defaultConfig(), theme: "frozen", themeSelected: true });

describe("the grown-ups' table", () => {
  it("every item is on the page, in a section; the adult pieces the kids' table left out are here", () => {
    expect(ADULT_SECTIONS.flatMap((s) => s.items).sort()).toEqual(ADULT_ITEMS.map((i) => i.key).sort());
    expect(ADULT_ITEMS.map((i) => i.key)).toEqual(expect.arrayContaining(["chargers", "runner", "nameCards", "chairDecor"]));
  });
  it("prices per table and per guest; ten guests at one long table", () => {
    const a = defaultAdultTable(frozen);
    expect(adultCounts(a)).toEqual({ guests: 10, tables: 1, perTable: 10 });
    const lines = adultPriceLines(a);
    expect(lines.find((l) => l.label.startsWith("Long table"))).toEqual({ label: "Long table (1)", amount: 150 });
    expect(lines.find((l) => l.label.startsWith("Gold chiavari"))).toEqual({ label: "Gold chiavari (10)", amount: 200 });
    // Eleven guests take a second table.
    expect(adultCounts({ ...a, guests: 11 }).tables).toBe(2);
    // None adds nothing; a skipped table, nothing at all.
    expect(adultTotal({ ...a, choices: { ...a.choices, chargers: NONE } })).toBe(adultTotal(a) - 120);
    expect(adultPriceLines({ ...a, enabled: false })).toEqual([]);
  });
  it("is in the party total, in its own section", () => {
    const c = { ...base(), adultTable: defaultAdultTable(frozen) };
    const { lines, total } = priceBreakdown(c);
    expect(lines.filter((l) => l.section === "adults").reduce((s, l) => s + l.amount, 0)).toBe(adultTotal(c.adultTable));
    expect(total).toBe(priceBreakdown(base()).total + adultTotal(c.adultTable));
  });
  it("reads back safely: unknown choices, colours and counts fall back", () => {
    const a = readAdultTable({ guests: 999, choices: { chargers: "diamond", runner: NONE, table: NONE }, clothColor: "red", done: true }, frozen)!;
    expect(a.guests).toBe(60);
    expect(a.choices.chargers).toBe("gold");
    expect(a.choices.runner).toBe(NONE);
    expect(a.choices.table).toBe("banquet"); // the table is not optional
    expect(a.clothColor).toBe("#FFFFFF");
    expect(a.done).toBe(true);
    expect(readAdultTable(null, frozen)).toBeUndefined();
  });
});

describe("the welcome board", () => {
  it("prices the size, an acrylic board and the easel", () => {
    const b = defaultWelcomeBoard(frozen);
    expect(welcomePriceLines(b)).toEqual([{ label: "Welcome board, Medium 70 × 100 cm", amount: 250 }, { label: "Easel", amount: 40 }]);
    expect(welcomeTotal({ ...b, size: "large", material: "acrylic", stand: "none" })).toBe(320 + 150);
    expect(welcomePriceLines({ ...b, enabled: false })).toEqual([]);
    expect(priceBreakdown({ ...base(), welcomeBoard: b }).total).toBe(priceBreakdown(base()).total + 290);
  });
  it("uses the theme's own art, or none for a plain board", () => {
    expect(boardArt({ design: "watercolour" }, "frozen")).toBe("/design/table/placemats/frozen/watercolour.webp");
    expect(boardArt({ design: "plain" }, "frozen")).toBeNull();
    // Every theme has both pictures.
    for (const t of THEMES) for (const design of ["watercolour", "sparkle"] as const) expect(existsSync(`public${boardArt({ design }, t.id)}`), `${t.id} ${design}`).toBe(true);
  });
  it("keeps the words clean and short, and reads back safely", () => {
    expect(cleanBoardText("<b>Arya's</b>   party")).toBe("bArya'sb party");
    expect(cleanBoardText("x".repeat(80))).toHaveLength(30);
    const b = readWelcomeBoard({ size: "huge", shape: "star", design: "plain", colour: "#123456", name: "Arya's", font: "comic", textColor: "blue" }, frozen)!;
    expect(b).toMatchObject({ size: "medium", shape: "arch", design: "plain", colour: "#123456", name: "Arya's", font: "birthstone-bounce" });
    expect(b.textColor).toBeUndefined();
  });
});

describe("on the device and in My designs", () => {
  const full = (): BuilderConfig => ({
    ...base(), decor: { ...base().decor, backdropChoice: "yes" },
    table: { ...defaultTableSetup(frozen), done: true }, adultTable: defaultAdultTable(frozen), welcomeBoard: { ...defaultWelcomeBoard(frozen), name: "Arya's" },
  });
  it("the device copy keeps both tables, the board and the Finish marks", () => {
    const back = fromDraft(JSON.stringify(toDraft(full(), 2, 0)))!.config;
    expect(back.table?.done).toBe(true);
    expect(back.adultTable?.guests).toBe(10);
    expect(back.welcomeBoard?.name).toBe("Arya's");
    expect(readTableSetup({ done: "yes" }, frozen)?.done).toBeUndefined();
  });
  it("saves three designs: the backdrop, the table setup (both tables) and the welcome board", () => {
    const { backdrop, table, welcome } = splitDesign(full(), 2, 0);
    expect(backdrop!.config.config).not.toHaveProperty("welcomeBoard");
    expect(table!.config).toMatchObject({ kind: "table", table: { kids: 10 }, adultTable: { guests: 10 } });
    expect(welcome!.config).toMatchObject({ kind: "welcome", welcomeBoard: { name: "Arya's" } });
    const items: SavedItem[] = [
      { id: "b", party_id: "p", ref_id: "studio.backdrop", updated_at: "2026-10-31T10:00:00Z", ...backdrop! },
      { id: "t", party_id: "p", ref_id: TABLE_ITEM, updated_at: "2026-10-31T10:00:00Z", ...table! },
      { id: "w", party_id: "p", ref_id: WELCOME_ITEM, updated_at: "2026-10-31T10:00:00Z", ...welcome! },
    ];
    expect(designCards(items).map((c) => c.kind)).toEqual(["backdrop", "table", "welcome"]);
    const joined = joinParty(items, "p")!;
    expect(joined).toMatchObject({ itemId: "b", tableItemId: "t", welcomeItemId: "w" });
    expect(joined.draft.config).toMatchObject({ table: { kids: 10 }, adultTable: { guests: 10 }, welcomeBoard: { name: "Arya's" } });
  });
  it("a grown-ups' table alone is a table setup; a board alone, a welcome design", () => {
    const onlyAdults = { ...base(), decor: { ...base().decor, backdropChoice: "skip" as const }, table: { ...defaultTableSetup(frozen), enabled: false }, adultTable: defaultAdultTable(frozen) };
    const split = splitDesign(onlyAdults, 2, 0);
    expect(split.backdrop).toBeNull();
    expect(readStoredTable(split.table!.config)?.adultTable?.enabled).toBe(true);
    expect(split.table!.price_snapshot.total).toBe(adultTotal(onlyAdults.adultTable));
    const onlyBoard = splitDesign({ ...base(), decor: { ...base().decor, backdropChoice: "skip" }, welcomeBoard: defaultWelcomeBoard(frozen) }, 2, 0);
    expect(onlyBoard.backdrop).toBeNull();
    expect(onlyBoard.table).toBeNull();
    expect(onlyBoard.welcome).not.toBeNull();
  });
});
