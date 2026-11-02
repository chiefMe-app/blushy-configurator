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
  // 2026-11-02: every setup re-shot fresh in the Single Arch's light ("single arch'taki renk ve ortam ışığını
  // sevdim, onun gibi yapalım hepsini"), from its own route guide; one geometry across the four set folders.
  // A seed at x -1 is a board its garland hides whole in these shots (the Triple Arch's half arches): no mask.
  single_arch: [[420, 520, 270, 240, 680, 870]],
  double_arch: [[470, 520, 300, 190, 560, 870], [700, 520, 545, 255, 835, 870]],
  arch_open_frame: [[400, 520, 180, 215, 560, 870], [572, 640, 545, 265, 880, 870]],
  // 2026-11-02 ("shimmer neden perde gibi?", "triple arch bozuk"): the two shimmers and the Triple Arch re-shot
  // on the earlier shots she liked (LAYOUT), so in their geometry, not their guides'.
  arch_shimmer: [[400, 600, 280, 370, 450, 800], [0, 0, 450, 410, 720, 795]],
  single_banner: [[400, 600, 200, 80, 880, 870]],
  single_shimmer: [[0, 0, 340, 385, 725, 800]],
  triple_arch: [[340, 650, 180, 440, 380, 790], [512, 650, 370, 375, 655, 790], [690, 650, 645, 440, 850, 790]],
  balloon_ring: [],
  round: [[600, 550, 175, 185, 850, 870]],
  // 2026-11-02 (later): the wavy board stands in front now, its left rim in sight: seeded left of centre so the rim
  // test (right of the seed less 60 px) takes in both sides.
  // Later still ("yere değmeli"): the flat-foot board, re-drawn on one master shot recoloured per set.
  single_wavy: [[410, 560, 345, 250, 690, 895]],
  single_fringe: [[0, 0, 218, 258, 806, 850]],
  // The Wavy + Shimmer (new 2026-11-02): laid out as the Arch + Shimmer, the wavy board in front on its rim.
  // Later ("yere değmeli", "aşırı uzak"): its flat-foot board drawn from its outline, the shot cropped 1.2x closer.
  wavy_shimmer: [[225, 500, 160, 215, 480, 815], [0, 0, 467, 294, 743, 786]],
};
/** A round board's circle (px: centre and radius), past which nothing is board. */
const CIRCLE: Record<string, [number, number, number]> = { round: [505, 560, 300] };
/** Re-shoots whose garland walls off pieces of board from the flood (not where a white balloon would go too). */
const PATCHES = new Set(["round", "double_arch", "arch_shimmer", "arch_open_frame", "wavy_shimmer"]);
/** Parts of the photo that are all foreground though the cut-out missed some (a fringe's busy strands):
 *  px x0, y0, x1, y1. The Fringe's frame and its tiers, re-shot 2026-11-01 ("o frame'in içinde olsun"). */
const SOLID: Record<string, [number, number, number, number]> = { single_fringe: [218, 258, 806, 850] };
/** Boards photographed on a coral rim (the offset border): the rim's own mask (<setup>-rim-<i>.png), made
 *  neutral so its colour is laid on it like a board's. */
const RIM = new Set(["single_wavy", "wavy_shimmer"]);
/** Boards drawn on the shot from the very outline of their guide (the flat-foot wavy board, 2026-11-02 later,
 *  "yere değmeli"): held to it within 3 px, so a looser flood fills the board's shaded foot. */
const EXACT_GUIDE = new Set(["single_wavy", "wavy_shimmer"]);
/** Shot on an earlier photo, not on its route guide: no guide to hold the boards to. */
const NO_GUIDE = new Set(["single_shimmer", "arch_shimmer", "triple_arch"]);
/** Boards that aren't flat paint (a sequin wall, a fringe curtain): the whole box, but for the balloons in front. */
const RECT: Record<string, number[]> = { arch_shimmer: [1], single_shimmer: [0], single_fringe: [0], wavy_shimmer: [1] };
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
  // own order: Unicorn's pastel is its palette; its bright is peach, Fashion 017 fuchsia, green, lilac (the owner's Sempertex picks).
  "unicorn-pastel": [[[320, 360], [0, 25]], [[25, 75]], [[75, 165]], [[165, 245]], [[245, 320]]],
  "unicorn-bright": [[[15, 60]], [[300, 360], [0, 15]], [[60, 200]], [[200, 300]]],
  // Frozen's: white, ice blue, lilac, silver, clear (pastel); white, royal blue, caribbean blue, violet, silver
  // (bright). White, silver and clear have no hue: left as shot.
  "frozen-pastel": [[], [[165, 245]], [[245, 330]], [], []],
  "frozen-bright": [[], [[212, 250]], [[160, 212]], [[250, 330]], []],
};
/** Sets whose balloons are told apart by their nearest colour (Lab a/b, so light and shade alike) rather than by
 *  hue bands: Unicorn's bright peach shades to under 15° (read as fuchsia) and its pastel mint is too pale for the
 *  chroma cut, and the pastel set's pale yellow, mint and blue cross their bands — the AI-recoloured Wavy shots came
 *  out patchy (2026-11-02, later). The set's balloons as its Single Arch shot has them, in FAMILIES' order. */
const LAB_REFS: Record<string, [number, number, number][]> = {
  "unicorn-bright": [[224, 172, 147], [188, 75, 111], [162, 177, 149], [172, 152, 184]],
  // Its pastel: pink, yellow, mint, icy blue, lilac, as her liked Single Arch photo has them.
  "unicorn-pastel": [[209, 156, 155], [203, 181, 97], [162, 187, 160], [137, 166, 192], [167, 148, 192]],
};
const labAB = (r: number, g: number, b: number) => {
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const R = lin(r), G = lin(g), B = lin(b);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [500 * (x - y), 200 * (y - z)];
};

(async () => {
  const [dir, setup, theme] = process.argv.slice(2);
  const OUT = theme ? `public/design/sketch/${theme}` : "public/design/sketch";
  const shot = theme ? (existsSync(path.join(dir, `${setup}-u2.png`)) ? `${setup}-u2.png` : `${setup}-u1.png`) : `${setup}-e1.png`;
  // A re-shoot: a fresh photo of the cleaned square, its balloons elsewhere (so none of the hand fixes).
  if (theme) for (const fix of [FILL, BAND, KEEP, ERASE]) delete fix[setup];
  // For LAB_REFS sets: the photo softened, so a point's family is its neighbourhood's colour (a pale balloon's
  // pixels drift between mint and icy blue one by one).
  const soft = theme && LAB_REFS[theme] ? await sharp(path.join(dir, shot)).removeAlpha().resize(1024, 1024).blur(5).raw().toBuffer() : null;
  // Its boards are shot white (the tinted Open Frame was the first photo's).
  if (theme) { NEUTRAL.delete(setup); delete CHROMA[setup]; }
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
  // 2026-11-02: a fresh shot's white boards on its white wall flood out past their outline, so each board is
  // held to its outline in the route guide it was shot from (shots2/<theme>/<setup>-guide.png, flat paint
  // inside a drawn line), widened a little for the shot's drift.
  const guideFile = theme ? path.join(dir, "..", "..", "shots2", theme, `${setup === "round" ? "single_round" : setup}-guide.png`) : "";
  const guide = guideFile && existsSync(guideFile) ? await sharp(guideFile).removeAlpha().resize(W, H).raw().toBuffer() : null;
  const clamps = SEEDS[setup].map(([sx, sy]) => {
    // The Single Arch's guide hides its board's top under the garland that the shot leaves bare: its arch as
    // shot (px: left, right, top) stands in.
    if (setup === "single_arch") {
      const [x0, x1, top] = [288, 638, 245], r = (x1 - x0) / 2, cx = x0 + r, cy = top + r;
      const m = new Uint8Array(N);
      for (let y = top; y < H; y++) for (let x = x0; x <= x1; x++) if (y >= cy || Math.hypot(x - cx, y - cy) <= r) m[y * W + x] = 1;
      return m;
    }
    if (!guide || sx < 0 || NO_GUIDE.has(setup)) return null;
    const m = new Uint8Array(N), gs = (i: number, j: number) => Math.abs(guide[i * 3] - guide[j * 3]) + Math.abs(guide[i * 3 + 1] - guide[j * 3 + 1]) + Math.abs(guide[i * 3 + 2] - guide[j * 3 + 2]);
    const stack = [sy * W + sx];
    m[stack[0]] = 1;
    let n = 1;
    while (stack.length) {
      const i = stack.pop()!, x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || m[j] || gs(i, j) > 12) continue;
        m[j] = 1; n++; stack.push(j);
      }
    }
    if (n < 2000 || n > N * 0.4) { console.log(`guide ${setup}: no outline at the seed (${n})`); return null; }
    let out = m;
    // A board on a coloured rim is held by its rim, so it may drift further from its guide (2026-11-02, the
    // four-sided Wavy came out 25 px wider than its guide; held at 10 px its face missed its right rim).
    for (let k = 0; k < (EXACT_GUIDE.has(setup) ? 3 : RIM.has(setup) ? 30 : 10); k++) {
      const prev = out.slice();
      for (let i = 0; i < N; i++) if (!prev[i]) { const x = i % W; if ((x > 0 && prev[i - 1]) || (x < W - 1 && prev[i + 1]) || prev[i - W] || prev[i + W]) out[i] = 1; }
    }
    return out;
  });
  SEEDS[setup].forEach(([sx, sy, bx0, by0, bx1, by1], b) => {
    if (sx < 0) return;
    if (RECT[setup]?.includes(b)) {
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (fg[(y * W + x) * 4 + 3] < 128) board[y * W + x] = b;
      if (SOLID[setup]) return;
      // 2026-11-02: the cut-out took (some of) a sequin wall in with the balloons. The sequins are busy, a balloon
      // is smooth: big smooth pieces of the cut-out are balloons (and a few points round them); the rest is wall.
      const smooth = new Uint8Array(N);
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
        let s = 0, s2 = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const l = lum(yy * W + xx); s += l; s2 += l * l; n++;
        }
        if (s2 / n - (s / n) ** 2 < 30 && fg[(y * W + x) * 4 + 3] >= 128) smooth[y * W + x] = 1;
      }
      const ball = new Uint8Array(N), seen = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        if (!smooth[i] || seen[i]) continue;
        const part = [i], stack = [i];
        seen[i] = 1;
        while (stack.length) {
          const k = stack.pop()!, x = k % W;
          for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
            if (j < 0 || j >= N || seen[j] || !smooth[j]) continue;
            seen[j] = 1; part.push(j); stack.push(j);
          }
        }
        if (part.length >= 250) for (const k of part) ball[k] = 1;
      }
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
        let near = false;
        for (let dy = -4; dy <= 4 && !near; dy++) for (let dx = -4; dx <= 4; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && ball[yy * W + xx]) { near = true; break; }
        }
        if (!near) board[y * W + x] = b;
      }
      return;
    }
    const stack = [sy * W + sx];
    board[stack[0]] = b;
    while (stack.length) {
      const i = stack.pop()!, x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        const jx = j % W, jy = (j - jx) / W;
        if (j < 0 || j >= N || board[j] >= 0 || kept[j] > 0 || !boardLike(j) || step(i, j) > (process.env.ST ? +process.env.ST : EXACT_GUIDE.has(setup) ? 8 : 5) || jx < bx0 || jx > bx1 || jy < by0 || jy > by1 || (clamps[b] && !clamps[b]![j])) continue;
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
  if (theme && PATCHES.has(setup)) SEEDS[setup].forEach(([sx, , bx0, by0, bx1, by1], b) => {
    if (sx < 0 || RECT[setup]?.includes(b)) return;
    const c = CIRCLE[setup];
    const inside = (j: number) => {
      const x = j % W, y = (j - x) / W;
      if (x < bx0 || x > bx1 || y < by0 || y > by1) return false;
      return (!c || Math.hypot(x - c[0], y - c[1]) <= c[2]) && (!clamps[b] || !!clamps[b]![j]);
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
    if (sx <= 0) return; // a sequin wall has no rim
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const i = y * W + x, r = at(i, 0), g = at(i, 1), bl = at(i, 2);
      if (near) {
        // Coloured, as the wall never is: pink, peach or blue by the set (a balloon is too, so only in the band,
        // right of the seed).
        // Over 11: Frozen Pastel's pale arctic-blue rim reads 12–24 where the window lights it (the wall 1–4).
        if (near[i] === 2 && x > sx - 60 && chroma(i) > 11 && lum(i) > 100) rim[i] = b;
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
    if (theme && LAB_REFS[theme]) {
      const [pa, pb] = labAB(soft![i * 3], soft![i * 3 + 1], soft![i * 3 + 2]), refs = LAB_REFS[theme].map(([rr, rg, rb]) => labAB(rr, rg, rb));
      const dists = refs.map(([qa, qb]) => Math.hypot(pa - qa, pb - qb)), k = dists.indexOf(Math.min(...dists));
      fam[i] = Math.hypot(pa, pb) < 6 || mx < 50 ? 255 : k;
    } else if (theme) fam[i] = d < 22 || mx < 50 ? 255 : Math.max(0, FAMILIES[theme].findIndex((rs) => rs.some(([a, b]) => h >= a && h < b)));
    else fam[i] = d < 22 || mx < 50 ? 0 : h >= 165 && h < 245 ? 1 : h >= 245 && h < 330 ? 2 : 0;
  }
  // Balloon by balloon (a SAM 2 segmentation next to the shot, <setup>-segs.png, id = R + G * 256): each balloon
  // takes the family most of its points have, highlights and shade too, so no balloon is repainted in patches
  // (2026-11-02, later: the AI-recoloured Wavy shots). Segments too big for a balloon (wall, floor, board) are left.
  const segsFile = path.join(dir, `${setup}-segs.png`);
  if (theme && existsSync(segsFile)) {
    const sg = await sharp(segsFile).removeAlpha().resize(W, H, { kernel: "nearest" }).raw().toBuffer();
    const id = (i: number) => sg[i * 3] + sg[i * 3 + 1] * 256;
    const votes = new Map<number, Map<number, number>>(), size = new Map<number, number>();
    for (let i = 0; i < N; i++) {
      const s0 = id(i);
      if (!s0) continue;
      size.set(s0, (size.get(s0) ?? 0) + 1);
      if (balloons[i * 4 + 3] < 128 || fam[i] === 255) continue;
      const v = votes.get(s0) ?? new Map<number, number>();
      v.set(fam[i], (v.get(fam[i]) ?? 0) + 1);
      votes.set(s0, v);
    }
    const major = new Map<number, number>();
    for (const [s0, v] of Array.from(votes)) {
      const [f, n] = Array.from(v).sort((p: [number, number], q: [number, number]) => q[1] - p[1])[0];
      if ((size.get(s0) ?? 0) < 40000 && n > (size.get(s0) ?? 0) * 0.3) major.set(s0, f);
    }
    for (let i = 0; i < N; i++) { const f = major.get(id(i)); if (f !== undefined && balloons[i * 4 + 3] > 0) fam[i] = f; }
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
    if (x1 < x0) { console.log(`board ${b}: hidden`); continue; }
    console.log(`board ${b}: x ${(x0 / W).toFixed(4)}–${(x1 / W).toFixed(4)}, y ${(y0 / H).toFixed(4)}–${(y1 / H).toFixed(4)}`);
    if (!RIM.has(setup)) continue;
    const rm = Buffer.alloc(N);
    for (let i = 0; i < N; i++) if (rim[i] === b) rm[i] = 255;
    await sharp(rm, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(OUT, `${setup}-rim-${b}.png`));
  }
})();
