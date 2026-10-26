// Shapes one line of lettering into outlines in millimetres (Typography
// System, T2). HarfBuzz does the shaping — ligatures, contextual forms,
// kerning and the registry's always-on features — the way browsers do.
// Coordinates are y-down with the baseline at y = 0 and the pen starting at
// x = 0, so a caller only translates them.
import * as hb from "harfbuzzjs";
import type { LoadedFont } from "./fontLoader";
import { EMPTY_BOX, pathBox, unionBox, type Box } from "./geometry";

export type { Box };

export interface ShapedLine {
  /** One SVG path per glyph (mm, y-down, baseline 0). */
  glyphs: string[];
  advanceMm: number;
  /** Tight ink box, measured on the drawn curves, mm. */
  ink: Box;
  /** Characters the font has no glyph for (reported, never substituted). */
  missing: string;
}

/** Ordinal suffixes ("1st", "22nd") are set smaller and raised. */
const ORDINAL = /(\d)(st|nd|rd|th)(?![A-Za-z])/g;
const SUFFIX_SCALE = 0.6;
const SUFFIX_RAISE = 0.42; // of the cap height

const f3 = (v: number) => (Math.round(v * 1000) / 1000).toString();

function segments(text: string): { text: string; suffix: boolean }[] {
  const out: { text: string; suffix: boolean }[] = [];
  let last = 0;
  for (const m of Array.from(text.matchAll(ORDINAL))) {
    const at = m.index! + 1; // after the digit
    out.push({ text: text.slice(last, at), suffix: false });
    out.push({ text: m[2], suffix: true });
    last = at + m[2].length;
  }
  out.push({ text: text.slice(last), suffix: false });
  return out.filter((s) => s.text.length > 0);
}

export function shapeLine(lf: LoadedFont, text: string, fontSizeMm: number): ShapedLine {
  const glyphs: string[] = [];
  let ink: Box = { ...EMPTY_BOX };
  const missing = new Set<string>();
  for (const ch of Array.from(text)) if (ch.trim() && !lf.has(ch.codePointAt(0)!)) missing.add(ch);

  let pen = 0; // mm
  for (const seg of segments(text)) {
    const size = seg.suffix ? fontSizeMm * SUFFIX_SCALE : fontSizeMm;
    const shift = seg.suffix ? -lf.capHeightEm * fontSizeMm * SUFFIX_RAISE : 0;
    const s = size / lf.upem;
    const buf = new hb.Buffer();
    buf.addText(seg.text);
    buf.guessSegmentProperties();
    hb.shape(lf.font, buf, lf.features);
    const infos = buf.getGlyphInfos(), pos = buf.getGlyphPositions();
    for (let i = 0; i < infos.length; i++) {
      const gid = infos[i].codepoint;
      const ox = pen + pos[i].xOffset * s, oy = shift - pos[i].yOffset * s;
      // Glyph 0 is .notdef — the empty box drawn for a missing letter. It is
      // reported in `missing` and left out, never drawn as a box.
      const cmds = gid === 0 ? [] : lf.font.glyphToJson(gid);
      if (cmds.length) {
        const d = cmds.map((c) => {
          const v: string[] = [];
          for (let k = 0; k < c.values.length; k += 2) v.push(`${f3(ox + c.values[k] * s)},${f3(oy - c.values[k + 1] * s)}`);
          return c.type + v.join(" ");
        }).join("");
        glyphs.push(d);
        ink = unionBox(ink, pathBox(d));
      }
      pen += pos[i].xAdvance * s;
    }
  }
  if (!Number.isFinite(ink.x0)) ink = { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { glyphs, advanceMm: pen, ink, missing: Array.from(missing).join("") };
}
