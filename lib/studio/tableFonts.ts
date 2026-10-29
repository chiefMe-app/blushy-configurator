// The lettering of the words on the placemats and the bottle labels
// (2026-10-29, the owner: "font opsiyonları da olsun, birkaç tane handwritten
// da olsun, hem placemat hem water bottle'da"): a few faces from the approved
// lettering fonts (lib/typography/registry.ts), the print ones in capitals,
// the handwritten ones as typed. Data only, for the builder and the server.
import { fontById } from "@/lib/typography/registry";

export interface TableFont {
  /** The registry font. */
  id: string;
  name: string;
  weight: number;
  /** Handwritten: set as typed, not in capitals. */
  hand: boolean;
  /** How much bigger it is set to look as big as the others (a script's small letters). */
  scale: number;
  /** The face in words, for the render. */
  words: string;
}

export const TABLE_FONTS: TableFont[] = [
  { id: "playfair-display", name: "Classic", weight: 400, hand: false, scale: 1, words: "an elegant classic serif" },
  { id: "fraunces", name: "Soft", weight: 600, hand: false, scale: 1, words: "a soft chunky old-style serif" },
  { id: "young-serif", name: "Friendly", weight: 400, hand: false, scale: 0.95, words: "a friendly rounded serif" },
  { id: "birthstone-bounce", name: "Bouncy", weight: 500, hand: true, scale: 1.45, words: "a bouncy playful handwritten script" },
  { id: "sacramento", name: "Handwritten", weight: 400, hand: true, scale: 1.5, words: "a thin flowing handwritten script" },
  { id: "italianno", name: "Calligraphy", weight: 400, hand: true, scale: 1.75, words: "an elegant calligraphy script" },
];

export const DEFAULT_TABLE_FONT = TABLE_FONTS[0].id;

export const tableFont = (id: string | undefined) => TABLE_FONTS.find((f) => f.id === id) ?? TABLE_FONTS[0];

/** The words as printed: capitals in a print face, as typed in a handwritten one. */
export const asPrinted = (words: string, font: TableFont) => (font.hand ? words : words.toUpperCase());

/** The face's web font (public/fonts/typography/fonts.css). */
export const fontCss = (font: TableFont) => `"PM ${fontById(font.id)?.family ?? "Playfair Display"}"`;

/** The lettering in words, for the render: "set in an elegant classic serif, all capitals". */
export const fontWords = (font: TableFont) => `set in ${font.words}${font.hand ? "" : ", all capitals"}`;
