// The welcome board's photo pieces (2026-10-31), cut out of their key-colour
// renders (scripts/welcome/piece-render.mjs) and written to
// public/design/welcome/pieces/, with each picture's size in
// lib/studio/welcomePieces.json.
// The builder stacks them round the board it draws (components/studio/WelcomeBoardArt.tsx).
// The white balloon is made pure white-and-grey, so the builder can tint it to any colour.
// Run: npx tsx scripts/welcome/piece-prepare.ts <dir of the renders>
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cutOut, whiten, type Raw } from "../table/cutout";

const RAW = process.argv[2];
const OUT = "public/design/welcome/pieces";
const MAX = 720;

type Piece = { w: number; h: number };
const MANIFEST = "lib/studio/welcomePieces.json";
const manifest: Record<string, Piece> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

async function write(name: string, r: Raw) {
  const buf = await sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } })
    .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toBuffer();
  writeFileSync(path.join(OUT, `${name}.webp`), buf);
  const m = await sharp(buf).metadata();
  manifest[name] = { ...manifest[name], w: m.width!, h: m.height! };
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(RAW).filter((f) => f.endsWith(".png")).sort()) {
    const name = f.replace(/\.png$/, "").replace("__magenta", "");
    const r = await cutOut(path.join(RAW, f), f.includes("__magenta"));
    await write(name, name === "balloon-latex" ? whiten(r) : r);
    console.log(name, manifest[name]);
  }
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + "\n");
})();
