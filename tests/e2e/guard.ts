// Network lock and shared steps for every e2e test. Nothing leaves the
// machine, and the endpoints that cost money or store data never reach the
// server: they are recorded (so a test can inspect what the UI sent) and
// either aborted or answered with a stand-in.
import { test as base, expect, type Page, type Request, type Route } from "@playwright/test";

const BLOCKED_API = /\/api\/(orders|generate|generate-cutouts|generate-controlled-render|generate-structure-render-test)\/?(\?|$)/;

/** A stand-in render: any local picture, so the flow can move past Decor. */
export const FAKE_RENDER = "/design/balloon-dog-outline.webp";

export interface Guard {
  blocked: Request[];
  external: string[];
  /** Answer blocked render requests with FAKE_RENDER instead of aborting. */
  fakeRender: boolean;
  /** Answer blocked order requests the way the route does without Supabase. */
  fakeOrder: boolean;
  /** Answer blocked render requests the way the render limits do (lib/renderGuard.ts). */
  limitRender?: { status: number; error: string; busy?: boolean };
  /** The stand-in Supabase at supabase.test (see fakeSupabase below). */
  supabase: FakeSupabase;
}

/**
 * A stand-in for Supabase, answered inside the browser: guest sign-in and the
 * parties / party_items tables, kept in memory, with every request recorded.
 * The Builder is built with NEXT_PUBLIC_SUPABASE_URL=http://supabase.test
 * (playwright.config.ts); nothing reaches a real Supabase.
 */
export interface FakeSupabase {
  requests: { method: string; path: string; body: unknown }[];
  parties: Record<string, unknown>[];
  items: Record<string, unknown>[];
  /** Answer guest sign-in the way Supabase does when it is switched off. */
  anonymousOff: boolean;
}
const FAKE_SUPABASE_HOST = "supabase.test";
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

async function fakeSupabase(route: Route, db: FakeSupabase) {
  const req = route.request();
  const url = new URL(req.url());
  const cors = {
    "access-control-allow-origin": req.headers()["origin"] ?? "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-expose-headers": "content-range",
  };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  let body: unknown = null;
  try { body = req.postData() ? JSON.parse(req.postData()!) : null; } catch { body = req.postData(); }
  db.requests.push({ method: req.method(), path: url.pathname + url.search, body });
  const json = (status: number, data: unknown) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(data) });

  if (url.pathname === "/auth/v1/signup" && req.method() === "POST") {
    if (db.anonymousOff) return json(422, { code: 422, error_code: "anonymous_provider_disabled", msg: "Anonymous sign-ins are disabled" });
    const id = "00000000-0000-4000-8000-0000000000e2";
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const user = { id, aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
    const access_token = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: id, role: "authenticated", is_anonymous: true, exp })}.e2e`;
    return json(200, { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "e2e-refresh", user });
  }
  const table = url.pathname === "/rest/v1/parties" ? db.parties : url.pathname === "/rest/v1/party_items" ? db.items : null;
  if (!table) return json(404, { message: "not in the stand-in" });
  const one = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
  const wantsRows = (req.headers()["prefer"] ?? "").includes("return=representation");
  if (req.method() === "POST") {
    const row = { id: `${url.pathname.split("/").pop()}-${table.length + 1}`, ...(body as object) };
    table.push(row);
    return wantsRows ? json(201, one ? { id: row.id } : [{ id: row.id }]) : route.fulfill({ status: 201, headers: cors });
  }
  if (req.method() === "PATCH") {
    const id = url.searchParams.get("id")?.replace(/^eq./, "");
    const hit = table.filter((r) => r.id === id);
    hit.forEach((r) => Object.assign(r, body));
    return wantsRows ? json(200, hit.map((r) => ({ id: r.id }))) : route.fulfill({ status: 204, headers: cors });
  }
  return json(405, { message: "method not in the stand-in" });
}

export async function lockNetwork(page: Page): Promise<Guard> {
  const guard: Guard = { blocked: [], external: [], fakeRender: false, fakeOrder: false,
    supabase: { requests: [], parties: [], items: [], anonymousOff: false } };
  await page.route("**/*", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.hostname === FAKE_SUPABASE_HOST) return fakeSupabase(route, guard.supabase);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!local) {
      guard.external.push(req.url());
      return route.abort("blockedbyclient");
    }
    if (BLOCKED_API.test(url.pathname)) {
      guard.blocked.push(req);
      if (guard.limitRender && url.pathname.startsWith("/api/generate-controlled-render")) {
        const { status, error, busy } = guard.limitRender;
        return route.fulfill({ status, json: busy ? { error, busy: true } : { error, limited: true } });
      }
      if (guard.fakeRender && url.pathname.startsWith("/api/generate-controlled-render")) {
        return route.fulfill({ json: { imageUrl: FAKE_RENDER } });
      }
      if (guard.fakeOrder && url.pathname.startsWith("/api/orders")) {
        return route.fulfill({ json: { designId: "TEST-ORDER", total: 0, persisted: false } });
      }
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return guard;
}

// auto: every test is locked, whether or not it names `guard` (2026-10-26: a
// test that did not name it reached the network).
export const test = base.extend<{ guard: Guard }>({
  guard: [async ({ page }, use) => {
    const g = await lockNetwork(page);
    await use(g);
    // Fonts from Google are the one outside request the page itself makes;
    // anything else trying to leave the machine fails the test.
    expect(g.external.filter((u) => !/fonts\.(googleapis|gstatic)\.com/.test(u)), "external requests").toEqual([]);
  }, { auto: true }],
});
export { expect };

// ---- shared steps ---------------------------------------------------------

const exactly = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

export const next = (page: Page) => page.locator("button.bz-next");
export const total = (page: Page) => page.locator(".bz-total strong");

/** Event → Theme → Decor (Backdrop tab), with the given theme and setup. */
export async function openDecor(page: Page, theme = "Frozen", setup?: string) {
  await page.goto("/builder");
  await page.locator(".bz-choice.bz-birthday").click();
  await next(page).click();
  await page.locator(".bz-choice.bz-theme", { has: page.locator("h3", { hasText: exactly(theme) }) }).first().click();
  await next(page).click();
  if (setup) await chooseSetup(page, setup);
}

export async function chooseSetup(page: Page, name: string) {
  await page.locator(".bz-choice.bz-layout", { has: page.locator("h3", { hasText: exactly(name) }) }).click();
}

export async function decorTab(page: Page, name: "Backdrop" | "Style" | "Balloons" | "Extras") {
  await page.locator(".bz-decor-tab", { hasText: name }).click();
}

/** The request body the UI sends when Generate render is pressed. */
export async function captureRenderBody(page: Page, guard: Guard): Promise<Record<string, unknown>> {
  const before = guard.blocked.length;
  await decorTab(page, "Extras");
  await next(page).click();
  await expect.poll(() => guard.blocked.slice(before).some((r) => r.url().includes("/api/generate-controlled-render"))).toBe(true);
  const req = guard.blocked.slice(before).find((r) => r.url().includes("/api/generate-controlled-render"))!;
  return JSON.parse(req.postData() ?? "{}");
}

/**
 * Wait for fonts, images and a still page, so screenshots are stable. On
 * phones a tab change scrolls the page to the tab bar, and pictures loading
 * meanwhile can move it again — including SVG <image>s, which are not in
 * document.images. Wait until the scroll position, the page height and where
 * the headings and buttons sit have not changed for 6 frames (up to 5 s).
 */
export async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    const marks = () => Array.from(document.querySelectorAll("h1,h2,h3,button")).slice(0, 80).reduce((s, el) => s + Math.round(el.getBoundingClientRect().top), 0);
    const state = () => `${window.scrollY}|${document.documentElement.scrollHeight}|${marks()}`;
    let last = state(), still = 0;
    const until = performance.now() + 5000;
    while (still < 6 && performance.now() < until) { await frame(); const s = state(); still = s === last ? still + 1 : 0; last = s; }
  });
}

/** GIFs keep animating in screenshots; mask them. */
export const masks = (page: Page) => [page.locator("img[src$='.gif']")];
