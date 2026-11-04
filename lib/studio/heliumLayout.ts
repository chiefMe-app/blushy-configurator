// Where every balloon goes in the empty room (2026-11-04), in the room photo's pixels (HELIUM_ROOM): the bouquets on
// their weights to either side, the age's foil digits standing in the middle with the name bubble beside them, the
// name's foil letters in a row on the wall, and the loose balloons against the ceiling, nearer ones bigger. Pure, so
// the preview, its tests and the finished designs agree.
import { BUBBLE_CM, HELIUM_ROOM, LATEX, LETTER_CM, NUMBER_SIZES, bouquetSize, heliumPicture, type Helium } from "./helium";

/** A latex balloon: its picture (LATEX), its colour, its middle and width. */
export interface PlacedLatex { pic: (typeof LATEX)[number]; colour: string; x: number; y: number; w: number }
export interface PlacedBouquet { x: number; weight: { x: number; y: number }; balloons: PlacedLatex[]; foil?: { x: number; y: number; w: number; h: number } }
export interface HeliumLayout {
  bouquets: PlacedBouquet[];
  ceiling: (PlacedLatex & { ribbon: number })[];
  number?: { x: number; bottom: number; h: number };
  letters?: { x: number; top: number; h: number };
  bubble?: { x: number; y: number; r: number; weight: { x: number; y: number } };
}

const { perCm, floor, ceiling: CEILING, w: W, view } = HELIUM_ROOM;
/** An 11-inch latex balloon, 28 cm across. */
export const BALLOON_W = 28 * perCm;
/** The foil on a bouquet, 45 cm tall. */
const FOIL_H = 45 * perCm;

/** The balloons of a bouquet, in balloon widths from its middle, the back ones first. */
const CLUSTERS: Record<number, [number, number][]> = {
  5: [[-0.45, -0.55], [0.45, -0.55], [-0.9, 0.1], [0.9, 0.1], [0, 0.25]],
  7: [[-0.45, -0.7], [0.45, -0.7], [-0.9, -0.15], [0, -0.15], [0.9, -0.15], [-0.45, 0.4], [0.45, 0.4]],
  9: [[-0.45, -0.75], [0.45, -0.75], [-1.35, -0.15], [-0.45, -0.15], [0.45, -0.15], [1.35, -0.15], [-0.9, 0.45], [0, 0.45], [0.9, 0.45]],
};

/** A small steady number from a seed, 0 to 1. */
const rand = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };

/** n points spread from a to b (one in the middle). */
const spread = (n: number, a: number, b: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + (i * (b - a)) / (n - 1)));

export function heliumLayout(h: Helium): HeliumLayout {
  const colours = h.colours.length ? h.colours : ["#F8BBD0"];
  const number = h.number.on && !!h.number.value;
  const bubble = h.bubble.on;
  const middle = number || bubble;
  const out: HeliumLayout = { bouquets: [], ceiling: [] };

  // The bouquets: half to each side of what stands in the middle, or across the room when nothing does.
  const n = h.bouquets;
  const xs = middle ? [...spread(Math.ceil(n / 2), 250, 450), ...spread(Math.floor(n / 2), 894, 1094)] : spread(n, n > 1 ? 300 : 672, n > 1 ? 1044 : 672);
  const cluster = CLUSTERS[bouquetSize(h.size).balloons];
  let c = 0;
  xs.forEach((x, i) => {
    // Their strings 140 or 178 cm, so neighbours stand at two heights, one above the other.
    const cy = floor - (i % 2 ? 178 : 140) * perCm;
    const balloons = cluster.map(([dx, dy], j) => ({
      pic: LATEX[(i + j) % LATEX.length], colour: colours[c++ % colours.length], x: x + dx * BALLOON_W, y: cy + dy * BALLOON_W * 1.05, w: BALLOON_W,
    }));
    const top = Math.min(...balloons.map((b) => b.y)) - BALLOON_W * 0.55;
    const foil = h.topper === "none" ? undefined : (() => {
      const pic = heliumPicture(h.topper);
      const fh = FOIL_H, fw = (pic.w / pic.h) * fh;
      return { x, y: top - fh * 0.42, w: fw, h: fh };
    })();
    out.bouquets.push({ x, weight: { x, y: floor + 6 + (i % 2) * 8 }, balloons, foil });
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
    out.ceiling.push({ pic: LATEX[i % LATEX.length], colour: colours[i % colours.length], x, y: top + w * 0.55, w, ribbon: (90 + rand(i + 201) * 110) * s });
  }
  return out;
}
