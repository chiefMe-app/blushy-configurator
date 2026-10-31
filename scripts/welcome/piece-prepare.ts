// The welcome board's photo pieces (2026-10-31), cut out of their key-colour
// renders (scripts/welcome/piece-render.mjs) and written to
// public/design/welcome/pieces/, with each picture's size — and where the
// easel's ledge and the room's floor are — in lib/studio/welcomePieces.json.
// The builder stacks them round the board it draws (components/studio/WelcomeBoardArt.tsx).
// The white balloon is made pure white-and-grey, so the builder can tint it to any colour.
// Run: npx tsx scripts/welcome/piece-prepare.ts <dir of the renders>
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cutOut, lum, whiten, type Raw } from "../table/cutout";

const RAW = process.argv[2];
const OUT = "public/design/welcome/pieces";
const MAX = 720;

type Piece = { w: number; h: number; ledge?: [number, number]; floor?: number };
const MANIFEST = "lib/studio/welcomePieces.json";
const manifest: Record<string, Piece> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

async function write(name: string, r: Raw) {
  const buf = await sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } })
    .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toBuffer();
  writeFileSync(path.join(OUT, `${name}.webp`), buf);
  const m = await sharp(buf).metadata();
  manifest[name] = { ...manifest[name], w: m.width!, h: m.height! };
}

/** The easel's ledge: the widest run of rows between a third and nine tenths of the way down (fractions of its height). */
function ledge(r: Raw): [number, number] {
  const widths = Array.from({ length: r.height }, (_, y) => {
    let n = 0;
    for (let x = 0; x < r.width; x++) if (r.data[(y * r.width + x) * 4 + 3] > 160) n++;
    return n;
  });
  const lo = Math.floor(r.height / 3), hi = Math.floor(r.height * 0.9);
  const best = Math.max(...widths.slice(lo, hi));
  let y0 = lo; while (widths[y0] < best * 0.7) y0++;
  let y1 = y0; while (y1 + 1 < hi && widths[y1 + 1] >= best * 0.7) y1++;
  return [+(y0 / r.height).toFixed(4), +((y1 + 1) / r.height).toFixed(4)];
}

/** The room: where the wall meets the floor — the row where it darkens most, a fraction of its height. */
async function room(file: string) {
  const { data, info } = await sharp(file).removeAlpha().resize({ width: 1200, height: 1200, fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const rows = Array.from({ length: info.height }, (_, y) => {
    let s = 0;
    for (let x = 0; x < info.width; x++) s += lum(data, (y * info.width + x) * 3);
    return s / info.width;
  });
  let at = 0, drop = 0;
  for (let y = Math.floor(info.height * 0.3); y < info.height - 6; y++) {
    const d = rows[y - 4] - rows[y + 4];
    if (d > drop) { drop = d; at = y; }
  }
  writeFileSync(path.join(OUT, "room.webp"), await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).webp({ quality: 82 }).toBuffer());
  manifest.room = { w: info.width, h: info.height, floor: +(at / info.height).toFixed(4) };
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(RAW).filter((f) => f.endsWith(".png")).sort()) {
    const name = f.replace(/\.png$/, "").replace("__magenta", "");
    if (name === "room") { await room(path.join(RAW, f)); console.log(name, manifest.room); continue; }
    const r = await cutOut(path.join(RAW, f), f.includes("__magenta"));
    await write(name, name === "balloon-latex" ? whiten(r) : r);
    if (name === "easel") manifest.easel.ledge = ledge(r);
    console.log(name, manifest[name]);
  }
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + "\n");
})();
