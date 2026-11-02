// The live sketch's photographed bases (2026-11-01, the owner: "backdropta
// roundda sadece live sketch bu şekilde yapmıştık … diğer backdrop
// seçeneklerini … bütün temalara uygulamamız lazım"). Free and local: each
// setup's Frozen photo, cleaned once by paid edits (lettering, snowflakes and
// the pedestal out; approved $0.60) and cut out (balloons and boards), is split
// here into the layers LiveSketch stacks:
//   <setup>-room.webp      the photo, square
//   <setup>-balloons.webp  the balloons alone (the boards taken out of the cut-out)
//   <setup>-families.png   each balloon point's family: 0 white/silver/clear, 100 blue, 200 lilac
//   <setup>-board-<i>.png  where each board shows (its colour is laid there)
// and prints each board's box, for LiveSketch's PHOTO_BASES.
// Run: npx tsx scripts/sketch/sketch-base.ts <dir with <setup>-e1.png, -fg1.png> <setup>
//
// A theme's own bases (2026-11-01, the owner: "bunları gerçekten render alıp sonra ordan kesmek
// lazım"): the same photo re-shot by a paid edit with the theme's balloons (<setup>-u1.png, or -u2.png
// when fixed up again) and cut out (<setup>-ufg.png), split the same way into
// public/design/sketch/<theme>/, its families one per theme colour (see FAMILIES):
//   npx tsx scripts/sketch/sketch-base.ts <dir> <setup> <theme>
import sharp from "sharp";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";

/** Each setup's boards, left to right: a point well inside each, and the box it stays in (px of the 1024 square:
 *  x, y, then x0, y0, x1, y1 — two boards side by side, or a white balloon on a board, share no outline). */
const SEEDS: Record<string, [number, number, number, number, number, number][]> = {
  single_arch: [[420, 520, 270, 208, 680, 860]],
  double_arch: [[460, 500, 330, 235, 534, 780], [640, 500, 535, 290, 790, 780]],
  arch_open_frame: [[420, 520, 240, 240, 580, 830], [585, 640, 550, 320, 870, 830]],
  arch_shimmer: [[370, 650, 280, 380, 445, 795], [0, 0, 445, 410, 715, 792]],
  single_banner: [[300, 500, 55, 100, 900, 897]],
  single_shimmer: [[0, 0, 255, 392, 735, 800]],
  triple_arch: [[320, 650, 250, 400, 378, 790], [515, 650, 372, 380, 660, 790], [700, 650, 652, 400, 780, 790]],
  balloon_ring: [],
  // Only for a theme's re-shoot (the Frozen round base was made apart): the round board, clear of the garland.
  round: [[640, 420, 175, 185, 850, 870]],
  // 2026-11-01: the Wavy Board (from the Single Arch photo) and the Fringe (from the Banner photo), made by one paid edit each.
  // Re-shot wider, on a coral rim (2026-11-01, the owner: "wavy daha geniş olmalı … border offset olmalı").
  // 2026-11-02: re-shot from a real render of its new garland (down the left from the top, low on the right).
  single_wavy: [[520, 500, 330, 120, 730, 890]],
  single_fringe: [[0, 0, 70, 118, 885, 915]],
};
/** A round board's circle (px: centre and radius), past which nothing is board. */
const CIRCLE: Record<string, [number, number, number]> = { round: [512, 528, 333] };
/** Re-shoots whose garland walls off pieces of board from the flood (not where a white balloon would go too). */
const PATCHES = new Set(["round", "double_arch", "arch_shimmer", "arch_open_frame"]);
/** Parts of the photo that are all foreground though the cut-out missed some (a fringe's busy strands):
 *  px x0, y0, x1, y1. The Fringe's frame and its tiers, re-shot 2026-11-01 ("o frame'in içinde olsun"). */
const SOLID: Record<string, [number, number, number, number]> = { single_fringe: [138, 150, 830, 912] };
/** Boards photographed on a coral rim (the offset border): the rim's own mask (<setup>-rim-<i>.png), made
 *  neutral so its colour is laid on it like a board's. */
const RIM = new Set(["single_wavy"]);
/** Boards that aren't flat paint (a sequin wall, a fringe curtain): the whole box, but for the balloons in front. */
const RECT: Record<string, number[]> = { arch_shimmer: [1], single_shimmer: [0], single_fringe: [0] };
/** Boards photographed tinted (light blue): made neutral, so their colour is laid on white. */
const NEUTRAL = new Set(["arch_open_frame"]);
/** How coloured a board's paint may be (the light blue one more than a white one). */
const CHROMA: Record<string, number> = { arch_open_frame: 34 };
/** How dark a board may be in a balloon's shadow before the flood stops. */
const LUM: Record<string, number> = { arch_open_frame: 140, arch_shimmer: 150, round: 150 };
/** Strips the square's padding left smeared (the photo was widened or heightened to a square): filled from
 *  the rows next to them, mirrored (px: the first good row, how many rows to mirror). */
const FILL: Record<string, { top?: [number, number]; bottom?: [number, number] }> = {
  double_arch: { top: [128, 60], bottom: [890, 70] },
};
/** A wide photo's square padding the paid edit left flat: each column's wall carried up from the rows
 *  above the balloons (darkening a little toward the ceiling) and its floor carried down (px: the first
 *  good row, how many rows to take). */
const BAND: Record<string, { top?: [number, number]; bottom?: [number, number] }> = {
  arch_open_frame: { top: [62, 30] },
  arch_shimmer: { top: [308, 45], bottom: [881, 40] },
  single_shimmer: { top: [307, 40], bottom: [880, 40] },
  triple_arch: { top: [235, 14], bottom: [913, 40] },
};
/** By hand, where the flood went wrong: balloons over a board's edge it ate (x, y, radius: kept whole), and
 *  board the cut-out kept with the balloons (x0, y0, x1, y1: taken out, but for the kept balloons). */
const KEEP: Record<string, [number, number, number][]> = {
  single_arch: [[353, 185, 38], [318, 212, 20], [472, 232, 14], [580, 318, 20], [655, 515, 28], [640, 560, 25], [605, 610, 45]],
  double_arch: [[412, 256, 16], [690, 728, 36]],
  single_banner: [[770, 322, 46], [790, 396, 34], [335, 150, 24], [370, 176, 26]],
};
const ERASE: Record<string, [number, number, number, number][]> = {
  double_arch: [[432, 238, 500, 335], [395, 268, 432, 335]],
};
/** A theme's balloon families by hue, in its palette's order (the value in families.png is the turn × 50;
 *  255 marks a balloon of none of them, left as shot). Hue ranges in degrees. */
const FAMILIES: Record<string, [number, number][][]> = {
  unicorn: [[[320, 360], [0, 25]], [[25, 75]], [[75, 165]], [[165, 245]], [[245, 320]]],
  // 2026-11-02: a shot per theme and balloon set (lib/balloonSets.ts), relit in neutral daylight. Each set's
  // own order: Unicorn's pastel is its palette; its bright is fuchsia, orange, yellow, mint, purple.
  "unicorn-pastel": [[[320, 360], [0, 25]], [[25, 75]], [[75, 165]], [[165, 245]], [[245, 320]]],
  "unicorn-bright": [[[300, 360], [0, 18]], [[18, 42]], [[42, 75]], [[75, 200]], [[200, 300]]],
  // Frozen's: white, ice blue, lilac, silver, clear (pastel); white, royal blue, caribbean blue, violet, silver
  // (bright). White, silver and clear have no hue: left as shot.
  "frozen-pastel": [[], [[165, 245]], [[245, 330]], [], []],
  "frozen-bright": [[], [[212, 250]], [[160, 212]], [[250, 330]], []],
};

(async () => {
  const [dir, setup, theme] = process.argv.slice(2);
  const OUT = theme ? `public/design/sketch/${theme}` : "public/design/sketch";
  const shot = theme ? (existsSync(path.join(dir, `${setup}-u2.png`)) ? `${setup}-u2.png` : `${setup}-u1.png`) : `${setup}-e1.png`;
  // A re-shoot: a fresh photo of the cleaned square, its balloons elsewhere (so none of the hand fixes).
  if (theme) for (const fix of [FILL, BAND, KEEP, ERASE]) delete fix[setup];
  const e1 = await sharp(path.join(dir, shot)).removeAlpha().resize(1024, 1024).raw().toBuffer({ resolveWithObject: true });
  const fg = await sharp(path.join(dir, theme ? `${setup}-ufg.png` : `${setup}-fg1.png`)).ensureAlpha().resize(1024, 1024).raw().toBuffer();
  const W = e1.info.width, H = e1.info.height, N = W * H, px = e1.data;
  const solid = SOLID[setup];
  if (solid) for (let y = solid[1]; y <= solid[3]; y++) for (let x = solid[0]; x <= solid[2]; x++) fg[(y * W + x) * 4 + 3] = 255;
  const { top, bottom } = FILL[setup] ?? {};
  const mirror = (y: number, from: number, span: number, dir: 1 | -1) => {
    const k = Math.abs(y - from) % (2 * span), src = from + dir * (k < span ? k : 2 * span - 1 - k);
    px.copy(px, y * W * 3, src * W * 3, (src + 1) * W * 3);
  };
  if (top) for (let y = top[0] - 1; y >= 0; y--) mirror(y, top[0], top[1], 1);
  if (bottom) for (let y = bottom[0]; y < H; y++) mirror(y, bottom[0] - 1, bottom[1], -1);
  const band = BAND[setup] ?? {};
  const noise = (x: number, y: number) => { const t = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return t - Math.floor(t) - 0.5; };
  const carry = (from: number, rows: number, to: number[], dir: 1 | -1) => {
    for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
      // Its wall (or floor) only: rows behind a balloon are passed over.
      const v: number[] = [];
      for (let y = from; v.length < rows && y >= 0 && y < H && Math.abs(y - from) < 300; y += dir) if (fg[(y * W + x) * 4 + 3] < 30) v.push(px[(y * W + x) * 3 + c]);
      if (!v.length) continue;
      const m = v.sort((a, b) => a - b)[v.length >> 1];
      for (const y of to) {
        const d = Math.abs(y - from), shade = dir === 1 ? 1 - 0.12 * Math.min(1, d / 400) : 1;
        // With a little grain like the wall's.
        px[(y * W + x) * 3 + c] = Math.round(Math.max(0, Math.min(255, m * shade + noise(x, y) * 5)));
      }
    }
  };
  if (band.top) carry(band.top[0], band.top[1], Array.from({ length: band.top[0] }, (_, y) => y), 1);
  if (band.bottom) carry(band.bottom[0] - 1, band.bottom[1], Array.from({ length: H - band.bottom[0] }, (_, k) => band.bottom![0] + k), -1);
  const at = (i: number, c: number) => px[i * 3 + c];
  const lum = (i: number) => 0.299 * at(i, 0) + 0.587 * at(i, 1) + 0.114 * at(i, 2);
  const chroma = (i: number) => Math.max(at(i, 0), at(i, 1), at(i, 2)) - Math.min(at(i, 0), at(i, 1), at(i, 2));
  // A board: plain white, flat — flooded from a point inside it through each step too small to be an outline.
  const boardLike = (i: number) => lum(i) > (process.env.LUM ? +process.env.LUM : LUM[setup] ?? 175) && chroma(i) < (process.env.CH ? +process.env.CH : CHROMA[setup] ?? 16);
  const step = (i: number, j: number) => Math.abs(at(i, 0) - at(j, 0)) + Math.abs(at(i, 1) - at(j, 1)) + Math.abs(at(i, 2) - at(j, 2));
  const kept = new Float32Array(N);
  for (const [cx, cy, r] of KEEP[setup] ?? []) for (let y = Math.max(0, cy - r - 2); y <= Math.min(H - 1, cy + r + 2); y++) for (let x = Math.max(0, cx - r - 2); x <= Math.min(W - 1, cx + r + 2); x++) {
    kept[y * W + x] = Math.max(kept[y * W + x], Math.min(1, Math.max(0, r + 0.5 - Math.hypot(x - cx, y - cy))));
  }
  const erased = (i: number) => { const x = i % W, y = (i - x) / W; return (ERASE[setup] ?? []).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1); };
  const board = new Int8Array(N).fill(-1);
  SEEDS[setup].forEach(([sx, sy, bx0, by0, bx1, by1], b) => {
    if (RECT[setup]?.includes(b)) {
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (fg[(y * W + x) * 4 + 3] < 128) board[y * W + x] = b;
      return;
    }
    const stack = [sy * W + sx];
    board[stack[0]] = b;
    while (stack.length) {
      const i = stack.pop()!, x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        const jx = j % W, jy = (j - jx) / W;
        if (j < 0 || j >= N || board[j] >= 0 || kept[j] > 0 || !boardLike(j) || step(i, j) > (process.env.ST ? +process.env.ST : 5) || jx < bx0 || jx > bx1 || jy < by0 || jy > by1) continue;
        board[j] = b; stack.push(j);
      }
    }
  });
  // Closed (a fleck in the board's paint stopped the flood) and grown a pixel under the balloons' soft edges.
  const grow = (m: Int8Array, r: number, into: (i: number) => boolean) => {
    const out = m.slice();
    for (let i = 0; i < N; i++) {
      if (m[i] >= 0 || !into(i)) continue;
      const x = i % W, y = (i - x) / W;
      for (let dy = -r; dy <= r && out[i] < 0; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || m[yy * W + xx] < 0) continue;
        out[i] = m[yy * W + xx]; break;
      }
    }
    return out;
  };
  // A re-shoot's garland can wall off a piece of board from the flood: a big plain piece of the cut-out
  // (the wall never is in it; a balloon's highlight is far smaller) is board too — the round's in its circle.
  const patchLike = (i: number) => fg[i * 4 + 3] > 128 && lum(i) > 125 && chroma(i) < 16;
  if (theme && PATCHES.has(setup)) SEEDS[setup].forEach(([, , bx0, by0, bx1, by1], b) => {
    if (RECT[setup]?.includes(b)) return;
    const c = CIRCLE[setup];
    const inside = (j: number) => {
      const x = j % W, y = (j - x) / W;
      if (x < bx0 || x > bx1 || y < by0 || y > by1) return false;
      return !c || Math.hypot(x - c[0], y - c[1]) <= c[2];
    };
    const seen = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (seen[i] || board[i] >= 0 || !inside(i) || !patchLike(i)) continue;
      const part = [i], stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const k = stack.pop()!, x = k % W;
        for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
          if (j < 0 || j >= N || seen[j] || board[j] >= 0 || !inside(j) || !patchLike(j) || step(k, j) > 8) continue;
          seen[j] = 1; part.push(j); stack.push(j);
        }
      }
      if (part.length >= 1200) for (const k of part) board[k] = b;
    }
  });
  let filled = grow(board, 2, (i) => boardLike(i) && !kept[i]);
  filled = grow(filled, 1, (i) => !kept[i]);
  if (NEUTRAL.has(setup)) for (let i = 0; i < N; i++) if (filled[i] >= 0) {
    const l = Math.round(lum(i));
    px[i * 3] = px[i * 3 + 1] = px[i * 3 + 2] = Math.min(255, l + 6);
  }
  // The rim: strongly coral (no balloon is), in a board's box, next to nothing else; greyed to the board's white.
  const rim = new Int8Array(N).fill(-1);
  // 2026-11-02: a theme's re-shoot of the Wavy (a real render of its new garland) has a soft pink rim, as
  // pink as some balloons: there the rim is the pink in a band hugging the board's right and top edges
  // (its left one is behind the garland).
  const near = theme && RIM.has(setup) ? (() => {
    const m = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (filled[i] >= 0) m[i] = 1;
    for (let k = 0; k < 18; k++) {
      const prev = m.slice();
      for (let i = 0; i < N; i++) if (!prev[i]) { const x = i % W; if ((x > 0 && prev[i - 1]) || (x < W - 1 && prev[i + 1]) || prev[i - W] || prev[i + W]) m[i] = 2; }
    }
    return m;
  })() : null;
  if (RIM.has(setup)) SEEDS[setup].forEach(([sx, , bx0, by0, bx1, by1], b) => {
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const i = y * W + x, r = at(i, 0), g = at(i, 1), bl = at(i, 2);
      if (near) {
        // Pink: red highest, blue past green (a pink balloon is too, so only in the band, right of the seed).
        if (near[i] === 2 && x > sx - 60 && r > g + 14 && bl >= g - 4 && lum(i) > 120) rim[i] = b;
        continue;
      }
      // Coral: red past green past blue, its hue under ~28° (a yellow balloon's is ~55°, a pink one's past 330°).
      const hue = r > g && g >= bl ? (60 * (g - bl)) / (r - bl || 1) : 99;
      if (filled[i] < 0 && chroma(i) > 80 && hue < 28) rim[i] = b;
    }
  });
  // Only long pieces of it: a balloon's orange-shaded side is a speck.
  {
    const seen = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (seen[i] || rim[i] < 0) continue;
      const part = [i], stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const k = stack.pop()!, x = k % W;
        for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
          if (j < 0 || j >= N || seen[j] || rim[j] < 0) continue;
          seen[j] = 1; part.push(j); stack.push(j);
        }
      }
      if (part.length < 600) for (const k of part) rim[k] = -1;
    }
  }
  if (!near) rim.set(grow(rim, 1, (i) => { const hue = at(i, 0) > at(i, 1) && at(i, 1) >= at(i, 2) ? (60 * (at(i, 1) - at(i, 2))) / (at(i, 0) - at(i, 2) || 1) : 99; return filled[i] < 0 && chroma(i) > 40 && hue < 32; }));
  if (RIM.has(setup)) {
    let sl = 0, n = 0;
    for (let i = 0; i < N; i++) if (rim[i] >= 0) { sl += lum(i); n++; }
    const k = n ? 236 / (sl / n) : 1;
    for (let i = 0; i < N; i++) if (rim[i] >= 0) px[i * 3] = px[i * 3 + 1] = px[i * 3 + 2] = Math.min(255, Math.round(lum(i) * k));
  }
  // The balloons: the cut-out, less the boards.
  const balloons = Buffer.alloc(N * 4);
  const fam = Buffer.alloc(N);
  for (let i = 0; i < N; i++) {
    const a = Math.round(Math.max(kept[i] * 255, filled[i] >= 0 || rim[i] >= 0 || erased(i) ? 0 : fg[i * 4 + 3]));
    balloons[i * 4] = at(i, 0); balloons[i * 4 + 1] = at(i, 1); balloons[i * 4 + 2] = at(i, 2); balloons[i * 4 + 3] = a;
    // Its family by hue: blue, lilac, else white, silver or clear.
    const r = at(i, 0), g = at(i, 1), b = at(i, 2), mx = Math.max(r, g, b), d = chroma(i);
    let h = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    if (theme) fam[i] = d < 22 || mx < 50 ? 255 : Math.max(0, FAMILIES[theme].findIndex((rs) => rs.some(([a, b]) => h >= a && h < b)));
    else fam[i] = d < 22 || mx < 50 ? 0 : h >= 165 && h < 245 ? 1 : h >= 245 && h < 330 ? 2 : 0;
  }
  // Crumbs of board left loose (a few hundred points, apart from every balloon) go.
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (seen[i] || balloons[i * 4 + 3] < 40) continue;
    const part = [i], stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop()!, x = k % W;
      for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
        if (j < 0 || j >= N || seen[j] || balloons[j * 4 + 3] < 40) continue;
        seen[j] = 1; part.push(j); stack.push(j);
      }
    }
    if (part.length < 300) for (const k of part) balloons[k * 4 + 3] = 0;
  }
  // Tidied: each point the family most of its near neighbours are in.
  const tidy = Buffer.alloc(N);
  const M = 4;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (theme) {
      // Most of its near neighbours' family (a theme's: up to five, and the as-shot ones).
      const v = new Map<number, number>();
      for (let dy = -M; dy <= M; dy++) for (let dx = -M; dx <= M; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && balloons[(yy * W + xx) * 4 + 3] > 60) v.set(fam[yy * W + xx], (v.get(fam[yy * W + xx]) ?? 0) + 1);
      }
      const best = Array.from(v).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 255;
      tidy[y * W + x] = best === 255 ? 255 : best * 50;
      continue;
    }
    const v = [0, 0, 0];
    for (let dy = -M; dy <= M; dy++) for (let dx = -M; dx <= M; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && balloons[(yy * W + xx) * 4 + 3] > 60) v[fam[yy * W + xx]]++;
    }
    tidy[y * W + x] = v[1] > v[0] && v[1] >= v[2] ? 100 : v[2] > v[0] && v[2] > v[1] ? 200 : 0;
  }
  mkdirSync(OUT, { recursive: true });
  await sharp(px, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 88 }).toFile(path.join(OUT, `${setup}-room.webp`));
  await sharp(balloons, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${setup}-balloons.webp`));
  await sharp(tidy, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(OUT, `${setup}-families.png`));
  for (let b = 0; b < SEEDS[setup].length; b++) {
    const m = Buffer.alloc(N);
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let i = 0; i < N; i++) if (filled[i] === b) {
      m[i] = 255;
      const x = i % W, y = (i - x) / W;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    await sharp(m, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(OUT, `${setup}-board-${b}.png`));
    console.log(`board ${b}: x ${(x0 / W).toFixed(4)}–${(x1 / W).toFixed(4)}, y ${(y0 / H).toFixed(4)}–${(y1 / H).toFixed(4)}`);
    if (!RIM.has(setup)) continue;
    const rm = Buffer.alloc(N);
    for (let i = 0; i < N; i++) if (rim[i] === b) rm[i] = 255;
    await sharp(rm, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(OUT, `${setup}-rim-${b}.png`));
  }
})();
