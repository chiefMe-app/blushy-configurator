// The Privacy Policy and Terms pages, which Google's sign-in setup links to,
// and the links to them from the landing page and the sign-in dialog.
import { test, expect } from "./guard";

test("L1 privacy and terms pages open from the landing page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByText("We do not sell your information")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Terms of Service" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();
});

test("L2 the sign-in dialog links to the terms and privacy policy", async ({ page }) => {
  await page.goto("/my-designs");
  await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  await expect(dialog.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
});
