// The helium balloons' pictures (2026-11-04, the owner's answers: bouquets, ceiling balloons and a name bubble; theme
// shape, number, letter and plain foils; an empty pastel party room): scripts/helium/sources are flux-2 product shots
// — nine theme-shape foils to a picture (foils-a, foils-b), four plain silver foils (plain: star, heart, round,
// cloud), four white latex balloons (latex) — each a birefnet cutout, cut apart here by its pieces, trimmed and
// written to public/design/helium/<name>.webp (the snowflake, pale on white, birefnet lost: it was keyed from its white
// and laid into foils-a). The plain foils and the latex are made grey with their light evened out (the brightest
// white), so a colour multiplied over them reads true. Sizes go to lib/studio/heliumParts.json. The empty room
// (room.png, its pink wall made white by one flux-2 edit on the owner's first look) is copied as it is.
//   npx tsx scripts/helium/build.mts
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, "scripts/helium/sources");
const OUT = path.join(ROOT, "public/design/helium");
const TALL = 420;
/** Each picture's pieces, row by row, left to right (as the photo has them: in foils-a the lightning came before the heart). */
const GRIDS: Record<string, { names: string[]; grey?: boolean }> = {
  "foils-a": { names: ["unicorn", "snowflake", "crown", "rainbow", "dinosaur", "lion", "lightning", "heart-red", "puppy"] },
  "foils-b": { names: ["icecream", "mermaid", "shark", "rocket", "football", "butterfly", "cupcake", "treasure", "kitten"] },
  plain: { names: ["star", "heart", "round", "cloud"], grey: true },
  latex: { names: ["latex-a", "latex-b", "latex-c", "latex-d"], grey: true },
};

/** The picture's pieces (4-connected, alpha > 24) with their boxes; tiny ones (under 1% of the largest) are dropped. */
function pieces(d: Buffer, W: number, H: number) {
  const label = new Int32Array(W * H).fill(-1);
  const found: { n: number; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }[] = [];
  for (let i = 0; i < W * H; i++) {
    if (label[i] >= 0 || d[i * 4 + 3] <= 24) continue;
    const id = found.length, stack = [i];
    label[i] = id;
    const f = { n: 0, x0: W, y0: H, x1: 0, y1: 0, cx: 0, cy: 0 };
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % W, y = (p - x) / W;
      f.n++; f.cx += x; f.cy += y;
      f.x0 = Math.min(f.x0, x); f.y0 = Math.min(f.y0, y); f.x1 = Math.max(f.x1, x); f.y1 = Math.max(f.y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && label[q] < 0 && d[q * 4 + 3] > 24) { label[q] = id; stack.push(q); }
      }
    }
    f.cx /= f.n; f.cy /= f.n;
    found.push(f);
  }
  const big = Math.max(...found.map((f) => f.n));
  return { label, found: found.map((f, id) => ({ ...f, id })).filter((f) => f.n >= big * 0.01) };
}

fs.mkdirSync(OUT, { recursive: true });
const manifest: Record<string, { w: number; h: number }> = {};
await sharp(path.join(SRC, "room.png")).webp({ quality: 84 }).toFile(path.join(OUT, "room.webp"));
for (const [file, { names, grey }] of Object.entries(GRIDS)) {
  const { data, info } = await sharp(path.join(SRC, `${file}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const { label, found } = pieces(data, W, H);
  // The biggest pieces, as many as the picture has names, in rows (a row is pieces whose middles are within a
  // sixth of the height) then left to right.
  const kept = [...found].sort((a, b) => b.n - a.n).slice(0, names.length);
  const rows = Math.round(Math.sqrt(names.length));
  kept.sort((a, b) => Math.floor((a.cy / H) * rows) - Math.floor((b.cy / H) * rows) || a.cx - b.cx);
  if (kept.length !== names.length) throw new Error(`${file}: ${kept.length} pieces for ${names.length} names`);
  kept.forEach((f, k) => {
    const w = f.x1 - f.x0 + 1, h = f.y1 - f.y0 + 1;
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (f.y0 + y) * W + f.x0 + x, o = (y * w + x) * 4;
      // Only this piece (and the soft edge round it), never a neighbour's bit inside its box.
      const l = label[i];
      if (l >= 0 && l !== f.id) continue;
      out[o] = data[i * 4]; out[o + 1] = data[i * 4 + 1]; out[o + 2] = data[i * 4 + 2]; out[o + 3] = data[i * 4 + 3];
    }
    if (grey) {
      const lum: number[] = [];
      for (let i = 0; i < w * h; i++) if (out[i * 4 + 3] > 200) lum.push(0.299 * out[i * 4] + 0.587 * out[i * 4 + 1] + 0.114 * out[i * 4 + 2]);
      lum.sort((a, b) => a - b);
      const top = lum[Math.floor(lum.length * 0.97)] || 255;
      for (let i = 0; i < w * h; i++) {
        const v = Math.min(255, Math.round(((0.299 * out[i * 4] + 0.587 * out[i * 4 + 1] + 0.114 * out[i * 4 + 2]) * 255) / top));
        out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
      }
    }
    manifest[names[k]] = { w: Math.round((w * TALL) / h), h: TALL };
    void sharp(out, { raw: { width: w, height: h, channels: 4 } }).resize({ height: TALL }).webp({ quality: 86, alphaQuality: 90 })
      .toFile(path.join(OUT, `${names[k]}.webp`));
  });
}
fs.writeFileSync(path.join(ROOT, "lib/studio/heliumParts.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(Object.keys(manifest).length, "pieces");
