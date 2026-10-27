// The free sample Design Pack (Phase 1.3): offered on the landing page and in
// the Package step, and downloaded as a ZIP with the pack's folders, no cut files.
import { unzipSync } from "fflate";
import { test, expect, openDecor } from "./guard";

test("P1 the landing page offers the sample pack, which downloads as a ZIP", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: /New: Design Pack/ });
  await expect(link).toHaveAttribute("href", "/api/packs/sample");
  const res = await page.request.get("/api/packs/sample");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/zip");
  expect(res.headers()["content-disposition"]).toContain('filename="PartyMuse_DesignPack_SAMPLE.zip"');
  const names = Object.keys(unzipSync(new Uint8Array(await res.body()))).map((n) => n.replace(/^PartyMuse_DesignPack_SAMPLE\//, "")).sort();
  expect(names).toEqual([
    "1_SPECIFICATION/Design_Specification.pdf",
    "3_VISUAL_REFERENCE_NOT_FOR_PRINT/visual_reference.jpg",
    "4_LISTS/balloons.csv",
    "4_LISTS/props.csv",
    "README.txt",
  ]);
});

test("P2 the Package step links the sample under the design packages", async ({ page }) => {
  await openDecor(page, "Frozen", "Single Round");
  // Straight to the Package step: the design kept on this device, at step 4.
  await page.waitForTimeout(800); // the device copy is written a moment after a change
  await page.evaluate(() => {
    const key = "partymuse.builder.draft.v1";
    const d = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...d, step: 3 }));
  });
  await page.reload();
  const link = page.getByTestId("sample-pack");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/api/packs/sample");
  await expect(link).toContainText("free sample Design Pack");
});

test("P3 My designs offers the sample pack under its heading", async ({ page }) => {
  await page.goto("/my-designs");
  const link = page.getByTestId("my-designs-sample-pack");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/api/packs/sample");
});
