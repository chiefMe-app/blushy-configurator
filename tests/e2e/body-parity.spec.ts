// The render golden (tests/golden) builds request bodies from fixtures, not
// from the UI. This proves the two are the same: each case is clicked through
// the real builder, the render request it sends is caught before it leaves
// the browser, and it must equal renderBody(fixture) field for field — the
// fixture as the Builder holds it, every board lettered with the Typography
// System (withBuilderLettering, 2026-10-26).
import { test, expect, openDecor, decorTab, captureRenderBody, signIn } from "./guard";
import { fixtureById } from "../fixtures/configs";
import { withBuilderLettering } from "../fixtures/builder";
import { renderBody, comparableBody } from "../../scripts/golden/renderBody";

const cases: { fixture: string; setup: string; steps?: (page: import("@playwright/test").Page) => Promise<void> }[] = [
  { fixture: "A-single_round", setup: "Single Round" },
  { fixture: "A-double_arch", setup: "Double Arch" },
  {
    fixture: "B01-hb-arya-script", setup: "Single Round",
    steps: async (page) => {
      await decorTab(page, "Style");
      await page.getByLabel("Name text").fill("Arya");
    },
  },
  {
    fixture: "E03-foil-pink", setup: "Single Round",
    steps: async (page) => {
      await decorTab(page, "Extras");
      await page.getByRole("switch", { name: "Add a number" }).click();
      await page.getByRole("button", { name: /Foil balloon bunch/ }).click();
      await page.getByRole("button", { name: "pink", exact: true }).click();
    },
  },
];

for (const c of cases) {
  test(`${c.fixture}: UI sends the fixture's render body`, async ({ page, guard }) => {
    await signIn(page); // renders need an account
    await openDecor(page, "Ice Princess", c.setup);
    if (c.steps) await c.steps(page);
    const sent = comparableBody(await captureRenderBody(page, guard));
    const expected = comparableBody(renderBody(withBuilderLettering(fixtureById(c.fixture).config)) as Record<string, unknown>);
    expect(sent).toEqual(expected);
  });
}
