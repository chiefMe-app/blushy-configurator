// The pieces of the top view (2026-10-29, the owner: "top view renderlarda bütün
// opsiyonların renderını alıp sonra onları preview olarak kullanmak istiyorum …
// render olmayacak"): every option rendered once on its own, straight down, on
// chroma green (scripts/table/top-render.mjs), is cut out here and written to
// public/design/table/top/, with each picture's size (and the bottle's label)
// in lib/studio/tableTopPieces.json. The builder stacks them
// (components/studio/table/TablePlace.tsx), so a change of colour or words costs
// no render. The white pieces are made pure white-and-grey, so the builder can
// tint them to any colour; the plain cup was rendered with a blue outside, which
// becomes a separate outside layer (tinted) over its white inside.
// Run: npx tsx scripts/table/top-prepare.ts <dir of the green renders>
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const RAW = process.argv[2];
const OUT = "public/design/table/top";
const MAX = 720; // px along the longest side: plenty for a 23 cm plate in a 80 cm wide view

type Raw = { data: Buffer; width: number; height: number };

/** The green away, with a soft edge, the green spill out, and only the piece's own blobs kept. */
async function cutOut(file: string): Promise<Raw> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, n = W * H, o = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3]; let g = data[i * 3 + 1]; const b = data[i * 3 + 2];
    const green = g - Math.max(r, b);
    // ≤25: opaque, ≥70: gone; a dark greenish pixel is the background's own shading.
    const a = green > 8 && g < 120 ? 0 : Math.max(0, Math.min(1, (70 - green) / 45));
    if (green > 0) g = Math.max(r, b) + Math.min(green, 6);
    o[i * 4] = r; o[i * 4 + 1] = g; o[i * 4 + 2] = b; o[i * 4 + 3] = a < 0.24 ? 0 : Math.round(a * 255);
  }
  // Blobs of solid pixels on an 8× smaller grid; those at least a twentieth of
  // the biggest, away from the picture's edge, are the piece.
  const G = 8, gw = Math.ceil(W / G), gh = Math.ceil(H / G), solid = new Uint8Array(gw * gh);
  for (let i = 0; i < n; i++) if (o[i * 4 + 3] > 200) solid[(((i / W) | 0) / G | 0) * gw + ((i % W) / G | 0)] = 1;
  const label = new Int32Array(gw * gh).fill(-1);
  const blobs: { n: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let s = 0; s < solid.length; s++) {
    if (!solid[s] || label[s] >= 0) continue;
    const q = [s], bb = { n: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
    label[s] = blobs.length;
    while (q.length) {
      const c = q.pop()!, x = c % gw, y = (c / gw) | 0;
      bb.n++; bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x); bb.y0 = Math.min(bb.y0, y); bb.y1 = Math.max(bb.y1, y);
      for (const d of [c - 1, c + 1, c - gw, c + gw]) if (d >= 0 && d < solid.length && solid[d] && label[d] < 0 && Math.abs((d % gw) - x) <= 1) { label[d] = blobs.length; q.push(d); }
    }
    blobs.push(bb);
  }
  const big = Math.max(...blobs.map((b) => b.n));
  const keep = new Set(blobs.flatMap((b, i) => (b.n >= big / 20 && b.x0 > 0 && b.y0 > 0 && b.x1 < gw - 1 && b.y1 < gh - 1 ? [i] : [])));
  const near = new Uint8Array(gw * gh);
  for (let c = 0; c < near.length; c++) if (keep.has(label[c])) {
    const x = c % gw, y = (c / gw) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) near[yy * gw + xx] = 1; }
  }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let i = 0; i < n; i++) {
    if (!near[(((i / W) | 0) / G | 0) * gw + ((i % W) / G | 0)]) { o[i * 4 + 3] = 0; continue; }
    if (o[i * 4 + 3]) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const out = await sharp(o, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).raw().toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}

const lum = (d: Buffer, i: number) => (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);

/** Grey, with the paper's white at white: ready to be tinted by multiplying. */
function whiten(r: Raw): Raw {
  const ls: number[] = [];
  for (let i = 0; i < r.data.length; i += 4) if (r.data[i + 3] > 200) ls.push(lum(r.data, i));
  ls.sort((a, b) => a - b);
  const top = ls[Math.floor(ls.length * 0.9)] || 255;
  const d = Buffer.from(r.data);
  for (let i = 0; i < d.length; i += 4) { const v = Math.min(255, Math.round((lum(d, i) / top) * 255)); d[i] = d[i + 1] = d[i + 2] = v; }
  return { ...r, data: d };
}

// Added to the pieces already there (a run may prepare only some of them).
const MANIFEST = "lib/studio/tableTopPieces.json";
const manifest: Record<string, { w: number; h: number; label?: [number, number, number, number] }> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
async function write(name: string, r: Raw, rotate = 0) {
  let img = sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } });
  if (rotate) img = sharp(await img.rotate(rotate).png().toBuffer());
  const buf = await img.resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toBuffer();
  writeFileSync(path.join(OUT, `${name}.webp`), buf);
  const m = await sharp(buf).metadata();
  manifest[name] = { ...manifest[name], w: m.width!, h: m.height! };
}

/** The plain cup: its blue outside as its own layer (grey, to be tinted), over the white inside. */
async function plainCup(r: Raw) {
  const out = Buffer.alloc(r.data.length), inside = Buffer.from(r.data);
  const blues: number[] = [];
  for (let i = 0; i < r.data.length; i += 4) { const [R, G, B] = [r.data[i], r.data[i + 1], r.data[i + 2]]; if (B - Math.max(R, G) > 80 && r.data[i + 3] > 200) blues.push(B); }
  blues.sort((a, b) => a - b);
  const top = blues[Math.floor(blues.length * 0.92)] || 255;
  for (let i = 0; i < r.data.length; i += 4) {
    const [R, G, B, A] = [r.data[i], r.data[i + 1], r.data[i + 2], r.data[i + 3]];
    const m = Math.max(0, Math.min(1, (B - Math.max(R, G) - 30) / 90)); // how blue: the outside
    const v = Math.min(255, Math.round((B / top) * 255));
    out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = Math.round(A * m);
    // The inside's own edge where it meets the outside: white paper.
    inside[i + 3] = Math.round(A * (1 - m * 0.98));
    if (m > 0) { const w = Math.round(235 * m + lum(r.data, i) * (1 - m)); inside[i] = inside[i + 1] = inside[i + 2] = w; }
  }
  await write("cup-plain-in", { ...r, data: inside });
  await write("cup-plain-out", { ...r, data: out });
}

/** The three pieces of a cutlery set, apart: columns with nothing in them split them. */
async function cutlery(name: string, r: Raw) {
  const used = Array.from({ length: r.width }, (_, x) => { let k = 0; for (let y = 0; y < r.height; y++) if (r.data[(y * r.width + x) * 4 + 3] > 100) k++; return k > 4; });
  const runs: [number, number][] = [];
  for (let x = 0; x < r.width; x++) if (used[x] && (x === 0 || !used[x - 1])) { let e = x; while (e + 1 < r.width && used[e + 1]) e++; if (e - x > 20) runs.push([x, e]); }
  if (runs.length !== 3) throw new Error(`${name}: ${runs.length} pieces`);
  for (let k = 0; k < runs.length; k++) {
    const [a, b] = runs[k];
    const piece = await sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } }).extract({ left: a, top: 0, width: b - a + 1, height: r.height }).png().toBuffer();
    const t = await sharp(piece).trim({ threshold: 0 }).raw().toBuffer({ resolveWithObject: true });
    await write(`${name}-${k}`, { data: t.data, width: t.info.width, height: t.info.height });
  }
}

/** The bottle, and its blank label: the longest run of white rows, as a box (fractions) and a grey layer of its light and shade. */
async function bottle(r: Raw) {
  const rows: number[] = [];
  for (let y = 0; y < r.height; y++) {
    let white = 0, solid = 0;
    for (let x = 0; x < r.width; x++) {
      const i = (y * r.width + x) * 4;
      if (r.data[i + 3] < 200) continue;
      solid++;
      const lo = Math.min(r.data[i], r.data[i + 1], r.data[i + 2]), hi = Math.max(r.data[i], r.data[i + 1], r.data[i + 2]);
      if (lo > 185 && hi - lo < 22) white++;
    }
    if (solid && white / solid > 0.85) rows.push(y);
  }
  let y0 = rows[0], y1 = rows[0];
  for (let i = 0, start = 0; i < rows.length; i++) if (i === rows.length - 1 || rows[i + 1] !== rows[i] + 1) { if (rows[i] - rows[start] > y1 - y0) { y0 = rows[start]; y1 = rows[i]; } start = i + 1; }
  let x0 = r.width, x1 = 0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < r.width; x++) if (r.data[(y * r.width + x) * 4 + 3] > 200) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const shade = Buffer.alloc(r.data.length);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * r.width + x) * 4;
    const v = Math.min(255, Math.round(lum(r.data, i) / 235 * 255));
    shade[i] = shade[i + 1] = shade[i + 2] = v; shade[i + 3] = r.data[i + 3];
  }
  await write("bottle", r);
  await write("bottle-label", { ...r, data: shade });
  manifest.bottle.label = [x0 / r.width, y0 / r.height, (x1 - x0 + 1) / r.width, (y1 - y0 + 1) / r.height].map((v) => +v.toFixed(4)) as [number, number, number, number];
}

// White pieces the builder tints; the others keep their own colours.
const TINTED = ["plates-plain-round", "plates-plain-scalloped", "plates-plain-square", "pocket", "hat-cone", "chair-blue_kids"];
// Each chair seen with its back towards the child (the bottom of the view).
const TURN: Record<string, number> = { "chair-white_kids": 180 };

(async () => {
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(RAW).filter((f) => f.endsWith(".png")).sort()) {
    const name = f.replace(/\.png$/, "");
    const r = await cutOut(path.join(RAW, f));
    if (name === "cup-plain") await plainCup(r);
    else if (name.startsWith("cutlery-")) await cutlery(name, r);
    else if (name === "bottle") await bottle(r);
    else await write(name, TINTED.includes(name) ? whiten(r) : r, TURN[name] ?? 0);
    console.log(name);
  }
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + "\n");
})();
