// Network lock and shared steps for every e2e test. Nothing leaves the
// machine, and the endpoints that cost money or store data never reach the
// server: they are recorded (so a test can inspect what the UI sent) and
// either aborted or answered with a stand-in.
import fs from "fs";
import nodePath from "path";
import { test as base, expect, type Page, type Request, type Route } from "@playwright/test";
import { renderKey } from "@/lib/renderKey";

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
 * A stand-in for Supabase, answered inside the browser: guest sign-in, the
 * emailed-link sign-in (with its code exchange), and the parties /
 * party_items tables kept in memory and filtered by owner the way the table
 * rules do, with every request recorded. The Builder is built with
 * NEXT_PUBLIC_SUPABASE_URL=http://supabase.test (playwright.config.ts);
 * nothing reaches a real Supabase.
 */
export interface FakeSupabase {
  requests: { method: string; path: string; body: unknown }[];
  parties: Record<string, unknown>[];
  items: Record<string, unknown>[];
  /** Answer guest sign-in the way Supabase does when it is switched off. */
  anonymousOff: boolean;
  /** The account an emailed link signs in to. */
  account: { id: string; email: string };
}
export const FAKE_GUEST_ID = "00000000-0000-4000-8000-0000000000e2";
export const FAKE_ACCOUNT = { id: "00000000-0000-4000-8000-0000000000a1", email: "arya.parent@example.com" };
const FAKE_SUPABASE_HOST = "supabase.test";
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

function session(id: string, anonymous: boolean, email?: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id, aud: "authenticated", role: "authenticated", is_anonymous: anonymous, email, app_metadata: { provider: anonymous ? "anonymous" : "email" },
    user_metadata: {}, identities: [], created_at: new Date().toISOString() };
  const access_token = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: id, role: "authenticated", is_anonymous: anonymous, email, exp })}.e2e`;
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: `e2e-refresh-${id}`, user };
}

async function fakeSupabase(route: Route, db: FakeSupabase) {
  const req = route.request();
  const url = new URL(req.url());
  const cors = {
    "access-control-allow-origin": req.headers()["origin"] ?? "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-expose-headers": "content-range",
  };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  let body: unknown = null;
  try { body = req.postData() ? JSON.parse(req.postData()!) : null; } catch { body = req.postData(); }
  db.requests.push({ method: req.method(), path: url.pathname + url.search, body });
  const json = (status: number, data: unknown) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(data) });
  // Who is asking: the user in the request's access token (none for the anon key).
  const who = (() => {
    const t = (req.headers()["authorization"] ?? "").replace(/^Bearer /, "").split(".")[1];
    try { return t ? (JSON.parse(Buffer.from(t, "base64url").toString()) as { sub?: string }).sub ?? null : null; } catch { return null; }
  })();
  const path = url.pathname;

  if (path === "/auth/v1/signup" && req.method() === "POST") {
    if (db.anonymousOff) return json(422, { code: 422, error_code: "anonymous_provider_disabled", msg: "Anonymous sign-ins are disabled" });
    return json(200, session(FAKE_GUEST_ID, true));
  }
  if (path === "/auth/v1/otp" && req.method() === "POST") return json(200, {});
  if (path === "/auth/v1/user" && req.method() === "PUT") {
    // A guest adding an email that already has an account (the test case): refused, as Supabase does.
    return json(422, { code: 422, error_code: "email_exists", msg: "A user with this email address has already been registered" });
  }
  if (path === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce") return json(200, session(db.account.id, false, db.account.email));
  if (path === "/auth/v1/logout") return route.fulfill({ status: 204, headers: cors });
  // Google: linking a guest returns the provider page to go to; that page is a stand-in.
  if (path === "/auth/v1/user/identities/authorize") {
    return json(200, { url: `http://${FAKE_SUPABASE_HOST}/auth/v1/authorize?provider=${url.searchParams.get("provider")}&redirect_to=${encodeURIComponent(url.searchParams.get("redirect_to") ?? "")}` });
  }
  if (path === "/auth/v1/authorize") return route.fulfill({ status: 200, headers: { "content-type": "text/html" }, body: "<h1>Google sign-in (stand-in)</h1>" });

  // Storage (0.5c): signed links to stored renders, the pictures behind them, removal.
  const storage = path.match(/^\/storage\/v1\/object\/(sign\/)?renders(?:\/(.+))?$/);
  if (storage) {
    const [, sign, file] = storage;
    const signed = (p: string) => `/object/sign/renders/${p}?token=e2e`;
    if (sign && req.method() === "POST" && !file) return json(200, ((body as { paths: string[] }).paths ?? []).map((p) => ({ path: p, signedURL: signed(p), error: null })));
    if (sign && req.method() === "POST") return json(200, { signedURL: signed(decodeURIComponent(file)) });
    if (sign && req.method() === "GET") {
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "image/webp" }, body: fs.readFileSync(nodePath.join(process.cwd(), "public", FAKE_RENDER)) });
    }
    if (!sign && req.method() === "DELETE") return json(200, []);
    return json(405, { message: "storage call not in the stand-in" });
  }
  const table = path === "/rest/v1/parties" ? db.parties : path === "/rest/v1/party_items" ? db.items : null;
  if (!table) return json(404, { message: "not in the stand-in" });
  const mine = table.filter((r) => r.owner_id === who);
  const eq = (k: string) => url.searchParams.get(k)?.replace(/^eq\./, "");
  const one = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
  const wantsRows = (req.headers()["prefer"] ?? "").includes("return=representation");
  const tag = path.split("/").pop();
  if (req.method() === "GET") {
    const rows = mine.map((r) => (table === db.items ? { ...r, parties: { title: db.parties.find((p) => p.id === r.party_id)?.title ?? "My party" } } : r));
    return json(200, rows);
  }
  if (req.method() === "POST") {
    const added = (Array.isArray(body) ? body : [body]).map((b) => {
      const row: Record<string, unknown> = { id: `${tag}-${table.length + 1}`, owner_id: who, title: tag === "parties" ? "My party" : undefined,
        updated_at: new Date().toISOString(), ...(b as object) };
      if (row.title === undefined) delete row.title;
      table.push(row);
      return row;
    });
    const ids = added.map((r) => ({ id: r.id }));
    return wantsRows ? json(201, one ? ids[0] : ids) : route.fulfill({ status: 201, headers: cors });
  }
  if (req.method() === "PATCH") {
    const hit = mine.filter((r) => r.id === eq("id"));
    hit.forEach((r) => Object.assign(r, body, { updated_at: new Date().toISOString() }));
    return wantsRows ? json(200, hit.map((r) => ({ id: r.id }))) : route.fulfill({ status: 204, headers: cors });
  }
  if (req.method() === "DELETE") {
    for (const r of mine.filter((x) => x.id === eq("id"))) table.splice(table.indexOf(r), 1);
    return route.fulfill({ status: 204, headers: cors });
  }
  return json(405, { message: "method not in the stand-in" });
}

/** The user id in a request's `Authorization: Bearer <JWT>`, if any. */
function tokenSubject(header: string | undefined): string | null {
  const t = (header ?? "").replace(/^Bearer /, "").split(".")[1];
  try { return t ? (JSON.parse(Buffer.from(t, "base64url").toString()) as { sub?: string }).sub ?? null : null; } catch { return null; }
}

export async function lockNetwork(page: Page): Promise<Guard> {
  const guard: Guard = { blocked: [], external: [], fakeRender: false, fakeOrder: false,
    supabase: { requests: [], parties: [], items: [], anonymousOff: false, account: { ...FAKE_ACCOUNT } } };
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
        // As the server does for a signed-in customer (0.5c): the render is also kept in their account.
        const sub = tokenSubject(req.headers()["authorization"]);
        const scene = (() => { try { return String(JSON.parse(req.postData() ?? "{}").currentSceneHash ?? ""); } catch { return ""; } })();
        const key = renderKey(scene);
        return route.fulfill({ json: sub && scene ? { imageUrl: FAKE_RENDER, storedRender: { path: `${sub}/${key}.jpg`, key } } : { imageUrl: FAKE_RENDER } });
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

export const next = (page: Page) => page.locator(".bz-footer button.bz-next"); // the footer's, not a step's own pink buttons
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

/**
 * Signs in to the stand-in account with the emailed link (since 2026-10-27
 * renders need an account), from My designs, so the test then starts afresh.
 */
export async function signIn(page: Page) {
  await page.goto("/my-designs");
  await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill(FAKE_ACCOUNT.email);
  await dialog.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(dialog.getByRole("status")).toContainText("Check your inbox");
  await page.goto("/account/callback?code=e2e-link");
  await expect(page).toHaveURL(/\/my-designs$/);
}

/**
 * The visible Generate render button (2026-10-27: optional; the footer goes on
 * to Package): the preview card's on desktop, where the Extras tab's own
 * footer is hidden; the first of the two on phones. Gone once the render is in
 * (the card then offers "Regenerate").
 */
export const renderButton = (page: Page) => page.getByRole("button", { name: /^Generate render/ }).first();

/** The request body the UI sends when Generate render is pressed. */
export async function captureRenderBody(page: Page, guard: Guard): Promise<Record<string, unknown>> {
  const before = guard.blocked.length;
  await decorTab(page, "Extras");
  await renderButton(page).click();
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
