import { describe, expect, it } from "vitest";
import { computeTotal, priceBreakdown, FOIL_NUMBER_BUNCH_PRICE } from "@/lib/config";
import { FIXTURES, fixtureById } from "../fixtures/configs";

describe("pricing golden", () => {
  for (const f of FIXTURES) {
    it(f.id, () => {
      const breakdown = priceBreakdown(f.config);
      const total = computeTotal(f.config);
      expect({ breakdown, total }).toMatchSnapshot();
    });
  }
});

describe("pricing invariants", () => {
  it.each(FIXTURES.map((f) => [f.id, f] as const))("%s: total is the sum of its lines, nothing negative", (_id, f) => {
    const b = priceBreakdown(f.config);
    for (const l of b.lines) expect(l.amount).toBeGreaterThanOrEqual(0);
    expect(b.lines.reduce((s, l) => s + l.amount, 0)).toBe(b.total);
    expect(computeTotal(f.config)).toBe(b.total);
  });

  it("foil number bunch is AED 150", () => {
    expect(FOIL_NUMBER_BUNCH_PRICE).toBe(150);
    const b = priceBreakdown(fixtureById("E03-foil-pink").config);
    expect(b.lines.some((l) => l.amount === 150 && /foil|number/i.test(l.label))).toBe(true);
  });
});
