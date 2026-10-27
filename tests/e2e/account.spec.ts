// Sign in and My designs (Phase 0.4), against the in-browser stand-in
// Supabase (guard.ts): an emailed link, saving (which needs an account since
// 2026-10-27), coming back to the page signed in from, My designs (open,
// delete), and the edges. A guest's old designs moving into an account is
// covered in tests/unit/account.test.ts.
import { test, expect, openDecor, decorTab, settle, masks, FAKE_ACCOUNT } from "./guard";
import type { Page } from "@playwright/test";

const saveLabel = (page: Page) => page.getByTestId("save-design").locator(".full");

/** Sign in from the dialog with the emailed link, opened on this device. */
async function signInByEmail(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Email").fill(FAKE_ACCOUNT.email);
  await dialog.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(dialog.getByRole("status")).toContainText("Check your inbox");
  await page.goto("/account/callback?code=e2e-link");
}

/** A design saved to the account: Save, sign in, back in the Builder. */
async function saveSignedIn(page: Page) {
  await openDecor(page, "Frozen", "Single Round");
  await page.getByTestId("save-design").click();
  await signInByEmail(page);
  await expect(page).toHaveURL(/\/builder$/);
  await expect(saveLabel(page)).toHaveText("✓ Saved");
}

test("A1 Sign in offers Google and an emailed link", async ({ page }) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Keep your designs" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(dialog.getByLabel("Email")).toBeVisible();
  await settle(page);
  await expect.soft(dialog).toHaveScreenshot("a1-sign-in.png");
  await dialog.getByLabel("Email").fill("not-an-email");
  await dialog.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Please enter a valid email address.");
});

test("A2 a saved design is in My designs", async ({ page, guard }) => {
  await saveSignedIn(page);
  await page.goto("/my-designs");
  const cards = page.getByTestId("saved-design");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Frozen · Single Round");
  expect(guard.supabase.items.map((i) => i.owner_id)).toEqual([FAKE_ACCOUNT.id]);
  await expect(page.getByRole("button", { name: /^Account:/ })).toHaveText("A");
  await expect(cards.first().getByTestId("sketch-lettering").locator("path").first()).toBeAttached(); // the sketch's lettering has come
  await settle(page);
  await expect.soft(page).toHaveScreenshot("a2-my-designs.png", { mask: masks(page) });
});

test("A3 Open brings a saved design back; Save changes updates it", async ({ page, guard }) => {
  await saveSignedIn(page);
  await page.goto("/my-designs");
  await page.getByTestId("saved-design").getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByTestId("draft-restored")).toBeVisible();
  await expect(page.locator(".bz-decor-head strong")).toHaveText("Single Round");
  await expect(saveLabel(page)).toHaveText("✓ Saved");
  await decorTab(page, "Balloons");
  await page.locator(".bz-bl-chip").first().click();
  await expect(saveLabel(page)).toHaveText("♡ Save changes");
  const before = guard.supabase.requests.length;
  await page.getByTestId("save-design").click();
  await expect(saveLabel(page)).toHaveText("✓ Saved");
  const patched = guard.supabase.requests.slice(before).filter((r) => r.method === "PATCH" && r.path.startsWith("/rest/v1/party_items"));
  expect(patched).toHaveLength(1);
  expect(patched[0].path).toContain(`id=eq.${guard.supabase.items[0].id}`);
  expect(guard.supabase.items).toHaveLength(1); // no copy made
});

test("A4 Delete removes a design from My designs", async ({ page, guard }) => {
  await saveSignedIn(page);
  await page.goto("/my-designs");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("saved-design").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("saved-design")).toHaveCount(0);
  await expect(page.getByText("No saved designs yet.")).toBeVisible();
  expect(guard.supabase.items).toHaveLength(0);
});

test("A5 My designs signed out asks to sign in, and signing in there comes back to it", async ({ page }) => {
  await page.goto("/my-designs");
  await expect(page.getByText("Sign in to see the designs you saved.")).toBeVisible();
  await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
  await signInByEmail(page);
  await expect(page).toHaveURL(/\/my-designs$/);
  await expect(page.getByText("No saved designs yet.")).toBeVisible();
});

test("A6 signing in from the Builder's top bar comes back to the Builder, saving nothing", async ({ page, guard }) => {
  await openDecor(page, "Frozen", "Single Round");
  await page.getByRole("banner").getByRole("button", { name: "Sign in" }).click();
  await signInByEmail(page);
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByRole("button", { name: /^Account:/ })).toBeVisible();
  await expect(page.locator(".bz-decor-head strong")).toHaveText("Single Round");
  await expect(saveLabel(page)).toHaveText("♡ Save my design");
  expect(guard.supabase.items).toHaveLength(0);
});

test("A7 a sign-in link opened without its code says so", async ({ page }) => {
  await page.goto("/account/callback");
  await expect(page.getByRole("heading", { name: "Almost…" })).toBeVisible();
  await expect(page.getByText(/expired, or was opened on another device/)).toBeVisible();
});

test("A8 Sign out", async ({ page }) => {
  await saveSignedIn(page);
  await page.getByRole("button", { name: /^Account:/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
