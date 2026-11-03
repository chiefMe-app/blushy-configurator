// The cake's pictures (2026-11-03, the owner: "piñatadan sonra cake studio'ya geçelim"; on a cake stand, close
// up): scripts/cake/sources/*.png are flux-2 product shots, four to a picture, then a birefnet cutout and cut apart —
// one white tier for each decoration (smooth, drip, ruffles, rosettes), stacked and coloured in the builder, and the
// fondant figures that go on top, in their own colours; since 2026-11-03 also the printed card cutouts (K-pop, Unicorn —
// original pop stars, never a film's or band's) and the mirror, glitter and bubble balls, named fig-<id> the same way. The stand (stand.png) is the photo they sit in, with more wall above it.
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

/** Where the cart photo's awning is (measured by eye), its stripes looked for inside it. */
const AWNING = { x0: 160, x1: 825, y0: 165, y1: 395 };
/** How tall a sweet's picture is kept. */
const SWEET_TALL = 480;

/**
 * A sweet's icing (2026-11-03, the owner: "cupcake, cookie, cake pops … ve donut"): the white of it — bright and
 * colourless, the gold stand and the baked dough left out — as a mask its colour is multiplied through. (Where its
 * pieces are, for toppers and prints, is measured by eye in lib/studio/cakeSweets.ts: the icing runs together.)
 */
function icing(d: Buffer, W: number, H: number) {
  const m = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    // Soft at the edge: white enough and grey enough, the more the stronger.
    const w = Math.max(0, Math.min(1, (max - 170) / 40)) * Math.max(0, Math.min(1, (0.2 - sat) / 0.08)) * (a / 255);
    m[i * 4] = m[i * 4 + 1] = m[i * 4 + 2] = 255;
    m[i * 4 + 3] = Math.round(w * 255);
  }
  return m;
}

fs.mkdirSync(OUT, { recursive: true });
const manifest: {
  tiers: Record<string, { w: number; h: number; top: number; bottom: number }>;
  figures: Record<string, { w: number; h: number }>;
  sweets: Record<string, { w: number; h: number }>;
} = { tiers: {}, figures: {}, sweets: {} };
for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith(".png")).sort()) {
  const name = f.replace(/\.png$/, "");
  if (name === "cart") {
    // The sweet cart (2026-11-03, the owner: "cake cart opsiyonu da olabilir"): its photo, and its awning's grey
    // stripes as a mask her colour is multiplied through (only inside the awning: the cart's own shade stays white).
    const { data: c, info: ci } = await sharp(path.join(SRC, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // The cart alone (a birefnet cut-out of the same photo): the wall round the awning is left as it is.
    const { data: cut } = await sharp(path.join(SRC, "cart-cut.png.keep")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const m = Buffer.alloc(ci.width * ci.height * 4);
    for (let y = 0; y < ci.height; y++) for (let x = 0; x < ci.width; x++) {
      const i = (y * ci.width + x) * 4;
      m[i] = m[i + 1] = m[i + 2] = 255;
      if (x < AWNING.x0 || x > AWNING.x1 || y < AWNING.y0 || y > AWNING.y1) continue;
      const lum = (c[i] + c[i + 1] + c[i + 2]) / 3;
      m[i + 3] = Math.round(Math.max(0, Math.min(1, (236 - lum) / 22)) * cut[i + 3]);
    }
    await sharp(path.join(SRC, f)).webp({ quality: 84 }).toFile(path.join(OUT, "cart.webp"));
    await sharp(m, { raw: { width: ci.width, height: ci.height, channels: 4 } }).blur(1).webp({ quality: 80, alphaQuality: 80 }).toFile(path.join(OUT, "cart-awning.webp"));
    console.log("cart", ci.width, "x", ci.height);
    continue;
  }
  if (name === "stand" || name === "stand-board") {
    // More wall above it, its top row carried up, for a tall cake and its topper. The board (2026-11-03, the owner:
    // "3 katlı olunca alttaki cake holder'ın ayaksızı olsun"): the same photo, a flux-2 edit, a flat cake board on the
    // tablecloth where the stand was.
    await sharp(path.join(SRC, f)).extend({ top: STAND_ABOVE, extendWith: "copy" }).webp({ quality: 84 }).toFile(path.join(OUT, name === "stand" ? "stand.webp" : "board.webp"));
    continue;
  }
  if (name === "cart-board") {
    // The cart with a flat cake board on its counter instead of its stand: only the counter taken from a flux-2 edit,
    // feathered, so the awning (and its mask) is the cart's own.
    await sharp(path.join(SRC, f)).webp({ quality: 84 }).toFile(path.join(OUT, "cart-board.webp"));
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
  if (name.startsWith("sweet-")) {
    const out = await img.resize({ height: SWEET_TALL }).png().toBuffer({ resolveWithObject: true });
    const w = out.info.width, h = out.info.height;
    const { data: px } = await sharp(out.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const mask = icing(px, w, h);
    await sharp(out.data).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(OUT, `${name}.webp`));
    await sharp(mask, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 80, alphaQuality: 80 }).toFile(path.join(OUT, `${name}-icing.webp`));
    manifest.sweets[name.slice(6)] = { w, h };
    console.log(name.padEnd(16), w, "x", h);
    continue;
  }
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
