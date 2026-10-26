// The isolated /typography-demo page: the real engine behind every control,
// Heading and Name edited independently, on desktop and mobile.
import { test, expect, settle } from "./guard";
import type { Page } from "@playwright/test";

const paths = async (page: Page) => page.locator('[data-testid="lettering"] path').evaluateAll((ps) =>
  Object.fromEntries(ps.map((p) => [p.getAttribute("data-role"), { d: p.getAttribute("d"), fill: p.getAttribute("fill") }])));
const hash = (page: Page) => page.locator('[data-testid="lettering"]').getAttribute("data-hash");
async function waitForNewLayout(page: Page, before: string | null) {
  await expect.poll(() => hash(page), { timeout: 15_000 }).not.toBe(before);
}
async function open(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/typography-demo");
  await expect.poll(() => hash(page), { timeout: 30_000 }).not.toBe("");
  return errors;
}
// The tab's accessible name is lowercase ("heading · Bellefair"); CSS capitalises it.
const tab = (page: Page, role: "Heading" | "Name") => page.getByRole("tab", { name: new RegExp(`^${role}`, "i") }).click();
/** A path's points relative to its first point: its shape without its position. */
const shape = (d: string | null) => {
  const pts = Array.from((d ?? "").matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)).map((m) => [Number(m[1]), Number(m[2])]);
  return pts.map(([x, y]) => [x - pts[0][0], y - pts[0][1]]);
};
/** Same shape within 0.02 mm (moving a path rounds its coordinates to 0.001 mm twice). */
const sameShape = (a: string | null, b: string | null) => {
  const p = shape(a), q = shape(b);
  return p.length === q.length && p.every(([x, y], i) => Math.abs(x - q[i][0]) <= 0.02 && Math.abs(y - q[i][1]) <= 0.02);
};

test.describe.configure({ timeout: 60_000 });

test("opens on #5 Soft Signature with the engine's lettering, no console errors, no sideways scroll", async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByRole("radio", { name: /Soft Signature/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("preset-state")).toContainText("Soft Signature");
  await expect(page.getByTestId("measurements")).toContainText("Bellefair 400");
  await expect(page.getByTestId("measurements")).toContainText("Italianno 400");
  const p = await paths(page);
  expect(Object.keys(p).sort()).toEqual(["heading", "name"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  // The preview fits the screen and covers no control (on phones the photo once
  // grew to 1288 px and lay over the controls below it).
  const layout = await page.evaluate(() => {
    const blocked: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[role=tab], [role=radio], button, input"))) {
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!(hit === el || (hit && el.contains(hit)))) blocked.push((el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30));
    }
    window.scrollTo(0, 0);
    return { blocked, preview: document.querySelector('[data-testid="demo-preview"]')!.getBoundingClientRect().width, vw: window.innerWidth };
  });
  expect(layout.blocked).toEqual([]);
  expect(layout.preview).toBeLessThanOrEqual(layout.vw);
  await settle(page);
  await expect.soft(page).toHaveScreenshot("demo-default.png", { fullPage: false });
  expect(errors).toEqual([]);
});

test("the heading's text and font change only the heading", async ({ page }) => {
  await open(page);
  const p0 = await paths(page);
  let h = await hash(page);
  await tab(page, "Heading");
  await page.getByLabel("Heading text").fill("Welcome to");
  await waitForNewLayout(page, h);
  const p1 = await paths(page);
  expect(p1.heading.d).not.toBe(p0.heading.d);
  expect(p1.name.d).toBe(p0.name.d);
  h = await hash(page);
  await page.getByRole("button", { name: "All fonts (25)" }).click();
  await page.getByRole("radio", { name: "Libre Baskerville" }).click();
  await waitForNewLayout(page, h);
  const p2 = await paths(page);
  expect(p2.heading.d).not.toBe(p1.heading.d);
  expect(p2.name.d).toBe(p0.name.d);
  await expect(page.getByTestId("measurements")).toContainText("Libre Baskerville 400");
  await expect(page.getByTestId("preset-state")).toContainText("Custom (based on Soft Signature)");
});

test("the name's font, size, colour and position change only the name; Reset to preset restores both fonts", async ({ page }) => {
  await open(page);
  const p0 = await paths(page);
  for (const step of [
    async () => page.getByRole("radio", { name: "WindSong" }).click(),
    async () => page.getByRole("group", { name: "name size" }).getByRole("button", { name: "Large" }).click(),
    async () => page.getByRole("group", { name: "name colour" }).getByRole("button", { name: "Pink" }).click(),
    async () => page.getByLabel("name horizontal position").fill("0.2"),
  ]) {
    const h = await hash(page);
    await step();
    await waitForNewLayout(page, h);
    const p = await paths(page);
    // The heading keeps its letters, font and size. It may only move up — and
    // then the page says so — when a taller name would touch it.
    expect(sameShape(p.heading.d, p0.heading.d)).toBe(true);
    expect(p.heading.fill).toBe(p0.heading.fill);
    if (p.heading.d !== p0.heading.d) await expect(page.getByTestId("measurements")).toContainText("Moved up to clear the name");
  }
  const p = await paths(page);
  expect(p.name.d).not.toBe(p0.name.d);
  expect(p.name.fill).toBe("#F472B6");
  await expect(page.getByTestId("measurements")).toContainText("WindSong 500");
  const h = await hash(page);
  await page.getByRole("button", { name: "Reset to preset" }).click();
  await waitForNewLayout(page, h);
  await expect(page.getByTestId("measurements")).toContainText("Italianno 400");
  await expect(page.getByTestId("preset-state")).toContainText("Preset: Soft Signature");
});

test("#9 Modern Editorial: Bodoni keeps its display cut until the customer previews the sturdy option", async ({ page }) => {
  await open(page);
  let h = await hash(page);
  await page.getByRole("radio", { name: /Modern Editorial/ }).click();
  await waitForNewLayout(page, h);
  await expect(page.getByTestId("measurements")).toContainText("Cormorant Garamond 600");
  await expect(page.getByTestId("measurements")).toContainText("Bodoni Moda 700");
  await expect(page.getByTestId("measurements")).not.toContainText("· text");
  const mirror = page.locator('[data-testid="assessment"] [data-finish="mirror_acrylic"]');
  await expect(mirror).toHaveAttribute("data-status", "check");
  const p0 = await paths(page);
  h = await hash(page);
  await mirror.getByRole("button", { name: /Preview Sturdy/ }).click();
  await waitForNewLayout(page, h);
  await expect(page.getByTestId("measurements")).toContainText("Bodoni Moda 700 · text");
  const p1 = await paths(page);
  expect(p1.name.d).not.toBe(p0.name.d);
  expect(p1.heading.d).toBe(p0.heading.d);
  await settle(page);
  await expect.soft(page).toHaveScreenshot("demo-modern-editorial-sturdy.png", { fullPage: false });
});

test("Turkish heading and name are drawn in full", async ({ page }) => {
  await open(page);
  let h = await hash(page);
  await tab(page, "Heading");
  await page.getByLabel("Heading text").fill("İyi ki doğdun");
  await waitForNewLayout(page, h);
  h = await hash(page);
  await tab(page, "Name");
  await page.getByLabel("Name text").fill("Ayşe Gül Çağla");
  await waitForNewLayout(page, h);
  await expect(page.getByTestId("measurements")).not.toContainText("No glyph");
});

test("the production SVG download is the same lettering in millimetres", async ({ page }) => {
  await open(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download production SVG (mm)" }).click()]);
  const svg = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(svg).toContain('width="691mm" height="420mm" viewBox="0 0 691 420"');
  const preview = await paths(page);
  const dls = Array.from(svg.matchAll(/data-role="(\w+)" d="([^"]+)"/g)).map((m) => [m[1], m[2]]);
  expect(Object.fromEntries(dls)).toEqual({ heading: preview.heading.d, name: preview.name.d });
});
