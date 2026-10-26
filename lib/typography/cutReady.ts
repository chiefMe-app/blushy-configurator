// Cut-ready contours for a lettering layout (Typography System, T2). Glyph
// outlines overlap — joined script letters, and the overlapping contours of
// variable fonts — so each element is merged into clean outer shapes with
// their holes. Curves are flattened to within 0.05 mm. The input is the same
// glyph list the preview and production SVG draw, so the cut file matches
// them. No production-weight offset is applied (only with a producer's
// approval, and then in the preview too).
import polygonClipping, { type MultiPolygon } from "polygon-clipping";
import { flatten as flattenPath, ringArea, type Ring } from "./geometry";
import type { LetteringLayout } from "./layout";

export const CUT_TOLERANCE_MM = 0.05;
const MIN_PIECE_MM2 = 0.01;

/** Path to closed rings, flattened to the cut tolerance. */
export const flatten = (d: string, tol = CUT_TOLERANCE_MM): Ring[] => flattenPath(d, tol);
export { ringArea };

/** One glyph's filled area: rings wound like its largest ring are filled, the others are holes. */
function glyphShape(d: string): MultiPolygon {
  const rings = flatten(d);
  if (!rings.length) return [];
  const areas = rings.map(ringArea);
  const outerSign = Math.sign(areas.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0));
  const fills = rings.filter((_, i) => Math.sign(areas[i]) === outerSign).map((r) => [r]);
  const holes = rings.filter((_, i) => Math.sign(areas[i]) !== outerSign).map((r) => [r]);
  if (!fills.length) return [];
  const filled = polygonClipping.union(fills[0], ...fills.slice(1));
  return holes.length ? polygonClipping.difference(filled, ...holes) : filled;
}

export interface CutElement {
  role: "heading" | "name";
  polygons: MultiPolygon;
  /** Separate solid pieces (a joined script word can be one). */
  pieces: number;
  holes: number;
  areaMm2: number;
  /** Zero-area leftovers of the union that were dropped. */
  slivers: number;
  /** Even-odd path of the merged outline, mm. */
  d: string;
}

export function cutElements(layout: LetteringLayout): CutElement[] {
  return layout.elements.map((e) => {
    const shapes = e.glyphs.map(glyphShape).filter((g) => g.length);
    // Union leaves zero-area slivers where edges meet exactly; they are not
    // parts of a letter and would be stray cuts, so they are dropped.
    const all = shapes.length ? polygonClipping.union(shapes[0], ...shapes.slice(1)) : [];
    const net = (poly: MultiPolygon[number]) => Math.abs(ringArea(poly[0])) - poly.slice(1).reduce((h, r) => h + Math.abs(ringArea(r)), 0);
    const merged = all.filter((poly) => net(poly) >= MIN_PIECE_MM2);
    const areaMm2 = merged.reduce((a, poly) => a + Math.abs(ringArea(poly[0])) - poly.slice(1).reduce((h, r) => h + Math.abs(ringArea(r)), 0), 0);
    const d = merged.map((poly) => poly.map((r) => `M${r.map((p) => `${+p[0].toFixed(3)},${+p[1].toFixed(3)}`).join("L")}Z`).join("")).join("");
    return { role: e.role, polygons: merged, pieces: merged.length, holes: merged.reduce((h, p) => h + p.length - 1, 0), areaMm2: +areaMm2.toFixed(2), slivers: all.length - merged.length, d };
  });
}

/** 1:1 cut file: merged outlines, mm, even-odd fill. */
export function cutSvg(layout: LetteringLayout): string {
  const { widthMm: w, heightMm: h } = layout.box;
  const paths = cutElements(layout).map((c) => `<path data-role="${c.role}" fill-rule="evenodd" d="${c.d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${+w.toFixed(3)}mm" height="${+h.toFixed(3)}mm" viewBox="0 0 ${+w.toFixed(3)} ${+h.toFixed(3)}">${paths}</svg>`;
}
