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
