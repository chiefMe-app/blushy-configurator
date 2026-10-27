// The Design Pack's cut files (Phase 1.3): 1:1 SVGs in millimetres. Board
// outlines from the design's sizes; lettering from the typography engine's
// merged outlines (lib/typography/cutReady.ts), scaled from the layout box to
// the real board. Beta: to be checked against the producer's own software
// with CALIBRATION_100mm.svg before cutting.
import { cutElements } from "@/lib/typography/cutReady";
import type { BoardSpec, LetteringSpec } from "./spec";

/** The cut files' folder in the ZIP. ASCII only: some unzip tools garble other characters in names. */
export const CUT_DIR = "2_CUT_FILES (beta - verify with your producer)";

const CUT = `fill="none" stroke="#FF0000" stroke-width="0.25"`;
const n = (v: number) => +v.toFixed(3);
const svgDoc = (w: number, h: number, body: string, title: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}mm" height="${n(h)}mm" viewBox="0 0 ${n(w)} ${n(h)}">\n<title>${title}</title>\n${body}\n</svg>\n`;

/** The board's outline path, in board mm (0,0 = top left of its bounding box). */
export function boardOutlinePath(b: Pick<BoardSpec, "type" | "widthMm" | "heightMm">): string {
  const w = b.widthMm, h = b.heightMm;
  if (b.type === "round") {
    const r = w / 2;
    return `M0,${n(r)}A${n(r)},${n(r)} 0 1 1 ${n(w)},${n(r)}A${n(r)},${n(r)} 0 1 1 0,${n(r)}Z`;
  }
  if (b.type === "arch") {
    const r = w / 2; // a semicircular top
    return `M0,${n(h)}L0,${n(r)}A${n(r)},${n(r)} 0 0 1 ${n(w)},${n(r)}L${n(w)},${n(h)}Z`;
  }
  return `M0,0H${n(w)}V${n(h)}H0Z`;
}

export function boardOutlineSvg(b: BoardSpec): string {
  return svgDoc(b.widthMm, b.heightMm, `<path ${CUT} d="${boardOutlinePath(b)}"/>`,
    `${b.name} outline — ${b.kind}, ${b.widthMm} x ${b.heightMm} mm, 1:1 (beta: verify with your producer)`);
}

/** The lettering's merged outlines in board mm. */
function letteringRings(l: LetteringSpec, offsetX: number, offsetY: number) {
  const box = l.layout.box;
  const ox = l.centreXMm - (box.widthMm * l.scale) / 2 + offsetX;
  const oy = l.centreYMm - (box.heightMm * l.scale) / 2 + offsetY;
  return cutElements(l.layout).map((e) => ({
    role: e.role,
    d: e.polygons.map((poly) => poly.map((r) => `M${r.map((p) => `${n(ox + p[0] * l.scale)},${n(oy + p[1] * l.scale)}`).join("L")}Z`).join("")).join(""),
    xs: e.polygons.flatMap((poly) => poly[0].map((p) => ox + p[0] * l.scale)),
    ys: e.polygons.flatMap((poly) => poly[0].map((p) => oy + p[1] * l.scale)),
  }));
}

const MARGIN = 10;

/** The lettering alone, 1:1, on a canvas just around its ink. */
export function letteringCutSvg(b: BoardSpec): string | null {
  const l = b.lettering;
  if (!l) return null;
  const placed = letteringRings(l, 0, 0);
  const xs = placed.flatMap((p) => p.xs), ys = placed.flatMap((p) => p.ys);
  if (!xs.length) return null;
  const x0 = Math.min(...xs) - MARGIN, y0 = Math.min(...ys) - MARGIN;
  const w = Math.max(...xs) + MARGIN - x0, h = Math.max(...ys) + MARGIN - y0;
  const body = letteringRings(l, -x0, -y0).map((p) => `<path data-role="${p.role}" ${CUT} fill-rule="evenodd" d="${p.d}"/>`).join("\n");
  return svgDoc(w, h, body, `${b.name} lettering — ${l.finishLabel}; ${n(w - 2 * MARGIN)} x ${n(h - 2 * MARGIN)} mm ink, 1:1 (beta: verify with your producer)`);
}

/** Where the lettering goes on the board: outline in grey, lettering in black. Reference, not a cut file. */
export function placementSvg(b: BoardSpec): string | null {
  const l = b.lettering;
  if (!l) return null;
  const letters = letteringRings(l, 0, 0).map((p) => `<path fill="#111" fill-rule="evenodd" d="${p.d}"/>`).join("\n");
  const centre = `<path d="M${n(l.centreXMm - 15)},${n(l.centreYMm)}H${n(l.centreXMm + 15)}M${n(l.centreXMm)},${n(l.centreYMm - 15)}V${n(l.centreYMm + 15)}" stroke="#0A84FF" stroke-width="1"/>`;
  return svgDoc(b.widthMm, b.heightMm, `<path fill="none" stroke="#999" stroke-width="2" d="${boardOutlinePath(b)}"/>\n${letters}\n${centre}`,
    `${b.name} lettering placement — centre ${l.centreXMm} mm from the left edge, ${l.centreYMm} mm from the top (reference only)`);
}

/** A 100 mm square with 10 mm ticks: print or open at 100 %, it must measure 100 mm. */
export function calibrationSvg(): string {
  const ticks = Array.from({ length: 11 }, (_, i) => `M${10 + i * 10},110V${i % 5 ? 114 : 118}`).join("");
  return svgDoc(120, 125, `<path ${CUT} d="M10,10H110V110H10Z"/>\n<path fill="none" stroke="#000" stroke-width="0.25" d="${ticks}"/>`,
    "Calibration: the red square is exactly 100 x 100 mm, ticks every 10 mm");
}
