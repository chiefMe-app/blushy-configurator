// Lays out a board's lettering in millimetres (Typography System, T2): a
// Heading ("Happy 1st Birthday") over a Name ("Layla"), each with its own text,
// font, weight, optical version, size, offset and colour. The same outlines
// feed the preview, the production SVG and the cut file (svg.ts, cutReady.ts).
//
// Independence: base sizes come from the lettering box only (never from a
// font), each element shrinks only when its own text is too wide, and both sit
// on fixed reference lines. So changing the heading's font does not move or
// resize the name, and the reverse. The one coupling is overlap: if a tall
// script name would touch the heading, the heading moves up just enough, and
// the layout says so (`adjusted`).
import { createHash } from "crypto";
import { textSizeScale, type TextSize } from "../config";
import { assessAllFinishes, type FinishAssessment } from "./check";
import { loadFont } from "./fontLoader";
import type { FinishId } from "./production";
import type { Box } from "./geometry";
import { shapeLine } from "./shape";

export interface LetteringElementInput {
  text: string;
  fontId: string;
  weight: number;
  /** Optical version id; empty = the font's default. */
  optical?: string;
  size?: TextSize;
  /** Shift as a share of the box width (x) and height (y). */
  offset?: { x: number; y: number };
  color?: string;
}

export interface LayoutInput {
  heading?: LetteringElementInput;
  name?: LetteringElementInput;
  /** Heading cap height as a share of the name's (the preset's). Default 0.42. */
  headingRatio?: number;
  /** The clear area the lettering may use, in mm. */
  box: { widthMm: number; heightMm: number };
}

export interface LaidOutElement {
  role: "heading" | "name";
  input: LetteringElementInput;
  fontSizeMm: number;
  capHeightMm: number;
  /** Pen origin of the line in box coordinates (mm, y-down). */
  originMm: { x: number; y: number };
  /** One path per glyph, absolute box coordinates in mm. */
  glyphs: string[];
  ink: Box;
  missing: string;
  /** Moved up to clear the name's ink. */
  adjusted: boolean;
  /** Every production method assessed separately (preliminary, provisional). */
  finishes: Record<FinishId, FinishAssessment>;
}

export interface LetteringLayout {
  box: { widthMm: number; heightMm: number };
  elements: LaidOutElement[];
  ink: Box;
  /** Hash of everything drawn — equal hashes mean identical lettering. */
  hash: string;
}

// Reference proportions, from today's guide (Single Round: a ~0.69 m clear band
// takes a ~90 mm name at Large).
const NAME_CAP_OF_WIDTH = 0.13;
const NAME_CAP_OF_HEIGHT = 0.35;
const FIT = 0.96; // share of the box width a line may fill
const MIN_GAP_OF_NAME_CAP = 0.12;

function translate(d: string, dx: number, dy: number): string {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${+(+x + dx).toFixed(3)},${+(+y + dy).toFixed(3)}`);
}

const moveBox = (b: Box, dx: number, dy: number): Box => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy });

function sized(el: LetteringElementInput, baseCapMm: number, maxWidthMm: number) {
  const lf = loadFont(el.fontId, el.weight, el.optical);
  const unit = shapeLine(lf, el.text, 1);
  const inkW1 = Math.max(1e-6, unit.ink.x1 - unit.ink.x0);
  const capByWidth = (maxWidthMm / inkW1) * lf.capHeightEm;
  const capMm = Math.min(baseCapMm, capByWidth) * textSizeScale(el.size);
  const fontSizeMm = capMm / lf.capHeightEm;
  return { lf, fontSizeMm, capMm, line: shapeLine(lf, el.text, fontSizeMm) };
}

export function layoutLettering(input: LayoutInput): LetteringLayout {
  const { box } = input;
  const ratio = input.headingRatio ?? 0.42;
  const nameBase = Math.min(box.widthMm * NAME_CAP_OF_WIDTH, box.heightMm * NAME_CAP_OF_HEIGHT);
  const headingBase = nameBase * ratio;
  const hasH = !!input.heading?.text.trim(), hasN = !!input.name?.text.trim();

  // Fixed reference lines (depend on the box only).
  const headingBand = hasH ? headingBase * 1.9 : 0;
  const nameBand = hasN ? nameBase * 1.45 : 0;
  const top = (box.heightMm - headingBand - nameBand) / 2;
  const headingBaseline = top + headingBase * 1.3;
  const nameBaseline = top + headingBand + nameBase * 1.1;

  const out: LaidOutElement[] = [];
  const place = (role: "heading" | "name", el: LetteringElementInput, baseCap: number, baseline: number) => {
    const s = sized(el, baseCap, box.widthMm * FIT);
    const off = el.offset ?? { x: 0, y: 0 };
    const x = (box.widthMm - (s.line.ink.x1 + s.line.ink.x0)) / 2 + off.x * box.widthMm;
    const y = baseline + off.y * box.heightMm;
    return { s, x, y };
  };
  const n = hasN ? place("name", input.name!, nameBase, nameBaseline) : null;
  const h = hasH ? place("heading", input.heading!, headingBase, headingBaseline) : null;

  let headingShift = 0;
  if (h && n) {
    const headingBottom = h.y + h.s.line.ink.y1;
    const nameTop = n.y + n.s.line.ink.y0;
    const minGap = MIN_GAP_OF_NAME_CAP * n.s.capMm;
    if (headingBottom + minGap > nameTop) headingShift = nameTop - minGap - headingBottom;
  }
  for (const [role, p, shift] of [["heading", h, headingShift], ["name", n, 0]] as const) {
    if (!p) continue;
    const el = role === "heading" ? input.heading! : input.name!;
    const ox = p.x, oy = p.y + shift;
    out.push({
      role,
      input: el,
      fontSizeMm: +p.s.fontSizeMm.toFixed(3),
      capHeightMm: +p.s.capMm.toFixed(3),
      originMm: { x: +ox.toFixed(3), y: +oy.toFixed(3) },
      glyphs: p.s.line.glyphs.map((d) => translate(d, ox, oy)),
      ink: moveBox(p.s.line.ink, ox, oy),
      missing: p.s.line.missing,
      adjusted: shift !== 0,
      finishes: assessAllFinishes({ fontId: el.fontId, weight: el.weight, optical: el.optical, capHeightMm: p.s.capMm, text: el.text }),
    });
  }
  const ink = out.reduce<Box>((b, e) => ({ x0: Math.min(b.x0, e.ink.x0), y0: Math.min(b.y0, e.ink.y0), x1: Math.max(b.x1, e.ink.x1), y1: Math.max(b.y1, e.ink.y1) }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const hash = createHash("sha256").update(JSON.stringify(out.map((e) => [e.role, e.input, e.glyphs]))).digest("hex");
  return { box, elements: out, ink, hash };
}

/** A neon sign: one line, its own font (independent of the board lettering). */
export function layoutNeon(el: LetteringElementInput, box: { widthMm: number; heightMm: number }): LetteringLayout {
  return layoutLettering({ name: el, box });
}
