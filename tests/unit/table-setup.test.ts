// The kids' table in the builder (F2): seats, per-item prices, the party
// total, and a stored table reading back safely.
import { describe, expect, it } from "vitest";
import { defaultConfig, priceBreakdown, themeById } from "@/lib/config";
import { fromDraft, toDraft } from "@/lib/draft";
import { NONE, TABLE_ITEMS, TABLE_TABS } from "@/lib/studio/tableCatalog";
import { MIN_KIDS, defaultTableSetup, readTableSetup, tableCounts, tablePriceLines, tableTotal } from "@/lib/studio/tableSetup";
import { arrangeTables } from "@/components/studio/table/TableSketch";

const frozen = themeById("frozen")!;

describe("the catalog", () => {
  it("every item has three options, and every item is on a tab", () => {
    for (const item of TABLE_ITEMS) expect(item.options).toHaveLength(3);
    expect(TABLE_TABS.flatMap((t) => t.items).sort()).toEqual(TABLE_ITEMS.map((i) => i.key).sort());
  });
});

describe("seats", () => {
  it("eight a table, shared evenly; ten kids sit five a side", () => {
    expect(tableCounts({ kids: 10 })).toEqual({ tables: 2, seats: 16, perTable: [5, 5] });
    const t = { ...defaultTableSetup(frozen), kids: 10 };
    const seats = arrangeTables(t).tables.flatMap((x) => x.seats);
    expect(seats.filter((s) => s.facing > 0)).toHaveLength(5);
    expect(seats.filter((s) => s.facing < 0)).toHaveLength(5);
  });
  it("round and square tables seat everyone", () => {
    for (const table of ["round", "square"]) {
      const t = { ...defaultTableSetup(frozen), kids: 17, choices: { ...defaultTableSetup(frozen).choices, table } };
      expect(arrangeTables(t).tables.flatMap((x) => x.seats)).toHaveLength(17);
    }
  });
});

describe("prices", () => {
  it("per table or per child, and nothing for None", () => {
    const t = { ...defaultTableSetup(frozen), kids: 12 };
    const lines = tablePriceLines(t);
    expect(lines.find((l) => l.label.startsWith("Long table"))).toEqual({ label: "Long table (2)", amount: 160 });
    expect(lines.find((l) => l.label.startsWith("White kids' chairs"))).toEqual({ label: "White kids' chairs (12)", amount: 60 });
    expect(lines.some((l) => l.label.startsWith("Gold chargers"))).toBe(false); // chargers: None
    expect(tableTotal(t)).toBe(lines.reduce((a, l) => a + l.amount, 0));
  });
  it("adds to the party total; a skipped table adds nothing", () => {
    const base = defaultConfig();
    const withTable = { ...base, table: defaultTableSetup(frozen) };
    expect(priceBreakdown(withTable).total).toBe(priceBreakdown(base).total + tableTotal(withTable.table));
    expect(priceBreakdown(withTable).lines.filter((l) => l.section === "table").length).toBeGreaterThan(5);
    expect(priceBreakdown({ ...base, table: { ...withTable.table, enabled: false } }).total).toBe(priceBreakdown(base).total);
  });
});

describe("kept on the device", () => {
  it("the table goes with the design and reads back", () => {
    const config = { ...defaultConfig(), theme: "frozen" as const, themeSelected: true, table: { ...defaultTableSetup(frozen), kids: 14 } };
    expect(fromDraft(JSON.stringify(toDraft(config, 2, 3)))!.config.table).toEqual(config.table);
    expect(fromDraft(JSON.stringify(toDraft({ ...config, table: undefined }, 2, 3)))!.config.table).toBeUndefined();
  });
  it("anything that does not read back is replaced, never trusted", () => {
    const t = readTableSetup({ kids: "lots", choices: { table: "triangle", chairs: "gold_chiavari", runner: NONE, plates: NONE }, clothColor: "red;}" }, frozen)!;
    expect(t.kids).toBe(MIN_KIDS);
    expect(t.choices.table).toBe("long");
    expect(t.choices.chairs).toBe("gold_chiavari");
    expect(t.choices.runner).toBe(NONE); // optional: None is allowed
    expect(t.choices.plates).toBe("themed"); // not optional: None is not
    expect(t.clothColor).toBe("#FFFFFF");
    expect(readTableSetup(null, frozen)).toBeUndefined();
  });
});
