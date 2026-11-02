// The welcome board's garland in the backdrop's own balloons (2026-11-02, the owner: "balon renkleri doğru değil
// silver yoktu ve boyanmış gibi duruyor", "backdropta ne seçildiyse balon welcomeboardda da aynı olmalı"): the
// Single Arch's garland — a column up the board's right side arching over its top, whole on both sides — cut from
// each balloon set's photo (/design/sketch/<theme>-<set>/single_arch-*). Its families map comes with it, so the
// builder repaints it exactly as it repaints the backdrop (LiveSketch's useRecoloredBase). Free and local.
// (The Wavy's column was tried first: the backdrop's board had cut its balloons, and the cut showed under the board.)
// npx tsx scripts/welcome/garland-sets.ts
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SETS = ["unicorn-pastel", "unicorn-bright", "frozen-pastel", "frozen-bright"];
/** The garland in the 1024 px shot (px). */
const BOX = { x0: 278, y0: 32, x1: 853, y1: 923 };
/** Where the welcome board's right edge goes: just inside the column (at the arch board's own edge, 575, the column hid a quarter of the board). */
const BOARD_X = 530;
const OUT = "public/design/welcome/pieces";
const MANIFEST = "lib/studio/welcomePieces.json";

(async () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const w = BOX.x1 - BOX.x0, h = BOX.y1 - BOX.y0;
  const box = { left: BOX.x0, top: BOX.y0, width: w, height: h };
  for (const set of SETS) {
    const dir = `public/design/sketch/${set}`;
    await sharp(path.join(dir, "single_arch-balloons.webp")).extract(box).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `garland-${set}.webp`));
    // The families map, cut the same (its values are family numbers).
    await sharp(path.join(dir, "single_arch-families.png")).extract(box).png().toFile(path.join(OUT, `garland-${set}-families.png`));
    manifest[`garland-${set}`] = { w, h, edge: +((BOARD_X - BOX.x0) / w).toFixed(4) };
    console.log(set, manifest[`garland-${set}`]);
  }
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + "\n");
})();
