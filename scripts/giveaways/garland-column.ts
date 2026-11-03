// The giveaway board's garland (2026-11-03, the owner: "üste doğru ilerlemesin balon, thank you for coming'in
// hizasında bitsin"): a column of balloons standing on the floor beside the board, ending at its words, no arch
// over its top. Cutting the welcome board garland's column off below its arch left halved balloons at the top
// (looked pasted on), so each balloon set's column was finished into whole balloons by one fal edit (flux-2/edit,
// "its top balloons are cut off … finish them") and cut out (birefnet): scripts/giveaways/columns/<piece>.png.
// Here: trimmed, and given a families map as the welcome board garland's (each pixel the family of the welcome
// photo whose colour is nearest; greys — chrome, white, clear — the greyest family), so it repaints the same way.
//   npx tsx scripts/giveaways/garland-column.ts
import { writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = "scripts/giveaways/columns";
const WELCOME = "public/design/welcome/pieces";
const OUT = "public/design/giveaways";
const MANIFEST = "lib/studio/giveawayGarland.json";
const SETS = ["frozen-bright", "frozen-pastel", "unicorn-bright", "unicorn-pastel"];

type Lab = [number, number, number];
function lab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const chroma = (c: Lab) => Math.hypot(c[1], c[2]);

async function column(set: string) {
  const name = `garland-${set}`;
  // The welcome photo's families: each one's mean colour.
  const w = await sharp(path.join(WELCOME, `${name}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const wf = await sharp(path.join(WELCOME, `${name}-families.png`)).resize(w.info.width, w.info.height, { kernel: "nearest" }).greyscale().raw().toBuffer();
  const sums = new Map<number, number[]>();
  for (let i = 0; i < wf.length; i++) {
    if (w.data[i * 4 + 3] < 200) continue;
    const s = sums.get(wf[i]) ?? [0, 0, 0, 0];
    const c = lab(w.data[i * 4], w.data[i * 4 + 1], w.data[i * 4 + 2]);
    s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; s[3]++;
    sums.set(wf[i], s);
  }
  const fams = Array.from(sums).filter(([, s]) => s[3] > 200).map(([v, s]) => ({ v, c: [s[0] / s[3], s[1] / s[3], s[2] / s[3]] as Lab }));
  const grey = [...fams].sort((p, q) => chroma(p.c) - chroma(q.c))[0];

  const trimmed = await sharp(path.join(SRC, `${name}.png`)).ensureAlpha().trim({ threshold: 1 }).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = trimmed.info, px = trimmed.data;
  const map = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) {
    if (px[i * 4 + 3] < 8) continue;
    const c = lab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    map[i] = chroma(c) < 12 && chroma(grey.c) < 15 ? grey.v
      : fams.reduce((best, f) => (Math.hypot(c[0] - f.c[0], c[1] - f.c[1], c[2] - f.c[2]) < Math.hypot(c[0] - best.c[0], c[1] - best.c[1], c[2] - best.c[2]) ? f : best)).v;
  }
  await sharp(px, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${name}-column.webp`));
  await sharp(map, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(OUT, `${name}-column-families.png`));
  return { w: W, h: H };
}

(async () => {
  const manifest: Record<string, { w: number; h: number }> = {};
  for (const set of SETS) { manifest[`garland-${set}`] = await column(set); console.log(set, manifest[`garland-${set}`]); }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
})();
