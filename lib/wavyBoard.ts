// The Wavy Backdrop's outline (2026-11-01, the owner's wavy board reference):
// a tall board whose sides run in a few soft waves and whose top edge is
// softly scalloped, like a wavy mirror. One path for the live sketch, the
// Style tab's size icon and the render's guide, so all three agree.

/** The outline of a wavy board in the box (x, top, w, h), its foot on top + h, as an SVG path. */
export function wavyBoardPath(x: number, top: number, w: number, h: number): string {
  const f = (n: number) => n.toFixed(1);
  // 2026-11-02, the owner: "birebir ayni backdrop genisligi 120cm mi?" — the waves swing about the board's
  // true edge, as gently as in her reference (about 3% of the width, four to a side). Swinging about a line
  // 4.5% in, the board read 9% narrower than its 120 cm.
  const amp = w * 0.03;         // how far a wave swells in or out
  const sideWaves = 4;          // waves down each side
  const topWaves = 3;           // scallops along the top
  const inset = 0;              // the waves swing about the edge itself
  const r = w * 0.14;           // the rounded top corners
  const bottom = top + h;
  const d: string[] = [`M ${f(x + inset)} ${f(bottom)}`];
  // Up the left side, from the foot to under the top-left corner.
  const sideTop = top + r, sideLen = bottom - sideTop, segS = sideLen / sideWaves;
  for (let i = 0; i < sideWaves; i++) {
    const y0 = bottom - i * segS, y1 = y0 - segS;
    d.push(`Q ${f(x + inset + (i % 2 ? amp : -amp))} ${f((y0 + y1) / 2)} ${f(x + inset)} ${f(y1)}`);
  }
  d.push(`Q ${f(x + inset)} ${f(top)} ${f(x + inset + r)} ${f(top)}`);
  // Along the top, scalloped.
  const topLen = w - 2 * inset - 2 * r, segT = topLen / topWaves;
  for (let i = 0; i < topWaves; i++) {
    const x0 = x + inset + r + i * segT;
    d.push(`Q ${f(x0 + segT / 2)} ${f(top + (i % 2 ? amp * 1.2 : -amp * 0.4))} ${f(x0 + segT)} ${f(top)}`);
  }
  d.push(`Q ${f(x + w - inset)} ${f(top)} ${f(x + w - inset)} ${f(sideTop)}`);
  // Down the right side, mirroring the left.
  for (let i = sideWaves - 1; i >= 0; i--) {
    const y1 = bottom - i * segS, y0 = y1 - segS;
    d.push(`Q ${f(x + w - inset - (i % 2 ? amp : -amp))} ${f((y0 + y1) / 2)} ${f(x + w - inset)} ${f(y1)}`);
  }
  d.push("Z");
  return d.join(" ");
}

/**
 * The offset border (2026-11-01, the owner: "wavy de border offset olmalı örnekteki gibi"): the board is
 * two layers, a coloured one behind showing as a rim all round the face. The rim, of the board's width.
 */
export const WAVY_BORDER = 0.055;

/** The face of a wavy board in the box (x, top, w, h): the same outline, inset by the rim (none at the foot). */
export function wavyFacePath(x: number, top: number, w: number, h: number): string {
  const b = w * WAVY_BORDER;
  return wavyBoardPath(x + b, top + b, w - 2 * b, h - b);
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
