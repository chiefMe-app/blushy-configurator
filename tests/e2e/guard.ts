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
}

export async function lockNetwork(page: Page): Promise<Guard> {
  const guard: Guard = { blocked: [], external: [], fakeRender: false, fakeOrder: false };
  await page.route("**/*", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
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

export const test = base.extend<{ guard: Guard }>({
  guard: async ({ page }, use) => {
    const g = await lockNetwork(page);
    await use(g);
    // Fonts from Google are the one outside request the page itself makes;
    // anything else trying to leave the machine fails the test.
    expect(g.external.filter((u) => !/fonts\.(googleapis|gstatic)\.com/.test(u)), "external requests").toEqual([]);
  },
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
