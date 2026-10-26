// Save (2026-10-26): the design goes to the guest's party in the database
// only when the customer presses the footer's Save button — never on its
// own. Supabase is the in-browser stand-in from guard.ts.
import { test, expect, next, openDecor, decorTab, settle, masks } from "./guard";

const save = (page: import("@playwright/test").Page) => page.getByTestId("save-design");
/** The button's full label (phones show a short one; both are in the button). */
const label = (page: import("@playwright/test").Page) => save(page).locator(".full");

test("S1 nothing is saved to the database without pressing Save", async ({ page, guard }) => {
  await page.goto("/builder");
  await expect(save(page)).toHaveCount(0); // nothing chosen yet: the footer note
  await openDecor(page, "Frozen", "Single Round");
  for (const tab of ["Style", "Balloons", "Extras"] as const) await decorTab(page, tab);
  await page.waitForTimeout(3000);
  expect(guard.supabase.requests).toEqual([]);
  await expect(label(page)).toHaveText("♡ Save my design");
});

test("S2 Save: a guest session, the party and the design — design only; then ✓ Saved", async ({ page, guard }) => {
  await openDecor(page, "Frozen", "Single Round");
  await save(page).click();
  await expect(label(page)).toHaveText("✓ Saved");
  await expect(save(page)).toBeDisabled();
  expect(guard.supabase.requests.map((r) => `${r.method} ${r.path.split("?")[0]}`)).toEqual([
    "POST /auth/v1/signup", "POST /rest/v1/parties", "POST /rest/v1/party_items",
  ]);
  expect(guard.supabase.items).toHaveLength(1);
  expect(guard.supabase.items[0]).toMatchObject({ kind: "product", ref_id: "studio.backdrop", party_id: "parties-1" });
  expect(Object.keys((guard.supabase.items[0].config as { config: object }).config).sort())
    .toEqual(["addOns", "decor", "eventType", "package", "servicePackageId", "theme", "themeSelected"]);
  await settle(page);
  await expect.soft(page.locator(".bz-footer")).toHaveScreenshot("s2-saved.png", { mask: masks(page) });
});

test("S3 a change after saving offers Save changes, which updates the same design", async ({ page, guard }) => {
  await openDecor(page, "Frozen", "Single Round");
  await save(page).click();
  await expect(label(page)).toHaveText("✓ Saved");
  await decorTab(page, "Balloons");
  await page.locator(".bz-bl-chip").first().click(); // a colour out
  await expect(label(page)).toHaveText("♡ Save changes");
  await settle(page);
  await expect.soft(page.locator(".bz-footer")).toHaveScreenshot("s3-save-changes.png", { mask: masks(page) });
  const before = guard.supabase.requests.length;
  await save(page).click();
  await expect(label(page)).toHaveText("✓ Saved");
  expect(guard.supabase.requests.slice(before).map((r) => `${r.method} ${r.path.split("?")[0]}`)).toEqual([
    "PATCH /rest/v1/parties", "PATCH /rest/v1/party_items",
  ]);
  expect(guard.supabase.parties).toHaveLength(1);
  expect(guard.supabase.items).toHaveLength(1);
});

test("S4 a saved design is still ✓ Saved after a reload", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await save(page).click();
  await expect(label(page)).toHaveText("✓ Saved");
  await page.waitForTimeout(800); // the device copy is written a moment after a change
  await page.reload();
  await expect(page.getByTestId("draft-restored")).toBeVisible();
  await expect(label(page)).toHaveText("✓ Saved");
});

test("S5 guest sign-ins switched off: says Save is unavailable", async ({ page, guard }) => {
  guard.supabase.anonymousOff = true;
  await openDecor(page, "Frozen", "Single Round");
  await save(page).click();
  await expect(label(page)).toHaveText("Saving is unavailable");
  expect(guard.supabase.parties).toHaveLength(0);
});

test("S6 Start over: the next Save is a new design, not an overwrite", async ({ page, guard }) => {
  await openDecor(page, "Frozen", "Single Round");
  await save(page).click();
  await expect(label(page)).toHaveText("✓ Saved");
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
