// Runs first. Proves the test server has no keys — so even a request that got
// past the browser lock could not spend money or store data — and that the
// browser lock holds. If this fails, stop: do not run the other suites.
import { test, expect } from "@playwright/test";
import { lockNetwork } from "./guard";
import { fixtureById } from "../fixtures/configs";

test.describe.configure({ mode: "serial" });

test("orders are only logged: no database configured", async ({ request }) => {
  const config = fixtureById("A-single_round").config;
  const res = await request.post("/api/orders", {
    data: { ...config, venue: { ...config.venue, photos: [] }, customer: { name: "Safety Check", whatsapp: "+971500000000" } },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).persisted).toBe(false);
});

test("renders cannot reach fal: no key configured", async ({ request }) => {
  const res = await request.post("/api/generate-controlled-render", { data: {} });
  expect(res.status()).toBe(500);
  expect((await res.json()).error).toBe("Missing FAL_KEY.");
});

test("the browser lock blocks paid and storing endpoints", async ({ page }) => {
  const guard = await lockNetwork(page);
  await page.goto("/builder");
  const results = await page.evaluate(async () => {
    const tryFetch = async (u: string) => { try { await fetch(u, { method: "POST", body: "{}" }); return "reached"; } catch { return "blocked"; } };
    return {
      orders: await tryFetch("/api/orders"),
      render: await tryFetch("/api/generate-controlled-render"),
      external: await tryFetch("https://fal.run/anything"),
    };
  });
  expect(results).toEqual({ orders: "blocked", render: "blocked", external: "blocked" });
  expect(guard.external).toContain("https://fal.run/anything");
});
