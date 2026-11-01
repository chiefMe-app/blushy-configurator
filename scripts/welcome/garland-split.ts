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
/** How sharp a change in colour is a balloon's outline (summed Sobel over R, G and B). */
const EDGE = +(process.env.EDGE ?? 45);
/** How far (px) both balloons must rise above the neck between them to stay apart. */
const NECK = +(process.env.NECK ?? 4);
/** The chrome balls in the photo (px: middle, radius). */
const CHROME: [number, number, number][] = [[265, 63, 18], [255, 126, 44], [369, 275, 44], [372, 391, 47], [428, 484, 50]];

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
  // Tidied: each point takes the group most of its neighbours are in (a balloon is one colour throughout).
  const M = 14, tidy = new Int8Array(N).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (label[i] < 0) continue;
    if (label[i] === 4) { tidy[i] = 4; continue; }
    const votes = [0, 0, 0, 0, 0];
    for (let dy = -M; dy <= M; dy += 2) for (let dx = -M; dx <= M; dx += 2) {
      if (dx * dx + dy * dy > M * M) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const k = label[yy * W + xx]; if (k >= 0 && k < 4) votes[k]++;
    }
    tidy[i] = votes.indexOf(Math.max(...votes)) as number;
  }
  // Then one colour for each balloon (tinted strongly, a balloon in two colours showed as a puzzle piece):
  // the balloons are the patches between the photo's outlines, each taking the colour most of it has; the
  // outlines themselves the colour of the balloon beside them.
  const soft = await sharp(path.join(OUT, "garland-pastel.webp")).removeAlpha().blur(1.2).raw().toBuffer();
  const edge = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    let g = 0;
    for (let c = 0; c < 3; c++) {
      const at = (dx: number, dy: number) => soft[((y + dy) * W + x + dx) * 3 + c];
      const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
      const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
      g += Math.hypot(gx, gy);
    }
    edge[y * W + x] = g > EDGE ? 1 : 0;
  }
  // Touching balloons whose outline is too soft to find still meet at a narrow neck: each patch is split
  // there (a watershed of how far each point is from the patch's edge), one piece for each balloon.
  const inside = (i: number) => !edge[i] && tidy[i] >= 0 && tidy[i] !== 4 && data[i * 4 + 3] >= 128;
  const dist = new Float32Array(N);
  for (let i = 0; i < N; i++) dist[i] = inside(i) ? 1e9 : 0;
  const pass = (order: number[], steps: [number, number, number][]) => {
    for (const i of order) {
      if (!dist[i]) continue;
      const x = i % W, y = (i - x) / W;
      for (const [dx, dy, c] of steps) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) dist[i] = Math.min(dist[i], dist[yy * W + xx] + c);
      }
    }
  };
  const all = Array.from({ length: N }, (_, i) => i);
  pass(all, [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]]);
  pass(all.reverse(), [[1, 0, 1], [0, 1, 1], [1, 1, 1.414], [-1, 1, 1.414]]);
  // Flooded from the deepest points down; two pieces meeting stay apart when both rise well above the neck.
  const region = new Int32Array(N).fill(-1), peak: number[] = [], parent: number[] = [];
  const root = (a: number): number => (parent[a] === a ? a : (parent[a] = root(parent[a])));
  const byDepth = all.filter(inside).sort((a, b) => dist[b] - dist[a]);
  for (const i of byDepth) {
    const x = i % W, near = new Set<number>();
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && region[j] >= 0) near.add(root(region[j]));
    if (!near.size) { region[i] = peak.length; parent.push(peak.length); peak.push(dist[i]); continue; }
    const pieces = Array.from(near).sort((a, b) => peak[b] - peak[a]);
    region[i] = pieces[0];
    for (const other of pieces.slice(1)) if (peak[other] - dist[i] < NECK) parent[other] = pieces[0];
  }
  const sizes = new Map<number, number>(), votesOf = new Map<number, number[]>();
  for (const i of byDepth) {
    const r = root(region[i]); region[i] = r;
    sizes.set(r, (sizes.get(r) ?? 0) + 1);
    const v = votesOf.get(r) ?? [0, 0, 0, 0]; v[tidy[i]]++; votesOf.set(r, v);
  }
  if (process.env.REGIONS) {
    const map = Buffer.alloc(N * 3, 200);
    for (const i of byDepth) { const r = region[i] * 2654435761; map[i * 3] = r & 255; map[i * 3 + 1] = (r >> 8) & 255; map[i * 3 + 2] = (r >> 16) & 255; }
    await sharp(map, { raw: { width: W, height: H, channels: 3 } }).png().toFile(process.env.REGIONS);
  }
  const final = new Int8Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (tidy[i] === 4) final[i] = 4;
    else if (region[i] >= 0 && sizes.get(region[i])! >= 60) { const v = votesOf.get(region[i])!; final[i] = v.indexOf(Math.max(...v)); }
  }
  // The outlines and crumbs: from the nearest balloon, growing outwards a ring at a time.
  for (let ring = 0, open = true; open && ring < 40; ring++) {
    open = false;
    const grown = final.slice();
    for (let i = 0; i < N; i++) {
      if (final[i] >= 0 || tidy[i] < 0) continue;
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && final[j] >= 0 && final[j] < 4) { grown[i] = final[j]; break; }
      if (grown[i] < 0) open = true;
    }
    final.set(grown);
  }
  for (let i = 0; i < N; i++) if (tidy[i] >= 0) tidy[i] = final[i] >= 0 ? final[i] : tidy[i];
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
