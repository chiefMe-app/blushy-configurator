// The design is kept on this device (Phase 0.3a): a reload or a return visit
// opens where the customer left off; "Start over" clears it. Only design
// choices are stored, never the customer's name, phone or venue. Balloon
// colours the customer picked survive leaving the Decor step and coming back.
import { test, expect, next, total, openDecor, decorTab, settle, masks, signIn } from "./guard";
import { computeTotal, defaultConfig, formatAED } from "@/lib/config";

const KEY = "partymuse.builder.draft.v1";
const chips = (page: import("@playwright/test").Page) => page.locator(".bz-bl-chip").allTextContents();

test("D1 custom balloon colours survive leaving the Decor step and coming back", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Balloons");
  const before = await chips(page);
  await page.locator(".bz-bl-chip").first().click(); // remove one colour
  const mine = await chips(page);
  expect(mine.length).toBe(before.length - 1);
  await expect(page.locator(".bz-bl-pill")).toContainText("Your Sempertex mix");
  await page.locator("button.bz-back").click(); // to Theme
  await next(page).click(); // back to Decor, still on Balloons
  await expect(page.locator(".bz-decor-tab.on")).toContainText("Balloons");
  expect(await chips(page)).toEqual(mine);
  await expect(page.locator(".bz-bl-pill")).toContainText("Your Sempertex mix");
});

test("D2 a new theme still brings its own balloon colours", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Balloons");
  await page.locator(".bz-bl-chip").first().click();
  await page.locator("button.bz-back").click(); // to Theme
  await page.locator(".bz-choice.bz-theme", { has: page.locator("h3", { hasText: /^Unicorn$/ }) }).first().click();
  await next(page).click();
  await expect(page.locator(".bz-bl-pill")).toContainText("Matched to Unicorn");
});

test("D3 a reload opens the design where the customer left off", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Style");
  await page.getByLabel("Name text").fill("Arya");
  await decorTab(page, "Balloons");
  await page.locator(".bz-bl-chip").first().click();
  const mine = await chips(page);
  const shown = await total(page).textContent();
  await page.waitForTimeout(800); // saves are debounced
  await page.reload();
  await expect(page.getByTestId("draft-restored")).toBeVisible();
  await expect(page.locator(".bz-decor-head strong")).toHaveText("Single Round");
  await expect(page.locator(".bz-decor-tab.on")).toContainText("Balloons");
  expect(await chips(page)).toEqual(mine);
  await expect(total(page)).toHaveText(shown!);
  // The note itself (a reload keeps the scroll position; from the top it is never under the sticky header).
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await expect.soft(page.getByTestId("draft-restored")).toHaveScreenshot("d3-restored-note.png", { mask: masks(page) });
  await decorTab(page, "Style");
  await expect(page.getByLabel("Name text")).toHaveValue("Arya");
});

test("D4 Start over clears the saved design", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByTestId("draft-restored").getByRole("button", { name: "Start over" }).click();
  await expect(page.locator(".bz-choice.bz-birthday")).toBeVisible();
  await expect(total(page)).toHaveText(`AED ${formatAED(computeTotal(defaultConfig()))}`);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
  await page.reload();
  await expect(page.getByTestId("draft-restored")).toHaveCount(0);
  await expect(page.locator(".bz-choice.bz-birthday")).toBeVisible();
});

test("D5 only design choices are stored: no venue, no customer details", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await page.waitForTimeout(800);
  const stored = await page.evaluate((k) => localStorage.getItem(k), KEY);
  expect(stored).not.toBeNull();
  const draft = JSON.parse(stored!);
  expect(Object.keys(draft.config).sort()).toEqual(["addOns", "decor", "eventType", "package", "servicePackageId", "theme", "themeSelected"]);
});

test("D6 a fresh visit with nothing saved opens on Event as before", async ({ page }) => {
  await page.goto("/builder");
  await expect(page.locator(".bz-choice.bz-birthday")).toBeVisible();
  await expect(page.getByTestId("draft-restored")).toHaveCount(0);
});

test("D7 a broken saved draft is ignored, not a crash", async ({ page }) => {
  await page.goto("/builder");
  await page.evaluate((k) => localStorage.setItem(k, "{not json"), KEY);
  await page.reload();
  await expect(page.locator(".bz-choice.bz-birthday")).toBeVisible();
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, step: 2, config: { decor: "nope" } })), KEY);
  await page.reload();
  await expect(page.locator(".bz-choice.bz-birthday")).toBeVisible();
  await expect(page.getByTestId("draft-restored")).toHaveCount(0);
});

test("D8 the saved design is cleared once the request is sent", async ({ page, guard }) => {
  guard.fakeRender = true;
  guard.fakeOrder = true;
  await signIn(page); // renders need an account
  await openDecor(page, "Frozen", "Single Round");
  for (let i = 0; i < 3; i++) await next(page).click(); // Style, Balloons, Extras
  await next(page).click(); // Generate render → stand-in
  await expect(next(page)).toHaveText(/Continue to Package/);
  await next(page).click();
  await next(page).click();
  await next(page).click();
  await page.getByPlaceholder("Full name").fill("Test Customer");
  await page.getByPlaceholder("+971 5x xxx xxxx").fill("+971500000000");
  await page.waitForTimeout(800);
  const stored = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY))!);
  expect(JSON.stringify(stored)).not.toContain("Test Customer");
  expect(JSON.stringify(stored)).not.toContain("971500000000");
  await next(page).click();
  await next(page).click(); // Request Final Quote → caught
  await expect(page.getByText("Request received!")).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
});
