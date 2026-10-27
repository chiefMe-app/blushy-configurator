// Table Setup studio (Phase 3): how many tables, who sits where, the estimate,
// and a stored design reading back safely.
import { describe, expect, it } from "vitest";
import { MAX_KIDS, MIN_KIDS, TABLE_PRICES, defaultTableDesign, readTableDesign, tableLayout, tablePrice, tableSwatches } from "@/lib/studio/table";

describe("tables and seats", () => {
  it("eight children a table, shared out evenly", () => {
    expect(tableLayout({ kids: 8, shape: "long" })).toEqual({ tables: 1, seats: 8, perTable: [8] });
    expect(tableLayout({ kids: 12, shape: "long" })).toEqual({ tables: 2, seats: 16, perTable: [6, 6] });
    expect(tableLayout({ kids: 17, shape: "round" })).toEqual({ tables: 3, seats: 24, perTable: [6, 6, 5] });
  });
  it("between 4 and 40 children", () => {
    expect(tableLayout({ kids: 1, shape: "long" }).perTable).toEqual([MIN_KIDS]);
    expect(tableLayout({ kids: 99, shape: "long" }).tables).toBe(MAX_KIDS / 8);
  });
});

describe("the estimate", () => {
  it("adds per-table and per-child items for what is chosen", () => {
    const d = { ...defaultTableDesign("frozen"), kids: 12, chairs: "gold_chiavari" as const, runner: "sequin" as const, centrepiece: "florals" as const, placeCards: true, favourBoxes: true, partyHats: false };
    const P = TABLE_PRICES;
    const { lines, total } = tablePrice(d);
    expect(total).toBe(2 * P.tableWithChairs + 12 * P.chairUpgrade.gold_chiavari + 2 * P.cloth + 2 * P.runner.sequin
      + 12 * P.tableware.themed + 2 * P.centrepiece.florals + 12 * P.placeCard + 12 * P.favourBox);
    expect(lines.map((l) => l.label)).toContain("Name cards (12)");
    expect(lines.some((l) => /hats/i.test(l.label))).toBe(false);
  });
  it("no runner, no centrepiece: no lines for them", () => {
    const { lines } = tablePrice({ ...defaultTableDesign(), runner: "none", centrepiece: "none" });
    expect(lines.some((l) => /runner|centrepiece/i.test(l.label))).toBe(false);
  });
});

describe("a stored design", () => {
  it("reads back as it was", () => {
    const d = { ...defaultTableDesign("unicorn"), kids: 20, shape: "round" as const };
    expect(readTableDesign(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it("anything that does not read back is replaced, never trusted", () => {
    expect(readTableDesign(null)).toBeNull();
    expect(readTableDesign({ v: 1, theme: "nope" })).toBeNull();
    const d = readTableDesign({ v: 1, theme: "frozen", kids: "lots", shape: "triangle", clothColor: "red;}", chairs: "throne", placeCards: "yes" })!;
    expect(d).toMatchObject({ kids: MIN_KIDS, shape: "long", clothColor: "#FFFFFF", chairs: "white_kids", placeCards: false });
  });
  it("the colours on offer are the theme's", () => {
    expect(tableSwatches("frozen")).toContain("#BAE6FD");
    expect(tableSwatches("frozen")[0]).toBe("#FFFFFF");
  });
});
