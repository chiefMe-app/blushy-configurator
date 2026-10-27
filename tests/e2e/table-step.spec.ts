// The kids' table, part 2 of Decor (2026-10-27, F2): after the backdrop's
// Extras, a yes or skip; then four tabs of picture options; the price adds to
// the party total; Back walks back through it; the table is kept on the device.
import { test, expect, openDecor, decorTab, next, total, settle } from "./guard";
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
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 2 long tables for 10 children");
  const tableSum = aed(await page.getByTestId("table-total").locator("b").textContent());
  expect(aed(await total(page).textContent())).toBe(before + tableSum);
  // Every item: three picture options (plus None where optional).
  await expect(page.getByRole("radiogroup", { name: "Chairs" }).getByRole("radio")).toHaveCount(3);
  await page.getByRole("radiogroup", { name: "Chairs" }).getByRole("radio", { name: /Gold chiavari/ }).click();
  expect(aed(await total(page).textContent())).toBe(before + tableSum + 10 * 5); // gold is AED 5 a child more
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
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 2 round tables for 11 children");
});
