// The kids' table, part 2 of Decor (2026-10-27, F2): after the backdrop's
// Extras, a yes or skip; then every item on one page (2026-10-28); the price
// adds to the party total; Back walks back; the table is kept on the device.
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

test("K1 design the kids' table: picture options on one page, the total grows, then Package", async ({ page, guard }) => {
  await toTable(page);
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  // The preview opens in perspective; the top view is one tab away.
  await expect(page.getByTestId("table-perspective-sketch")).toHaveAttribute("aria-label", "Perspective: 1 standard table for 10 children");
  await page.getByRole("tab", { name: "Top view" }).click();
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 1 standard table for 10 children");
  const tableSum = aed(await page.getByTestId("table-total").locator("b").textContent());
  expect(aed(await total(page).textContent())).toBe(before + tableSum);
  // The owner's six tables and three chairs, with her photos and prices.
  await expect(page.getByRole("radiogroup", { name: "Table", exact: true }).getByRole("radio")).toHaveCount(6);
  await expect(page.getByRole("radiogroup", { name: "Chairs" }).getByRole("radio")).toHaveCount(3);
  await page.getByRole("radiogroup", { name: "Chairs" }).getByRole("radio", { name: /Bow chair for kids/ }).click();
  expect(aed(await total(page).textContent())).toBe(before + tableSum); // every chair is AED 25
  // The low table: floor cushions instead of chairs.
  await page.getByRole("radiogroup", { name: "Table", exact: true }).getByRole("radio", { name: /Low table/ }).click();
  await expect(page.getByTestId("floor-cushions")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Chairs" })).toHaveCount(0);
  expect(aed(await total(page).textContent())).toBe(before + tableSum + (749 - 399) - 10 * 25);
  await page.getByRole("radiogroup", { name: "Table", exact: true }).getByRole("radio", { name: /Flower table/ }).click();
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 2 flower tables for 10 children");
  await settle(page);
  await expect.soft(page).toHaveScreenshot("k1-table-chairs.png");
  // Every section on the same page: no tabs to walk through.
  for (const section of ["Table & chairs", "Linens", "Tableware", "Decor & extras"]) await expect(page.getByRole("region", { name: section })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Linens/ })).toHaveCount(0);
  // A plain cloth or none, none chosen; no runner, name cards or chair decorations.
  const cloth = page.getByRole("radiogroup", { name: "Tablecloth" }).getByRole("radio");
  await expect(cloth).toHaveCount(2);
  await expect(cloth.first()).toHaveAttribute("aria-checked", "true");
  for (const gone of ["Runner", "Name cards", "Chair decoration"]) await expect(page.getByRole("radiogroup", { name: gone })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Cutlery holder" }).getByRole("radio")).toHaveCount(2); // None + the band
  await expect(page.getByRole("radiogroup", { name: "Water bottle label" }).getByRole("radio")).toHaveCount(4);
  // The placemats: the theme's own, with the customer's words on them.
  const placemats = page.getByRole("radiogroup", { name: "Placemats" });
  await expect(placemats.getByRole("radio", { name: /Watercolour placemat/ }).locator("img")).toHaveAttribute("src", "/design/table/placemats/frozen/watercolour.webp");
  await page.getByRole("textbox", { name: /Words on the placemats/ }).fill("Zahra turns 4");
  await expect(placemats.locator(".words").first()).toHaveText("Zahra turns 4");
  // Only the plain napkin takes a colour.
  await expect(page.getByRole("radiogroup", { name: "Napkins colour" })).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "Napkins", exact: true }).getByRole("radio", { name: /Plain napkins/ }).click();
  await expect(page.getByRole("radiogroup", { name: "Napkins colour" })).toBeVisible();
  // The bottle label: a name, and the finished label to see.
  await page.getByRole("radiogroup", { name: "Water bottle label" }).getByRole("radio", { name: /Sparkle label/ }).click();
  await page.getByRole("textbox", { name: /Words on the bottle labels/ }).fill("Arya turns 6");
  await expect(page.getByTestId("bottle-label-preview")).toHaveText("Arya turns 6");
  await page.getByRole("radiogroup", { name: "Cutlery holder" }).getByRole("radio", { name: /Napkin band/ }).click();
  await expect(page.getByRole("textbox", { name: /Name on the cutlery holders/ })).toBeVisible();
  await expect(page.getByTestId("cutleryHolder-colour")).toBeVisible();
  // The words in the theme's colour, unless another is picked — on the placemats and the labels alike.
  await page.getByTestId("bottleLabel-words-colour").getByRole("radio", { name: "purple" }).click();
  await expect(page.getByTestId("bottle-label-preview").locator("span")).toHaveCSS("color", "rgb(142, 36, 170)");
  await expect(page.getByTestId("placemat-preview").locator("span")).toHaveCSS("color", "rgb(142, 36, 170)");
  // Plain plates and cups in a colour; a big and a small plate, with the theme's card in the small one.
  await expect(page.getByTestId("plate-card-preview")).toBeVisible();
  await expect(page.getByTestId("plates-colour")).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "Plates", exact: true }).getByRole("radio", { name: /Plain plates/ }).click();
  await page.getByTestId("plates-colour").getByRole("radio", { name: "bright red" }).click();
  await expect(page.getByTestId("plates-colour").getByRole("radio", { name: "bright red" })).toHaveAttribute("aria-checked", "true");
  // …and in a shape (2026-10-29).
  await page.getByTestId("plate-shape").getByRole("radio", { name: "Scalloped" }).click();
  await expect(page.getByTestId("plate-shape").getByRole("radio", { name: "Scalloped" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Cups", exact: true }).getByRole("radio", { name: /Plain cup/ }).click();
  await expect(page.getByTestId("cups-colour")).toBeVisible();
  // The kids' chair in any plain colour: its picture follows.
  const chairs = page.getByRole("radiogroup", { name: "Chairs" });
  await page.getByRole("radiogroup", { name: "Table", exact: true }).getByRole("radio", { name: /Standard table/ }).click();
  await chairs.getByRole("radio", { name: /Colour chair for kids/ }).click();
  await expect(page.getByTestId("chairs-colour").getByRole("radio")).toHaveCount(3); // white, pink, light blue
  await page.getByTestId("chairs-colour").getByRole("radio", { name: "pastel pink" }).click();
  await expect(chairs.getByRole("radio", { name: /Colour chair for kids/ }).locator("img")).toHaveAttribute("src", "/design/table/chairs/blue_kids/f8bbd0.webp");
  await expect(next(page)).toHaveText(/Continue to Package/);
  await expect(page.getByRole("radiogroup", { name: "Party hats" }).getByRole("radio")).toHaveCount(2); // None + the cone hat (2026-10-29)
  await page.getByRole("radiogroup", { name: "Party hats" }).getByRole("radio", { name: /None/ }).click();
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
  await page.getByRole("radiogroup", { name: "Table", exact: true }).getByRole("radio", { name: /Round table/ }).click();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("tab", { name: /Table setup/ }).click();
  await expect(page.getByTestId("kids-count")).toHaveText("11");
  await expect(page.getByTestId("table-perspective-sketch")).toHaveAttribute("aria-label", "Perspective: 1 round table for 11 children");
  await page.getByRole("tab", { name: "Top view" }).click();
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 1 round table for 11 children");
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

test("K5 the close-up render: one picture, the layout stays the drawing, and it says when the table has changed since", async ({ page, guard }) => {
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  let answer!: () => void;
  guard.holdTableRender = new Promise((r) => { answer = r; });
  await page.getByRole("button", { name: "Render a close-up ✦" }).click();
  // While it renders: the drawing, faded, under three moving dots.
  const wait = page.getByTestId("table-render-wait");
  await expect(wait).toContainText("Rendering one seat up close");
  await expect(wait.locator(".dots i")).toHaveCount(3);
  await expect(page.getByTestId("table-render-box")).toContainText("about a minute");
  answer();
  const photo = page.getByTestId("table-render");
  await expect(photo).toHaveAttribute("src", FAKE_TABLE_RENDER.close);
  await expect(wait).toHaveCount(0);
  expect(tableRenders(guard.blocked)).toBe(1);
  // The layout is the drawing: perspective and top view are never photos.
  await page.getByRole("tab", { name: "Perspective" }).click();
  await expect(photo).toHaveCount(0);
  await expect(page.getByTestId("table-perspective-sketch")).toBeVisible();
  await page.getByRole("tab", { name: "Top view" }).click();
  await expect(page.getByTestId("table-sketch")).toBeVisible();
  await page.getByRole("tab", { name: "Close-up" }).click();
  await expect(photo).toHaveAttribute("src", FAKE_TABLE_RENDER.close);
  // A change: the drawing comes back, with an offer to update.
  await page.getByRole("radiogroup", { name: "Chairs" }).getByRole("radio", { name: /Colour chair for kids/ }).click();
  await expect(photo).toHaveCount(0);
  await expect(page.getByTestId("table-render-box")).toContainText("You changed the table since your close-up");
  await page.getByRole("button", { name: "Update the close-up ✦" }).click();
  await expect(photo).toBeVisible();
  expect(tableRenders(guard.blocked)).toBe(2);
  // Indoors instead of the garden is a change too.
  await page.getByRole("radio", { name: "Indoors" }).click();
  await expect(page.getByTestId("table-render-box")).toContainText("You changed the table since your close-up");
  await page.getByRole("button", { name: "Update the close-up ✦" }).click();
  await expect(photo).toBeVisible();
  expect(tableRenders(guard.blocked)).toBe(3);
});

test("K7 the render is kept: back on the page it comes from the customer's storage, with no new render", async ({ page, guard }) => {
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  await page.getByRole("button", { name: "Render a close-up ✦" }).click();
  await expect(page.getByTestId("table-render")).toHaveAttribute("src", FAKE_TABLE_RENDER.close);
  await page.waitForTimeout(800); // the device copy
  await page.reload();
  await page.getByRole("tab", { name: /Table setup/ }).click();
  const photo = page.getByTestId("table-render");
  await expect(photo).toHaveAttribute("src", /supabase\.test\/storage\/v1\/object\/sign\/renders\/00000000-0000-4000-8000-0000000000a1\/c[0-9a-z]+\.jpg\?token=/);
  await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  expect(tableRenders(guard.blocked)).toBe(1);
});

test("K8 the close-up renders in the background: carry on to Package, a note says when it is ready, See it opens it", async ({ page, guard }) => {
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  let answer!: () => void;
  guard.holdTableRender = new Promise((r) => { answer = r; });
  await page.getByRole("button", { name: "Render a close-up ✦" }).click();
  await expect(page.getByTestId("table-render-wait")).toContainText("Carry on with your party meanwhile");
  // On to Package while it renders.
  await next(page).click();
  const note = page.getByTestId("table-render-job");
  await expect(note).toContainText("Your table close-up is on its way");
  answer();
  await expect(note).toContainText("Your table close-up is ready");
  await note.getByRole("button", { name: "See it" }).click();
  await expect(page.getByTestId("table-render")).toHaveAttribute("src", FAKE_TABLE_RENDER.close);
  await expect(note).toHaveCount(0);
  // Seen: the note does not come back on the other steps.
  await next(page).click();
  await expect(page.getByTestId("table-render-job")).toHaveCount(0);
  expect(tableRenders(guard.blocked)).toBe(1);
});

test("K6 the table render needs an account: not signed in, it asks first and renders nothing", async ({ page, guard }) => {
  guard.fakeRender = true;
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  await page.getByRole("button", { name: "Render a close-up ✦" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Sign in to see your table" })).toBeVisible();
  expect(tableRenders(guard.blocked)).toBe(0);
});
