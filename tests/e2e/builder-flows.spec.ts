// Today's builder behaviour, step by step, on desktop and mobile. Each flow
// checks what the customer can see (choices, prices, the live sketch) and
// saves screenshots as the visual baseline. Renders and orders never leave
// the browser (see guard.ts); where a flow has to get past Decor, the render
// request is answered with a local stand-in picture.
import { test, expect, next, total, openDecor, chooseSetup, decorTab, settle, masks, signIn, renderButton, FAKE_ACCOUNT } from "./guard";
import { computeTotal, formatAED } from "@/lib/config";
import { fixtureById } from "../fixtures/configs";

const aed = (n: number) => `AED ${formatAED(n)}`;
const shot = async (page: import("@playwright/test").Page, name: string) => {
  await settle(page);
  // On phones a Decor tab change scrolls the page, and where it lands varies
  // by 1–50 px from run to run; there the shot is of the settings panel
  // itself rather than of the viewport. Desktop shots stay full-viewport.
  const phoneDecor = (page.viewportSize()?.width ?? 1000) < 768 && (await page.locator(".bz-decor-tabbar").count()) > 0;
  // Soft: one changed screen does not hide the next ones in the same flow.
  if (phoneDecor) await expect.soft(page.locator(".bz-content")).toHaveScreenshot(`${name}.png`, { mask: masks(page) });
  else await expect.soft(page).toHaveScreenshot(`${name}.png`, { mask: masks(page) });
};

test("F1 end to end: Event → Review, the total matches pricing and the order is caught", async ({ page, guard }) => {
  guard.fakeRender = true;
  guard.fakeOrder = true;
  await page.goto("/builder");
  await shot(page, "f1-01-event");
  await page.locator(".bz-choice.bz-birthday").click();
  await next(page).click();
  await expect(next(page)).toBeDisabled(); // no theme yet
  await shot(page, "f1-02-theme");
  await page.locator(".bz-choice.bz-theme", { has: page.locator("h3", { hasText: /^Frozen$/ }) }).first().click();
  await next(page).click();
  await chooseSetup(page, "Single Round");
  await expect(total(page)).toHaveText(aed(computeTotal(fixtureById("A-single_round").config)));
  await shot(page, "f1-03-decor-backdrop");
  for (const tab of ["Style", "Balloons", "Extras"] as const) {
    await next(page).click();
    await expect(page.locator(".bz-decor-tab.on")).toContainText(tab);
    // Desktop shots show the live sketch: its lettering comes a moment later.
    if ((page.viewportSize()?.width ?? 1000) >= 768) await expect(page.getByTestId("sketch-lettering").locator("path").first()).toBeAttached();
    await shot(page, `f1-04-decor-${tab.toLowerCase()}`);
  }
  // The footer goes on to the kids' table; the render is the Extras tab's own button.
  await expect(next(page)).toHaveText(/Next: Table setup/);
  // Generate render, signed out (2026-10-27: renders need an account): the
  // sign-in window, and no render asked for.
  await renderButton(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Sign in to see your render" })).toBeVisible();
  expect(guard.blocked.some((r) => r.url().includes("/api/generate-controlled-render"))).toBe(false);
  await dialog.getByLabel("Email").fill(FAKE_ACCOUNT.email);
  await dialog.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(dialog.getByRole("status")).toContainText("your render starts right after");
  await page.goto("/account/callback?code=e2e-link"); // the emailed link
  // Back on the same design, and the render starts by itself → stand-in.
  await expect(page).toHaveURL(/\/builder$/);
  const renderCalls = () => guard.blocked.filter((r) => r.url().includes("/api/generate-controlled-render"));
  await expect.poll(() => renderCalls().length).toBe(1);
  await expect(page.getByRole("button", { name: /^Regenerate/ }).first()).toBeVisible(); // the render is in
  const renders = renderCalls();
  expect(renders).toHaveLength(1);
  expect(renders[0].headers()["authorization"]).toMatch(/^Bearer \S+/);
  await next(page).click(); // the kids' table: skipped here (tests/e2e/table-step.spec.ts)
  await page.getByRole("button", { name: "No thanks, skip" }).click();
  await expect(next(page)).toHaveText(/Continue to Package/);
  await next(page).click();
  await shot(page, "f1-05-package");
  await next(page).click();
  await shot(page, "f1-06-addons");
  await next(page).click();
  await page.getByPlaceholder("Full name").fill("Test Customer");
  await page.getByPlaceholder("+971 5x xxx xxxx").fill("+971500000000");
  await shot(page, "f1-07-venue");
  await next(page).click();
  await shot(page, "f1-08-review");
  // The board's lettering is listed (until 2026-10-26 this row said "None").
  await expect(page.getByText('"Happy Birthday" · Soft Signature')).toBeVisible();
  const shown = await total(page).textContent();
  await next(page).click(); // Request Final Quote → caught
  await expect.poll(() => guard.blocked.some((r) => r.url().includes("/api/orders"))).toBe(true);
  const order = JSON.parse(guard.blocked.find((r) => r.url().includes("/api/orders"))!.postData()!);
  expect(aed(order.estimatedTotal)).toBe(shown);
  // The customer sees the confirmation (until 2026-10-26 a hook below the
  // success screen's early return crashed the page here).
  await expect(page.getByText("Request received!")).toBeVisible();
  // The total the server would save for exactly this body. The test server has
  // no database (00-safety), so nothing is stored. Before the 2026-10-25 fix
  // this was AED 50 (the Frozen surcharge) below the Review total.
  const saved = await (await page.request.post("/api/orders", { data: order })).json();
  expect(saved.persisted).toBe(false);
  expect(aed(saved.total)).toBe(shown);
  // 2026-10-26: board lettering is the Typography System's — the default
  // board opens on #5 Soft Signature with "Happy Birthday" as its heading.
  expect(order.decor.backdropItems[0].text).toMatchObject({
    enabled: true, value: "Happy Birthday",
    lettering: { presetId: "soft-signature", heading: { text: "Happy Birthday", fontId: "bellefair" }, name: { text: "", fontId: "italianno" } },
  });
});

const SETUPS = ["Single Arch", "Single Round", "Banner Backdrop", "Shimmer Wall", "Arch + Shimmer", "Balloon Ring", "Arch + Open Frame", "Double Arch", "Triple Arch"];

test("F2 every setup opens with its price and sketch", async ({ page }) => {
  await openDecor(page);
  const names = await page.locator(".bz-choice.bz-layout h3").allTextContents();
  expect(names).toEqual(SETUPS);
  for (const name of names) {
    await chooseSetup(page, name);
    await expect(page.locator(".bz-choice.bz-layout.selected h3")).toHaveText(name);
    await shot(page, `f2-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`);
  }
});

test("F3 lettering: presets, each line's font and size change only themselves", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Style");
  await page.getByLabel("Name text").fill("Arya");
  const before = await total(page).textContent();
  const sketch = page.getByTestId("sketch-lettering");
  await expect(sketch.locator("path")).toHaveCount(2); // heading and name, drawn by the engine
  await expect(page.getByTestId("lettering-state")).toContainText("Style: Soft Signature");
  await shot(page, "f3-soft-signature");
  for (const preset of ["Modern Editorial", "Party Pop"]) {
    const h = await sketch.getAttribute("data-hash");
    await page.getByRole("radio", { name: preset, exact: true }).click();
    await expect(page.getByTestId("lettering-state")).toContainText(`Style: ${preset}`);
    await expect(sketch).not.toHaveAttribute("data-hash", h!);
    await expect(page.getByLabel("Heading text")).toHaveValue("Happy Birthday");
    await expect(page.getByLabel("Name text")).toHaveValue("Arya");
    await expect(total(page)).toHaveText(before!);
    await shot(page, `f3-${preset.toLowerCase().replace(/ /g, "-")}`);
  }
  // The name's own font: the heading keeps Party Pop's, the mix is the customer's.
  await page.getByRole("tab", { name: /^Name/ }).click();
  let h = await sketch.getAttribute("data-hash");
  await page.getByRole("radio", { name: "WindSong", exact: true }).click();
  await expect(sketch).not.toHaveAttribute("data-hash", h!);
  await expect(page.getByRole("tab", { name: /^Name/ })).toContainText("WindSong");
  await expect(page.getByRole("tab", { name: /^Heading/ })).toContainText("Fraunces");
  await expect(page.getByTestId("lettering-state")).toContainText("Your own mix (from Party Pop)");
  // Sizes: each line on its own, never the price.
  h = await sketch.getAttribute("data-hash");
  await page.getByRole("group", { name: "Name size" }).getByRole("button", { name: /Small/ }).click();
  await expect(sketch).not.toHaveAttribute("data-hash", h!);
  await expect(total(page)).toHaveText(before!);
  await shot(page, "f3-own-mix-small-name");
  await page.getByRole("button", { name: "Back to Party Pop" }).click();
  await expect(page.getByTestId("lettering-state")).toContainText("Style: Party Pop");
});

test("F4 text off and on again keeps the message", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Style");
  await page.getByLabel("Name text").fill("Arya");
  await page.getByRole("button", { name: /No, keep it clean/ }).click();
  await expect(page.getByLabel("Name text")).toHaveCount(0);
  // Removing the field shortens the page and scroll anchoring lands a few
  // pixels differently from run to run (0–50 px on phones), so this shot is of
  // the Style panel itself rather than of the viewport.
  await settle(page);
  await expect.soft(page.locator(".bz-content")).toHaveScreenshot("f4-text-off.png", { mask: masks(page) });
  await page.getByRole("button", { name: /Yes, add text/ }).click();
  await expect(page.getByLabel("Name text")).toHaveValue("Arya");
  await expect(page.getByLabel("Heading text")).toHaveValue("Happy Birthday");
});

test("F5 standees: none by default, at most two", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Extras");
  await expect(page.locator(".bz-ex-squad")).toContainText("No characters yet");
  const chars = page.locator(".bz-ex-char:not(.more)");
  await chars.nth(0).click();
  await chars.nth(1).click();
  await expect(page.locator(".bz-ex-squad")).toContainText("2 standees selected");
  await expect(chars.nth(2)).toBeDisabled();
  await shot(page, "f5-two-standees");
});

test("F6 plinths 0–3, three is XXL · XL · XL", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Extras");
  const fewer = page.getByRole("button", { name: "One fewer plinth" });
  const more = page.getByRole("button", { name: "One more plinth" });
  const count = page.getByRole("group", { name: "Number of plinths" }).locator("span");
  await expect(count).toHaveText("1");
  await fewer.click();
  await expect(count).toHaveText("0");
  await expect(fewer).toBeDisabled();
  await more.click(); await more.click(); await more.click();
  await expect(count).toHaveText("3");
  await expect(more).toBeDisabled();
  await expect(page.locator(".bz-ex-side .lbl.small")).toContainText("XXL · XL · XL");
  await shot(page, "f6-three-plinths");
});

test("F7 foil number: AED 150, colour of the customer's choice", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Extras");
  const base = fixtureById("A-single_round").config;
  await page.getByRole("switch", { name: "Add a number" }).click();
  await page.getByRole("button", { name: /Foil balloon bunch/ }).click();
  await expect(total(page)).toHaveText(aed(computeTotal(base) + 150));
  await page.getByRole("button", { name: "pink", exact: true }).click();
  await expect(page.getByRole("button", { name: "pink", exact: true })).toHaveAttribute("aria-pressed", "true");
  await shot(page, "f7-foil-pink");
});

test("F8 neon swap and back", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Style");
  await page.getByLabel("Name text").fill("Arya");
  await decorTab(page, "Extras");
  await page.getByRole("button", { name: /use a neon sign instead/ }).click();
  await expect(page.getByLabel("Neon sign text")).toHaveValue("Happy Birthday Arya");
  await shot(page, "f8-neon-on");
  await page.getByRole("button", { name: /Use printed text instead of the neon/ }).click();
  await decorTab(page, "Style");
  await expect(page.getByLabel("Name text")).toHaveValue("Arya");
});

test("F9 show sizes", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Style");
  const toggle = page.getByRole("button", { name: /Show sizes/ });
  await toggle.click();
  await expect(page.getByRole("button", { name: /Hide sizes/ })).toBeVisible();
  await shot(page, "f9-sizes");
});

test("F10 nothing paid or stored is reached while browsing every step", async ({ page, guard }) => {
  await openDecor(page, "Frozen", "Double Arch");
  for (const tab of ["Style", "Balloons", "Extras"] as const) await decorTab(page, tab);
  // Browsing alone sends no render and no order.
  expect(guard.blocked.map((r) => new URL(r.url()).pathname)).toEqual([]);
});

test("F11 a render limit says so in the render card, with no Retry", async ({ page, guard }) => {
  guard.limitRender = { status: 429, error: "You've reached your render limit — you can render again in 7 min." };
  await signIn(page); // renders need an account
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Extras");
  await renderButton(page).click(); // refused by the limit
  const card = page.getByTestId("render-error");
  await expect(card).toHaveText("You've reached your render limit — you can render again in 7 min.");
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
  await expect(page.getByText("Render unavailable")).toHaveCount(0);
});

test("F12 renders still running from the same connection: says so, and Retry stays", async ({ page, guard }) => {
  guard.limitRender = { status: 429, busy: true, error: "A render from this connection is still being made — please try again in a few seconds." };
  await signIn(page); // renders need an account
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Extras");
  await renderButton(page).click();
  await expect(page.getByTestId("render-error")).toHaveText(/still being made/);
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("F13 the Package step without a render: the render is optional", async ({ page, guard }) => {
  await openDecor(page, "Frozen", "Single Round");
  await decorTab(page, "Extras");
  await expect(renderButton(page)).toBeVisible(); // offered, not required
  await expect(next(page)).toHaveText(/Next: Table setup/);
  await next(page).click();
  await expect(next(page)).toHaveText(/Skip to Package/); // the table is optional too
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Choose your service package" })).toBeVisible();
  expect(guard.blocked.some((r) => r.url().includes("/api/generate-controlled-render"))).toBe(false);
  expect(guard.supabase.requests).toEqual([]); // nor any sign-in asked for
});
