// The kids' table, part 2 of Decor (2026-10-27, F2): after the backdrop's
// Extras, a yes or skip; then every item on one page (2026-10-28); the price
// adds to the party total; Back walks back; the table is kept on the device.
import { test, expect, openDecor, decorTab, next, total, settle } from "./guard";
import type { Page } from "@playwright/test";

const aed = (s: string | null) => Number((s ?? "").replace(/[^0-9]/g, ""));

async function toTable(page: Page) {
  await openDecor(page, "Ice Princess", "Single Round");
  await decorTab(page, "Extras");
  await expect(next(page)).toHaveText(/Next: Table setup/);
  await next(page).click();
  await expect(page.getByTestId("table-intro")).toBeVisible();
}

test("K1 design the kids' table: picture options on one page, the total grows, then Package", async ({ page, guard }) => {
  await toTable(page);
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  // The preview opens on the top view of one place (2026-10-29); the whole table and the perspective are a tab away.
  await expect(page.getByTestId("table-place")).toBeVisible();
  await page.getByRole("tab", { name: "Perspective" }).click();
  await expect(page.getByTestId("table-perspective-sketch")).toHaveAttribute("aria-label", "Perspective: 1 standard table for 10 children");
  await page.getByRole("tab", { name: "Whole table" }).click();
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 1 standard table for 10 children");
  const tableSum = aed(await page.getByTestId("table-total").locator("b").textContent());
  expect(aed(await total(page).textContent())).toBe(before + tableSum);
  // The owner's six tables and three chairs, with her photos and prices.
  await expect(page.getByRole("radiogroup", { name: "Table", exact: true }).getByRole("radio")).toHaveCount(6);
  // 2026-10-30: the colour chair (white to begin with) and the bow chair; the white chair went.
  await expect(page.getByRole("radiogroup", { name: "Chairs", exact: true }).getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("radiogroup", { name: "Chairs", exact: true }).getByRole("radio", { name: /Colour chair for kids/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Chairs", exact: true }).getByRole("radio", { name: /Bow chair for kids/ }).click();
  expect(aed(await total(page).textContent())).toBe(before + tableSum); // every chair is AED 25
  // The low table: floor cushions instead of chairs.
  await page.getByRole("radiogroup", { name: "Table", exact: true }).getByRole("radio", { name: /Low table/ }).click();
  await expect(page.getByTestId("floor-cushions")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Chairs", exact: true })).toHaveCount(0);
  expect(aed(await total(page).textContent())).toBe(before + tableSum + (749 - 399) - 10 * 25);
  await page.getByRole("radiogroup", { name: "Table", exact: true }).getByRole("radio", { name: /Flower table/ }).click();
  await page.getByRole("tab", { name: "Whole table" }).click(); // on a phone a change brings the top view back
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
  await expect(page.getByRole("radiogroup", { name: "Cutlery holder", exact: true }).getByRole("radio")).toHaveCount(2); // None + the band
  await expect(page.getByRole("radiogroup", { name: "Water bottle label" }).getByRole("radio")).toHaveCount(4);
  // The placemats: the theme's own, with the customer's words on them.
  const placemats = page.getByRole("radiogroup", { name: "Placemats" });
  await expect(placemats.getByRole("radio", { name: /Watercolour placemat/ }).locator("img")).toHaveAttribute("src", "/design/table/placemats/frozen/watercolour.webp");
  await page.getByRole("textbox", { name: /Words on the placemats/ }).fill("Zahra turns 4");
  await expect(placemats.locator(".words").first()).toHaveText("Zahra turns 4");
  // The plain napkin, white to begin with; the theme's own napkins after it (2026-10-30: none made for this theme yet).
  await expect(page.getByTestId("napkins-colour").getByRole("radio", { name: "white" }).first()).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("napkins-themed")).toHaveCount(0);
  // The bottle label: a name, and the finished label to see.
  await page.getByRole("radiogroup", { name: "Water bottle label" }).getByRole("radio", { name: /Sparkle label/ }).click();
  await page.getByRole("textbox", { name: /Words on the bottle labels/ }).fill("Arya turns 6");
  await expect(page.getByTestId("bottle-label-preview")).toHaveText("Arya turns 6");
  // The napkin band comes chosen, in the theme's colour (2026-10-30).
  await expect(page.getByRole("radiogroup", { name: "Cutlery holder", exact: true }).getByRole("radio", { name: /Napkin band/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("textbox", { name: /Name on the cutlery holders/ })).toBeVisible();
  await expect(page.getByTestId("cutleryHolder-colour")).toBeVisible();
  // The words in the theme's colour, unless another is picked — on the placemats and the labels alike.
  await page.getByTestId("bottleLabel-words-colour").getByRole("radio", { name: "purple" }).click();
  await expect(page.getByTestId("bottle-label-preview").locator("span")).toHaveCSS("color", "rgb(142, 36, 170)");
  await expect(page.getByTestId("placemat-preview").locator("span")).toHaveCSS("color", "rgb(142, 36, 170)");
  // One kind of plate and of cup, no option cards, in a colour or a foil (2026-10-29); a big and a small plate, no card in it.
  await expect(page.getByTestId("plate-card-preview")).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Plates", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("plates-single")).toContainText("AED 3 each");
  // Pastels of the theme's colours to begin with (2026-10-30).
  await expect(page.getByTestId("plates-colour").getByRole("radio", { name: "pastel baby blue" }).first()).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("small-plate-colour").getByRole("radio", { name: "pastel lilac" }).first()).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("plates-colour").getByRole("radio", { name: "bright red" }).click();
  await expect(page.getByTestId("plates-colour").getByRole("radio", { name: "bright red" })).toHaveAttribute("aria-checked", "true");
  // …and in a shape (2026-10-29).
  await page.getByTestId("plate-shape").getByRole("radio", { name: "Scalloped" }).click();
  await expect(page.getByTestId("plate-shape").getByRole("radio", { name: "Scalloped" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radiogroup", { name: "Cups", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("cups-colour").getByRole("radio", { name: "gold foil" })).toBeVisible();
  // The small plate in its own colour; the hat and the name on the band in theirs.
  await expect(page.getByTestId("small-plate-colour")).toBeVisible();
  await expect(page.getByTestId("partyHats-colour")).toBeVisible();
  // The kids' chair in any plain colour: its picture follows.
  const chairs = page.getByRole("radiogroup", { name: "Chairs", exact: true });
  await page.getByRole("radiogroup", { name: "Table", exact: true }).getByRole("radio", { name: /Standard table/ }).click();
  await chairs.getByRole("radio", { name: /Colour chair for kids/ }).click();
  await expect(page.getByTestId("chairs-colour").getByRole("radio")).toHaveCount(3); // white, pink, light blue
  await page.getByTestId("chairs-colour").getByRole("radio", { name: "pastel pink" }).click();
  await expect(chairs.getByRole("radio", { name: /Colour chair for kids/ }).locator("img")).toHaveAttribute("src", "/design/table/chairs/blue_kids/f8bbd0.webp");
  await expect(next(page)).toHaveText(/Continue to Package/);
  await expect(page.getByRole("radiogroup", { name: "Party hats", exact: true }).getByRole("radio")).toHaveCount(2); // None + the cone hat (2026-10-29)
  await page.getByRole("radiogroup", { name: "Party hats", exact: true }).getByRole("radio", { name: /None/ }).click();
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
  await page.getByRole("tab", { name: "Perspective" }).click();
  await expect(page.getByTestId("table-perspective-sketch")).toHaveAttribute("aria-label", "Perspective: 1 round table for 11 children");
  await page.getByRole("tab", { name: "Whole table" }).click();
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 1 round table for 11 children");
});

test("K4 the backdrop is a choice too: skipping it leaves it out of the total", async ({ page }) => {
  await page.goto("/builder");
  await page.locator(".bz-choice.bz-birthday").click();
  await next(page).click();
  await page.locator(".bz-choice.bz-theme", { has: page.locator("h3", { hasText: /^Ice Princess$/ }) }).first().click();
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

// K5–K8 and K6 (the table's own close-up render) went on 2026-10-29: the owner
// took the render off this step ("bu aşamada render seçeneği olmasın") — one
// combined render of the backdrop and the table comes at the end instead.

test("K9 the top view of one place follows every colour and word at once, with no render", async ({ page, guard }) => {
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  const place = page.getByTestId("table-place");
  const focus = place.locator("[data-place=focus]");
  await expect(focus).toBeVisible();
  // A foil is a colour (2026-10-29).
  await page.getByTestId("plates-colour").getByRole("radio", { name: "iridescent foil" }).click();
  await expect(focus.locator("[data-part$=-plates]")).toHaveAttribute("data-foil", "iridescent");
  // The plain cup: white inside, its outside in the chosen colour.
  await page.getByTestId("cups-colour").getByRole("radio", { name: "hot pink" }).click();
  await expect(focus.locator("[data-part$=cup-out]")).toHaveAttribute("data-tint", "#EC407A");
  await expect(focus.locator("[data-part$=cup-in]")).not.toHaveAttribute("data-tint", /.+/);
  // Plates in a colour and a shape; nothing in the small plate.
  await page.getByTestId("plates-colour").getByRole("radio", { name: "pastel pink" }).click();
  await page.getByTestId("plate-shape").getByRole("radio", { name: "Square" }).click();
  const plates = focus.locator("[data-part$=-plates]");
  await expect(plates).toHaveAttribute("data-tint", "#F8BBD0");
  await expect(plates).toHaveAttribute("href", "/design/table/top/plates-plain-square.webp");
  // The words, in the placemat's corner and on the bottle's label.
  await page.getByRole("radiogroup", { name: "Water bottle label" }).getByRole("radio", { name: /Watercolour label/ }).click();
  await page.getByPlaceholder("e.g. Arya turns 6").first().fill("Arya turns 6");
  await page.getByPlaceholder("e.g. Arya turns 6").last().fill("Arya");
  await expect(focus.locator("[data-part$=matwords] text")).toHaveText(["ARYA", "TURNS", "6"]);
  await expect(focus.locator("[data-part$=bottle] text")).toHaveText(["ARYA"]);
  // Every piece's picture is there.
  for (const src of await place.locator("image").evaluateAll((l) => Array.from(new Set(l.map((i) => i.getAttribute("href")!))))) {
    expect((await page.request.get(src)).status(), src).toBe(200);
  }
  expect(guard.blocked).toEqual([]);
});

test("K10 on a phone, a change brings the top view into sight, and Back returns to the choices", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "the phone layout only");
  await toTable(page);
  await page.getByRole("button", { name: /Yes, design the table/ }).click();
  // Adding the table does not jump: the customer is about to choose.
  await page.waitForTimeout(800);
  await expect(page.getByTestId("table-back-to-choices")).toHaveCount(0);
  await page.getByRole("tab", { name: "Perspective" }).click();
  await page.getByTestId("cups-colour").getByRole("radio", { name: "gold foil" }).click();
  // The preview comes up, on the top view.
  await expect(page.getByTestId("table-place")).toBeInViewport();
  await expect(page.getByRole("tab", { name: "Top view" })).toHaveAttribute("aria-selected", "true");
  const back = page.getByTestId("table-back-to-choices");
  await back.click();
  await expect(page.getByTestId("cups-colour")).toBeInViewport();
  await expect(back).toHaveCount(0);
  // Typing: not on every letter, once the field is left.
  const words = page.getByPlaceholder("e.g. Arya turns 6").first();
  await words.fill("Zara turns 5");
  await expect(page.getByTestId("table-place")).not.toBeInViewport();
  await words.blur();
  await expect(page.getByTestId("table-place")).toBeInViewport();
  await expect(page.getByTestId("table-place").locator("[data-place=focus] [data-part$=matwords] text")).toHaveText(["ZARA", "TURNS", "5"]);
});
