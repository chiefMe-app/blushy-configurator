// The cake's pictures (2026-11-03, the owner: "piñatadan sonra cake studio'ya geçelim"; on a cake stand, close
// up): scripts/cake/sources/*.png are flux-2 product shots, four to a picture, then a birefnet cutout and cut apart —
// one white tier for each decoration (smooth, drip, ruffles, rosettes), stacked and coloured in the builder, and the
// fondant figures that go on top, in their own colours. The stand (stand.png) is the photo they sit in, with more wall above it.
// Each piece is cleaned (bits of its neighbours dropped) and trimmed; a tier's light is evened out so its white
// reads white (a colour multiplied over it then reads true) and where its top and bottom circles lie is measured.
// Written to public/design/cake/<name>.webp and lib/studio/cakeParts.json.
//   npx tsx scripts/cake/build-parts.mts
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, "scripts/cake/sources");
const OUT = path.join(ROOT, "public/design/cake");
const FIGURE_TALL = 360;
/** How deep a tier's top oval is for its width, halved (measured on the smooth tier: 36 px on 293). */
const OVAL = 0.125;
/** Wall added above the stand photo (lib/studio/cake.ts CAKE_STAND). */
const STAND_ABOVE = 240;

/** Only the picture's big pieces: a piece under 3% of the largest is a neighbour's bit, made clear. */
function keepBig(d: Buffer, W: number, H: number) {
  const label = new Int32Array(W * H).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (label[i] >= 0 || d[i * 4 + 3] <= 24) continue;
    const id = sizes.length, stack = [i];
    label[i] = id;
    let n = 0;
    while (stack.length) {
      const p = stack.pop()!;
      n++;
      const x = p % W, y = (p - x) / W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && label[q] < 0 && d[q * 4 + 3] > 24) { label[q] = id; stack.push(q); }
      }
    }
    sizes.push(n);
  }
  const big = Math.max(...sizes);
  for (let i = 0; i < W * H; i++) {
    const l = label[i];
    if ((l < 0 && d[i * 4 + 3] > 0) || (l >= 0 && sizes[l] < big * 0.03)) d[i * 4 + 3] = 0;
  }
}

/** The opaque part's box. */
function bbox(d: Buffer, W: number, H: number) {
  let [x0, y0, x1, y1] = [W, H, -1, -1];
  for (let i = 0; i < W * H; i++) {
    if (d[i * 4 + 3] <= 8) continue;
    const x = i % W, y = (i - x) / W;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

fs.mkdirSync(OUT, { recursive: true });
const manifest: { tiers: Record<string, { w: number; h: number; top: number; bottom: number }>; figures: Record<string, { w: number; h: number }> } = { tiers: {}, figures: {} };
for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith(".png")).sort()) {
  const name = f.replace(/\.png$/, "");
  if (name === "stand") {
    // More wall above it, its top row carried up, for a tall cake and its topper.
    await sharp(path.join(SRC, f)).extend({ top: STAND_ABOVE, extendWith: "copy" }).webp({ quality: 84 }).toFile(path.join(OUT, "stand.webp"));
    continue;
  }
  const { data, info } = await sharp(path.join(SRC, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  keepBig(data, W, H);
  const tier = name.startsWith("tier-");
  if (tier) {
    // Its whites made white, channel by channel (a cream cast taken out; the chocolate drip stays brown).
    for (let c = 0; c < 3; c++) {
      const v: number[] = [];
      for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 200 && data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2] > 540) v.push(data[i * 4 + c]);
      v.sort((a, b) => a - b);
      const top = v[Math.floor(v.length * 0.95)] || 255;
      for (let i = 0; i < W * H; i++) data[i * 4 + c] = Math.min(255, Math.round((data[i * 4 + c] * 255) / top));
    }
  }
  const b = bbox(data, W, H);
  const img = sharp(data, { raw: { width: W, height: H, channels: 4 } }).extract(b);
  if (tier) {
    const out = await img.webp({ quality: 88, alphaQuality: 92 }).toBuffer({ resolveWithObject: true });
    fs.writeFileSync(path.join(OUT, `${name}.webp`), out.data);
    // Its top and bottom circles' middles: the photos look down on them as an oval an eighth as deep as it is wide
    // (OVAL), so each lies that far in from the tier's top and bottom at its middle.
    const { data: a } = await sharp(out.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = out.info.width, h = out.info.height;
    const mid = Math.round(w / 2);
    const rows = (x: number) => { let t = -1, e = -1; for (let y = 0; y < h; y++) if (a[(y * w + x) * 4 + 3] > 128) { if (t < 0) t = y; e = y; } return [t, e]; };
    const cols = [-20, -10, 0, 10, 20].map((dx) => rows(mid + dx));
    const median = (v: number[]) => v.sort((p, q) => p - q)[2];
    const sag = Math.round(OVAL * (w / 2));
    const top = median(cols.map((c) => c[0])) + sag;
    const bottom = median(cols.map((c) => c[1])) - sag;
    manifest.tiers[name.slice(5)] = { w, h, top, bottom };
    console.log(name.padEnd(16), w, "x", h, "top", top, "bottom", bottom, `${(out.data.length / 1024).toFixed(0)} KB`);
  } else {
    const out = await img.resize({ height: FIGURE_TALL, withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 90 }).toBuffer({ resolveWithObject: true });
    fs.writeFileSync(path.join(OUT, `${name}.webp`), out.data);
    manifest.figures[name.replace(/^fig-/, "")] = { w: out.info.width, h: out.info.height };
    console.log(name.padEnd(16), out.info.width, "x", out.info.height, `${(out.data.length / 1024).toFixed(0)} KB`);
  }
}
fs.writeFileSync(path.join(ROOT, "lib/studio/cakeParts.json"), JSON.stringify(manifest, null, 1) + "\n");
