// Lettering for the layout guide, drawn as SVG paths from embedded fonts.
//
// The guide is rasterised by sharp, and on Vercel the runtime has no fonts:
// every <text> element came out as a row of empty boxes, which the render
// model then copied onto the backdrop as "□□□□□" (2026-10-20). Paths do not
// depend on what is installed, so the guide looks the same on every machine.
import { parse, type Font } from "opentype.js";
import { GUIDE_FONT_DATA } from "./guideFontData";

export type GuideFontStyle = "script" | "block" | "elegant";

const cache = new Map<GuideFontStyle, Font>();

function fontFor(style: string): Font {
  const key: GuideFontStyle = style === "block" || style === "elegant" ? style : "script";
  let f = cache.get(key);
  if (!f) {
    const buf = Buffer.from(GUIDE_FONT_DATA[key], "base64");
    f = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    cache.set(key, f);
  }
  return f;
}

/** Path data for one line of text, with the baseline at y. */
export function textPathD(
  text: string, style: string, x: number, y: number, size: number,
  anchor: "start" | "middle" = "middle",
): string {
  const f = fontFor(style);
  const left = anchor === "middle" ? x - f.getAdvanceWidth(text, size) / 2 : x;
  return f.getPath(text, left, y, size).toPathData(2);
}

/** Advance width of one line of text at the given size. */
export function textAdvance(text: string, style: string, size: number): number {
  return fontFor(style).getAdvanceWidth(text, size);
}
