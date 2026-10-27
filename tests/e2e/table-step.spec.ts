// The kids' table, part 2 of Decor (2026-10-27, F2): after the backdrop's
// Extras, a yes or skip; then four tabs of picture options; the price adds to
// the party total; Back walks back through it; the table is kept on the device.
import { test, expect, openDecor, decorTab, next, total, settle, signIn, FAKE_TABLE_RENDER } from "./guard";
import type { Page } from "@playwright/test";

const aed = (s: string | null) => Number((s ?? "").replace(/[^0-9]/g, ""));

async function toTable(page: Page) {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Extras");
  await expect(next(page)).toHaveText(/Next: Table setup/);
  await next(page).click();
  await expect(page.getByTestId("table-intro")).toBeVisible();
}

test("K1 design the kids' table: picture options, the total grows, every tab, then Package", async ({ page, guard }) => {
  await toTable(page);
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  // The preview opens in perspective; the top view is one tab away.
  await expect(page.getByTestId("table-perspective-sketch")).toHaveAttribute("aria-label", "Perspective: 2 long tables for 10 children");
  await page.getByRole("tab", { name: "Top view" }).click();
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 2 long tables for 10 children");
  const tableSum = aed(await page.getByTestId("table-total").locator("b").textContent());
  expect(aed(await total(page).textContent())).toBe(before + tableSum);
  // Every item: three picture options (plus None where optional).
  await expect(page.getByRole("radiogroup", { name: "Chairs" }).getByRole("radio")).toHaveCount(3);
  await page.getByRole("radiogroup", { name: "Chairs" }).getByRole("radio", { name: /Pastel kids' chairs/ }).click();
  expect(aed(await total(page).textContent())).toBe(before + tableSum + 10 * 2); // pastel is AED 2 a child more
  await settle(page);
  await expect.soft(page).toHaveScreenshot("k1-table-chairs.png");
  for (const tab of ["Linens", "Tableware", "Decor & extras"]) {
    await expect(next(page)).toHaveText(new RegExp(`Next: ${tab.replace("&", "&")}`));
    await next(page).click();
    await expect(page.getByRole("tab", { name: new RegExp(tab) })).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.getByRole("radiogroup", { name: "Party hats" }).getByRole("radio")).toHaveCount(4); // None + 3
  await page.getByRole("radiogroup", { name: "Party hats" }).getByRole("radio", { name: /Crown/ }).click();
  await expect(next(page)).toHaveText(/Continue to Package/);
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Choose your service package" })).toBeVisible();
  expect(guard.blocked).toEqual([]);
});

test("K2 skipping the table adds nothing; Back walks back to the backdrop", async ({ page }) => {
  await toTable(page);
  const before = await total(page).textContent();
  await page.getByRole("button", { name: "No thanks, skip" }).click();
  await expect(page.getByText("You skipped the kids' table")).toBeVisible();
  expect(await total(page).textContent()).toBe(before);
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.locator(".bz-decor-tab.on")).toContainText("Extras");
});

test("K3 the table is kept on the device", async ({ page }) => {
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  await page.getByRole("button", { name: "One more child" }).click();
  await page.getByRole("radiogroup", { name: "Table" }).getByRole("radio", { name: /Round table/ }).click();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("tab", { name: /Table setup/ }).click();
  await expect(page.getByTestId("kids-count")).toHaveText("11");
  await expect(page.getByTestId("table-perspective-sketch")).toHaveAttribute("aria-label", "Perspective: 2 round tables for 11 children");
  await page.getByRole("tab", { name: "Top view" }).click();
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 2 round tables for 11 children");
});

test("K4 the backdrop is a choice too: skipping it leaves it out of the total", async ({ page }) => {
  await page.goto("/builder");
  await page.locator(".bz-choice.bz-birthday").click();
  await next(page).click();
  await page.locator(".bz-choice.bz-theme", { has: page.locator("h3", { hasText: /^Frozen$/ }) }).first().click();
  await next(page).click();
  await expect(page.getByTestId("backdrop-intro")).toBeVisible();
  const withBackdrop = aed(await total(page).textContent());
  await page.getByRole("button", { name: "No thanks, skip" }).click();
  await expect(page.getByText("You skipped the backdrop")).toBeVisible();
  expect(aed(await total(page).textContent())).toBeLessThan(withBackdrop);
  await expect(next(page)).toHaveText(/Next: Table setup/);
  await next(page).click();
  await expect(page.getByTestId("table-intro")).toBeVisible();
});

const tableRenders = (blocked: { url(): string }[]) => blocked.filter((r) => r.url().includes("/api/table-render")).length;

test("K5 the real render: every view, and it says when the table has changed since", async ({ page, guard }) => {
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  let answer!: () => void;
  guard.holdTableRender = new Promise((r) => { answer = r; });
  await page.getByRole("button", { name: "Generate table render ✦" }).click();
  // While it renders: the drawing, faded, under three moving dots.
  const wait = page.getByTestId("table-render-wait");
  await expect(wait).toContainText("Rendering your table");
  await expect(wait.locator(".dots i")).toHaveCount(3);
  await expect(page.getByTestId("table-render-box")).toContainText("Three views, one by one");
  answer();
  const photo = page.getByTestId("table-render");
  await expect(photo).toHaveAttribute("src", FAKE_TABLE_RENDER.perspective);
  await expect(wait).toHaveCount(0);
  await page.getByRole("tab", { name: "Top view" }).click();
  await expect(photo).toHaveAttribute("src", FAKE_TABLE_RENDER.top);
  await page.getByRole("tab", { name: "Close-up" }).click();
  await expect(photo).toHaveAttribute("src", FAKE_TABLE_RENDER.close);
  await page.getByRole("tab", { name: "Top view" }).click();
  expect(tableRenders(guard.blocked)).toBe(1); // one request, every view
  // The sketch is a click away.
  await page.getByRole("button", { name: "Show the sketch" }).click();
  await expect(page.getByTestId("table-sketch")).toBeVisible();
  await page.getByRole("button", { name: "Show the render" }).click();
  // A change: the drawing comes back, with an offer to update.
  await page.getByRole("radiogroup", { name: "Chairs" }).getByRole("radio", { name: /Pastel kids' chairs/ }).click();
  await expect(photo).toHaveCount(0);
  await expect(page.getByTestId("table-render-box")).toContainText("You changed the table since your render");
  await page.getByRole("button", { name: "Update the render ✦" }).click();
  await expect(photo).toBeVisible();
  expect(tableRenders(guard.blocked)).toBe(2);
  // Indoors instead of the garden is a change too.
  await page.getByRole("radio", { name: "Indoors" }).click();
  await expect(page.getByTestId("table-render-box")).toContainText("You changed the table since your render");
  await page.getByRole("button", { name: "Update the render ✦" }).click();
  await expect(photo).toBeVisible();
  expect(tableRenders(guard.blocked)).toBe(3);
});

test("K7 the render is kept: back on the page it comes from the customer's storage, with no new render", async ({ page, guard }) => {
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  await page.getByRole("button", { name: "Generate table render ✦" }).click();
  await expect(page.getByTestId("table-render")).toHaveAttribute("src", FAKE_TABLE_RENDER.perspective);
  await page.waitForTimeout(800); // the device copy
  await page.reload();
  await page.getByRole("tab", { name: /Table setup/ }).click();
  const photo = page.getByTestId("table-render");
  await expect(photo).toHaveAttribute("src", /supabase\.test\/storage\/v1\/object\/sign\/renders\/00000000-0000-4000-8000-0000000000a1\/p[0-9a-z]+\.jpg\?token=/);
  await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  expect(tableRenders(guard.blocked)).toBe(1);
});

test("K6 the table render needs an account: not signed in, it asks first and renders nothing", async ({ page, guard }) => {
  guard.fakeRender = true;
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  await page.getByRole("button", { name: "Generate table render ✦" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Sign in to see your table" })).toBeVisible();
  expect(tableRenders(guard.blocked)).toBe(0);
});
