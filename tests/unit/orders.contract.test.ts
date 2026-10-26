// The order a customer sends is stored as given: the server recomputes the
// total and keeps the design (lettering, font style, every decor field)
// untouched in `extras`. Supabase is replaced by an in-memory stand-in, so no
// test can write to a real database.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { computeTotal, defaultConfig, THEMES, type BuilderConfig } from "@/lib/config";
import { FIXTURES, fixtureById } from "../fixtures/configs";
import { withSetup, withTheme } from "../fixtures/builder";
import { POST } from "@/app/api/orders/route";

const inserted: Record<string, unknown>[] = [];
let configured = true;
let failWith: string | null = null;
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => {
    if (!configured) throw new Error("Supabase is not configured.");
    return { from: () => ({ insert: async (row: Record<string, unknown>) => {
      if (failWith) return { error: { message: failWith } };
      inserted.push(row); return { error: null };
    } }) };
  },
}));

// The body app/builder/page.tsx submit() sends.
function orderBody(config: BuilderConfig) {
  return {
    eventType: config.eventType,
    theme: config.theme,
    themeSelected: config.themeSelected,
    package: config.package,
    servicePackageId: config.servicePackageId,
    decor: config.decor,
    addOns: config.addOns,
    venue: { ...config.venue, photos: [] },
    customer: { name: "Test Customer", whatsapp: "+971500000000" },
    estimatedTotal: computeTotal(config),
  };
}

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/orders", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

beforeEach(() => { inserted.length = 0; configured = true; failWith = null; });

describe("a request the database cannot take", () => {
  it("still fails visibly, and is written to the server log in full for follow-up", async () => {
    failWith = "TypeError: fetch failed"; // e.g. the Supabase project is gone
    const logged: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { logged.push(a.map(String).join(" ")); });
    const res = await post(orderBody(fixtureById("A-single_round").config));
    spy.mockRestore();
    expect(res.status).toBe(502);
    expect(inserted).toHaveLength(0);
    const line = logged.find((l) => l.includes("[orders] NOT SAVED"));
    expect(line).toBeDefined();
    for (const s of ["Test Customer", "+971500000000", "TypeError: fetch failed", "\"type\":\"round\""]) expect(line).toContain(s);
  });
});

describe("orders contract", () => {
  for (const id of ["B01-hb-arya-script", "B08-turkish", "B13-newline", "C01-legacy-birthday", "E03-foil-pink", "D06-double-two-colours"]) {
    it(`${id}: stored as sent, total recomputed`, async () => {
      const config = fixtureById(id).config;
      const body = orderBody(config);
      const res = await post(body);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.persisted).toBe(true);
      expect(json.total).toBe(computeTotal(config));
      expect(inserted).toHaveLength(1);
      const row = inserted[0] as { extras: { decor: unknown }; total_price: number; theme: string; shape: string; garland: string };
      // Lettering and font style pass through byte-for-byte.
      expect(JSON.stringify(row.extras.decor)).toBe(JSON.stringify(JSON.parse(JSON.stringify(body.decor))));
      expect(row.total_price).toBe(computeTotal(config));
      expect({ theme: row.theme, shape: row.shape, garland: row.garland }).toMatchSnapshot();
    });
  }

  it("a client total is never trusted", async () => {
    const body = { ...orderBody(fixtureById("B01-hb-arya-script").config), estimatedTotal: 1 };
    const json = await (await post(body)).json();
    expect(json.total).toBe(computeTotal(fixtureById("B01-hb-arya-script").config));
  });

  it("without Supabase the order is only logged", async () => {
    configured = false;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const json = await (await post(orderBody(FIXTURES[0].config))).json();
    log.mockRestore();
    expect(json.persisted).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it("rejects an order without a name", async () => {
    const res = await post({ ...orderBody(FIXTURES[0].config), customer: { name: "", whatsapp: "" } });
    expect(res.status).toBe(400);
  });
});

// 2026-10-25 fix: the saved total missed the theme surcharge (AED 30-60) the
// customer saw on Review, because the order body had no themeSelected.
describe("saved total = the total the customer saw", () => {
  it.each(FIXTURES.map((f) => [f.id, f.config] as const))("%s", async (_id, config) => {
    const json = await (await post(orderBody(config))).json();
    expect(json.total).toBe(computeTotal(config));
  });

  it.each(THEMES.map((t) => [t.id, t.priceModifier] as const))("theme %s (+AED %i)", async (id) => {
    const config = withSetup(withTheme(defaultConfig(), id), "single_round");
    const json = await (await post(orderBody(config))).json();
    expect(json.total).toBe(computeTotal(config));
  });

  it("a page loaded before the fix (no themeSelected in the body) is still charged the theme", async () => {
    const config = fixtureById("A-single_round").config;
    const { themeSelected: _omit, ...oldBody } = orderBody(config);
    const json = await (await post(oldBody)).json();
    expect(json.total).toBe(computeTotal(config));
  });

  it("a client cannot drop the surcharge by sending themeSelected: false", async () => {
    const config = fixtureById("A-single_round").config;
    const json = await (await post({ ...orderBody(config), themeSelected: false })).json();
    expect(json.total).toBe(computeTotal(config));
  });

  it("everything else in the price is unchanged: only the theme line moved", async () => {
    for (const f of FIXTURES) {
      const config = f.config;
      const withoutTheme = computeTotal({ ...config, themeSelected: false });
      const json = await (await post(orderBody(config))).json();
      expect(json.total - withoutTheme, f.id).toBe(config.themeSelected ? THEMES.find((t) => t.id === config.theme)!.priceModifier : 0);
    }
  });
});
