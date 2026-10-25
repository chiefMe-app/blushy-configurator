// The order a customer sends is stored as given: the server recomputes the
// total and keeps the design (lettering, font style, every decor field)
// untouched in `extras`. Supabase is replaced by an in-memory stand-in, so no
// test can write to a real database.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { computeTotal, themeById, type BuilderConfig } from "@/lib/config";
import { FIXTURES, fixtureById } from "../fixtures/configs";
import { POST } from "@/app/api/orders/route";

const inserted: Record<string, unknown>[] = [];
let configured = true;
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => {
    if (!configured) throw new Error("Supabase is not configured.");
    return { from: () => ({ insert: async (row: Record<string, unknown>) => { inserted.push(row); return { error: null }; } }) };
  },
}));

// The body app/builder/page.tsx submit() sends.
function orderBody(config: BuilderConfig) {
  return {
    eventType: config.eventType,
    theme: config.theme,
    package: config.package,
    servicePackageId: config.servicePackageId,
    decor: config.decor,
    addOns: config.addOns,
    venue: { ...config.venue, photos: [] },
    customer: { name: "Test Customer", whatsapp: "+971500000000" },
    estimatedTotal: computeTotal(config),
  };
}

// What the server prices today: the submitted body has no themeSelected, so
// the theme surcharge line is dropped (see the KNOWN ISSUE test below).
const serverTotal = (config: BuilderConfig) => computeTotal({ ...config, themeSelected: undefined } as unknown as BuilderConfig);

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/orders", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

beforeEach(() => { inserted.length = 0; configured = true; });

describe("orders contract", () => {
  for (const id of ["B01-hb-arya-script", "B08-turkish", "B13-newline", "C01-legacy-birthday", "E03-foil-pink", "D06-double-two-colours"]) {
    it(`${id}: stored as sent, total recomputed`, async () => {
      const config = fixtureById(id).config;
      const body = orderBody(config);
      const res = await post(body);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.persisted).toBe(true);
      expect(json.total).toBe(serverTotal(config));
      expect(inserted).toHaveLength(1);
      const row = inserted[0] as { extras: { decor: unknown }; total_price: number; theme: string; shape: string; garland: string };
      // Lettering and font style pass through byte-for-byte.
      expect(JSON.stringify(row.extras.decor)).toBe(JSON.stringify(JSON.parse(JSON.stringify(body.decor))));
      expect(row.total_price).toBe(serverTotal(config));
      expect({ theme: row.theme, shape: row.shape, garland: row.garland }).toMatchSnapshot();
    });
  }

  it("a client total is never trusted", async () => {
    const body = { ...orderBody(fixtureById("B01-hb-arya-script").config), estimatedTotal: 1 };
    const json = await (await post(body)).json();
    expect(json.total).toBe(serverTotal(fixtureById("B01-hb-arya-script").config));
  });

  // KNOWN ISSUE (found in Phase 0.0, 2026-10-25, not fixed here — app code is
  // out of scope): app/builder/page.tsx submit() does not send themeSelected,
  // so the saved total_price is lower than the Review total the customer saw
  // by the theme's priceModifier. When that is fixed, this test changes on
  // purpose: the gap becomes 0.
  it("KNOWN ISSUE: saved total misses the theme surcharge the customer saw", async () => {
    const config = fixtureById("B01-hb-arya-script").config;
    const json = await (await post(orderBody(config))).json();
    expect(computeTotal(config) - json.total).toBe(themeById(config.theme)!.priceModifier);
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
