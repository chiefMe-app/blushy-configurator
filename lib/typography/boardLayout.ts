// Board lettering laid out by the real engine (server only: HarfBuzz and the
// vendored fonts). The one entry point for the Builder's live sketch (through
// /api/typography/layout) and the render guide, so both draw the same paths.
//
// Lettering is laid out in a fixed box — the clear face of the 2 m Single
// Round, 1159 x 757 mm, the proportions approved on the typography demo — and
// each drawing scales that box into its own board's clear area.
import { layoutLettering, type LetteringElementInput, type LetteringLayout } from "./layout";
import { presetById } from "./presets";
import { DEMO_BOX, DEMO_NAME_CAP_MM } from "./demo";
import { headingRows } from "./lettering";

export const LETTERING_BOX = DEMO_BOX;

/** A one-row heading over a name: this much larger than the preset's ratio. */
export const HEADING_OVER_NAME = 1.6;

export interface BoardLetteringInput {
  heading?: LetteringElementInput;
  name?: LetteringElementInput;
  presetId?: string;
}

/** The layout of a board's lettering in LETTERING_BOX millimetres. */
export function layoutBoardLettering(input: BoardLetteringInput): LetteringLayout {
  let { heading, name } = input;
  // A lone heading leads, set at the name's size on two rows, "Happy" over "Birthday" (headingRows).
  // 2026-11-05 (the owner: "happy birthday çok küçüldü, isim gelirse happy birthday yanyana olsun"): over a
  // name it stays one row, side by side, and larger than before (the width still caps it).
  if (heading?.text.trim() && !name?.text.trim()) [heading, name] = [undefined, { ...heading, text: headingRows(heading.text).join("\n") }];
  const ratio = (input.presetId ? presetById(input.presetId)?.headingRatio : undefined) ?? 0.42;
  return layoutLettering({
    heading,
    name,
    headingRatio: ratio * HEADING_OVER_NAME,
    box: LETTERING_BOX,
    nameCapMm: DEMO_NAME_CAP_MM,
  });
}

/**
 * The layout's paths placed in another drawing: the box scaled to `widthPx`
 * and centred on (cx, cy). Every path is absolute, so each x,y pair maps on
 * its own.
 */
export function placeLettering(layout: LetteringLayout, widthPx: number, cx: number, cy: number) {
  const s = widthPx / layout.box.widthMm;
  const ox = cx - widthPx / 2, oy = cy - (layout.box.heightMm * s) / 2;
  const map = (d: string) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${+(ox + +x * s).toFixed(2)},${+(oy + +y * s).toFixed(2)}`);
  return layout.elements.map((e) => ({
    role: e.role,
    fontId: e.input.fontId,
    d: map(e.glyphs.join("")),
    fontSizePx: e.fontSizeMm * s,
  }));
}
