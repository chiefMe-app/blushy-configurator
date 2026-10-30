// Renders kept in the customer's account (Phase 0.5c): a render made while
// signed in is stored (the stand-in server answers with storedRender, as the
// real one does), goes with the design on Save, shows on its My designs card,
// comes back when the design is opened — without a new render — and is
// removed with the design.
import { test, expect, openDecor, decorTab, signIn, renderButton, FAKE_ACCOUNT } from "./guard";
import type { Page } from "@playwright/test";
import type { Guard } from "./guard";

const renderCalls = (guard: Guard) => guard.blocked.filter((r) => r.url().includes("/api/generate-controlled-render")).length;

async function renderAndSave(page: Page, guard: Guard) {
  guard.fakeRender = true;
  await signIn(page);
  await openDecor(page, "Ice Princess", "Single Round");
  await decorTab(page, "Extras");
  await renderButton(page).click(); // → stand-in, stored
  await expect(renderButton(page)).toHaveCount(0); // the render is in
  expect(renderCalls(guard)).toBe(1);
  await page.getByTestId("save-design").click();
  await expect(page.getByTestId("save-design").locator(".full")).toHaveText("✓ Saved");
  const saved = (guard.supabase.items[0].config as { config: { decor: { savedRender?: { path: string; key: string } } } }).config.decor.savedRender;
  expect(saved?.path).toMatch(new RegExp(`^${FAKE_ACCOUNT.id}/[0-9a-z]+\\.jpg$`));
  return saved!;
}

test("R1 a render made while signed in is saved with the design and shows on its card", async ({ page, guard }) => {
  const saved = await renderAndSave(page, guard);
  await page.goto("/my-designs");
  const img = page.getByTestId("saved-render");
  await expect(img).toHaveAttribute("src", new RegExp(`supabase\\.test/storage/v1/object/sign/renders/${saved.path.replace(/[.]/g, "\\.")}\\?token=`));
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByTestId("saved-design").locator(".bz-sketch")).toHaveCount(0);
});

test("R2 opening the design brings its render back, with no new render", async ({ page, guard }) => {
  await renderAndSave(page, guard);
  await page.goto("/my-designs");
  await page.getByTestId("saved-design").getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.locator("img[src*='/storage/v1/object/sign/renders/']").first()).toBeVisible();
  await decorTab(page, "Extras");
  await expect(renderButton(page)).toHaveCount(0); // the render counts as done
  expect(renderCalls(guard)).toBe(1); // only the first one, before saving
});

test("R3 a design changed after its render shows the sketch, not the old render", async ({ page, guard }) => {
  await renderAndSave(page, guard);
  await decorTab(page, "Balloons");
  await page.locator(".bz-bl-chip").first().click(); // a colour out: a different scene
  await page.getByTestId("save-design").click();
  await expect(page.getByTestId("save-design").locator(".full")).toHaveText("✓ Saved");
  await page.goto("/my-designs");
  await expect(page.getByTestId("saved-design").locator(".bz-sketch")).toHaveCount(1);
  await expect(page.getByTestId("saved-render")).toHaveCount(0);
});

test("R4 deleting the design removes its render from the account", async ({ page, guard }) => {
  const saved = await renderAndSave(page, guard);
  await page.goto("/my-designs");
  await expect(page.getByTestId("saved-render")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("saved-design").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("saved-design")).toHaveCount(0);
  await expect.poll(() => guard.supabase.requests.find((r) => r.method === "DELETE" && r.path === "/storage/v1/object/renders")?.body)
    .toEqual({ prefixes: [saved.path] });
});
