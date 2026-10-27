// Table Setup studio (Phase 3): the kids' table, drawn from above as it is
// chosen, with an estimate, kept on this device.
import { test, expect, settle } from "./guard";
import type { Page } from "@playwright/test";

const sketch = (page: Page) => page.getByTestId("table-sketch");
const chairs = (page: Page) => sketch(page).locator("[data-chair]");

test("T1 the studio draws the tables for the number of children, and the estimate follows", async ({ page, guard }) => {
  await page.goto("/studio/table");
  await expect(page.getByRole("heading", { name: /Set the party table/ })).toBeVisible();
  await expect(sketch(page)).toHaveAttribute("aria-label", "Top view: 2 long tables for 12 children");
  await expect(chairs(page)).toHaveCount(12);
  const total = () => page.getByTestId("table-total").locator(".sum b").textContent();
  const before = await total();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "One more child" }).click();
  await expect(page.getByTestId("kids-count")).toHaveText("17");
  await expect(sketch(page)).toHaveAttribute("aria-label", "Top view: 3 long tables for 17 children");
  await expect(chairs(page)).toHaveCount(17);
  expect(await total()).not.toBe(before);
  await page.getByRole("button", { name: /Round tables/ }).click();
  await expect(sketch(page)).toHaveAttribute("aria-label", "Top view: 3 round tables for 17 children");
  await page.getByRole("switch", { name: "Party hats" }).click();
  await expect(page.getByTestId("table-total")).toContainText("Party hats (17)");
  await settle(page);
  await expect.soft(page).toHaveScreenshot("t1-table-studio.png");
  expect(guard.blocked).toEqual([]); // nothing paid or stored
});

test("T2 the design is kept on this device", async ({ page }) => {
  await page.goto("/studio/table");
  await page.getByRole("button", { name: /Round tables/ }).click();
  await page.getByRole("radiogroup", { name: "Runner" }).getByRole("radio", { name: "Sequin" }).click();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByRole("button", { name: /Round tables/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("radiogroup", { name: "Runner" }).getByRole("radio", { name: "Sequin" })).toHaveAttribute("aria-checked", "true");
});

test("T3 it starts in the backdrop's theme", async ({ page }) => {
  await page.goto("/builder");
  await page.locator(".bz-choice.bz-birthday").click();
  await page.locator("button.bz-next").click();
  await page.locator(".bz-choice.bz-theme", { has: page.locator("h3", { hasText: /^Unicorn$/ }) }).first().click();
  await page.waitForTimeout(600);
  await page.goto("/studio/table");
  await expect(page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Unicorn" })).toHaveAttribute("aria-checked", "true");
});

test("T4 ten children: five a side", async ({ page }) => {
  await page.goto("/studio/table");
  await page.getByRole("button", { name: "One fewer child" }).click();
  await page.getByRole("button", { name: "One fewer child" }).click();
  await expect(page.getByTestId("kids-count")).toHaveText("10");
  const ys = await chairs(page).evaluateAll((els) => els.map((e) => (e as SVGGraphicsElement).getBoundingClientRect().y));
  const top = Math.min(...ys);
  expect(ys.filter((y) => Math.abs(y - top) < 2)).toHaveLength(5);
  expect(ys.filter((y) => Math.abs(y - top) >= 2)).toHaveLength(5);
});
