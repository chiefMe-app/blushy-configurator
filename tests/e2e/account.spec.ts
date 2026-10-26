// Sign in and My designs (Phase 0.4), against the in-browser stand-in
// Supabase (guard.ts): an emailed link, a guest's saved design moving into
// the account, My designs (open, delete), Google linking, and the edges.
import { test, expect, openDecor, decorTab, next, settle, masks, FAKE_ACCOUNT, FAKE_GUEST_ID } from "./guard";
import type { Page } from "@playwright/test";

const saveLabel = (page: Page) => page.getByTestId("save-design").locator(".full");

async function saveAsGuest(page: Page) {
  await openDecor(page, "Frozen", "Single Round");
  await page.getByTestId("save-design").click();
  await expect(saveLabel(page)).toHaveText("✓ Saved");
}

async function signInByEmail(page: Page) {
  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Email").fill(FAKE_ACCOUNT.email);
  await dialog.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(dialog.getByRole("status")).toContainText("Check your inbox");
  // The customer opens the link from the email on this device:
  await page.goto("/account/callback?code=e2e-link");
}

test("A1 Sign in offers Google and an emailed link", async ({ page }) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(dialog.getByLabel("Email")).toBeVisible();
  await settle(page);
  await expect.soft(dialog).toHaveScreenshot("a1-sign-in.png");
  await dialog.getByLabel("Email").fill("not-an-email");
  await dialog.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Please enter a valid email address.");
});

test("A2 a guest's saved design moves into the account they sign in to", async ({ page, guard }) => {
  await saveAsGuest(page);
  expect(guard.supabase.items.map((i) => i.owner_id)).toEqual([FAKE_GUEST_ID]);
  await signInByEmail(page);
  await expect(page).toHaveURL(/\/my-designs\?imported=1$/);
  await expect(page.getByRole("status")).toContainText("Your saved design is now in your account.");
  const cards = page.getByTestId("saved-design");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Frozen · Single Round");
  await expect(cards.first()).toContainText("Imported from guest session");
  const mine = guard.supabase.items.filter((i) => i.owner_id === FAKE_ACCOUNT.id);
  expect(mine).toHaveLength(1);
  expect(guard.supabase.parties.find((p) => p.owner_id === FAKE_ACCOUNT.id)?.title).toBe("Imported from guest session");
  await expect(page.getByRole("button", { name: /^Account:/ })).toHaveText("A");
  await expect(cards.first().getByTestId("sketch-lettering").locator("path").first()).toBeAttached(); // the sketch's lettering has come
  await settle(page);
  await expect.soft(page).toHaveScreenshot("a2-my-designs.png", { mask: masks(page) });
});

test("A3 Open brings a saved design back; Save changes updates it in the account", async ({ page, guard }) => {
  await saveAsGuest(page);
  await signInByEmail(page);
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
  const accountItem = guard.supabase.items.find((i) => i.owner_id === FAKE_ACCOUNT.id)!;
  expect(patched[0].path).toContain(`id=eq.${accountItem.id}`);
  expect(guard.supabase.items.filter((i) => i.owner_id === FAKE_ACCOUNT.id)).toHaveLength(1); // no copy made
});

test("A4 Delete removes a design from My designs", async ({ page, guard }) => {
  await saveAsGuest(page);
  await signInByEmail(page);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("saved-design").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("saved-design")).toHaveCount(0);
  await expect(page.getByText("No saved designs yet.")).toBeVisible();
  expect(guard.supabase.items.filter((i) => i.owner_id === FAKE_ACCOUNT.id)).toHaveLength(0);
});

test("A5 My designs with nobody signed in asks to sign in; a guest sees their designs", async ({ page }) => {
  await page.goto("/my-designs");
  await expect(page.getByText("Sign in to see the designs you saved.")).toBeVisible();
  await saveAsGuest(page);
  await page.goto("/my-designs");
  await expect(page.getByTestId("saved-design")).toHaveCount(1);
  await expect(page.getByText("These designs are saved on this device.")).toBeVisible();
});

test("A6 a guest's Google sign-in links the guest (same account, designs stay)", async ({ page, guard }) => {
  await saveAsGuest(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/supabase\.test\/auth\/v1\/authorize\?provider=google/);
  const link = guard.supabase.requests.find((r) => r.path.startsWith("/auth/v1/user/identities/authorize"));
  expect(link?.path).toContain("provider=google");
  expect(decodeURIComponent(link!.path)).toContain("/account/callback");
});

test("A7 a sign-in link opened without its code says so", async ({ page }) => {
  await page.goto("/account/callback");
  await expect(page.getByRole("heading", { name: "Almost…" })).toBeVisible();
  await expect(page.getByText(/expired, or was opened on another device/)).toBeVisible();
});

test("A8 Sign out", async ({ page }) => {
  await saveAsGuest(page);
  await signInByEmail(page);
  await page.getByRole("button", { name: /^Account:/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
