// Where every balloon goes in the empty room (2026-11-04), in the room photo's pixels (HELIUM_ROOM): the bouquets on
// their weights to either side, the age's foil digits standing in the middle with the name bubble beside them, the
// name's foil letters in a row on the wall, and the loose balloons against the ceiling, nearer ones bigger. Pure, so
// the preview, its tests and the finished designs agree. Since the owner's first look (2026-11-04): a bouquet's
// colours mixed at random, never in rows, its balloons a little uneven like real ones, the foils their real size, and
// the picture closing in on what is there (`view`); up to three foils on a bouquet, fanned; and every latex balloon
// leaning along its ribbon to the weight, as a real bouquet's do ("neden gerçek balon gibi durmuyor": all upright,
// side by side, they read as drawn discs).
import { BUBBLE_CM, HELIUM_ROOM, LATEX, LATEX_CM, LETTER_CM, NUMBER_SIZES, bouquetSize, foilCm, heliumPicture, type FoilId, type Helium } from "./helium";

/** A latex balloon: its picture (LATEX), its colour, its middle and width, and its lean in degrees (clockwise). */
export interface PlacedLatex { pic: (typeof LATEX)[number]; colour: string; x: number; y: number; w: number; tilt: number }
/** A foil on a bouquet: which, its middle, its size and its lean. */
export interface PlacedFoil { id: FoilId; x: number; y: number; w: number; h: number; tilt: number }
export interface PlacedBouquet { x: number; weight: { x: number; y: number }; balloons: PlacedLatex[]; foils: PlacedFoil[] }
export interface HeliumLayout {
  bouquets: PlacedBouquet[];
  ceiling: (PlacedLatex & { ribbon: number })[];
  number?: { x: number; bottom: number; h: number };
  letters?: { x: number; top: number; h: number };
  bubble?: { x: number; y: number; r: number; weight: { x: number; y: number } };
  /** The part of the room the picture shows, always the shape of HELIUM_ROOM.view. */
  view: { x: number; y: number; w: number; h: number };
}

const { perCm, floor, ceiling: CEILING, w: W, h: H, view } = HELIUM_ROOM;
/** An 11-inch latex balloon, 28 cm across. */
export const BALLOON_W = LATEX_CM * perCm;
/** The narrowest the picture closes in to: about 2.4 m of the room. */
const MIN_VIEW_W = 640;

/** The balloons of a bouquet, in balloon widths from its middle, the back ones first. */
const CLUSTERS: Record<number, [number, number][]> = {
  5: [[-0.45, -0.55], [0.45, -0.55], [-0.9, 0.1], [0.9, 0.1], [0, 0.25]],
  7: [[-0.45, -0.7], [0.45, -0.7], [-0.9, -0.15], [0, -0.15], [0.9, -0.15], [-0.45, 0.4], [0.45, 0.4]],
  9: [[-0.45, -0.75], [0.45, -0.75], [-1.35, -0.15], [-0.45, -0.15], [0.45, -0.15], [1.35, -0.15], [-0.9, 0.45], [0, 0.45], [0.9, 0.45]],
};

/** A small steady number from a seed, 0 to 1. */
const rand = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };

/** Where a bouquet's foils sit, in the main foil's widths from the middle and its heights down, and their lean. */
const FOIL_FANS: Record<number, { dx: number; dy: number; tilt: number }[]> = {
  1: [{ dx: 0, dy: 0, tilt: 0 }],
  2: [{ dx: -0.3, dy: 0, tilt: -6 }, { dx: 0.42, dy: 0.2, tilt: 12 }],
  3: [{ dx: 0, dy: 0, tilt: 0 }, { dx: -0.6, dy: 0.24, tilt: -14 }, { dx: 0.6, dy: 0.26, tilt: 14 }],
};

/** n points spread from a to b (one in the middle). */
const spread = (n: number, a: number, b: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + (i * (b - a)) / (n - 1)));

/**
 * A bouquet's colours: each colour as often as the others, shuffled (steadily, from the bouquet's seed) the way that
 * puts the fewest same colours side by side — mixed, never in rows.
 */
export function mixColours(colours: string[], cluster: [number, number][], seed: number): string[] {
  const n = cluster.length;
  const pairs: [number, number][] = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    if (Math.hypot(cluster[a][0] - cluster[b][0], cluster[a][1] - cluster[b][1]) < 1.05) pairs.push([a, b]);
  }
  let best: string[] = [], bestBad = Infinity;
  for (let t = 0; t < 24 && bestBad > 0; t++) {
    const list = Array.from({ length: n }, (_, i) => colours[(i + seed) % colours.length]);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand(seed * 131 + t * 17 + i) * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    const bad = pairs.filter(([a, b]) => list[a] === list[b]).length;
    if (bad < bestBad) { best = list; bestBad = bad; }
  }
  return best;
}

export function heliumLayout(h: Helium): HeliumLayout {
  const colours = h.colours.length ? h.colours : ["#F8BBD0"];
  const number = h.number.on && !!h.number.value;
  const bubble = h.bubble.on;
  const middle = number || bubble;
  const out: HeliumLayout = { bouquets: [], ceiling: [], view };

  // The bouquets: half to each side of what stands in the middle, or across the room when nothing does.
  const n = h.bouquets;
  const xs = middle ? [...spread(Math.ceil(n / 2), 250, 450), ...spread(Math.floor(n / 2), 894, 1094)] : spread(n, n > 1 ? 300 : 672, n > 1 ? 1044 : 672);
  const cluster = CLUSTERS[bouquetSize(h.size).balloons];
  xs.forEach((x, i) => {
    // Their strings 140 or 178 cm, so neighbours stand at two heights, one above the other.
    const cy = floor - (i % 2 ? 178 : 140) * perCm;
    const mixed = mixColours(colours, cluster, i * 7 + 3);
    // Each balloon a touch off the grid and a touch bigger or smaller, as real ones are blown.
    const weight = { x, y: floor + 6 + (i % 2) * 8 };
    const balloons = cluster.map(([dx, dy], j) => {
      const bx = x + (dx + (rand(i * 31 + j + 1) - 0.5) * 0.16) * BALLOON_W;
      const by = cy + (dy + (rand(i * 37 + j + 2) - 0.5) * 0.14) * BALLOON_W * 1.05;
      // Leaning along its ribbon, its knot to the weight, a little more as a held bouquet fans out.
      const tilt = (-Math.atan2(weight.x - bx, weight.y - by) * 180 / Math.PI) * 1.6 + (rand(i * 41 + j + 9) - 0.5) * 6;
      return { pic: LATEX[(i + j) % LATEX.length], colour: mixed[j], x: bx, y: by, w: BALLOON_W * (0.95 + rand(i * 53 + j * 11 + 5) * 0.1), tilt };
    });
    const top = Math.min(...balloons.map((b) => b.y)) - BALLOON_W * 0.55;
    // Each foil its real size on its longest side, fanned by the main one's size.
    const sized = h.foils.map((id) => {
      const pic = heliumPicture(id), long = foilCm(id) * perCm;
      const fh = pic.h >= pic.w ? long : (pic.h / pic.w) * long;
      return { id, w: (pic.w / pic.h) * fh, h: fh };
    });
    const fan = FOIL_FANS[sized.length] ?? [];
    const main = sized[0];
    const foils = sized.map((f, k) => ({
      ...f, x: x + fan[k].dx * main.w, y: top - main.h * 0.42 + fan[k].dy * main.h + (main.h - f.h) * 0.3, tilt: fan[k].tilt,
    }));
    // Drawn back to front: the side ones behind the main one.
    out.bouquets.push({ x, weight, balloons, foils: [...foils.slice(1), ...foils.slice(0, 1)] });
  });

  // The age, standing on the floor; the bubble beside it, or in the middle alone.
  if (number) {
    const cm = NUMBER_SIZES.find((s) => s.id === h.number.size)!.cm;
    out.number = { x: bubble ? 760 : 672, bottom: floor + 8, h: cm * perCm };
  }
  if (bubble) {
    const r = (BUBBLE_CM * perCm) / 2;
    const x = number ? 565 : 672;
    out.bubble = { x, y: floor - 105 * perCm, r, weight: { x, y: floor + 10 } };
  }
  // The name on the wall, 2.2 m up.
  if (h.letters.on && h.letters.text) out.letters = { x: W / 2, top: HELIUM_ROOM.base - 205 * perCm, h: LETTER_CM * perCm };

  // The ceiling: far ones (t 0) touch it at the wall, near ones higher in the picture and bigger; far first.
  const count = h.ceiling;
  const loose = Array.from({ length: count }, (_, i) => ({ i, t: rand(i + 1) * 0.9, x: view.x + 10 + rand(i + 101) * (view.w - 20) }))
    .sort((a, b) => a.t - b.t);
  for (const { i, t, x } of loose) {
    const s = 0.85 + t * 0.55;
    const w = BALLOON_W * s;
    const top = CEILING - 8 - t * 95;
    out.ceiling.push({ pic: LATEX[i % LATEX.length], colour: colours[Math.floor(rand(i + 301) * colours.length)], x, y: top + w * 0.55, w, ribbon: (90 + rand(i + 201) * 110) * s, tilt: (rand(i + 401) - 0.5) * 14 });
  }
  out.view = closeIn(out, h);
  return out;
}

/**
 * The picture closed in on what is in it: the balloons with some room around them and the floor under their weights,
 * in the shape of HELIUM_ROOM.view, no narrower than MIN_VIEW_W, inside the room. With balloons on the ceiling, all of it.
 */
function closeIn(L: HeliumLayout, h: Helium): HeliumLayout["view"] {
  if (L.ceiling.length) return view;
  const box: [number, number, number, number][] = []; // left, top, right, bottom
  for (const q of L.bouquets) {
    for (const b of q.balloons) box.push([b.x - b.w / 2, b.y - b.w * 0.6, b.x + b.w / 2, b.y + b.w / 2]);
    for (const f of q.foils) box.push([f.x - f.w / 2, f.y - f.h / 2, f.x + f.w / 2, f.y + f.h / 2]);
    box.push([q.weight.x - 25, q.weight.y - 30, q.weight.x + 25, q.weight.y + 6]);
  }
  if (L.number) {
    const half = (L.number.h * 0.7 * h.number.value.length) / 2 + L.number.h * 0.1;
    box.push([L.number.x - half, L.number.bottom - L.number.h, L.number.x + half, L.number.bottom]);
  }
  if (L.bubble) box.push([L.bubble.x - L.bubble.r, L.bubble.y - L.bubble.r, L.bubble.x + L.bubble.r, L.bubble.weight.y + 6]);
  if (L.letters) {
    const half = (L.letters.h * 0.7 * h.letters.text.length) / 2 + L.letters.h * 0.2;
    box.push([L.letters.x - half, L.letters.top, L.letters.x + half, L.letters.top + L.letters.h]);
  }
  if (!box.length) return view;
  const left = Math.min(...box.map((b) => b[0])), top = Math.min(...box.map((b) => b[1]));
  const right = Math.max(...box.map((b) => b[2])), bottom = Math.max(floor + 35, ...box.map((b) => b[3] + 25));
  const ratio = view.w / view.h;
  const w = Math.min(view.w, Math.max(MIN_VIEW_W, right - left + 140, (bottom - (top - 40)) * ratio));
  const vh = w / ratio;
  const x = Math.max(0, Math.min(W - w, (left + right) / 2 - w / 2));
  const y = Math.max(0, Math.min(H - vh, bottom - vh));
  return { x, y, w, h: vh };
}
