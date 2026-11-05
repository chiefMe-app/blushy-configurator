// The cake render's sides evened (lib/photoGrade.ts evenSides, 2026-11-05: "sol taraf çok shaded duruyor daha aydınlık
// olsun ama ışık patlamasın").
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { evenSides } from "@/lib/photoGrade";

const W = 300, H = 200;
/** A grey photo whose left side is `dark` times as light as its right, a white patch on the left. */
async function photo(dark: number, patch = true) {
  const data = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = patch && x < 40 && y < 40 ? 250 : Math.round(150 * (x < W / 2 ? dark + (1 - dark) * (x / (W / 2)) : 1));
    data.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3);
  }
  return sharp(data, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}
const mean = async (b: Buffer, x0: number, x1: number, y0 = 50) => {
  const { data } = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  let s = 0, n = 0;
  for (let y = y0; y < H; y++) for (let x = x0; x < x1; x++) { s += data[(y * W + x) * 3]; n++; }
  return s / n;
};

describe("evenSides", () => {
  it("lifts a shaded left side towards the right, leaves the right and the whites", async () => {
    const before = await photo(0.6), after = await evenSides(before);
    expect(await mean(after, 0, 60)).toBeGreaterThan((await mean(before, 0, 60)) * 1.07);
    expect(Math.abs((await mean(after, 200, 300)) - (await mean(before, 200, 300)))).toBeLessThan(2);
    // The white patch is not pushed into a blown white.
    expect(await mean(after, 5, 35, 5)).toBeLessThan(254);
  });
  it("leaves an evenly lit photo as it is", async () => {
    const even = await photo(1, false);
    expect(await evenSides(even)).toBe(even);
  });
});
