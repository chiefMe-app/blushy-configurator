// Path geometry shared by the engine (Typography System, T2): flattening the
// glyph outlines (M/L/Q/C/Z with "x,y" pairs) into rings, ring areas and
// ink boxes measured on the curves themselves (a TrueType glyph's stored box
// also covers its off-curve control points, so it runs up to ~0.4 mm wide at
// board sizes).
export type Pair = [number, number];
export type Ring = Pair[];
export interface Box { x0: number; y0: number; x1: number; y1: number }

const len = (x: number, y: number) => Math.hypot(x, y);

/** Closed rings of a path, curves flattened to within `tol` (mm). */
export function flatten(d: string, tol: number): Ring[] {
  const rings: Ring[] = [];
  let ring: Ring = [];
  let cur: Pair = [0, 0];
  const close = () => { if (ring.length > 2) rings.push(ring); ring = []; };
  for (const m of Array.from(d.matchAll(/([MLQCZ])([^MLQCZ]*)/g))) {
    const pts = Array.from(m[2].matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)).map((p) => [+p[1], +p[2]] as Pair);
    switch (m[1]) {
      case "M": close(); cur = pts[0]; ring.push(cur); break;
      case "L": cur = pts[0]; ring.push(cur); break;
      case "Q": {
        const [c, e] = pts;
        const n = Math.max(1, Math.ceil(Math.sqrt(len(cur[0] - 2 * c[0] + e[0], cur[1] - 2 * c[1] + e[1]) / (4 * tol))));
        for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; ring.push([u * u * cur[0] + 2 * u * t * c[0] + t * t * e[0], u * u * cur[1] + 2 * u * t * c[1] + t * t * e[1]]); }
        cur = e; break;
      }
      case "C": {
        const [c1, c2, e] = pts;
        const dd = Math.max(len(cur[0] - 2 * c1[0] + c2[0], cur[1] - 2 * c1[1] + c2[1]), len(c1[0] - 2 * c2[0] + e[0], c1[1] - 2 * c2[1] + e[1]));
        const n = Math.max(1, Math.ceil(Math.sqrt((0.75 * dd) / tol)));
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          ring.push([u * u * u * cur[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * e[0], u * u * u * cur[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * e[1]]);
        }
        cur = e; break;
      }
      case "Z": close(); break;
    }
  }
  close();
  return rings;
}

export const ringArea = (r: Ring) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

export const EMPTY_BOX: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };

/** Ink box of a path, measured on the curves (to `tol` mm). */
export function pathBox(d: string, tol = 0.01): Box {
  const b = { ...EMPTY_BOX };
  for (const r of flatten(d, tol)) for (const [x, y] of r) {
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
  }
  return b;
}

export const unionBox = (a: Box, b: Box): Box => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
