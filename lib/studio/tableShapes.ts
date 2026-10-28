// The floor plan of the kids' table (1 unit = 1 cm): every table of the
// chosen kind, its outline and the seats round it, for both live drawings
// (TableSketch from above, TablePerspective from the front). The kinds are
// the owner's own tables (2026-10-28, her photos in lib/studio/tableCatalog.ts);
// sizes are read from the photos, close enough for a sketch.
import { onFloor } from "./tableCatalog";
import { tableCounts, type TableSetup } from "./tableSetup";

export type Pt = readonly [number, number];

export interface Seat {
  x: number; y: number;
  /** Direction from the seat towards the table, radians. */
  facing: number;
  /** The table edge in front of the seat. */
  ex: number; ey: number;
}

export interface Placed {
  kind: string;
  /** The bounding box. */
  x: number; y: number; w: number; h: number;
  /** The tabletop's edge, a closed polygon. */
  outline: Pt[];
  seats: Seat[];
  /** The runner (or the line of confetti) on the tabletop, a closed polygon. */
  runner: Pt[];
  /** Where centrepieces stand. */
  centres: Pt[];
  /** Tabletop height. */
  height: number;
}

export const CHAIR = { d: 34, gap: 9 };
/** A floor cushion's depth (the low table). */
export const CUSHION = { d: 40, gap: 4 };

interface Edge { ex: number; ey: number; facing: number }
interface Shape {
  w: number; h: number; height: number;
  outline: Pt[];
  /** n seats' table edges, relative to the box. */
  seats: (n: number) => Edge[];
  runner: Pt[];
  /** One table's centrepiece spots, from its seats. */
  centres: (seats: Edge[]) => Pt[];
}

const TAU = 2 * Math.PI;
const circle = (cx: number, cy: number, r: number, n = 48): Pt[] =>
  Array.from({ length: n }, (_, i) => [cx + Math.cos((i * TAU) / n) * r, cy + Math.sin((i * TAU) / n) * r] as const);

/**
 * A long table from its centre line (left to right) and half its depth: the
 * outline, a seat on either side spread along it (one more on the far side
 * for an odd number), the runner down the line and centrepieces in the gaps.
 */
function alongLine(line: (u: number) => Pt, half: number, bump = (_u: number) => 0): Omit<Shape, "w" | "h" | "height"> {
  const N = 40;
  const at = (u: number) => {
    const [x, y] = line(u), [x2, y2] = line(Math.min(1, u + 0.001)), [x1, y1] = line(Math.max(0, u - 0.001));
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    return { x, y, nx: -(y2 - y1) / len, ny: (x2 - x1) / len }; // the normal points to the near side
  };
  const side = (sign: number) => Array.from({ length: N + 1 }, (_, i) => {
    const u = i / N, p = at(u), d = half + bump(u);
    return [p.x + sign * p.nx * d, p.y + sign * p.ny * d] as const;
  });
  const band = (d: number, from: number, to: number) => {
    const us = Array.from({ length: 21 }, (_, i) => from + ((to - from) * i) / 20);
    const a = us.map((u) => { const p = at(u); return [p.x - p.nx * d, p.y - p.ny * d] as const; });
    const b = us.map((u) => { const p = at(u); return [p.x + p.nx * d, p.y + p.ny * d] as const; });
    return [...a, ...b.reverse()];
  };
  const spots = (n: number, sign: number): Edge[] => Array.from({ length: n }, (_, k) => {
    const u = (k + 0.5) / n, p = at(u), d = half + bump(u) * 0.6;
    return { ex: p.x + sign * p.nx * d, ey: p.y + sign * p.ny * d, facing: Math.atan2(-sign * p.ny, -sign * p.nx) };
  });
  return {
    outline: [...side(-1), ...side(1).reverse()],
    seats: (n) => [...spots(Math.ceil(n / 2), -1), ...spots(Math.floor(n / 2), 1)],
    runner: band(9, 0.04, 0.96),
    centres: (seats) => {
      // Between the far side's places (they sit at (k + 0.5) / n along the line).
      const n = Math.ceil(seats.length / 2);
      const us = n > 1 ? Array.from({ length: n - 1 }, (_, i) => (i + 1) / n) : [0.2, 0.8];
      return us.map((u) => { const p = at(u); return [p.x, p.y] as const; });
    },
  };
}

const SHAPES: Record<string, Shape> = (() => {
  const straight = (w: number, h: number) => (u: number): Pt => [u * w, h / 2];
  const standard = { w: 240, h: 80, height: 55, ...alongLine(straight(240, 80), 40) };
  const low = { w: 200, h: 70, height: 35, ...alongLine(straight(200, 70), 35) };
  // Soft scallops all along both sides.
  const cloud = { w: 260, h: 100, height: 55, ...alongLine(straight(260, 100), 40, (u) => 10 * Math.abs(Math.sin(u * Math.PI * 5))) };
  // Half a wave: the table bends one way and back, like a stretched S.
  const wave = (u: number): Pt => [u * 240, 85 + 45 * Math.cos(u * Math.PI)];
  const halfWave = { w: 240, h: 170, height: 55, ...alongLine(wave, 37) };
  // One big circle, the children all round it.
  const R = 110;
  const round: Shape = {
    w: 2 * R, h: 2 * R, height: 55, outline: circle(R, R, R, 64), runner: circle(R, R, 34),
    seats: (n) => Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + (k * TAU) / n; return { ex: R + Math.cos(a) * R, ey: R + Math.sin(a) * R, facing: a + Math.PI }; }),
    centres: () => [[R, R]],
  };
  // Six round petals, one pointing up; a child at the tip of each (fewer
  // children: every other petal first).
  const F = 80, r = (a: number) => 52 + 28 * Math.abs(Math.sin(3 * a));
  const petal = (k: number, n: number) => -Math.PI / 2 + ((Math.round((k * 6) / n) % 6) * TAU) / 6;
  const flower: Shape = {
    w: 2 * F, h: 2 * F, height: 55,
    outline: Array.from({ length: 96 }, (_, i) => { const a = (i * TAU) / 96; return [F + Math.cos(a) * r(a), F + Math.sin(a) * r(a)] as const; }),
    runner: circle(F, F, 24),
    seats: (n) => Array.from({ length: n }, (_, k) => { const a = petal(k, n); return { ex: F + Math.cos(a) * r(a), ey: F + Math.sin(a) * r(a), facing: a + Math.PI }; }),
    centres: () => [[F, F]],
  };
  return { standard, low, cloud, half_wave: halfWave, round, flower };
})();

export const tableShape = (kind: string) => SHAPES[kind] ?? SHAPES.standard;

/** Where every table and seat goes, in cm: long tables two to a row, the others three. */
export function arrangeTables(t: Pick<TableSetup, "kids" | "choices">): { tables: Placed[]; width: number; height: number } {
  const { perTable } = tableCounts(t);
  const kind = t.choices.table in SHAPES ? t.choices.table : "standard";
  const S = SHAPES[kind];
  const seat = onFloor(t.choices) ? CUSHION : CHAIR;
  const reach = seat.gap + seat.d, margin = 30, space = 60;
  const cols = Math.min(S.w >= 200 ? 2 : 3, perTable.length), rows = Math.ceil(perTable.length / cols);
  const cellW = S.w + 2 * reach + space, cellH = S.h + 2 * reach + space;
  const tables = perTable.map((kids, i): Placed => {
    const x = margin + reach + (i % cols) * cellW, y = margin + reach + Math.floor(i / cols) * cellH;
    const move = ([px, py]: Pt): Pt => [x + px, y + py];
    const edges = S.seats(kids);
    return {
      kind, x, y, w: S.w, h: S.h, height: S.height,
      outline: S.outline.map(move), runner: S.runner.map(move), centres: S.centres(edges).map(move),
      seats: edges.map((e) => ({
        ex: x + e.ex, ey: y + e.ey, facing: e.facing,
        x: x + e.ex - Math.cos(e.facing) * (seat.gap + seat.d / 2),
        y: y + e.ey - Math.sin(e.facing) * (seat.gap + seat.d / 2),
      })),
    };
  });
  return { tables, width: 2 * margin + cols * cellW - space, height: 2 * margin + rows * cellH - space };
}

/** An outline as an SVG path. */
export const outlinePath = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("") + "Z";
