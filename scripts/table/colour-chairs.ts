// The kids' chair in every plain colour (2026-10-28, owner: "blue chair for
// kids'in her renk seçeneği olabilsin, ordaki görselin backgroundunu remove
// edelim"): from the owner's photo of her blue chair, the chair is cut out by
// its colour (the grass, the wall and the shadow are not blue) and repainted
// in each colour of PLAIN_COLOURS, keeping its light and shade, on a
// transparent background. Run: npx tsx scripts/table/colour-chairs.ts
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PLAIN_COLOURS } from "@/lib/studio/tableCatalog";

const SRC = "public/design/table/chairs-blue_kids.webp";
const OUT = "public/design/table/chairs/blue_kids";

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max / 255 };
}

async function main() {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info, n = W * H;
  if (info.channels !== 3) throw new Error(`expected RGB, got ${info.channels} channels`);
  // The chair: blue-cyan, fairly saturated, not in deep shadow.
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const { h, s, v } = hsv(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    raw[i] = h > 170 && h < 225 && s > 0.28 && v > 0.32 ? 1 : 0;
  }
  // Keep only the biggest piece (the chair), and close tiny holes.
  const label = new Int32Array(n).fill(-1);
  let best = -1, bestSize = 0;
  for (let i = 0; i < n; i++) {
    if (!raw[i] || label[i] >= 0) continue;
    const stack = [i]; label[i] = i; let size = 0;
    while (stack.length) {
      const p = stack.pop()!; size++;
      const x = p % W, y = (p / W) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) if (q >= 0 && raw[q] && label[q] < 0) { label[q] = i; stack.push(q); }
    }
    if (size > bestSize) { bestSize = size; best = i; }
  }
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = label[i] === best ? 255 : 0;
  // A soft edge.
  const soft = await sharp(Buffer.from(mask), { raw: { width: W, height: H, channels: 1 } }).blur(0.6).extractChannel(0).raw().toBuffer();
  // The chair's light and shade, relative to its typical brightness.
  const lum = (i: number) => (0.3 * data[i * 3] + 0.59 * data[i * 3 + 1] + 0.11 * data[i * 3 + 2]) / 255;
  const ls: number[] = [];
  for (let i = 0; i < n; i++) if (mask[i]) ls.push(lum(i));
  ls.sort((a, b) => a - b);
  const mid = ls[(ls.length / 2) | 0];
  mkdirSync(OUT, { recursive: true });
  for (const { hex } of PLAIN_COLOURS) {
    const t = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    const out = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      const shade = lum(i) / mid; // 1: the chair's own colour; below: shadow; above: highlight
      for (let c = 0; c < 3; c++) {
        const v = shade <= 1 ? t[c] * shade : t[c] + (255 - t[c]) * Math.min(0.35, (shade - 1) * 0.6);
        out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
      out[i * 4 + 3] = soft[i];
    }
    const file = path.join(OUT, `${hex.slice(1).toLowerCase()}.webp`);
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 }).webp({ quality: 90, alphaQuality: 100 }).toFile(file);
  }
  console.log(`${PLAIN_COLOURS.length} chairs, ${bestSize} chair pixels of ${n}`);
}
main();
