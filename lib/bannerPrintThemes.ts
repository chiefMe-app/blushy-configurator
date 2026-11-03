// The themes whose banner is printed with their own artwork: the live sketch
// shows /design/sketch/banner-print-<theme>.webp, the render's guide draws the
// same picture (lib/generateStructureSilhouette.ts). Frozen's is the customer's
// castle print; Unicorn's (2026-11-01) came from scripts/themes/theme-art.mjs.
// Kept apart from the pictures themselves so the builder never bundles them.
export const BANNER_PRINT_THEMES = ["frozen", "unicorn"] as const;

/** The theme whose print a banner graphic carries, by its asset id ("unicorn-02" → "unicorn"), or null. */
export function bannerPrintTheme(assetId: unknown): string | null {
  const theme = String(assetId ?? "").replace(/-\d+$/, "");
  return (BANNER_PRINT_THEMES as readonly string[]).includes(theme) ? theme : null;
}

// A theme graphic's own picture (2026-11-03, the owner: "add graphic çalışmıyor"): one cut-out motif per preset
// (lib/themeCatalog.ts graphicPresets), made by scripts/themes/theme-art.mjs, at /design/graphics/<assetId>.webp.
const GRAPHIC_ART = new Set(["unicorn-01", "unicorn-02", "unicorn-03", "frozen-01", "frozen-02", "frozen-03"]);

/** The picture a theme graphic is printed with, by its asset id, or null (a theme with no art yet). */
export function themeGraphicArt(assetId: unknown): string | null {
  const id = String(assetId ?? "");
  return GRAPHIC_ART.has(id) ? `/design/graphics/${id}.webp` : null;
}
