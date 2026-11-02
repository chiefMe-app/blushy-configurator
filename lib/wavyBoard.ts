// The Wavy Backdrop's outline (2026-11-01, the owner's wavy board reference):
// a tall board whose four sides all run in waves, like a wavy mirror. One path for the live sketch, the
// Style tab's size icon and the render's guide, so all three agree.

/** How deep a wave swells in or out, and the rounded corners, of the board's width. */
const AMP = 0.04, CORNER = 0.09;
/** One wave runs about this much of the board's width. */
const WAVE = 0.4;

/**
 * A rounded rectangle in the box whose four sides all run in waves, a crest on every corner, as a smooth
 * closed SVG path. `n` is the waves along the top/bottom and down each side.
 */
function wavyRect(x: number, top: number, w: number, h: number, amp: number, r: number, n: { across: number; down: number }): string {
  const x0 = x + amp, y0 = top + amp, x1 = x + w - amp, y1 = top + h - amp;
  const a = (r * Math.PI) / 4;
  // Clockwise from the top-left corner's middle: each run goes corner middle to corner middle.
  const runs = [
    { c0: [x0 + r, y0 + r], t0: 225, from: [x0 + r, y0], dir: [1, 0], len: x1 - x0 - 2 * r, c1: [x1 - r, y0 + r], waves: n.across },
    { c0: [x1 - r, y0 + r], t0: 315, from: [x1, y0 + r], dir: [0, 1], len: y1 - y0 - 2 * r, c1: [x1 - r, y1 - r], waves: n.down },
    { c0: [x1 - r, y1 - r], t0: 45, from: [x1 - r, y1], dir: [-1, 0], len: x1 - x0 - 2 * r, c1: [x0 + r, y1 - r], waves: n.across },
    { c0: [x0 + r, y1 - r], t0: 135, from: [x0, y1 - r], dir: [0, -1], len: y1 - y0 - 2 * r, c1: [x0 + r, y0 + r], waves: n.down },
  ];
  const pts: number[][] = [];
  const STEPS = 48;
  for (const run of runs) {
    const total = 2 * a + run.len;
    for (let k = 0; k < STEPS; k++) {
      const s = (k / STEPS) * total;
      let p: number[], nx: number, ny: number;
      if (s < a) {
        const t = ((run.t0 * Math.PI) / 180) + s / r;
        nx = Math.cos(t); ny = Math.sin(t); p = [run.c0[0] + r * nx, run.c0[1] + r * ny];
      } else if (s < a + run.len) {
        nx = run.dir[1]; ny = -run.dir[0]; p = [run.from[0] + run.dir[0] * (s - a), run.from[1] + run.dir[1] * (s - a)];
      } else {
        const t = ((run.t0 + 90 - 45) * Math.PI) / 180 + (s - a - run.len) / r;
        nx = Math.cos(t); ny = Math.sin(t); p = [run.c1[0] + r * nx, run.c1[1] + r * ny];
      }
      const off = amp * Math.cos((2 * Math.PI * run.waves * s) / total);
      pts.push([p[0] + nx * off, p[1] + ny * off]);
    }
  }
  // Catmull-Rom through the points, as cubic curves.
  const f = (v: number) => v.toFixed(1);
  const N = pts.length, d = [`M ${f(pts[0][0])} ${f(pts[0][1])}`];
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    d.push(`C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`);
  }
  d.push("Z");
  return d.join(" ");
}

/** The waves along the top and down each side of a board w by h: whole waves, about WAVE of the width each. */
function waveCounts(w: number, h: number) {
  const amp = w * AMP, r = w * CORNER, a = (r * Math.PI) / 2;
  return {
    across: Math.max(1, Math.round((w - 2 * amp - 2 * r + a) / (w * WAVE))),
    down: Math.max(1, Math.round((h - 2 * amp - 2 * r + a) / (w * WAVE))),
  };
}

/** The outline of a wavy board in the box (x, top, w, h), its foot on top + h, as an SVG path. */
export function wavyBoardPath(x: number, top: number, w: number, h: number): string {
  // 2026-11-02, the owner sent a wavy board photo: "bunun aynısını yap şekil olarak". All four sides wave,
  // the bottom too, about 4% of the width deep; four waves down each side and two across the top and the
  // foot of a 120 x 220 board, a crest on every corner. The crests touch the box: the board is its full
  // 120 cm at its widest (earlier: "birebir aynı backdrop genişliği 120cm mi?").
  return wavyRect(x, top, w, h, w * AMP, w * CORNER, waveCounts(w, h));
}

/**
 * The offset border (2026-11-01, the owner: "wavy de border offset olmalı örnekteki gibi"): the board is
 * two layers, a coloured one behind showing as a rim all round the face. The rim, of the board's width.
 */
export const WAVY_BORDER = 0.07;

/** The face of a wavy board in the box (x, top, w, h): the same waves, inset by the rim all round (her photo's rim runs under the foot too). */
export function wavyFacePath(x: number, top: number, w: number, h: number): string {
  const b = w * WAVY_BORDER;
  return wavyRect(x + b, top + b, w - 2 * b, h - 2 * b, w * AMP, w * CORNER * 0.6, waveCounts(w, h));
}

/** The rim's colour: the one picked, else the party's first balloon colour that isn't white, silver or clear. */
export function wavyBorderColor(picked: string | undefined, balloonColors: string[], accent: string): string {
  if (picked) return picked;
  const sat = (h: string) => {
    const n = parseInt(h.replace("#", ""), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
    const mx = Math.max(...c), mn = Math.min(...c);
    return mx ? (mx - mn) / mx : 0;
  };
  return balloonColors.find((h) => /^#[0-9a-f]{6}$/i.test(h) && sat(h) >= 0.12) ?? accent;
}
