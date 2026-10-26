// SVG output of a lettering layout (Typography System, T2). The preview and
// the production file are built from the same path list (`letteringPaths`):
// the only difference is the outer size — millimetres for production, pixels
// for the preview — so what the customer sees is exactly what is produced.
import type { LetteringLayout } from "./layout";

export interface LetteringPath {
  role: "heading" | "name";
  d: string;
  fill: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const r3 = (v: number) => +v.toFixed(3);

/** The one list of drawn paths (box coordinates, mm). */
export function letteringPaths(layout: LetteringLayout, defaultFill = "#15182E"): LetteringPath[] {
  return layout.elements.map((e) => ({ role: e.role, d: e.glyphs.join(""), fill: e.input.color ?? defaultFill }));
}

function body(layout: LetteringLayout, defaultFill: string): string {
  return letteringPaths(layout, defaultFill)
    .map((p) => `<path data-role="${p.role}" d="${p.d}" fill="${esc(p.fill)}"/>`)
    .join("");
}

/** 1:1 production SVG: width and height in mm, viewBox in mm. */
export function productionSvg(layout: LetteringLayout, defaultFill = "#000000"): string {
  const { widthMm: w, heightMm: h } = layout.box;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(w)}mm" height="${r3(h)}mm" viewBox="0 0 ${r3(w)} ${r3(h)}">${body(layout, defaultFill)}</svg>`;
}

/** Preview SVG at a pixel scale — same paths, same viewBox, only the outer size differs. */
export function previewSvg(layout: LetteringLayout, pxPerMm: number, defaultFill = "#15182E"): string {
  const { widthMm: w, heightMm: h } = layout.box;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * pxPerMm)}" height="${Math.round(h * pxPerMm)}" viewBox="0 0 ${r3(w)} ${r3(h)}">${body(layout, defaultFill)}</svg>`;
}
