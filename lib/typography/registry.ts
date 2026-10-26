// The approved lettering fonts (Typography System, T1). Data only: nothing in
// the app reads this yet. Every entry is SIL OFL 1.1 from google/fonts, vendored
// in assets/fonts/<dir>/ by scripts/typography/fetch-fonts.mjs. Measurements
// (glyph coverage, stroke widths, shaping check) are produced by
// scripts/typography/qualify.mjs into fonts.generated.json — never edited by hand.

export type FontCategory = "signature" | "elegant_serif" | "modern_serif" | "classic" | "playful";

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: "signature", label: "Signature & Handwritten" },
  { id: "elegant_serif", label: "Elegant Serif" },
  { id: "modern_serif", label: "Modern Serif" },
  { id: "classic", label: "Classic" },
  { id: "playful", label: "Playful" },
];

export interface FontWeight {
  weight: number;
  /** File in assets/fonts/<dir>/. */
  file: string;
  /** Axis values for a variable file ("max" = the axis maximum). */
  axes?: Record<string, number | "max">;
}

/**
 * Optical-size versions of a variable font. The default keeps the face's
 * intended look; another version is offered only as an option the customer
 * previews and confirms (e.g. when a production method needs sturdier
 * strokes) — never applied on its own.
 */
export interface OpticalVariant {
  id: string;
  label: string;
  opsz: number | "max";
  default?: boolean;
}

export interface RegistryFont {
  id: string;
  family: string;
  dir: string;
  category: FontCategory;
  weights: FontWeight[];
  /** The weight a preset or picker uses unless one is chosen. */
  defaultWeight: number;
  /** Where the font is offered first in the picker; it can still be used for either. */
  bestFor: ("heading" | "name")[];
  /** Short description for the render prompt. */
  promptDescriptor: string;
  /**
   * OpenType features always on, in every renderer (engine, CSS tiles, guide).
   * "lnum": lining figures — the default old-style 1 in "1st" reads as a
   * Turkish dotless ı.
   */
  features?: string[];
  /** Kept so existing designs keep working; not offered in the picker. */
  legacyOnly?: boolean;
  optical?: OpticalVariant[];
}

const one = (file: string): FontWeight[] => [{ weight: 400, file }];
const vf = (file: string, weights: number[], axes: Record<string, number | "max"> = {}): FontWeight[] =>
  weights.map((weight) => ({ weight, file, axes: { ...axes, wght: weight } }));

export const FONTS: RegistryFont[] = [
  // Signature & Handwritten
  { id: "italianno", family: "Italianno", dir: "italianno", category: "signature", weights: one("Italianno-Regular.ttf"), defaultWeight: 400, bestFor: ["name"], promptDescriptor: "an elegant flowing calligraphic script" },
  { id: "whisper", family: "Whisper", dir: "whisper", category: "signature", weights: one("Whisper-Regular.ttf"), defaultWeight: 400, bestFor: ["name"], promptDescriptor: "a delicate thin handwritten signature script" },
  { id: "windsong", family: "WindSong", dir: "windsong", category: "signature", weights: [{ weight: 400, file: "WindSong-Regular.ttf" }, { weight: 500, file: "WindSong-Medium.ttf" }], defaultWeight: 500, bestFor: ["name"], promptDescriptor: "a wide sweeping brush-pen script" },
  { id: "allison", family: "Allison", dir: "allison", category: "signature", weights: one("Allison-Regular.ttf"), defaultWeight: 400, bestFor: ["name"], promptDescriptor: "a soft casual handwritten script" },
  { id: "hurricane", family: "Hurricane", dir: "hurricane", category: "signature", weights: one("Hurricane-Regular.ttf"), defaultWeight: 400, bestFor: ["name"], promptDescriptor: "a bold expressive brush script" },
  { id: "qwitcher-grypen", family: "Qwitcher Grypen", dir: "qwitchergrypen", category: "signature", weights: [{ weight: 400, file: "QwitcherGrypen-Regular.ttf" }, { weight: 700, file: "QwitcherGrypen-Bold.ttf" }], defaultWeight: 700, bestFor: ["name"], promptDescriptor: "a tall narrow handwritten script" },
  { id: "sacramento", family: "Sacramento", dir: "sacramento", category: "signature", weights: one("Sacramento-Regular.ttf"), defaultWeight: 400, bestFor: ["name"], promptDescriptor: "a thin monoline handwritten script" },
  { id: "montecarlo", family: "MonteCarlo", dir: "montecarlo", category: "signature", weights: one("MonteCarlo-Regular.ttf"), defaultWeight: 400, bestFor: ["name"], promptDescriptor: "a classic formal copperplate script" },
  // Elegant Serif
  { id: "bellefair", family: "Bellefair", dir: "bellefair", category: "elegant_serif", weights: one("Bellefair-Regular.ttf"), defaultWeight: 400, bestFor: ["heading"], promptDescriptor: "a light elegant high-contrast serif" },
  { id: "cormorant-garamond", family: "Cormorant Garamond", dir: "cormorantgaramond", category: "elegant_serif", weights: vf("CormorantGaramond[wght].ttf", [400, 500, 600, 700]), features: ["lnum"], defaultWeight: 600, bestFor: ["heading", "name"], promptDescriptor: "a refined classical Garamond serif" },
  { id: "gilda-display", family: "Gilda Display", dir: "gildadisplay", category: "elegant_serif", weights: one("GildaDisplay-Regular.ttf"), defaultWeight: 400, bestFor: ["heading"], promptDescriptor: "a graceful display serif" },
  { id: "eb-garamond", family: "EB Garamond", dir: "ebgaramond", category: "elegant_serif", weights: vf("EBGaramond[wght].ttf", [400, 500]), features: ["lnum"], defaultWeight: 500, bestFor: ["heading"], promptDescriptor: "a traditional book-style Garamond serif" },
  // Modern Serif
  { id: "bodoni-moda", family: "Bodoni Moda", dir: "bodonimoda", category: "modern_serif", weights: vf("BodoniModa[opsz,wght].ttf", [500, 700]), features: ["lnum"], defaultWeight: 700,
    // 2026-10-26: the fine display cut is the default ("Bodoni Moda'nın zarif
    // versiyonunu korumak istiyorum"); its hairlines are under 1% of the cap
    // height, so the sturdier text cut is offered where a method needs it.
    optical: [{ id: "display", label: "Display — fine hairlines", opsz: "max", default: true }, { id: "text", label: "Sturdy — stronger hairlines", opsz: 11 }], bestFor: ["name", "heading"], promptDescriptor: "a bold high-contrast Bodoni editorial serif" },
  { id: "dm-serif-display", family: "DM Serif Display", dir: "dmserifdisplay", category: "modern_serif", weights: one("DMSerifDisplay-Regular.ttf"), defaultWeight: 400, bestFor: ["name", "heading"], promptDescriptor: "a strong contemporary display serif" },
  { id: "gloock", family: "Gloock", dir: "gloock", category: "modern_serif", weights: one("Gloock-Regular.ttf"), defaultWeight: 400, bestFor: ["name"], promptDescriptor: "a heavy high-contrast modern serif" },
  { id: "instrument-serif", family: "Instrument Serif", dir: "instrumentserif", category: "modern_serif", weights: one("InstrumentSerif-Regular.ttf"), defaultWeight: 400, bestFor: ["heading", "name"], promptDescriptor: "a condensed modern editorial serif" },
  { id: "playfair-display", family: "Playfair Display", dir: "playfairdisplay", category: "modern_serif", weights: vf("PlayfairDisplay[wght].ttf", [400, 500, 700]), features: ["lnum"], defaultWeight: 700, bestFor: ["name", "heading"], promptDescriptor: "a bold transitional Playfair serif" },
  // Classic
  { id: "libre-caslon-text", family: "Libre Caslon Text", dir: "librecaslontext", category: "classic", weights: vf("LibreCaslonText[wght].ttf", [400, 700]), defaultWeight: 400, bestFor: ["heading"], promptDescriptor: "a classic Caslon book serif" },
  { id: "libre-caslon-display", family: "Libre Caslon Display", dir: "librecaslondisplay", category: "classic", weights: one("LibreCaslonDisplay-Regular.ttf"), defaultWeight: 400, bestFor: ["heading"], promptDescriptor: "a fine classic Caslon display serif" },
  { id: "libre-baskerville", family: "Libre Baskerville", dir: "librebaskerville", category: "classic", weights: vf("LibreBaskerville[wght].ttf", [400, 700]), defaultWeight: 400, bestFor: ["heading"], promptDescriptor: "a classic Baskerville serif" },
  { id: "marcellus", family: "Marcellus", dir: "marcellus", category: "classic", weights: one("Marcellus-Regular.ttf"), defaultWeight: 400, bestFor: ["heading"], promptDescriptor: "a flared Roman inscription serif" },
  // Playful
  // opsz 24: at the display maximum Fraunces' hairlines fall to ~1% of the cap height.
  { id: "fraunces", family: "Fraunces", dir: "fraunces", category: "playful", weights: vf("Fraunces[SOFT,WONK,opsz,wght].ttf", [600], { opsz: 24 }), defaultWeight: 600, bestFor: ["heading", "name"], promptDescriptor: "a soft chunky old-style display serif" },
  { id: "young-serif", family: "Young Serif", dir: "youngserif", category: "playful", weights: one("YoungSerif-Regular.ttf"), defaultWeight: 400, bestFor: ["heading", "name"], promptDescriptor: "a friendly rounded heavy serif" },
  { id: "birthstone-bounce", family: "Birthstone Bounce", dir: "birthstonebounce", category: "playful", weights: [{ weight: 400, file: "BirthstoneBounce-Regular.ttf" }, { weight: 500, file: "BirthstoneBounce-Medium.ttf" }], defaultWeight: 500, bestFor: ["name"], promptDescriptor: "a bouncy playful handwritten script" },
  // Kept for existing designs only (today's "Bold" lettering).
  { id: "archivo-black", family: "Archivo Black", dir: "archivoblack", category: "modern_serif", weights: one("ArchivoBlack-Regular.ttf"), defaultWeight: 400, bestFor: ["heading"], promptDescriptor: "a bold heavy sans-serif", legacyOnly: true },
];

export const fontById = (id: string) => FONTS.find((f) => f.id === id);

/** One measurable/renderable version of a font: a weight, plus an optical version if it has them. */
export interface FontVariant {
  font: RegistryFont;
  weight: FontWeight;
  optical?: OpticalVariant;
  /** "700", or "700/text" for a non-default optical version. */
  key: string;
  axes: Record<string, number | "max">;
}

export function variantKey(weight: number, opticalId?: string, font?: RegistryFont): string {
  const def = font?.optical?.find((o) => o.default)?.id;
  return opticalId && opticalId !== def ? `${weight}/${opticalId}` : String(weight);
}

export function fontVariants(f: RegistryFont): FontVariant[] {
  return f.weights.flatMap((w) => (f.optical ?? [undefined]).map((o) => ({
    font: f, weight: w, optical: o,
    key: variantKey(w.weight, o?.id, f),
    axes: { ...(w.axes ?? {}), ...(o ? { opsz: o.opsz } : {}) },
  })));
}

/** CSS family of a variant's web font (public/fonts/typography/fonts.css). */
export function cssFamily(v: Pick<FontVariant, "font" | "optical">): string {
  const def = v.font.optical?.find((o) => o.default)?.id;
  return `PM ${v.font.family}${v.optical && v.optical.id !== def ? ` ${v.optical.id}` : ""}`;
}

/** Web font file of a variant, in public/fonts/typography/. */
export function webFontFile(v: Pick<FontVariant, "font" | "weight" | "key">): string {
  return `${v.font.id}-${v.key.replace("/", "-")}.woff2`;
}

export function resolveVariant(fontId: string, weight: number, opticalId?: string): FontVariant | undefined {
  const f = fontById(fontId);
  if (!f) return undefined;
  const key = variantKey(weight, opticalId ?? f.optical?.find((o) => o.default)?.id, f);
  return fontVariants(f).find((v) => v.key === key);
}

/** Fonts the picker offers (legacy-only ones stay out of it). */
export const PICKER_FONTS = FONTS.filter((f) => !f.legacyOnly);
