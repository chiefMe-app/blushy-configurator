// The real photo's finishing edit (lib/photoGrade.ts, 2026-11-04, the owner: "istediğim canlılığı ver").
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { gradePhoto } from "@/lib/photoGrade";

const swatch = async (rgb: [number, number, number][]) => {
  // A picture of bands, one per colour, 60 px tall each.
  const w = 120, h = 60 * rgb.length, raw = Buffer.alloc(w * h * 3);
  rgb.forEach(([r, g, b], j) => { for (let y = j * 60; y < (j + 1) * 60; y++) for (let x = 0; x < w; x++) raw.set([r, g, b], (y * w + x) * 3); });
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
};
const bands = async (jpeg: Buffer, count: number) => {
  const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  return Array.from({ length: count }, (_, j) => {
    const i = ((j * 60 + 30) * info.width + 60) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  });
};
// How colourful: the spread of the channels.
const chroma = ([r, g, b]: number[]) => Math.max(r, g, b) - Math.min(r, g, b);

describe("gradePhoto", () => {
  it("takes a warm cast off the whites and brightens them", async () => {
    const wall: [number, number, number] = [222, 214, 200];
    const [w] = await bands(await gradePhoto(await swatch([wall, wall, wall, [40, 36, 34]])), 4);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(wall[0] - wall[2] - 6); // nearer white-neutral
    expect(w[1]).toBeGreaterThan(wall[1] + 8);
  });

  it("makes the pastels livelier and opens the shadows, under a neutral light", async () => {
    const wall: [number, number, number] = [216, 216, 214];
    const pink: [number, number, number] = [228, 186, 200], mint: [number, number, number] = [180, 214, 196];
    const [, , , p, m, dark] = await bands(await gradePhoto(await swatch([wall, wall, wall, pink, mint, [40, 38, 38]])), 6);
    expect(chroma(p)).toBeGreaterThan(chroma(pink) + 6);
    expect(chroma(m)).toBeGreaterThan(chroma(mint) + 6);
    expect((p[0] + p[1] + p[2]) / 3).toBeGreaterThan((pink[0] + pink[1] + pink[2]) / 3 - 3); // never darker
    expect(dark[0]).toBeGreaterThanOrEqual(40); // opened, never crushed
  });

  // 2026-11-04 ("aşırı aydınlık ortam"): a photo already bright keeps its light tones apart instead of one white.
  it("does not lift the light tones of a photo already bright", async () => {
    const wall: [number, number, number] = [238, 238, 238], cloth: [number, number, number] = [222, 222, 222];
    const [w, , , c] = await bands(await gradePhoto(await swatch([wall, wall, wall, cloth, [120, 118, 118]])), 5);
    expect(w[1]).toBeLessThanOrEqual(247); // only the exposure's own lift, to its white
    expect(w[1] - c[1]).toBeGreaterThan(12); // still a step apart
  });

  it("leaves white white and keeps the size", async () => {
    const jpeg = await swatch([[255, 255, 255], [250, 250, 250], [120, 60, 160]]);
    const out = await gradePhoto(jpeg);
    expect(await sharp(out).metadata()).toMatchObject({ width: 120, height: 180, format: "jpeg" });
    const [white] = await bands(out, 3);
    expect(Math.min(...white)).toBeGreaterThan(248);
  });
});
