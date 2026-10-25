// How today's code reads lettering: the line split, the size scale, and the
// guide face each text is drawn in (including the fallback for letters the
// script face lacks). T0 and the typography steps are measured against this.
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { parse } from "opentype.js";
import { messageLines, resolveBackdropText, textSizeScale, TEXT_SIZES, FONT_STYLES } from "@/lib/config";
import { textAdvance, textPathD } from "@/lib/guideFonts";
import { GUIDE_FONT_DATA } from "@/lib/guideFontData";
import { LEGACY_TEXTS } from "../fixtures/legacyTexts";
import { FIXTURES } from "../fixtures/configs";

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

// Which embedded face a "script" line is drawn in — mirrors fontFor() in
// lib/guideFonts.ts, which is not exported.
const faceNames = Object.keys(GUIDE_FONT_DATA);
function scriptFace(text: string): string {
  if (!faceNames.includes("signature")) return "script";
  const buf = Buffer.from(GUIDE_FONT_DATA["signature" as keyof typeof GUIDE_FONT_DATA], "base64");
  const sig = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return Array.from(text).every((ch) => ch === " " || sig.charToGlyph(ch).index !== 0) ? "signature" : "script";
}

describe("lettering golden", () => {
  it("guide faces, sizes and font styles on offer", () => {
    expect({ faces: faceNames, sizes: TEXT_SIZES, styles: FONT_STYLES, defaultScale: textSizeScale(undefined) }).toMatchSnapshot();
  });

  LEGACY_TEXTS.forEach((t, i) => {
    it(`text ${String(i).padStart(2, "0")} ${JSON.stringify(t.text)}`, () => {
      const lines = messageLines(t.text);
      const drawn = (lines ?? [t.text.trim()]).filter(Boolean);
      expect({
        group: t.group,
        messageLines: lines,
        scriptFace: drawn.map(scriptFace),
        guide: Object.fromEntries((["script", "elegant", "block"] as const).map((style) => [style, drawn.map((line) => ({
          advance: Math.round(textAdvance(line, style, 100) * 100) / 100,
          path: sha(textPathD(line, style, 500, 500, 100)),
        }))])),
      }).toMatchSnapshot();
    });
  });

  it("legacy decor.backdropText resolves", () => {
    const out = FIXTURES.filter((f) => f.id.startsWith("C")).map((f) => [f.id, resolveBackdropText(f.config.decor.backdropText)]);
    expect(out).toMatchSnapshot();
  });
});
