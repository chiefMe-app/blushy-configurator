// Lettering presets (Typography System, T1). A preset only suggests the two
// fonts and how big the heading is against the name; once chosen, the heading
// and the name are changed independently and the customer's colour and size
// are kept. #5 Soft Signature is the default for new designs, #9 Modern
// Editorial is featured beside it.

export interface LetteringPreset {
  id: string;
  number: number;
  name: string;
  featured?: boolean;
  default?: boolean;
  headingFont: { fontId: string; weight: number };
  nameFont: { fontId: string; weight: number };
  /** Heading cap height as a share of the name's. */
  headingRatio: number;
}

export const PRESETS: LetteringPreset[] = [
  { id: "soft-signature", number: 5, name: "Soft Signature", featured: true, default: true, headingFont: { fontId: "bellefair", weight: 400 }, nameFont: { fontId: "italianno", weight: 400 }, headingRatio: 0.42 },
  { id: "modern-editorial", number: 9, name: "Modern Editorial", featured: true, headingFont: { fontId: "cormorant-garamond", weight: 600 }, nameFont: { fontId: "bodoni-moda", weight: 700 }, headingRatio: 0.42 },
  { id: "flowing-script", number: 2, name: "Flowing Script", headingFont: { fontId: "libre-caslon-text", weight: 400 }, nameFont: { fontId: "windsong", weight: 500 }, headingRatio: 0.42 },
  { id: "soft-romance", number: 3, name: "Soft Romance", headingFont: { fontId: "gilda-display", weight: 400 }, nameFont: { fontId: "allison", weight: 400 }, headingRatio: 0.42 },
  { id: "whisper-light", number: 4, name: "Whisper Light", headingFont: { fontId: "eb-garamond", weight: 500 }, nameFont: { fontId: "whisper", weight: 400 }, headingRatio: 0.42 },
  { id: "timeless-bold", number: 8, name: "Timeless Bold", headingFont: { fontId: "libre-caslon-text", weight: 400 }, nameFont: { fontId: "playfair-display", weight: 700 }, headingRatio: 0.42 },
  { id: "gallery", number: 12, name: "Gallery", headingFont: { fontId: "instrument-serif", weight: 400 }, nameFont: { fontId: "instrument-serif", weight: 400 }, headingRatio: 0.42 },
  { id: "party-pop", number: 13, name: "Party Pop", headingFont: { fontId: "fraunces", weight: 600 }, nameFont: { fontId: "birthstone-bounce", weight: 500 }, headingRatio: 0.42 },
];

export const DEFAULT_PRESET_ID = "soft-signature";
export const presetById = (id: string) => PRESETS.find((p) => p.id === id);
