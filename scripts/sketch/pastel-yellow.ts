// The Unicorn shots' yellow, made pastel (2026-11-02, the owner: "sarı rengi çok sarı duruyor, pastel sarı
// olması lazım"): the fresh renders gave the yellow balloons a warm golden yellow (hue ~45°, as saturated as
// 0.5), and the Fringe its mustard strips. Each yellow pixel keeps its own light and shade; only its hue is
// moved to lemon, its saturation lowered and its light lifted a little. Balloons by their family map (the
// yellow family), the Fringe curtain inside its board mask by hue. Free and local; run ONCE on the shipped
// files (it rewrites them in place, so a second run softens again).
// npx tsx scripts/sketch/pastel-yellow.ts [--balloons|--fringe] [--setup=<setup>] [folder…]   (default: unicorn-pastel unicorn-bright)
// (--setup: one re-shot setup's balloons only, the rest having been softened already.)
import sharp from "sharp";

sharp.cache(false);
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = "public/design/sketch";
/** Lemon pastel: the hue the yellows are moved to, and how far; how much saturation is kept; how much lighter. */
const HUE = 54, HUE_PULL = 0.7, SAT_KEEP = 0.6, LIFT = 0.12;

const rgbHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hslRgb = (h: number, s: number, l: number): [number, number, number] => {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};
/** How yellow a hue is: 1 from 34° to 62°, fading out by 24° and 72° (so oranges and greens are left). */
const yellowness = (h: number) => Math.max(0, Math.min(1, (h - 24) / 10, (72 - h) / 10));

function soften(px: Buffer, i: number, weight: number) {
  const [h, s, l] = rgbHsl(px[i], px[i + 1], px[i + 2]);
  const w = weight * yellowness(h) * Math.min(1, s / 0.12);
  if (w <= 0) return;
  const out = hslRgb(h + (HUE - h) * HUE_PULL * w, s * (1 - (1 - SAT_KEEP) * w), l + (1 - l) * LIFT * w);
  for (let c = 0; c < 3; c++) px[i + c] = Math.round(Math.max(0, Math.min(255, out[c])));
}

async function balloons(dir: string, setup: string) {
  const file = path.join(dir, `${setup}-balloons.webp`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const fam = await sharp(path.join(dir, `${setup}-families.png`)).resize(info.width, info.height, { kernel: "nearest" }).extractChannel(0).raw().toBuffer();
  // The yellow family: the one whose mean is most yellow.
  const sums = new Map<number, number[]>();
  for (let k = 0; k < info.width * info.height; k++) {
    if (data[k * 4 + 3] < 128 || fam[k] > 230) continue;
    const f = Math.round(fam[k] / 50), s = sums.get(f) ?? [0, 0, 0, 0];
    for (let c = 0; c < 3; c++) s[c] += data[k * 4 + c];
    s[3]++; sums.set(f, s);
  }
  let yellow = -1, best = 0;
  for (const [f, s] of Array.from(sums)) {
    const [h, sat] = rgbHsl(s[0] / s[3], s[1] / s[3], s[2] / s[3]);
    // A yellow family's mean sits at 42–48°: a peach one (Unicorn Bright, ~30°) is not one.
    const score = h >= 38 ? yellowness(h) * sat : 0;
    if (score > best) { best = score; yellow = f; }
  }
  if (yellow < 0 || best < 0.15) { console.log(setup, "no yellow family"); return; }
  for (let k = 0; k < info.width * info.height; k++) {
    if (data[k * 4 + 3] === 0 || fam[k] > 230 || Math.round(fam[k] / 50) !== yellow) continue;
    soften(data, k * 4, 1);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toBuffer().then((b) => writeFileSync(file, b));
  console.log(setup, "yellow family", yellow);
}

async function fringe(dir: string) {
  const file = path.join(dir, "single_fringe-room.webp"), mask = path.join(dir, "single_fringe-board-0.png");
  if (!existsSync(file) || !existsSync(mask)) return;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = await sharp(mask).resize(info.width, info.height).extractChannel(0).raw().toBuffer(); // a grey mask
  for (let k = 0; k < info.width * info.height; k++) if (m[k] > 0) soften(data, k * 4, m[k] / 255);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).removeAlpha().webp({ quality: 90 }).toBuffer().then((b) => writeFileSync(file, b));
  console.log("fringe curtain", dir);
}

(async () => {
  const args = process.argv.slice(2), only = args.includes("--fringe") ? "fringe" : args.includes("--balloons") ? "balloons" : null;
  const named = args.filter((a) => !a.startsWith("--"));
  const setup = args.find((a) => a.startsWith("--setup="))?.slice("--setup=".length);
  const folders = named.length ? named : ["unicorn-pastel", "unicorn-bright"];
  for (const folder of folders) {
    const dir = path.join(ROOT, folder);
    if (only !== "fringe") for (const f of readdirSync(dir).filter((f) => f.endsWith("-balloons.webp") && (!setup || f === `${setup}-balloons.webp`))) await balloons(dir, f.replace("-balloons.webp", ""));
    if (only !== "balloons") await fringe(dir);
  }
})();
