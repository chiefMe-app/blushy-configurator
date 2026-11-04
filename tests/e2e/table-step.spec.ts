// The kids' table, part 2 of Decor (2026-10-27, F2): after the backdrop's
// Extras, a yes or skip; then every item on one page (2026-10-28); the price
// adds to the party total; Back walks back; the table is kept on the device.
import { test, expect, next, total, settle, signIn } from "./guard";
import type { Page } from "@playwright/test";

const aed = (s: string | null) => Number((s ?? "").replace(/[^0-9]/g, ""));

// 2026-11-03: a designed backdrop is finalized only with its render, so the tables are reached with the backdrop
// skipped; the kids' table then opens designed, in the theme's own pieces ("default böyle gelsin").
async function toTable(page: Page) {
  await page.goto("/builder");
  await page.locator(".bz-choice.bz-birthday").click();
  await next(page).click();
  await page.locator(".bz-choice.bz-theme", { has: page.locator("h3", { hasText: /^Ice Princess$/ }) }).first().click();
  await next(page).click();
  await page.getByRole("button", { name: "No thanks, skip" }).click();
  await expect(next(page)).toHaveText(/Next: Table setup/);
  await next(page).click();
  await expect(page.getByTestId("table-place")).toBeVisible();
}

/** The kids' table's top-view render (a stand-in, guard.fakeRender), offered, not waited for (lib/renderGate.ts). */
async function renderKids(page: Page) {
  await expect(page.getByTestId("finish-kids-table")).toBeEnabled();
  await page.getByTestId("finish-kids-table-generate").click();
  await expect(page.getByTestId("finish-kids-table")).toBeEnabled();
}

test("K1 design the kids' table: picture options on one page, the total grows, then Finish", async ({ page, guard }) => {
  guard.fakeRender = true;
  await signIn(page); // its render needs an account
  await toTable(page);
  // The preview opens on one place from above (2026-10-29, on its own since 2026-10-31); six places, the whole table and the perspective are a tab away.
  await expect(page.getByTestId("table-place")).toHaveAttribute("data-mode", "one");
  await page.getByRole("tab", { name: "Six places" }).click();
  await expect(page.getByTestId("table-place")).toHaveAttribute("data-mode", "six");
  await page.getByRole("tab", { name: "Perspective" }).click();
  await expect(page.getByTestId("table-perspective-sketch")).toHaveAttribute("aria-label", "Perspective: 1 standard table for 10 children");
  await page.getByRole("tab", { name: "Whole table" }).click();
  await expect(page.getByTestId("table-sketch")).toHaveAttribute("aria-label", "Top view: 1 standard table for 10 children");
  const tableSum = aed(await page.getByTestId("table-total").locator("b").textContent());
  expect(tableSum).toBeGreaterThan(0);
  const before = aed(await total(page).textContent()) - tableSum; // the party without its table
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
  // The plain napkin, white to begin with; the theme's own napkins after it (2026-10-30: Ice Princess has two).
  await expect(page.getByTestId("napkins-colour").getByRole("radio", { name: "white" }).first()).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("napkins-themed").getByRole("radio")).toHaveCount(2);
  await expect(page.getByTestId("cups-themed").getByRole("radio")).toHaveCount(3);
  await expect(page.getByTestId("plates-themed").getByRole("radio")).toHaveCount(3);
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
  // The table ends in its own Finalize buttons, no footer Next (2026-11-03).
  await expect(next(page)).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Party hats", exact: true }).getByRole("radio")).toHaveCount(2); // None + the cone hat (2026-10-29)
  await page.getByRole("radiogroup", { name: "Party hats", exact: true }).getByRole("radio", { name: /None/ }).click();
  // 2026-10-31 (owner): Finish the table, then the grown-ups' table is asked — not Package. 2026-11-03: once its
  // top view is rendered ("generate render yapmadan finalize basılamasın … top view render alsın sadece").
  await renderKids(page);
  await expect(page.getByTestId("table-render")).toBeVisible();
  await page.getByTestId("finish-kids-table").click();
  await expect(page.getByTestId("adult-intro")).toBeVisible();
  expect(guard.blocked.map((r) => new URL(r.url()).pathname)).toEqual(["/api/table-render"]);
  const sent = JSON.parse(guard.blocked[0].postData()!);
  expect(sent.view).toBe("top");
  // Made from the one place as drawn here (2026-11-03: "live sketchin birebir aynı açısının renderı olsun").
  expect(sent.preview).toMatch(/^data:image\/jpeg;base64,/);
});

test("K10 the grown-ups' table: asked only once the kids' table is finished, then on to the welcome board", async ({ page, guard }) => {
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  // Not before the kids' table is finished.
  await expect(page.getByTestId("adults-tab")).toBeDisabled();
  await renderKids(page);
  await page.getByTestId("finish-kids-table").click();
  await expect(page.getByRole("heading", { name: "Add a grown-ups' table?" })).toBeVisible();
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, design it/ }).click();
  await expect(page.getByTestId("adult-preview").locator("svg")).toHaveAttribute("aria-label", "The grown-ups' table from above");
  const sum = aed(await page.getByTestId("adult-total").locator("b").textContent());
  expect(sum).toBeGreaterThan(0);
  expect(aed(await total(page).textContent())).toBe(before + sum);
  // More guests, a second table: the price grows.
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "One more guest" }).click();
  await expect(page.getByTestId("guests-count")).toHaveText("12");
  expect(aed(await page.getByTestId("adult-total").locator("b").textContent())).toBeGreaterThan(sum);
  await page.getByRole("radiogroup", { name: "Charger plates" }).getByRole("radio", { name: /Rattan charger/ }).click();
  await expect(page.getByRole("radiogroup", { name: "Charger plates" }).getByRole("radio", { name: /Rattan charger/ })).toHaveAttribute("aria-checked", "true");
  // The kids' table is still there, ticked as finished.
  await page.getByRole("tab", { name: /Kids' table/ }).click();
  await expect(page.getByTestId("finish-kids-table")).toHaveText(/Next: Grown-ups' table/);
  await page.getByRole("tab", { name: /Grown-ups' table/ }).click();
  await expect(next(page)).toHaveCount(0);
  await page.getByTestId("finish-adult-table").click();
  await expect(page.getByTestId("welcome-intro")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Table setup/ }).locator(".n")).toHaveText("✓");
  // Kept on the device.
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("tab", { name: /Table setup/ }).click();
  await page.getByRole("tab", { name: /Grown-ups' table/ }).click();
  await expect(page.getByTestId("guests-count")).toHaveText("12");
});

test("W1 the welcome board: words and lettering drawn live, priced, Finish goes on to the giveaways; Back comes back", async ({ page, guard }) => {
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByTestId("skip-kids-table").click(); // on to the grown-ups' table
  await next(page).click(); // skipped: the welcome board
  await expect(page.getByTestId("welcome-intro")).toBeVisible();
  await expect(next(page)).toHaveText(/Skip to Giveaways/);
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, design the board/ }).click();
  const board = page.getByTestId("welcome-preview").getByRole("img", { name: "Your welcome board" });
  await expect(board).toBeVisible();
  await page.getByTestId("welcome-name").fill("Arya's");
  await page.getByTestId("welcome-line").fill("6th Birthday");
  await expect(board).toContainText("Arya's");
  await expect(board).toContainText("6TH BIRTHDAY");
  // Her board first (2026-11-01): plain white, the handwritten name, a balloon garland; painted corners, the
  // theme's art, or a plain colour.
  await expect(board.locator("[data-part=painted-corners]")).toHaveCount(0);
  await expect(board.locator("[data-part=garland]")).toHaveCount(1);
  await expect(page.getByTestId("welcome-font").getByRole("radio", { name: /Handwritten/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Board design" }).getByRole("radio", { name: /Painted corners/ }).click();
  await expect(board.locator("[data-part=painted-corners]")).toHaveCount(1);
  await page.getByRole("radiogroup", { name: "Board design" }).getByRole("radio", { name: /Watercolour/ }).click();
  await expect(board.locator("[data-part=art]")).toHaveAttribute("href", "/design/table/placemats/frozen/watercolour-portrait.webp");
  await page.getByRole("radiogroup", { name: "Board design" }).getByRole("radio", { name: /Plain colour/ }).click();
  await expect(board.locator("[data-part=art]")).toHaveCount(0);
  await expect(page.getByTestId("welcome-colour")).toBeVisible();
  const sum = aed(await page.getByTestId("welcome-total").locator("b").textContent());
  expect(aed(await total(page).textContent())).toBe(before + sum);
  await page.getByRole("radiogroup", { name: "Board size" }).getByRole("radio", { name: /Large/ }).click();
  await page.getByTestId("welcome-material").getByRole("radio", { name: /Acrylic/ }).click();
  expect(aed(await page.getByTestId("welcome-total").locator("b").textContent())).toBe(sum + (320 - 180) + 150);
  // Round, and balloons with flowers on it (2026-10-31).
  await page.getByTestId("welcome-shape").getByRole("radio", { name: /Round/ }).click();
  await expect(board).toHaveAttribute("data-shape", "round");
  await page.getByTestId("welcome-garnish").getByRole("radio", { name: /Balloons & flowers/ }).click();
  await expect(board.locator("[data-part=balloons]")).toHaveCount(1);
  await expect(board.locator("[data-part=flowers]")).toHaveCount(1);
  // A real photo of the board on its easel, the print laid onto it, the real garland with roses in it (2026-10-31).
  await expect(board.locator("[data-part=scene]")).toHaveAttribute("href", /scene-round-easel/);
  // The backdrop's own balloons (2026-11-02): the Single Arch's garland from the party's balloon-set shot.
  await expect(board.locator("[data-part=garland]")).toHaveCount(1);
  await expect(board.locator("[data-part=garland]")).toHaveAttribute("data-set", /^(unicorn|frozen)-(pastel|bright)$/);
  await expect(board.locator("[data-part=garland-roses]")).toHaveCount(2);
  for (const src of await board.locator("image").evaluateAll((l) => Array.from(new Set(l.map((i) => i.getAttribute("href")!))))) {
    // A repainted garland is drawn from a blob made in the page.
    if (src.startsWith("blob:")) continue;
    expect((await page.request.get(src)).status(), src).toBe(200);
  }
  expect(aed(await page.getByTestId("welcome-total").locator("b").textContent())).toBe(sum + (320 - 180) + 150 + (380 - 250));
  // The words, measured once drawn, never run into each other.
  await page.getByTestId("welcome-name").fill("Maximiliana-Josephine's");
  for (const font of ["Calligraphy", "Classic"]) {
    await page.getByTestId("welcome-font").getByRole("radio", { name: new RegExp(font) }).click();
    await expect.poll(async () => board.evaluate((svg) => {
      const [h, n, l] = ["heading", "name", "line"].map((k) => (svg.querySelector(`[data-word=${k}]`) as SVGTextElement).getBBox());
      return h.y + h.height <= n.y + 0.01 && n.y + n.height <= l.y + 0.01;
    })).toBe(true);
  }
  // The render offered; finalizing waits for it only at release (lib/renderGate.ts).
  await expect(next(page)).toHaveCount(0);
  await expect(page.getByTestId("finish-welcome")).toBeEnabled();
  await page.getByTestId("finish-welcome-generate").click();
  await expect(page.getByTestId("welcome-render")).toBeVisible();
  await expect(page.getByTestId("finish-welcome")).toBeEnabled();
  const sent = JSON.parse(guard.blocked.find((r) => r.url().includes("/api/welcome-render"))!.postData()!);
  expect(sent.preview).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.board.name).toBe("Maximiliana-Josephine's");
  await page.getByTestId("finish-welcome").click();
  await expect(page.getByTestId("giveaways-intro")).toBeVisible();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByTestId("finish-welcome")).toHaveText(/Next: Giveaways/);
  await expect(page.getByTestId("welcome-name")).toHaveValue("Maximiliana-Josephine's");
  expect(guard.blocked.map((r) => new URL(r.url()).pathname)).toEqual(["/api/welcome-render"]);
});

test("W3 a welcome board begun can still be skipped, with no render", async ({ page }) => {
  // 2026-11-03 (the owner: "welcome board skip yapabilmeliyim").
  await toTable(page);
  await page.getByTestId("skip-kids-table").click();
  await next(page).click();
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, design the board/ }).click();
  await expect(page.getByTestId("finish-welcome-generate")).toBeVisible();
  await page.getByTestId("finish-welcome-skip").click();
  await expect(page.getByTestId("giveaways-intro")).toBeVisible();
  expect(aed(await total(page).textContent())).toBe(before);
  // The giveaways, the piñata, the cake and the balloons the same way, on to Package.
  await page.getByRole("button", { name: /Yes, add giveaways/ }).click();
  await page.getByTestId("finish-giveaways-skip").click();
  await expect(page.getByTestId("pinata-intro")).toBeVisible();
  await page.getByRole("button", { name: /Yes, add a piñata/ }).click();
  await page.getByTestId("finish-pinata-skip").click();
  await expect(page.getByTestId("cake-intro")).toBeVisible();
  await page.getByRole("button", { name: /Yes, add a cake/ }).click();
  await page.getByTestId("finish-cake-skip").click();
  await expect(page.getByTestId("helium-intro")).toBeVisible();
  await page.getByRole("button", { name: /Yes, add balloons/ }).click();
  await page.getByTestId("finish-helium-skip").click();
  await expect(page.getByTestId("experiences")).toBeVisible(); // the experiences (2026-11-04), none picked
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Choose your service package" })).toBeVisible();
  expect(aed(await total(page).textContent())).toBe(before);
});

test("G1 the giveaways: a themed box, its contents as a list, on a board in her colour; rendered, then on to Package", async ({ page, guard }) => {
  // 2026-11-03 (the owner: "bu box'ı masaya mı yoksa giveaway board mu istiyor onun seçimini yapsın … board rengi
  // vs customizable olacak … onları da render alıp sonra gene preview'a koymamız lazım").
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByTestId("skip-kids-table").click();
  await next(page).click(); // the grown-ups' table skipped
  await next(page).click(); // the welcome board skipped
  await expect(page.getByTestId("giveaways-intro")).toBeVisible();
  await expect(next(page)).toHaveText(/Skip to Piñata/);
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, add giveaways/ }).click();
  // No kids' table: the boxes go on the board.
  const places = page.getByTestId("giveaways-place");
  await expect(places.getByRole("radio", { name: /On the table/ })).toBeDisabled();
  await expect(places.getByRole("radio", { name: /On a giveaway board/ })).toHaveAttribute("aria-checked", "true");
  const board = page.getByTestId("giveaway-board-art");
  await expect(board).toBeVisible();
  await page.getByTestId("giveaways-count").fill("8");
  await expect(board.locator("[data-part=giveaway-box]")).toHaveCount(8);
  await page.getByTestId("giveaways-count").fill("30");
  await expect(board.locator("[data-part=giveaway-box]")).toHaveCount(12);
  // Twelve to a board, the rest kept beside it, and said so (2026-11-03).
  await expect(page.getByTestId("giveaways-board-full")).toContainText("The other 18 are kept beside it");
  await page.getByTestId("giveaways-name").fill("Arya");
  await expect(board).toContainText("Arya");
  // The box's words in her colour (2026-11-03: "yazının rengini değiştirebilmeliyim").
  const boxWords = page.getByTestId("giveaway-box-card").locator("[data-part=giveaway-box] text").first();
  await page.getByTestId("giveaways-ink").getByRole("radio").nth(2).click(); // the dark one
  await expect(boxWords).toHaveAttribute("fill", "#2B2B2B");
  // The box's background: the theme's designs, or a plain colour (2026-11-03: "plain box color … her tema için").
  const prints = page.getByTestId("giveaways-box-print");
  await expect(prints.getByRole("radio")).toHaveCount(3);
  await prints.getByRole("radio", { name: /Watercolour/ }).click();
  await expect(page.getByTestId("giveaway-box-card").locator('image[href$="frozen/watercolour.webp"]')).toHaveCount(1);
  await prints.getByRole("radio", { name: /Plain colour/ }).click();
  await page.getByTestId("giveaways-box-colour").getByRole("radio").nth(3).click();
  await expect(page.getByTestId("giveaway-box-card").locator("[data-part=box-colour]")).toHaveCount(1);
  // Plain: nothing of the theme on it (2026-11-03: "plain deyince hiç theme olmasın").
  await expect(page.getByTestId("giveaway-box-card").locator('image[href*="themes-v2"]')).toHaveCount(0);
  await prints.getByRole("radio", { name: /Pattern/ }).click();
  // What is inside is a list, each priced a box.
  const contents = page.getByTestId("giveaways-contents");
  await expect(contents.getByRole("checkbox")).toHaveCount(5);
  const sum = aed(await page.getByTestId("giveaways-total").locator("b").textContent());
  expect(aed(await total(page).textContent())).toBe(before + sum);
  await contents.getByRole("checkbox", { name: /Candy/ }).uncheck();
  expect(aed(await page.getByTestId("giveaways-total").locator("b").textContent())).toBe(sum - 6 * 30);
  // The board in her colour.
  await expect(board.locator("[data-part=board-colour]")).toHaveCount(0);
  await page.getByTestId("giveaways-board-colour").getByRole("radio").nth(1).click();
  await expect(board.locator("[data-part=board-colour]")).toHaveCount(1);
  // The board's words in her lettering and colour, and a balloon garland on it (2026-11-03).
  await page.getByTestId("giveaways-board-font").getByRole("radio", { name: /Classic/ }).click();
  await expect(board.locator("text").first()).toHaveText("ARYA");
  await page.getByTestId("giveaways-board-ink").getByRole("radio").nth(1).click();
  await expect(board.locator("text").first()).toHaveAttribute("fill", "#FFFFFF");
  const withoutGarland = aed(await page.getByTestId("giveaways-total").locator("b").textContent());
  await page.getByTestId("giveaways-board-garland").getByRole("radio", { name: /Balloon garland/ }).click();
  await expect(board).toHaveAttribute("data-garland", "yes");
  await expect(board.locator("[data-part=garland] image")).toHaveCount(1);
  // The line in its own lettering (2026-11-03: "thank you for coming'in fontunu seçemiyoruz").
  await page.getByTestId("giveaways-board-line-font").getByRole("radio", { name: /Handwritten/ }).click();
  await expect(board.locator("[data-word=line]")).toHaveText("Thank you for coming");
  expect(aed(await page.getByTestId("giveaways-total").locator("b").textContent())).toBe(withoutGarland + 250);
  for (const src of await board.locator("image").evaluateAll((l) => Array.from(new Set(l.map((i) => i.getAttribute("href")!))))) {
    if (src.startsWith("blob:")) continue; // the garland, repainted in the page
    expect((await page.request.get(src)).status(), src).toBe(200);
  }
  // The box close up, above the render.
  await expect(page.getByTestId("giveaway-box-card").locator("[data-part=giveaway-box]")).toHaveCount(1);
  await expect(page.getByTestId("giveaway-box-card")).toContainText("Inside: Playdough · Bubbles · Stickers · Themed items");
  // The render offered, not waited for.
  await expect(next(page)).toHaveCount(0);
  await expect(page.getByTestId("finish-giveaways")).toBeEnabled();
  await page.getByTestId("finish-giveaways-generate").click();
  await expect(page.getByTestId("giveaways-render")).toBeVisible();
  // Rendered, it can be made again as it is (2026-11-03: "regenerate render çıkmıyor").
  await expect(page.getByTestId("giveaways-render-again").getByRole("button", { name: /Make a new photo/ })).toBeVisible();
  const sent = JSON.parse(guard.blocked.find((r) => r.url().includes("/api/giveaway-render"))!.postData()!);
  expect(sent.preview).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.giveaways).toMatchObject({ name: "Arya", place: "board", count: 30 });
  expect(sent.giveaways).not.toHaveProperty("age");
  // The boxes go on their own, laid on the render afterwards (the engine, given them, redrew them).
  expect(sent.boxes).toMatch(/^data:image\/png;base64,/);
  // The backdrop's own preview is not shown on this part.
  await expect(page.getByText("Your party preview").locator("visible=true")).toHaveCount(0);
  await page.getByTestId("finish-giveaways").click();
  // Then the piñata and the cake (2026-11-03), skipped here.
  await expect(page.getByTestId("pinata-intro")).toBeVisible();
  await expect(next(page)).toHaveText(/Skip to Cake/);
  await next(page).click();
  await expect(page.getByTestId("cake-intro")).toBeVisible();
  await next(page).click();
  await expect(page.getByTestId("helium-intro")).toBeVisible();
  await next(page).click();
  await expect(page.getByTestId("experiences")).toBeVisible(); // the experiences (2026-11-04), none picked
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Choose your service package" })).toBeVisible();
  await expect(page.getByTestId("finished-giveaways-jpeg").or(page.getByTestId("finished-designs").getByAltText("Your giveaways"))).toBeVisible();
  await page.getByRole("button", { name: "← Back" }).click(); // to the experiences
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByTestId("helium-intro")).toContainText("You skipped the helium balloons");
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByTestId("cake-intro")).toContainText("You skipped the cake");
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByTestId("pinata-intro")).toContainText("You skipped the piñata");
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByTestId("finish-giveaways")).toHaveText(/Next: Piñata/);
  expect(guard.blocked.map((r) => new URL(r.url()).pathname)).toEqual(["/api/giveaway-render"]);
});

test("P1 the piñata: the age in her colours or a theme shape, how it opens, what's inside; rendered, then on to the cake", async ({ page, guard }) => {
  // 2026-11-03 (the owner: "şimdi piñata studio'ya geçelim"; number or theme shape, pull strings or a stick, on a stand).
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByTestId("skip-kids-table").click();
  await next(page).click(); // the grown-ups' table skipped
  await next(page).click(); // the welcome board skipped
  await next(page).click(); // the giveaways skipped
  await expect(page.getByTestId("pinata-intro")).toBeVisible();
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, add a piñata/ }).click();
  const art = page.getByTestId("pinata-art");
  await expect(art.locator("[data-part=pinata] > g")).toHaveCount(1); // the one digit, 5
  await expect(art.locator("[data-part=pinata-strings] path")).toHaveCount(9);
  const sum = page.getByTestId("pinata-total");
  const one = aed(await sum.textContent());
  expect(aed(await total(page).textContent())).toBe(before + one);
  // Two digits, the second one priced.
  await page.getByTestId("pinata-number").fill("10");
  await expect(art.locator("[data-part=pinata] > g")).toHaveCount(2);
  expect(aed(await sum.textContent())).toBe(one + 150);
  // Large (2026-11-03: "medium ve large iki size olsun"): bigger on the stand, and priced.
  const h0 = Number(await art.locator("[data-part=pinata] > g > image").first().getAttribute("height"));
  await page.getByTestId("pinata-size").getByRole("radio", { name: /Large/ }).click();
  expect(Number(await art.locator("[data-part=pinata] > g > image").first().getAttribute("height"))).toBeGreaterThan(h0 * 1.2);
  expect(aed(await sum.textContent())).toBe(one - 220 + 320 + 220); // 320 and 220 for the second digit, large
  await page.getByTestId("pinata-size").getByRole("radio", { name: /Medium/ }).click();
  // Her colours, in the order picked: one taken off, one more on.
  const colours = page.getByTestId("pinata-colours").getByRole("button");
  const picked = page.getByTestId("pinata-colours").locator("button[aria-pressed=true]");
  const n0 = await picked.count();
  await picked.first().click();
  await expect(picked).toHaveCount(n0 - 1);
  await colours.last().click();
  await expect(picked).toHaveCount(n0);
  await expect(art.locator("[data-part=pinata-colours]").first().locator("rect")).toHaveCount(n0);
  // The stick instead of the strings.
  await page.getByTestId("pinata-opening").getByRole("radio", { name: /Stick/ }).click();
  await expect(art.locator("[data-part=pinata-stick]")).toHaveCount(1);
  await expect(art.locator("[data-part=pinata-strings]")).toHaveCount(0);
  // A theme shape: the theme's own first (Ice Princess: a snowflake).
  await page.getByTestId("pinata-kind").getByRole("radio", { name: /Theme shape/ }).click();
  const shapes = page.getByTestId("pinata-shape").getByRole("radio");
  await expect(shapes).toHaveCount(20);
  await expect(shapes.first()).toContainText("Snowflake");
  await expect(shapes.first()).toHaveAttribute("aria-checked", "true");
  await expect(art.locator('image[href$="snowflake.webp"]')).toHaveCount(1);
  await shapes.filter({ hasText: "Rocket" }).click();
  await expect(art.locator('image[href$="rocket.webp"]')).toHaveCount(1);
  // What's inside: a list, in the price.
  const sum1 = aed(await sum.textContent());
  await page.getByTestId("pinata-fillings").getByText("Chocolates", { exact: true }).click();
  expect(aed(await sum.textContent())).toBe(sum1 + 55);
  await expect(page.getByTestId("pinata-preview")).toContainText("Chocolates");
  // The render offered, not waited for; then made again as it is.
  await expect(next(page)).toHaveCount(0);
  await expect(page.getByTestId("finish-pinata")).toBeEnabled();
  await page.getByTestId("finish-pinata-generate").click();
  await expect(page.getByTestId("pinata-render")).toBeVisible();
  await expect(page.getByTestId("pinata-render-again").getByRole("button", { name: /Make a new photo/ })).toBeVisible();
  const sent = JSON.parse(guard.blocked.find((r) => r.url().includes("/api/pinata-render"))!.postData()!);
  expect(sent.preview).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.pinata).toMatchObject({ kind: "shape", shape: "rocket", opening: "stick", number: "10" });
  // "Finalize the piñata → Cake" (2026-11-03).
  await expect(page.getByTestId("finish-pinata")).toHaveText(/Cake/);
  await page.getByTestId("finish-pinata").click();
  await expect(page.getByTestId("cake-intro")).toBeVisible();
  await next(page).click(); // the cake skipped
  await next(page).click(); // the balloons skipped
  await expect(page.getByTestId("experiences")).toBeVisible(); // the experiences (2026-11-04), none picked
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Choose your service package" })).toBeVisible();
  await expect(page.getByTestId("finished-designs")).toContainText("Piñata");
  await page.getByRole("button", { name: "← Back" }).click(); // to the experiences
  await page.getByRole("button", { name: "← Back" }).click();
  await page.getByRole("button", { name: "← Back" }).click();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByTestId("finish-pinata")).toHaveText(/Next: Cake/);
  expect(guard.blocked.map((r) => new URL(r.url()).pathname)).toEqual(["/api/pinata-render"]);
});

test("C1 the cake: a theme design or a plain one, its tiers, decoration, colours, figures, topper and flavour; rendered, then on to the balloons", async ({ page, guard }) => {
  // 2026-11-03 (the owner: "piñatadan sonra cake studio'ya geçelim"; themed designs she can change, or plain; on a stand).
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByTestId("skip-kids-table").click();
  for (let i = 0; i < 4; i++) await next(page).click(); // the grown-ups' table, welcome board, giveaways, piñata skipped
  await expect(page.getByTestId("cake-intro")).toBeVisible();
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, add a cake/ }).click();
  const art = page.getByTestId("cake-art");
  const sum = page.getByTestId("cake-total");
  // It opens as the plain white cake (2026-11-04, the owner: "cake plain white default gelsin").
  const designs = page.getByTestId("cake-design").getByRole("radio");
  await expect(designs).toHaveCount(5);
  await expect(designs.filter({ hasText: "Plain cake" })).toHaveAttribute("aria-checked", "true");
  await expect(art.locator("[data-part=cake-tier]")).toHaveCount(1);
  await expect(art.locator("[data-part=cake-figure]")).toHaveCount(0);
  await expect(art.locator("[data-part=cake-colour]")).toHaveCount(0);
  // The theme's first design: one tier, its figure on top (Ice Princess: a snowflake), the topper with the age.
  await designs.first().click();
  await expect(designs.first()).toHaveAttribute("aria-checked", "true");
  // A hand shows that the figures drag (the owner: "daha eğlenceli bir şekilde user'ı guide edelim"), and the tips under the picture.
  await expect(page.getByTestId("cake-coach")).toBeVisible();
  await expect(page.getByTestId("cake-tips")).toContainText("Drag");
  await expect(art.locator("[data-part=cake-tier]")).toHaveCount(1);
  await expect(art.locator('[data-part=cake-figure][href$="fig-snowflake.webp"]')).toHaveCount(1);
  await expect(art.locator("[data-part=cake-topper]")).toHaveCount(1);
  const one = aed(await sum.textContent());
  expect(one).toBe(380 + 45 + 60);
  expect(aed(await total(page).textContent())).toBe(before + one);
  // The grand design: three tiers of rosettes, each its own colour.
  await designs.filter({ hasText: /grand/ }).click();
  await expect(art.locator("[data-part=cake-tier]")).toHaveCount(3);
  await expect(art.locator('image[href$="tier-rosettes.webp"]')).toHaveCount(6); // each tier and its mask
  // Two tiers, drip; the top tier in white has no colour over it.
  await page.getByTestId("cake-tiers").getByRole("radio", { name: /Two tiers/ }).click();
  await page.getByTestId("cake-style").getByRole("radio", { name: /Drip/ }).click();
  await expect(art.locator("[data-part=cake-tier]")).toHaveCount(2);
  await page.getByTestId("cake-colour-1").getByRole("radio", { name: "white" }).click();
  await expect(art.locator("[data-part=cake-colour]")).toHaveCount(1);
  expect(aed(await sum.textContent())).toBe(780 + 2 * 40 + 3 * 45 + 60); // two tiers, a drip on each, three figures, the topper
  // Figures: each card adds one (three on top already, so the fourth goes on a tier's side), priced each.
  // 2026-11-03 (the owner: "sürükle bırak … duplicate … her yere yapıştırabilsin", up to 8).
  const figures = page.getByTestId("cake-figures").getByRole("button");
  await expect(figures).toHaveCount(24); // four of them the unicorn's own sugar figures (2026-11-03)
  const placed = art.locator("[data-part=cake-figure]");
  const s0 = aed(await sum.textContent());
  await expect(placed).toHaveCount(3);
  await figures.filter({ hasText: "Rocket" }).click();
  await expect(placed).toHaveCount(4);
  expect(aed(await sum.textContent())).toBe(s0 + 45);
  const rocket = art.locator('[data-part=cake-figure][href$="fig-rocket.webp"]');
  await expect(rocket).toHaveAttribute("data-on", "side");
  // Tapped: its tools. A copy beside it, priced too.
  await rocket.click();
  const tools = page.getByTestId("cake-tools");
  await expect(tools).toContainText("Rocket");
  await expect(page.getByTestId("cake-picked")).toHaveCount(1);
  await tools.getByRole("button", { name: "Copy" }).click();
  await expect(rocket).toHaveCount(2);
  expect(aed(await sum.textContent())).toBe(s0 + 2 * 45);
  await expect(figures.filter({ hasText: "Rocket" })).toHaveAttribute("aria-label", /2 on the cake/);
  // Dragged up onto the top of the cake.
  const box = (await rocket.nth(1).boundingBox())!;
  const top = (await art.locator("[data-part=cake-tier]").last().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(top.x + top.width * 0.7, top.y - box.height * 0.25, { steps: 8 }); // its foot on the top
  await page.mouse.up();
  await expect(rocket.nth(1)).toHaveAttribute("data-on", "top");
  await expect(page.getByTestId("cake-coach")).toHaveCount(0); // gone once she has touched the picture
  // Taken off from its tools; up to eight on the cake, then the cards wait.
  await tools.getByRole("button", { name: "Remove" }).click();
  await expect(rocket).toHaveCount(1);
  for (let i = 0; i < 4; i++) await figures.filter({ hasText: "Heart" }).click();
  await expect(placed).toHaveCount(8);
  await expect(figures.filter({ hasText: "Heart" })).toBeDisabled();
  await expect(page.getByTestId("cake-figures-note")).toContainText("8 figures");
  await page.getByRole("button", { name: "Take all the figures off" }).click();
  await expect(placed).toHaveCount(0);
  await figures.filter({ hasText: "Rocket" }).click();
  await expect(rocket).toHaveAttribute("data-on", "top");
  // The topper's words, in the preview; off takes its price away.
  await page.getByTestId("cake-topper-name").fill("Arya");
  await page.getByTestId("cake-topper-age").fill("7");
  await expect(art.locator("[data-part=cake-topper]")).toContainText("Arya");
  await expect(art.locator("[data-part=cake-topper]")).toContainText("7");
  await page.getByTestId("cake-topper-colour").getByRole("radio", { name: "Silver", exact: true }).click();
  const s1 = aed(await sum.textContent());
  await page.getByTestId("cake-topper").getByText("A topper with the name and age").click();
  await expect(art.locator("[data-part=cake-topper]")).toHaveCount(0);
  expect(aed(await sum.textContent())).toBe(s1 - 60);
  await page.getByTestId("cake-topper").getByText("A topper with the name and age").click();
  // The flavour: a list, in the price, not in the picture.
  await page.getByTestId("cake-flavour").getByText("Red velvet", { exact: true }).click();
  expect(aed(await sum.textContent())).toBe(s1 + 40);
  await expect(page.getByTestId("cake-preview")).toContainText("Red velvet");
  // 2026-11-03 (the owner: "name topper pastanın önüne de yazılabilir"; cutouts, not only sugar paste; "sprinkles ve
  // rainbow color"): the name on the front on a cloud card, a printed cutout and a mirror ball, a rainbow tier, sprinkles.
  const topper = art.locator("[data-part=cake-topper]");
  await page.getByTestId("cake-topper-place").getByText("On the front", { exact: true }).click();
  await expect(topper).toHaveAttribute("data-at", "front");
  await page.getByTestId("cake-topper-card").getByRole("radio", { name: "Cloud card" }).click();
  await expect(topper.locator("[data-part=cake-topper-card]")).toHaveCount(1);
  // The card in a colour of hers (the owner: "yazının arkasındaki cloud kartın rengini seçebilsin").
  const cardColour = page.getByTestId("cake-topper-card-colour").getByRole("radio");
  await expect(cardColour.first()).toHaveAttribute("aria-checked", "true"); // white
  await cardColour.nth(2).click();
  await expect(cardColour.nth(2)).toHaveAttribute("aria-checked", "true");
  const cardHex = await cardColour.nth(2).evaluate((b) => {
    const [r, g, bl] = getComputedStyle(b).backgroundColor.match(/\d+/g)!.map(Number);
    return "#" + [r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
  });
  await expect(topper.locator(`[data-part=cake-topper-card] [fill="${cardHex}"]`).first()).toBeAttached();
  // Its border the letters' colour, hers or none (the owner: "dışında pembe border oldu, onu da seçtirsin").
  const border = page.getByTestId("cake-topper-card-border").getByRole("radio");
  await expect(border.first()).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("cake-topper-card-border").getByRole("radio", { name: "No border" }).click();
  await expect(topper.locator("[data-part=cake-topper-card]")).toHaveAttribute("data-border", "none");
  await border.first().click();
  await expect(topper.locator("[data-part=cake-topper-card]")).not.toHaveAttribute("data-border", "none");
  const s2 = aed(await sum.textContent());
  await page.getByTestId("cake-cutouts").getByRole("button", { name: /Add Holographic star/ }).click();
  await page.getByTestId("cake-decos").getByRole("button", { name: /Add Mirror ball/ }).click();
  await expect(art.locator("[data-part=cake-figure][data-kind=cutout]")).toHaveCount(1);
  await expect(art.locator("[data-part=cake-figure][data-kind=deco]")).toHaveCount(1);
  await page.getByTestId("cake-colour-0").getByRole("radio", { name: "Pastel rainbow" }).click();
  await expect(art.locator("[data-rainbow=rainbow-pastel]")).toHaveCount(1);
  await page.getByTestId("cake-sprinkles").getByText("A band at the foot", { exact: true }).click();
  await expect(art.locator("[data-part=cake-sprinkles]")).toHaveCount(2); // on both tiers
  expect(aed(await sum.textContent())).toBe(s2 + 30 + 15 + 30 + 30);
  // Sweets on the table beside it (the owner: "cupcake, cookie, cake pops … donut … macaron"): how many, a topper, a print.
  const s3 = aed(await sum.textContent());
  const cupcakes = page.getByTestId("cake-sweet-cupcakes");
  await cupcakes.getByRole("radio", { name: "12", exact: true }).click();
  await expect(art.locator("[data-sweet=cupcakes] [data-part=cake-sweet-topper]").first()).toBeVisible();
  // Their liners and their flavour (the owner: "cupcake kağıdının rengini de seçebilsin … flavour her sweet için ayrı seçilsin").
  await cupcakes.getByTestId("cake-cupcake-liner").getByRole("radio", { name: "Silver foil" }).click();
  await expect(art.locator("[data-sweet=cupcakes] [data-part=cake-sweet-liner]")).toHaveAttribute("data-liner", "silver");
  // A change to a sweet shows it close up (2026-11-04, the owner: "cupcake değişikliği yapılıyorsa cupcake'in yakın view'u açılsın").
  await expect(art).toHaveAttribute("data-view", "cupcakes");
  // Rainbow confetti paper too (the owner: "rainbow liners'ta güzelmiş, onu da ekleyelim").
  await cupcakes.getByTestId("cake-cupcake-liner").getByRole("radio", { name: "Rainbow confetti paper" }).click();
  await expect(art.locator("[data-sweet=cupcakes] [data-part=cake-sweet-liner]")).toHaveAttribute("data-liner", "rainbow");
  const cupFlavour = page.getByTestId("cake-sweet-flavour-cupcakes").getByRole("radio");
  await expect(cupFlavour.first()).toHaveAttribute("aria-checked", "true");
  await cupFlavour.filter({ hasText: "Chocolate" }).click();
  await expect(cupFlavour.filter({ hasText: "Chocolate" })).toHaveAttribute("aria-checked", "true");
  await expect(cupcakes).toContainText("12 chocolate cupcakes");
  const cookies = page.getByTestId("cake-sweet-cookies");
  await cookies.getByRole("radio", { name: "6", exact: true }).click();
  await cookies.getByRole("radio", { name: /The age/ }).click();
  await expect(art.locator("[data-sweet=cookies] text[data-part=cake-sweet-print]").first()).toHaveText("7");
  await expect(art).toHaveAttribute("data-view", "cookies");
  await cookies.getByText(/Rainbow sprinkles/).click();
  expect(aed(await sum.textContent())).toBe(s3 + 12 * 12 + 6 * (10 + 1));
  await cupcakes.getByRole("radio", { name: "None" }).click();
  await expect(art.locator("[data-part=cake-sweet]")).toHaveCount(1);
  // On a sweet cart (the owner: "cake cart opsiyonu da olabilir"; later "stripe olmasın"): white, its roof in a colour of hers.
  const s4 = aed(await sum.textContent());
  await page.getByTestId("cake-display").getByText("On a sweet cart", { exact: true }).click();
  await expect(art).toHaveAttribute("data-scene", "cart");
  const awning = page.getByTestId("cake-awning").getByRole("radio");
  await expect(awning.first()).toHaveAttribute("aria-checked", "true"); // white
  await awning.nth(2).click();
  await expect(awning.nth(2)).toHaveAttribute("aria-checked", "true");
  expect(await art.locator("[data-part=cake-awning]").getAttribute("fill")).toBe(await awning.nth(2).evaluate((b) => {
    const [r, g, bl] = getComputedStyle(b).backgroundColor.match(/\d+/g)!.map(Number);
    return "#" + [r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
  }));
  await expect(art.locator("[data-part=cake-sweet]")).toHaveCount(1);
  expect(aed(await sum.textContent())).toBe(s4 + 450);
  // Balloons up its side (the owner: "burdaki gibi balon seçeneği olsun"), in the party's colours; off again.
  await page.getByTestId("cake-cart-balloons").getByText("A balloon garland on the cart").click();
  await expect(art.locator("[data-part=cart-balloons] image")).toHaveCount(1);
  expect(aed(await sum.textContent())).toBe(s4 + 450 + 350);
  await page.getByTestId("cake-cart-balloons").getByText("A balloon garland on the cart").click();
  await expect(art.locator("[data-part=cart-balloons]")).toHaveCount(0);
  expect(aed(await sum.textContent())).toBe(s4 + 450);
  // On plinths (the owner: "pastayı plinth üzerinde de görmek isteyebilir … diğer sweet'leri … diğer plinth'lerde").
  await page.getByTestId("cake-display").getByText("On plinths", { exact: true }).click();
  await expect(art).toHaveAttribute("data-scene", "plinths");
  await expect(page.getByTestId("cake-awning")).toHaveCount(0);
  await expect(art.locator("[data-part=cake-sweet]")).toHaveCount(1);
  await expect(page.getByTestId("cake-views").getByRole("tab").first()).toHaveText("Whole display");
  expect(aed(await sum.textContent())).toBe(s4 + 300);
  await page.getByTestId("cake-display").getByText("On a sweet cart", { exact: true }).click();
  await expect(art).toHaveAttribute("data-scene", "cart");
  // Close up (the owner: "cake'e basacağız sadece cake … cookies'e basacağız yakından cookies"): a tap on a sweet or the cake.
  const views = page.getByTestId("cake-views");
  await expect(views.getByRole("tab")).toHaveText(["Whole cart", "Cake", "Iced cookies"]);
  await art.locator("[data-sweet=cookies]").dispatchEvent("pointerdown");
  await expect(art).toHaveAttribute("data-view", "cookies");
  await views.getByRole("tab", { name: "Cake" }).click();
  await expect(art).toHaveAttribute("data-view", "cake");
  await expect(page.getByTestId("cake-render-box").getByRole("button")).toHaveText(/Make a real photo of the cake/);
  await views.getByRole("tab", { name: "Whole cart" }).click();
  await expect(art).toHaveAttribute("data-view", "whole");
  // Three tiers stand on a flat board (the owner: "3 katlı olunca … ayaksızı olsun"); the name on the board, in any colour.
  await page.getByTestId("cake-tiers").getByRole("radio", { name: /Three tiers/ }).click();
  await expect(art).toHaveAttribute("data-holder", "board");
  await page.getByTestId("cake-topper-place").getByText("On the board", { exact: true }).click();
  await expect(art.locator("[data-part=cake-topper]")).toHaveAttribute("data-at", "board");
  await expect(page.getByTestId("cake-topper-card")).toHaveCount(0);
  const letterColour = page.getByTestId("cake-topper-colour").getByRole("radio").nth(6);
  await letterColour.click();
  await expect(letterColour).toHaveAttribute("aria-checked", "true");
  // Back as it was: silver letters on top, two tiers.
  await page.getByTestId("cake-topper-colour").getByRole("radio", { name: "Silver", exact: true }).click();
  await page.getByTestId("cake-topper-place").getByText("On top", { exact: true }).click();
  await expect(art.locator("[data-part=cake-topper]")).not.toHaveAttribute("data-at", "board");
  await page.getByTestId("cake-tiers").getByRole("radio", { name: /Two tiers/ }).click();
  await expect(art).toHaveAttribute("data-holder", "stand");
  await page.getByTestId("cake-display").getByText("On a table", { exact: true }).click();
  await expect(art).toHaveAttribute("data-scene", "table");
  expect(aed(await sum.textContent())).toBe(s4);
  // A plain cake: white, nothing on top.
  await designs.filter({ hasText: "Plain cake" }).click();
  await expect(art.locator("[data-part=cake-figure]")).toHaveCount(0);
  await expect(art.locator("[data-part=cake-colour]")).toHaveCount(0);
  await expect(art.locator("[data-part=cake-topper]")).toHaveCount(0);
  await designs.filter({ hasText: /drip/ }).click();
  // The render offered, not waited for; then made again as it is.
  await expect(next(page)).toHaveCount(0);
  await expect(page.getByTestId("finish-cake")).toBeEnabled();
  await page.getByTestId("finish-cake-generate").click();
  await expect(page.getByTestId("cake-render")).toBeVisible();
  // Looked at closely (the owner: "render'a zoom in yapılıp detaylar incelenebilir mi?"): opened, a tap zooms in, Escape closes.
  await page.getByTestId("cake-render-zoom").click();
  const zoom = page.getByTestId("render-zoom");
  await expect(zoom).toBeVisible();
  const big = zoom.locator("img");
  await expect.poll(() => big.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  const fitted = (await big.boundingBox())!.width;
  await big.click();
  await expect.poll(async () => (await big.boundingBox())!.width).toBeGreaterThan(fitted * 2);
  await page.keyboard.press("Escape");
  await expect(zoom).toHaveCount(0);
  await expect(page.getByTestId("cake-render-again").getByRole("button", { name: /Make a new photo/ })).toBeVisible();
  const sent = JSON.parse(guard.blocked.find((r) => r.url().includes("/api/cake-render"))!.postData()!);
  expect(sent.preview).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.view).toBe("whole");
  // Made again while the render shows: still from the live picture.
  await page.getByTestId("cake-render-again").getByRole("button", { name: /Make a new photo/ }).click();
  await expect.poll(() => guard.blocked.filter((r) => r.url().includes("/api/cake-render")).length).toBe(2);
  expect(JSON.parse(guard.blocked.filter((r) => r.url().includes("/api/cake-render"))[1].postData()!).preview).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.getByTestId("cake-render")).toBeVisible();
  expect(sent.cake).toMatchObject({ design: "drip", tiers: 2, style: "drip", topper: { name: "Arya", age: "7", colour: "silver" }, flavour: "red-velvet" });
  // "Finalize the cake & sweets → Helium balloons" (2026-11-04).
  await expect(page.getByTestId("finish-cake")).toHaveText(/Helium balloons/);
  await page.getByTestId("finish-cake").click();
  await expect(page.getByTestId("helium-intro")).toBeVisible();
  await next(page).click(); // the balloons skipped
  await expect(page.getByTestId("experiences")).toBeVisible(); // the experiences (2026-11-04), none picked
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Choose your service package" })).toBeVisible();
  await expect(page.getByTestId("finished-designs")).toContainText("Cake");
  await page.getByRole("button", { name: "← Back" }).click(); // to the experiences
  await page.getByRole("button", { name: "← Back" }).click();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByTestId("finish-cake")).toHaveText(/Next: Helium balloons/);
  expect(guard.blocked.map((r) => new URL(r.url()).pathname)).toEqual(["/api/cake-render", "/api/cake-render"]);
});

test("H1 the helium balloons: bouquets in her colours with a foil, the age and the name in foil, the ceiling and a name bubble; rendered, then on to Package", async ({ page, guard }) => {
  // 2026-11-04 (the owner's answers: bouquets, ceiling balloons and a name bubble; theme, number, letter and plain foils; an empty pastel room).
  guard.fakeRender = true;
  await signIn(page);
  await toTable(page);
  await page.getByTestId("skip-kids-table").click();
  for (let i = 0; i < 5; i++) await next(page).click(); // the grown-ups' table, welcome board, giveaways, piñata, cake skipped
  await expect(page.getByTestId("helium-intro")).toBeVisible();
  const before = aed(await total(page).textContent());
  await page.getByRole("button", { name: /Yes, add balloons/ }).click();
  const art = page.getByTestId("helium-art");
  const sum = page.getByTestId("helium-total");
  // One medium bouquet with the theme's own foil (Ice Princess: a snowflake), its size written; no number until asked
  // (the owner's first look, 2026-11-04: "default olarak 1 buket olsun, age balon olmasın hemen").
  await expect(art.locator("[data-part=helium-bouquet]")).toHaveCount(1);
  await expect(art.locator("[data-part=helium-latex]")).toHaveCount(7);
  await expect(art.locator('[data-part=helium-foil][href$="snowflake.webp"]')).toHaveCount(1);
  await expect(page.getByTestId("helium-topper").getByRole("checkbox", { name: /Snowflake/ })).toContainText("60 cm");
  await expect(art.locator("[data-part=helium-number-glyph]")).toHaveCount(0);
  expect(aed(await sum.textContent())).toBe(165 + 30);
  expect(aed(await total(page).textContent())).toBe(before + aed(await sum.textContent()));
  // Two more bouquets, large.
  await page.getByRole("button", { name: "One bouquet more" }).click();
  await page.getByRole("button", { name: "One bouquet more" }).click();
  await page.getByTestId("helium-size").getByRole("radio", { name: /Large/ }).click();
  await expect(art.locator("[data-part=helium-latex]")).toHaveCount(27);
  expect(aed(await sum.textContent())).toBe(3 * (210 + 30));
  // Real Sempertex balloons by their codes, the whole catalogue, metallic and Reflex too (2026-11-04).
  await expect(page.getByTestId("helium-colours").getByRole("button").first()).toHaveAccessibleName(/^Remove \d{3} /);
  await page.getByTestId("helium-sempertex-open").click();
  const shop = page.getByTestId("helium-sempertex");
  await shop.getByRole("button", { name: "Metallic", exact: true }).click();
  await expect(shop.getByRole("button", { name: /^\d{3} Metallic / }).first()).toBeVisible();
  await expect(shop.getByRole("button", { name: /^\d{3} Reflex / })).toHaveCount(0);
  await shop.getByRole("button", { name: "All", exact: true }).click();
  await page.getByTestId("helium-sempertex-search").fill("970");
  await shop.getByRole("button", { name: "970 Reflex Gold" }).click();
  await expect(page.getByTestId("helium-colours").getByRole("button", { name: "Remove 970 Reflex Gold" })).toBeVisible();
  expect(aed(await sum.textContent())).toBe(3 * (210 + 30));
  // A plain star as well (several foils, 2026-11-04), in rose gold: the silver photo coloured; then the snowflake off.
  const foils = page.getByTestId("helium-topper");
  await foils.getByRole("checkbox", { name: /^Star(?!ry)/ }).click();
  await expect(art.locator("[data-part=helium-foil]")).toHaveCount(6);
  expect(aed(await sum.textContent())).toBe(3 * (210 + 30 + 15));
  await foils.getByRole("checkbox", { name: /Snowflake/ }).click();
  await expect(foils.getByRole("checkbox", { name: /Snowflake/ })).toHaveAttribute("aria-checked", "false");
  await expect(art.locator("[data-part=helium-foil]")).toHaveCount(3);
  await page.getByTestId("helium-topper-colour").getByRole("radio", { name: "Rose gold" }).click();
  await expect.poll(async () => (await art.locator("[data-part=helium-foil]").first().getAttribute("href")) ?? "").toMatch(/^data:image\/png/);
  expect(aed(await sum.textContent())).toBe(3 * (210 + 15));
  // The age in two digits, 100 cm tall.
  await page.getByTestId("helium-number-on").getByRole("radio", { name: "Yes" }).click();
  await expect(art.locator("[data-part=helium-number-glyph]")).toHaveCount(1);
  await page.getByTestId("helium-number").fill("10");
  await page.getByTestId("helium-number-size").getByRole("radio", { name: /100 cm/ }).click();
  await expect(art.locator("[data-part=helium-number-glyph]")).toHaveCount(2);
  expect(aed(await sum.textContent())).toBe(3 * 225 + 240);
  // The name in foil letters: capitals, letters only.
  await page.getByTestId("helium-letters-on").getByRole("radio", { name: "Yes" }).click();
  await page.getByTestId("helium-letters").fill("Mia-Rose");
  await expect(page.getByTestId("helium-letters")).toHaveValue("MIAROSE");
  await expect(art.locator("[data-part=helium-letters-glyph]")).toHaveCount(7);
  // The ceiling, and the bubble with the name.
  await page.getByTestId("helium-ceiling").getByRole("radio", { name: /^25 balloons/ }).click();
  await expect(art.locator("[data-part=helium-ceiling] [data-part=helium-latex]")).toHaveCount(25);
  await page.getByTestId("helium-bubble-on").getByRole("radio", { name: "Yes" }).click();
  await page.getByTestId("helium-bubble-name").fill("Mia");
  await page.getByTestId("helium-bubble-filling").getByRole("radio", { name: /Mini balloons/ }).click();
  await expect(art.locator("[data-part=helium-bubble-name]")).toHaveText("Mia");
  expect(aed(await sum.textContent())).toBe(3 * 225 + 240 + 7 * 25 + 275 + 180 + 40);
  expect(aed(await total(page).textContent())).toBe(before + aed(await sum.textContent()));
  // The render offered, not waited for (lib/renderGate.ts); then made.
  await expect(next(page)).toHaveCount(0);
  await expect(page.getByTestId("finish-helium")).toBeEnabled();
  await page.getByTestId("finish-helium-generate").click();
  await expect(page.getByTestId("helium-render")).toBeVisible();
  const sent = JSON.parse(guard.blocked.find((r) => r.url().includes("/api/helium-render"))!.postData()!);
  expect(sent.preview).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.helium).toMatchObject({ bouquets: 3, size: "large", foils: ["star"], ceiling: 25, number: { value: "10", size: "100" },
    letters: { on: true, text: "MIAROSE" }, bubble: { on: true, name: "Mia", filling: "mini" } });
  expect(sent.helium.balloons).toContain("reflex-970-gold");
  // "Finalize the balloons → Experiences".
  await page.getByTestId("finish-helium").click();
  await expect(page.getByTestId("experiences")).toBeVisible(); // the experiences (2026-11-04), none picked
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Choose your service package" })).toBeVisible();
  await expect(page.getByTestId("finished-designs")).toContainText("Helium balloons");
  await page.getByRole("button", { name: "← Back" }).click(); // to the experiences
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByTestId("finish-helium")).toHaveText(/Next: Experiences/);
  expect(guard.blocked.map((r) => new URL(r.url()).pathname)).toEqual(["/api/helium-render"]);
});

test("X1 the experiences, their own step before Package: priced by the guests, the children and the hours, in the order", async ({ page, guard }) => {
  // 2026-11-04 (the owner: the old Add-ons as "experiences", before Package; popcorn, cotton candy, photographer,
  // entertainment, inflatables, face painting and workshops).
  await toTable(page);
  await page.getByTestId("skip-kids-table").click();
  for (let i = 0; i < 5; i++) await next(page).click(); // the grown-ups' table, welcome board, giveaways, piñata, cake skipped
  await expect(next(page)).toHaveText(/Skip to Experiences/);
  await next(page).click(); // the balloons skipped
  await expect(page.getByTestId("experiences")).toBeVisible();
  await expect(next(page)).toHaveText(/Skip to Package/);
  const before = aed(await total(page).textContent());
  const sum = page.getByTestId("experiences-total");
  // The popcorn cart: 20 guests, the boxes in her theme's print; then plain, and a child more (the next tier).
  await page.getByTestId("exp-popcorn").click();
  await expect(page.getByTestId("exp-popcorn")).toHaveAttribute("aria-checked", "true");
  expect(aed(await sum.textContent())).toBe(220 + 60);
  await expect(page.getByTestId("exp-popcorn-boxes").locator("img")).toHaveAttribute("src", "/design/table/placemats/frozen/pattern.webp");
  await page.getByTestId("exp-popcorn-boxes").getByRole("radio", { name: /Plain white/ }).click();
  await page.getByTestId("exp-children").getByRole("button", { name: "One child more" }).click();
  expect(aed(await sum.textContent())).toBe(320);
  // The photographer for 3 hours with the film; face painting in the theme's designs; a bouncy castle outdoors.
  await page.getByTestId("exp-photographer").click();
  await page.getByTestId("exp-photo-hours").getByRole("radio", { name: /3 hrs/ }).click();
  await page.getByTestId("exp-video").check();
  await page.getByTestId("exp-face_painting").click();
  await expect(page.getByTestId("exp-face-designs")).toContainText("Snowflake crown");
  await page.getByTestId("exp-bouncy_castle").click();
  await page.getByTestId("exp-place").getByRole("radio", { name: /Outdoors/ }).click();
  expect(aed(await sum.textContent())).toBe(320 + 1500 + 550 + 450);
  expect(aed(await total(page).textContent())).toBe(before + 320 + 1500 + 550 + 450);
  // On to Package, and back: kept.
  await expect(next(page)).toHaveText(/Continue to Package/);
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Choose your service package" })).toBeVisible();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByTestId("exp-bouncy_castle")).toHaveAttribute("aria-checked", "true");
  await next(page).click();
  await next(page).click();
  await page.getByPlaceholder("Full name").fill("Test Customer");
  await page.getByPlaceholder("+971 5x xxx xxxx").fill("+971500000000");
  await next(page).click();
  await expect(page.getByText("Photographer, 3 hrs + video film").first()).toBeVisible();
  await next(page).click(); // Request Final Quote → caught
  await expect.poll(() => guard.blocked.some((r) => r.url().includes("/api/orders"))).toBe(true);
  const order = JSON.parse(guard.blocked.find((r) => r.url().includes("/api/orders"))!.postData()!);
  expect(order.experiences).toMatchObject({ picked: ["popcorn", "photographer", "face_painting", "bouncy_castle"], children: 11, photoHours: 3, video: true, place: "outdoor" });
});

test("W2 on a phone, a change to the welcome board brings it into sight, and Back returns to the choices", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "the phone layout only");
  await toTable(page);
  await page.getByTestId("skip-kids-table").click();
  await next(page).click();
  await page.getByRole("button", { name: /Yes, design the board/ }).click();
  await page.waitForTimeout(800);
  await expect(page.getByTestId("welcome-back-to-choices")).toHaveCount(0);
  await page.getByTestId("welcome-garnish").getByRole("radio", { name: /Just the board/ }).click();
  await expect(page.getByTestId("welcome-preview").getByRole("img", { name: "Your welcome board" })).toBeInViewport();
  await page.getByTestId("welcome-back-to-choices").click();
  await expect(page.getByTestId("welcome-garnish")).toBeInViewport();
  // Typing: once the field is left.
  const name = page.getByTestId("welcome-name");
  await name.fill("Zara's");
  await expect(page.getByTestId("welcome-preview").getByRole("img", { name: "Your welcome board" })).not.toBeInViewport();
  await name.blur();
  await expect(page.getByTestId("welcome-preview").getByRole("img", { name: "Your welcome board" })).toBeInViewport();
  await expect(page.getByTestId("welcome-preview").locator("svg [data-word=name]")).toHaveText("Zara's");
});

test("K2 skipping the table takes it out of the total; Back walks back to the backdrop", async ({ page }) => {
  await toTable(page);
  const designed = aed(await total(page).textContent());
  const sum = aed(await page.getByTestId("table-total").locator("b").textContent());
  await page.getByTestId("skip-kids-table").click();
  await expect(page.getByTestId("adult-intro")).toBeVisible(); // on to the grown-ups' table
  expect(aed(await total(page).textContent())).toBe(designed - sum);
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByText("You skipped the kids' table")).toBeVisible();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByText("You skipped the backdrop")).toBeVisible();
});

test("K3 the table is kept on the device", async ({ page }) => {
  await toTable(page);
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
  await expect(page.getByTestId("table-place")).toBeVisible(); // the kids' table, designed (2026-11-03)
});

// K5–K8 and K6 (the table's own close-up render) went on 2026-10-29: the owner
// took the render off this step ("bu aşamada render seçeneği olmasın") — one
// combined render of the backdrop and the table comes at the end instead.

test("K9 the top view of one place follows every colour and word at once, with no render", async ({ page, guard }) => {
  await toTable(page);
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
  // Opening the table does not jump: the customer is about to choose.
  await page.waitForTimeout(800);
  await expect(page.getByTestId("table-back-to-choices")).toHaveCount(0);
  await page.getByRole("tab", { name: "Perspective" }).click();
  await page.getByTestId("cups-colour").getByRole("radio", { name: "gold foil" }).click();
  // The preview comes up, on the top view.
  await expect(page.getByTestId("table-place")).toBeInViewport();
  await expect(page.getByRole("tab", { name: "One place" })).toHaveAttribute("aria-selected", "true");
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
