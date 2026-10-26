// The isolated /typography-demo page: the real engine behind every control,
// Heading and Name edited independently (font, size, colour, position), vinyl
// lettering only, on desktop and mobile.
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
const tabButton = (page: Page, role: "Heading" | "Name") => page.getByRole("tab", { name: new RegExp(`^${role}`, "i") });
const tab = (page: Page, role: "Heading" | "Name") => tabButton(page, role).click();
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
/** Width of an element's lettering in mm (the lettering SVG's units are mm). */
const widthMm = (page: Page, role: string) => page.locator(`[data-testid="lettering"] path[data-role="${role}"]`).evaluate((p) => (p as SVGPathElement).getBBox().width);

test.describe.configure({ timeout: 60_000 });

test("opens on #5 Soft Signature, big lettering, customer choices only, no console errors, fits the screen", async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByRole("radio", { name: /Soft Signature/ })).toHaveAttribute("aria-checked", "true");
  await expect(tabButton(page, "Heading")).toContainText("Bellefair");
  await expect(tabButton(page, "Name")).toContainText("Italianno");
  const p = await paths(page);
  expect(Object.keys(p).sort()).toEqual(["heading", "name"]);
  // The name leads: a short name spans well over a third of the 2 m board.
  expect(await widthMm(page, "name")).toBeGreaterThan(700);
  expect(await widthMm(page, "heading")).toBeGreaterThan(450);
  // Vinyl only; no production engineering on the page.
  await expect(page.getByTestId("finish")).toContainText("vinyl");
  const text = await page.locator("body").innerText();
  for (const word of ["Acrylic", "Mirror", "Neon", "LED", "producer", "provisional"]) expect(text, word).not.toContain(word);
  expect(text).not.toMatch(/\d\s?mm\b/); // no measurements shown
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
  await expect(tabButton(page, "Heading")).toContainText("Libre Baskerville");
  await expect(page.getByTestId("preset-state")).toContainText("Your own mix (from Soft Signature)");
});

test("the name's font, size, colour and position change only the name; back to the preset restores both fonts", async ({ page }) => {
  await open(page);
  const p0 = await paths(page);
  for (const step of [
    async () => page.getByRole("radio", { name: "WindSong" }).click(),
    async () => page.getByRole("group", { name: "name size" }).getByRole("button", { name: "Medium" }).click(),
    async () => page.getByRole("group", { name: "name colour" }).getByRole("button", { name: "Gold", exact: true }).click(),
    async () => page.getByLabel("name horizontal position").fill("0.15"),
  ]) {
    const h = await hash(page);
    await step();
    await waitForNewLayout(page, h);
    const p = await paths(page);
    // The heading keeps its letters, font, size and colour; it may only move
    // up when a taller name would touch it.
    expect(sameShape(p.heading.d, p0.heading.d)).toBe(true);
    expect(p.heading.fill).toBe(p0.heading.fill);
  }
  const p = await paths(page);
  expect(p.name.d).not.toBe(p0.name.d);
  expect(p.name.fill).toBe("#C9A24A");
  await expect(tabButton(page, "Name")).toContainText("WindSong");
  const h = await hash(page);
  await page.getByRole("button", { name: "Back to Soft Signature" }).click();
  await waitForNewLayout(page, h);
  await expect(tabButton(page, "Name")).toContainText("Italianno");
  await expect(page.getByTestId("preset-state")).toContainText("Style: Soft Signature");
});

test("#9 Modern Editorial: Cormorant heading and Bodoni name, with lining figures in the tiles", async ({ page }) => {
  await open(page);
  const h = await hash(page);
  await page.getByRole("radio", { name: /Modern Editorial/ }).click();
  await waitForNewLayout(page, h);
  await expect(tabButton(page, "Heading")).toContainText("Cormorant Garamond");
  await expect(tabButton(page, "Name")).toContainText("Bodoni Moda");
  // "1st" in Cormorant must not read as a Turkish dotless ı: tiles use lining figures like the engine.
  const tileHeading = page.getByRole("radio", { name: /Modern Editorial/ }).locator("div").nth(1);
  expect(await tileHeading.evaluate((d) => getComputedStyle(d).fontFeatureSettings)).toContain("lnum");
  await settle(page);
  await expect.soft(page).toHaveScreenshot("demo-modern-editorial.png", { fullPage: false });
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
  await expect(page.getByText(/This font has no/)).toHaveCount(0);
});
