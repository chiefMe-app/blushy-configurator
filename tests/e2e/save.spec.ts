// Save (2026-10-26): the design goes to the database only when the customer
// presses the footer's Save button — never on its own. 2026-10-27: Save needs
// an account: signed out, it opens the sign-in window, and the design is
// saved as soon as the customer is back from signing in. Supabase is the
// in-browser stand-in from guard.ts.
import { test, expect, next, openDecor, decorTab, settle, masks, FAKE_ACCOUNT } from "./guard";
import type { Page } from "@playwright/test";

const save = (page: Page) => page.getByTestId("save-design");
/** The button's full label (phones show a short one; both are in the button). */
const label = (page: Page) => save(page).locator(".full");
const calls = (r: { method: string; path: string }[]) => r.map((x) => `${x.method} ${x.path.split("?")[0]}`);

/** Save while signed out, sign in with the emailed link, back in the Builder. */
async function saveSigningIn(page: Page) {
  await save(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Sign in to save your design" })).toBeVisible();
  await dialog.getByLabel("Email").fill(FAKE_ACCOUNT.email);
  await dialog.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(dialog.getByRole("status")).toContainText("your design is saved right after");
  await page.goto("/account/callback?code=e2e-link"); // the link from the email, on this device
  await expect(page).toHaveURL(/\/builder$/);
  await expect(label(page)).toHaveText("✓ Saved");
}

test("S1 nothing is saved to the database without pressing Save", async ({ page, guard }) => {
  await page.goto("/builder");
  await expect(save(page)).toHaveCount(0); // nothing chosen yet: the footer note
  await openDecor(page, "Ice Princess", "Single Round");
  for (const tab of ["Style", "Balloons", "Extras"] as const) await decorTab(page, tab);
  await page.waitForTimeout(3000);
  expect(guard.supabase.requests).toEqual([]);
  await expect(label(page)).toHaveText("♡ Save my design");
});

test("S2 signed out, Save asks to sign in — no guest; signed in, the design is saved, design only", async ({ page, guard }) => {
  await openDecor(page, "Ice Princess", "Single Round");
  await save(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Sign in to save your design" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await settle(page);
  await expect.soft(dialog).toHaveScreenshot("s2-sign-in-to-save.png");
  expect(calls(guard.supabase.requests)).not.toContain("POST /auth/v1/signup"); // no guest session
  expect(guard.supabase.parties).toHaveLength(0);
  await dialog.getByRole("button", { name: "Close" }).click();

  await saveSigningIn(page);
  await expect(page.locator(".bz-decor-head strong")).toHaveText("Single Round"); // the same design came back
  expect(calls(guard.supabase.requests)).not.toContain("POST /auth/v1/signup");
  expect(guard.supabase.items).toHaveLength(1);
  expect(guard.supabase.items[0]).toMatchObject({ owner_id: FAKE_ACCOUNT.id, kind: "product", ref_id: "studio.backdrop" });
  expect(Object.keys((guard.supabase.items[0].config as { config: object }).config).sort())
    .toEqual(["addOns", "decor", "eventType", "package", "servicePackageId", "theme", "themeSelected"]);
  await expect(page.getByRole("button", { name: /^Account:/ })).toHaveText("A");
  await settle(page);
  await expect.soft(page.locator(".bz-footer")).toHaveScreenshot("s2-saved.png", { mask: masks(page) });
});

test("S3 a change after saving offers Save changes, which updates the same design", async ({ page, guard }) => {
  await openDecor(page, "Ice Princess", "Single Round");
  await saveSigningIn(page);
  await decorTab(page, "Balloons");
  await page.locator(".bz-bl-chip").first().click(); // a colour out
  await expect(label(page)).toHaveText("♡ Save changes");
  await settle(page);
  await expect.soft(page.locator(".bz-footer")).toHaveScreenshot("s3-save-changes.png", { mask: masks(page) });
  const before = guard.supabase.requests.length;
  await save(page).click(); // signed in now: straight to the database
  await expect(label(page)).toHaveText("✓ Saved");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(calls(guard.supabase.requests.slice(before))).toEqual(["PATCH /rest/v1/parties", "PATCH /rest/v1/party_items"]);
  expect(guard.supabase.parties).toHaveLength(1);
  expect(guard.supabase.items).toHaveLength(1);
});

test("S4 a saved design is still ✓ Saved after a reload, and is not saved again", async ({ page, guard }) => {
  await openDecor(page, "Ice Princess", "Single Round");
  await saveSigningIn(page);
  await page.waitForTimeout(800); // the device copy is written a moment after a change
  await page.reload();
  await expect(page.getByTestId("draft-restored")).toBeVisible();
  await expect(label(page)).toHaveText("✓ Saved");
  expect(guard.supabase.items).toHaveLength(1);
});

test("S5 Continue with Google from Save: back from Google, in the Builder, saved", async ({ page, guard }) => {
  await openDecor(page, "Ice Princess", "Single Round");
  await save(page).click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/supabase\.test\/auth\/v1\/authorize\?provider=google/);
  expect(decodeURIComponent(page.url())).toContain("/account/callback");
  await page.goto("/account/callback?code=e2e-google"); // Google sends the customer back
  await expect(page).toHaveURL(/\/builder$/);
  await expect(label(page)).toHaveText("✓ Saved");
  expect(guard.supabase.items.map((i) => i.owner_id)).toEqual([FAKE_ACCOUNT.id]);
});

test("S6 Start over: the next Save is a new design, not an overwrite", async ({ page, guard }) => {
  await openDecor(page, "Ice Princess", "Single Round");
  await saveSigningIn(page);
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByTestId("draft-restored").getByRole("button", { name: "Start over" }).click();
  await page.locator(".bz-choice.bz-birthday").click();
  await next(page).click();
  await page.locator(".bz-choice.bz-theme", { has: page.locator("h3", { hasText: /^Unicorn$/ }) }).first().click();
  await expect(label(page)).toHaveText("♡ Save my design");
  await save(page).click();
  await expect(label(page)).toHaveText("✓ Saved");
  expect(guard.supabase.items).toHaveLength(2);
});
