// The piñatas' pictures (2026-11-03, the owner: "şimdi piñata studio'ya geçelim"): scripts/pinata/sources/*.png are
// fringe piñatas photographed on their own — flux-2 product shots, four to a picture, then a birefnet cutout and
// cut apart (the shapes in their own colours; the digits white, to be coloured in the builder). Each is cleaned
// (only its own piece: bits of its neighbours dropped), trimmed and written to public/design/pinata/<name>.webp;
// the digits as grey with their light evened out, so a colour multiplied over them reads true. Sizes go to
// lib/studio/pinataShapes.json. The room with the stand (room.png) is copied as it is.
//   npx tsx scripts/pinata/build-shapes.mts
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, "scripts/pinata/sources");
const OUT = path.join(ROOT, "public/design/pinata");
const TALL = 560;

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

fs.mkdirSync(OUT, { recursive: true });
const manifest: { shapes: Record<string, { w: number; h: number }>; digits: Record<string, { w: number; h: number }> } = { shapes: {}, digits: {} };
for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith(".png")).sort()) {
  const name = f.replace(/\.png$/, "");
  if (name === "room") {
    await sharp(path.join(SRC, f)).webp({ quality: 84 }).toFile(path.join(OUT, "room.webp"));
    continue;
  }
  const { data, info } = await sharp(path.join(SRC, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  keepBig(data, W, H);
  const digit = name.startsWith("digit-");
  if (digit) {
    // Grey, the fringe's light kept and its brightest made white.
    const lum: number[] = [];
    for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 200) lum.push(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
    lum.sort((a, b) => a - b);
    const top = lum[Math.floor(lum.length * 0.95)] || 255;
    for (let i = 0; i < W * H; i++) {
      const v = Math.min(255, Math.round(((0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) * 255) / top));
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    }
  }
  let [x0, y0, x1, y1] = [W, H, -1, -1];
  for (let i = 0; i < W * H; i++) {
    if (data[i * 4 + 3] <= 8) continue;
    const x = i % W, y = (i - x) / W;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const img = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
  const out = await sharp(img).resize({ height: TALL, withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 90 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(OUT, `${name}.webp`), out.data);
  const size = { w: out.info.width, h: out.info.height };
  if (digit) manifest.digits[name.slice(6)] = size;
  else manifest.shapes[name] = size;
  console.log(name.padEnd(12), size.w, "x", size.h, `${(out.data.length / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(path.join(ROOT, "lib/studio/pinataShapes.json"), JSON.stringify(manifest, null, 1) + "\n");
