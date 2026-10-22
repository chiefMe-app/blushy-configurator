// Lettering for the layout guide, drawn as SVG paths from embedded fonts.
//
// The guide is rasterised by sharp, and on Vercel the runtime has no fonts:
// every <text> element came out as a row of empty boxes, which the render
// model then copied onto the backdrop as "□□□□□" (2026-10-20). Paths do not
// depend on what is installed, so the guide looks the same on every machine.
import { parse, type Font } from "opentype.js";
import { GUIDE_FONT_DATA } from "./guideFontData";

export type GuideFontStyle = "script" | "block" | "elegant";
type FaceKey = keyof typeof GUIDE_FONT_DATA;

const cache = new Map<FaceKey, Font>();

function face(key: FaceKey): Font {
  let f = cache.get(key);
  if (!f) {
    const buf = Buffer.from(GUIDE_FONT_DATA[key], "base64");
    f = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    cache.set(key, f);
  }
  return f;
}

// 2026-10-22: "script" lines are set in Brittany Signature, the customer's
// chosen face. It has no Turkish Ğ İ Ş ğ ı ş, so a line needing any letter
// it lacks is set whole in Sacramento instead — mixing faces inside a word
// looks broken.
function fontFor(style: string, text: string): Font {
  if (style === "block" || style === "elegant") return face(style);
  const sig = face("signature");
  const covered = Array.from(text).every((ch) => ch === " " || sig.charToGlyph(ch).index !== 0);
  return covered ? sig : face("script");
}

/** Path data for one line of text, with the baseline at y. */
export function textPathD(
  text: string, style: string, x: number, y: number, size: number,
  anchor: "start" | "middle" = "middle",
): string {
  const f = fontFor(style, text);
  const left = anchor === "middle" ? x - f.getAdvanceWidth(text, size) / 2 : x;
  return f.getPath(text, left, y, size).toPathData(2);
}

/** Advance width of one line of text at the given size. */
export function textAdvance(text: string, style: string, size: number): number {
  return fontFor(style, text).getAdvanceWidth(text, size);
}
