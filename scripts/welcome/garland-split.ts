// The welcome board's garland in the party's own balloon colours (2026-11-01,
// the owner: "her tema bu rengi kullanamaz … temanın default balon renkleriyle,
// hatta userın son seçimleriyle match olması lazım"). The garland is one real
// photo (garland-pastel: white, pink, blue and lilac latex with silver chrome);
// this splits it, once and free, into a layer for each of those five — each
// latex layer its light and shade only, in grey, so the builder can tint it to
// any colour live (WelcomeBoardArt's GarlandTint); the chrome as it is.
// Run: npx tsx scripts/welcome/garland-split.ts
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = "public/design/welcome/pieces";
const MANIFEST = "lib/studio/welcomePieces.json";
export const LAYERS = ["white", "pink", "blue", "lilac", "chrome"] as const;
/** Where a latex balloon's own colour sits in its grey layer: lighter is its shine, darker its shade. */
const BODY = 0.86;
/** The chrome balls in the photo (px: middle, radius). */
const CHROME: [number, number, number][] = [[265, 63, 18], [255, 126, 44], [369, 275, 44], [372, 391, 47], [428, 484, 50]];
type Latex = Exclude<(typeof LAYERS)[number], "chrome">;
/** The latex balloons in the photo, by hand (px: middle, radius, colour; "front": in front of all it overlaps). */
const BALLOONS: [number, number, number, Latex, "front"?][] = [
  // The top, left to right.
  [42, 86, 47, "white"], [96, 135, 37, "white"], [128, 55, 45, "white"], [82, 85, 15, "blue"],
  [210, 55, 42, "pink"], [171, 133, 42, "pink"], [205, 92, 16, "lilac"],
  [330, 48, 62, "white"], [296, 90, 16, "blue"], [416, 148, 57, "white"], [460, 215, 14, "white"],
  // Down the column.
  [332, 152, 38, "blue"], [286, 177, 17, "blue"], [321, 177, 17, "blue"], [362, 192, 32, "white"],
  [258, 193, 38, "blue"], [298, 231, 41, "blue"], [436, 258, 42, "pink"], [290, 290, 30, "lilac"],
  [315, 310, 16, "lilac"], [339, 331, 19, "pink"], [296, 355, 40, "pink"], [371, 338, 13, "pink"],
  [436, 340, 50, "white"], [472, 413, 52, "blue"], [433, 411, 14, "blue"], [300, 430, 35, "white"],
  [325, 431, 15, "pink"], [341, 451, 16, "pink"], [369, 459, 12, "lilac"], [290, 483, 18, "blue"],
  [336, 500, 39, "blue"], [392, 505, 22, "blue"], [378, 529, 17, "lilac"], [355, 550, 20, "lilac"],
  [466, 550, 18, "lilac"], [410, 580, 45, "lilac"], [300, 575, 40, "pink"], [336, 600, 31, "white"],
  [470, 585, 15, "lilac"], [480, 580, 10, "white"],
  // The foot.
  [452, 655, 52, "pink"], [505, 710, 42, "pink"], [377, 656, 38, "white"], [327, 646, 17, "pink"],
  [300, 683, 52, "blue"], [424, 697, 17, "blue"], [381, 740, 46, "blue"], [463, 735, 35, "lilac"],
  [493, 770, 18, "pink"], [248, 783, 76, "white"], [305, 812, 72, "pink", "front"], [441, 833, 67, "lilac"],
  [535, 818, 62, "lilac"],
];

(async () => {
  const { data, info } = await sharp(path.join(OUT, "garland-pastel.webp")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  // Each point's colour group: the chrome balls where they are in the photo; the latex by its hue, white
  // where it has next to no colour (how much colour, not HSL saturation, which runs high on pale colours).
  const label = new Int8Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (data[i * 4 + 3] < 8) continue;
    const x = i % W, y = Math.floor(i / W);
    const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let hue = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
    if (CHROME.some(([cx, cy, cr]) => (x - cx) ** 2 + (y - cy) ** 2 <= cr * cr)) label[i] = 4;
    else if (d < 0.1) label[i] = 0;
    else if (hue >= 330 || hue < 40) label[i] = 1;
    else if (hue >= 180 && hue < 238) label[i] = 2;
    else if (hue >= 238 && hue < 330) label[i] = 3;
    else label[i] = 0;
  }
  // Tidied a little: each point takes the group most of its near neighbours are in (shade and shine read
  // as other colours point by point).
  const M = 5, tidy = new Int8Array(N).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (label[i] < 0 || label[i] === 4) { tidy[i] = label[i]; continue; }
    const votes = [0, 0, 0, 0];
    for (let dy = -M; dy <= M; dy++) for (let dx = -M; dx <= M; dx++) {
      const xx = x + dx, yy = y + dy;
      if (dx * dx + dy * dy > M * M || xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const k = label[yy * W + xx]; if (k >= 0 && k < 4) votes[k]++;
    }
    tidy[i] = votes.indexOf(Math.max(...votes));
  }
  // Then each balloon one colour throughout (found point by point, a balloon came out in two colours, a
  // puzzle piece once tinted): every latex balloon in the photo by hand, a circle with its colour. A point
  // in a colour goes to the balloon over it in that colour (the one it is deepest inside); a point with next
  // to no colour (white, or any balloon's shine) to the one it is deepest inside; a point under none to the
  // nearest.
  const final = new Int8Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (tidy[i] < 0 || tidy[i] === 4) { final[i] = tidy[i]; continue; }
    const x = i % W, y = (i - x) / W;
    let best = -1, bestD = Infinity, own = -1, ownD = Infinity, near = -1, nearD = Infinity;
    const front = BALLOONS.findIndex(([cx, cy, r, , f]) => f && Math.hypot(x - cx, y - cy) < r);
    if (front >= 0) { final[i] = LAYERS.indexOf(BALLOONS[front][3]); continue; }
    BALLOONS.forEach(([cx, cy, r, k], n) => {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d - 1 < nearD) { nearD = d - 1; near = n; }
      if (d > 1.06) return;
      if (d < bestD) { bestD = d; best = n; }
      if (tidy[i] > 0 && LAYERS.indexOf(k) === tidy[i] && d < ownD) { ownD = d; own = n; }
    });
    const pick = own >= 0 ? own : best >= 0 ? best : near;
    final[i] = LAYERS.indexOf(BALLOONS[pick][3]);
  }
  if (process.env.REGIONS) {
    const tone = [[245, 237, 214], [239, 68, 68], [37, 99, 235], [31, 41, 55], [160, 160, 160]];
    const map = Buffer.alloc(N * 3, 220);
    for (let i = 0; i < N; i++) if (final[i] >= 0) tone[final[i]].forEach((v, c) => (map[i * 3 + c] = Math.round(v * (0.55 + 0.45 * lum[i]))));
    await sharp(map, { raw: { width: W, height: H, channels: 3 } }).png().toFile(process.env.REGIONS);
  }
  for (let i = 0; i < N; i++) tidy[i] = final[i];
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, unknown>;
  for (let k = 0; k < LAYERS.length; k++) {
    const own: number[] = [];
    for (let i = 0; i < N; i++) if (tidy[i] === k && data[i * 4 + 3] > 200) own.push(lum[i]);
    own.sort((a, b) => a - b);
    const mid = own[Math.floor(own.length * 0.5)] || 1, top = Math.max(mid + 0.02, own[Math.floor(own.length * 0.995)] || 1);
    const out = Buffer.alloc(N * 4);
    for (let i = 0; i < N; i++) {
      if (tidy[i] !== k) continue;
      if (LAYERS[k] === "chrome") { data.copy(out, i * 4, i * 4, i * 4 + 4); continue; }
      // Its shade below its own colour, its light rising smoothly above it to the brightest shine (a cut-off
      // at white made a balloon's lit half flat, with a hard edge).
      const v = Math.round(Math.min(1, lum[i] <= mid ? (BODY * lum[i]) / mid : BODY + ((1 - BODY) * (lum[i] - mid)) / (top - mid)) * 255);
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = data[i * 4 + 3];
    }
    const name = `garland-pastel-${LAYERS[k]}`;
    writeFileSync(path.join(OUT, `${name}.webp`), await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 96, alphaQuality: 100, smartSubsample: true }).toBuffer());
    manifest[name] = { w: W, h: H, share: +(own.length / N).toFixed(4) };
    console.log(name, own.length, "mid", mid.toFixed(3));
  }
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + "\n");
})();
