import type { SempertexSelectionItem } from "./types";

// Render-safe visual label lookup. Unicorn codes are intentionally verbose to defeat
// the model's training-data color biases (e.g. "968" drifts to bronze without the negations).
export const SAFE_VISUAL_LABEL: Record<string, string> = {
  // Frozen palette
  "002": "pure bright white",
  "540": "cool pearl white / light grey-white, not beige, not cream, not ivory, not champagne",
  "537": "soft icy blue / arctic blue",
  "534": "very pale cool lavender, almost white",
  "145": "cool metallic silver-gray, not gold, not bronze, not champagne",
  // Barbie palette
  "174": "soft pastel pink",
  "141": "cool reflective pink",
  "156": "vivid reflective fuchsia",
  "147": "rose-gold pink metallic, not orange, not copper, not bronze",
  // Unicorn palette — strongly worded to prevent drift into orange/teal/gold
  "609": "very soft pastel cotton-candy pink, light baby pink, not coral, not orange, not red",
  "620": "very pale pastel yellow, soft butter yellow, not orange, not gold, not amber",
  "630": "very pale pastel mint green, soft light green, not teal, not turquoise, not blue",
  "005": "pure bright white",
  "968": "soft blush rose-gold pink, pale rosy pink metallic, not copper, not bronze, not orange, not warm gold",
  // Legacy fallback codes
  "806": "cool off-white, not beige, not champagne, not cream",
  "640": "pale icy blue",
  "850": "very pale cool lavender, almost white",
  "981": "cool silver gray, not gold, not bronze, not copper",
  "909": "bright cool pink",
  "912": "vivid cool fuchsia",
};

export function getVisualLabel(c: SempertexSelectionItem): string {
  const cColor = c as SempertexSelectionItem & { renderLabel?: string };
  const code   = String(c.code ?? "");
  return cColor.renderLabel || SAFE_VISUAL_LABEL[code] || `${c.finish} ${c.colorName}`.trim().toLowerCase();
}

// Render-safe POSITIVE-ONLY labels for the positive prompt.
// Avoids color-biasing words (gold, yellow, rose-gold, orange, copper, bronze, rainbow, teal, blue)
// that appear in SAFE_VISUAL_LABEL but can bias AI color generation when placed in positive prompts.
export const HEX_POSITIVE_LABEL: Record<string, string> = {
  "#fbcfe8": "soft baby pink",
  "#fef08a": "pale vanilla cream",
  "#bbf7d0": "pale mint green",
  "#ffffff": "pure white",
  "#fecdd3": "blush pearl pink",
};

/**
 * Returns a positive-only appearance label safe for use in positive prompt wording.
 * Consults HEX_POSITIVE_LABEL first (hex-keyed, no bias words).
 * Falls back to getVisualLabel() with ", not X" qualifiers stripped.
 */
export function getPositiveLabel(c: SempertexSelectionItem): string {
  const hex = String((c as SempertexSelectionItem & { hex?: string }).hex ?? "").toLowerCase();
  if (HEX_POSITIVE_LABEL[hex]) return HEX_POSITIVE_LABEL[hex];
  const full   = getVisualLabel(c);
  const cutAt  = full.search(/,\s*not\s/i);
  return cutAt > 0 ? full.slice(0, cutAt).trim() : full;
}

/** Full formatted label: "CODE: #HEX - PMS xxx - visual description" */
export function renderSafeBalloonLabel(c: SempertexSelectionItem): string {
  const color = c as SempertexSelectionItem & { pms?: string };
  const code  = String(color.code ?? "");
  const hex   = String((color as SempertexSelectionItem & { hex?: string }).hex ?? "");
  const pms   = color.pms ? `PMS ${color.pms}` : "PMS unknown";
  return `${code}: ${hex} - ${pms} - ${getVisualLabel(c)}`;
}
