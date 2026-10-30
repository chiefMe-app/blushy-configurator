// The kids' table in the builder (F2): seats, per-item prices, the party
// total, and a stored table reading back safely.
import { describe, expect, it } from "vitest";
import { defaultConfig, priceBreakdown, themeById } from "@/lib/config";
import { fromDraft, toDraft } from "@/lib/draft";
import { NONE, TABLE_ITEMS, TABLE_SECTIONS, optionPhoto, tableOption } from "@/lib/studio/tableCatalog";
import { MAX_PLACEMAT_TEXT, MIN_KIDS, cleanPlacematText, defaultTableSetup, readTableSetup, tableCounts, tablePriceLines, tableTotal } from "@/lib/studio/tableSetup";
import { arrangeTables } from "@/components/studio/table/TableSketch";

const frozen = themeById("frozen")!;

describe("the catalog", () => {
  it("every item has options, and every item is in a section of the one page", () => {
    // The plates and cups are one kind each, in a colour or a foil (2026-10-29).
    for (const item of TABLE_ITEMS) expect(item.options.length).toBeGreaterThanOrEqual(item.optional || item.key === "plates" || item.key === "cups" ? 1 : 2);
    expect(TABLE_ITEMS.find((i) => i.key === "table")!.options.map((o) => o.id)).toEqual(["standard", "half_wave", "flower", "round", "low", "cloud"]);
    for (const o of TABLE_ITEMS.find((i) => i.key === "table")!.options) expect(o.seats).toBeGreaterThan(0);
    expect(TABLE_SECTIONS.flatMap((t) => t.items).sort()).toEqual(TABLE_ITEMS.map((i) => i.key).sort());
  });
  it("the owner's list (2026-10-28): no runner, name cards or chair decorations; a plain cloth or none; holders and bottle labels", () => {
    const keys = TABLE_ITEMS.map((i) => i.key);
    for (const gone of ["runner", "nameCards", "chairDecor", "chargers"]) expect(keys).not.toContain(gone);
    expect(keys).toEqual(expect.arrayContaining(["cutleryHolder", "bottleLabel", "centrepiece", "placemats"]));
    expect(TABLE_ITEMS.find((i) => i.key === "tablecloth")!.options.map((o) => o.name)).toEqual(["Plain cloth"]);
    expect(defaultTableSetup(frozen).choices.tablecloth).toBe(NONE); // None comes chosen
  });
  it("placemats are the theme's own: one picture per theme", () => {
    const o = tableOption("placemats", "watercolour");
    expect(optionPhoto("placemats", o, "frozen")).toBe("/design/table/placemats/frozen/watercolour.webp");
    expect(optionPhoto("placemats", o, "dinosaur")).toBe("/design/table/placemats/dinosaur/watercolour.webp");
    expect(optionPhoto("centrepiece", tableOption("centrepiece", "cutouts"), "frozen")).toBe("/design/table/centrepiece/frozen/cutouts.webp");
  });
});

const withTable = (table: string, kids: number) => ({ ...defaultTableSetup(frozen), kids, choices: { ...defaultTableSetup(frozen).choices, table } });

describe("seats", () => {
  it("as many a table as the owner's table seats, shared evenly; ten kids at the standard table sit five a side", () => {
    expect(tableCounts(withTable("standard", 10))).toEqual({ tables: 1, seats: 10, perTable: [10] });
    expect(tableCounts(withTable("flower", 11))).toEqual({ tables: 2, seats: 12, perTable: [6, 5] });
    expect(tableCounts(withTable("round", 17))).toEqual({ tables: 2, seats: 32, perTable: [9, 8] });
    const seats = arrangeTables(withTable("standard", 10)).tables.flatMap((x) => x.seats);
    expect(seats.filter((s) => s.facing > 0)).toHaveLength(5);
    expect(seats.filter((s) => s.facing < 0)).toHaveLength(5);
  });
  it("every kind of table seats everyone, every seat at the table's edge facing in", () => {
    for (const o of TABLE_ITEMS.find((i) => i.key === "table")!.options) {
      const { tables } = arrangeTables(withTable(o.id, 17));
      expect(tables.flatMap((x) => x.seats)).toHaveLength(17);
      for (const t of tables) {
        expect(t.outline.length).toBeGreaterThan(3);
        for (const s of t.seats) {
          // The seat is outside the table, and looking from it along `facing` reaches the edge.
          expect(Math.hypot(s.ex - s.x, s.ey - s.y)).toBeGreaterThan(20);
          expect(Math.cos(s.facing) * (s.ex - s.x) + Math.sin(s.facing) * (s.ey - s.y)).toBeGreaterThan(0);
        }
      }
    }
  });
  it("tables never overlap", () => {
    for (const o of TABLE_ITEMS.find((i) => i.key === "table")!.options) {
      const { tables } = arrangeTables(withTable(o.id, 40));
      for (const a of tables) for (const b of tables) if (a !== b) {
        expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
      }
    }
  });
});

describe("prices", () => {
  it("per table or per child, and nothing for None", () => {
    const t = { ...defaultTableSetup(frozen), kids: 12 };
    const lines = tablePriceLines(t);
    // The owner's prices (2026-10-28): AED 399 a standard table, 25 a chair.
    expect(lines.find((l) => l.label.startsWith("Standard table"))).toEqual({ label: "Standard table (2)", amount: 798 });
    expect(lines.find((l) => l.label.startsWith("Colour chair for kids"))).toEqual({ label: "Colour chair for kids (12)", amount: 300 });
    expect(lines.some((l) => l.label.startsWith("Plain cloth"))).toBe(false); // None, unless chosen
    expect(lines.find((l) => l.label.startsWith("Watercolour placemat"))).toEqual({ label: "Watercolour placemat (12)", amount: 72 });
    expect(tablePriceLines({ ...t, choices: { ...t.choices, placemats: NONE } }).some((l) => l.label.startsWith("Watercolour placemat"))).toBe(false); // None
    expect(tableTotal(t)).toBe(lines.reduce((a, l) => a + l.amount, 0));
  });
  it("the low table comes with floor cushions: no chairs to pay for", () => {
    const lines = tablePriceLines(withTable("low", 10));
    expect(lines.find((l) => l.label.startsWith("Low table"))).toEqual({ label: "Low table (1)", amount: 749 });
    expect(lines.some((l) => /chair/i.test(l.label))).toBe(false);
  });
  it("adds to the party total; a skipped table adds nothing", () => {
    const base = defaultConfig();
    const withTable = { ...base, table: defaultTableSetup(frozen) };
    expect(priceBreakdown(withTable).total).toBe(priceBreakdown(base).total + tableTotal(withTable.table));
    expect(priceBreakdown(withTable).lines.filter((l) => l.section === "table").length).toBeGreaterThan(5);
    expect(priceBreakdown({ ...base, table: { ...withTable.table, enabled: false } }).total).toBe(priceBreakdown(base).total);
  });
  it("a skipped backdrop adds none of its lines; the table still counts", () => {
    const base = { ...defaultConfig(), table: defaultTableSetup(frozen) };
    const skipped = { ...base, decor: { ...base.decor, backdropChoice: "skip" as const } };
    const lines = priceBreakdown(skipped).lines;
    expect(lines.some((l) => l.section === "design" && /Backdrop|Balloons|Plinth/i.test(l.label))).toBe(false);
    expect(lines.filter((l) => l.section === "table").length).toBeGreaterThan(5);
    expect(priceBreakdown(skipped).total).toBeLessThan(priceBreakdown(base).total);
  });
});

describe("kept on the device", () => {
  it("the table goes with the design and reads back", () => {
    const config = { ...defaultConfig(), theme: "frozen" as const, themeSelected: true, table: { ...defaultTableSetup(frozen), kids: 14 } };
    expect(fromDraft(JSON.stringify(toDraft(config, 2, 3)))!.config.table).toEqual(config.table);
    expect(fromDraft(JSON.stringify(toDraft({ ...config, table: undefined }, 2, 3)))!.config.table).toBeUndefined();
  });
  it("anything that does not read back is replaced, never trusted", () => {
    const t = readTableSetup({ kids: "lots", choices: { table: "triangle", chairs: "bow_kids", runner: NONE, plates: NONE }, clothColor: "red;}" }, frozen)!;
    expect(t.kids).toBe(MIN_KIDS);
    expect(t.choices.table).toBe("standard");
    expect(t.choices.chairs).toBe("bow_kids");
    expect(t.choices.runner).toBe(NONE); // optional: None is allowed
    expect(t.choices.plates).toBe("plain"); // not optional: None is not
    expect(t.clothColor).toBe("#FFFFFF");
    expect(readTableSetup(null, frozen)).toBeUndefined();
  });
  it("a kids' table kept before it turned into a kids' party reads back with kids' pieces", () => {
    const t = readTableSetup({ choices: { chairs: "gold_chiavari", chargers: "gold", plates: "white_gold", napkins: "folded", runner: "greenery" } }, frozen)!;
    expect(t.choices).toMatchObject({ chairs: "blue_kids", chargers: NONE, plates: "plain", napkins: "plain", runner: NONE });
    expect(t.chairColor).toBe("#FFFFFF");
  });
  it("the foil plates and cups kept before 2026-10-29 read back as plain ones in that foil", () => {
    const t = readTableSetup({ choices: { plates: "silver", cups: "iridescent" }, plateColor: "#F8BBD0" }, frozen)!;
    expect(t.choices).toMatchObject({ plates: "plain", cups: "plain" });
    expect(t).toMatchObject({ plateColor: "silver", smallPlateColor: "silver", cupColor: "iridescent" });
    expect(readTableSetup({ plateColor: "gold", cupColor: "chrome" }, frozen)).toMatchObject({ plateColor: "gold", cupColor: defaultTableSetup(frozen).cupColor });
  });
  it("pieces no longer offered read back as None, and the placemat words are kept clean", () => {
    // placematText: how the placemat words were kept on their first day.
    const t = readTableSetup({ choices: { runner: "tulle", nameCards: "tent", chairDecor: "balloon", tablecloth: "ruffle" }, placematText: "  Zahra <b>turns</b>   4  " }, frozen)!;
    expect(t.choices).toMatchObject({ runner: NONE, nameCards: NONE, chairDecor: NONE, tablecloth: NONE });
    expect(t.words).toEqual({ placemats: "Zahra bturnsb 4" });
    expect(readTableSetup({ words: { cutleryHolder: "Arya", bottleLabel: " Arya turns 6 ", other: "x" } }, frozen)!.words).toEqual({ cutleryHolder: "Arya", bottleLabel: "Arya turns 6" });
    expect(cleanPlacematText("x".repeat(80))).toHaveLength(MAX_PLACEMAT_TEXT);
    expect(cleanPlacematText("   ")).toBeUndefined();
    expect(readTableSetup({ placematText: 42, words: "x" }, frozen)!.words).toBeUndefined();
  });
  it("only the plain napkin takes a colour; the bottle labels wear the theme's placemat designs", () => {
    expect(TABLE_ITEMS.find((i) => i.key === "napkins")!.options.filter((o) => o.coloured).map((o) => o.id)).toEqual(["plain"]);
    expect(optionPhoto("bottleLabel", tableOption("bottleLabel", "sparkle"), "frozen")).toBe("/design/table/placemats/frozen/sparkle.webp");
  });
  it("tables and chairs from before the owner's own read back as hers", () => {
    const t = readTableSetup({ choices: { table: "long", chairs: "pastel_kids" } }, frozen)!;
    expect(t.choices).toMatchObject({ table: "standard", chairs: "blue_kids" });
    // The white chair of before: the colour chair in white (2026-10-30), whatever colour was kept with it.
    expect(readTableSetup({ choices: { chairs: "white_kids" }, chairColor: "#38BDF8" }, frozen)).toMatchObject({ choices: { chairs: "blue_kids" }, chairColor: "#FFFFFF" });
  });
});
