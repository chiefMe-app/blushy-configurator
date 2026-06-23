/**
 * Calculates the optimal AI render aspect ratio from the selected backdrop setup.
 *
 * Uses real-world panel dimensions (widthCm, heightCm) so the fal.ai image_size
 * matches the actual proportions of the setup — preventing narrow arches from
 * being rendered inside a wide landscape container.
 */

import type { BackdropItem } from "./config";

/** Subset of fal.ai image_size values used for render aspect ratio control. */
export type FalImageSize =
  | "portrait_16_9"   // 576 × 1024 — ratio ≈ 0.56  (very narrow/tall)
  | "portrait_4_3"    // 768 × 1024 — ratio ≈ 0.75  (medium portrait)
  | "square_hd"       // 1024 × 1024 — ratio = 1.0  (square)
  | "landscape_4_3"   // 1024 × 768  — ratio ≈ 1.33 (standard landscape)
  | "landscape_16_9"; // 1024 × 576  — ratio ≈ 1.78 (wide landscape)

export interface RenderAspectRatio {
  falImageSize:   FalImageSize;
  /** CSS aspect-ratio value, e.g. "9/16", "4/3", "1/1" */
  cssAspectRatio: string;
  totalWidthCm:   number;
  maxHeightCm:    number;
  setupRatio:     number; // totalWidthCm / maxHeightCm
}

const CSS_RATIOS: Record<FalImageSize, string> = {
  portrait_16_9:  "9/16",
  portrait_4_3:   "3/4",
  square_hd:      "1/1",
  landscape_4_3:  "4/3",
  landscape_16_9: "16/9",
};

/**
 * Derive the render aspect ratio from selected backdrop panels.
 *
 * Total setup width  = sum of all panel widths + gaps between panels
 * Total setup height = tallest selected panel
 *
 * Mapping (width / height ratio → fal image_size):
 *   < 0.65  → portrait_16_9  (single narrow arch, e.g. 100×200)
 *   < 0.90  → portrait_4_3   (slightly wider portrait)
 *   < 1.15  → square_hd      (roughly square multi-panel)
 *   < 1.55  → landscape_4_3  (standard multi-panel landscape)
 *   ≥ 1.55  → landscape_16_9 (very wide three-panel)
 */
export function calculateRenderAspectRatio(
  backdropItems: BackdropItem[],
  panelGapCm    = 15,
): RenderAspectRatio {
  const defaults: RenderAspectRatio = {
    falImageSize:   "landscape_4_3",
    cssAspectRatio: "4/3",
    totalWidthCm:   133,
    maxHeightCm:    100,
    setupRatio:     1.33,
  };

  if (!backdropItems || backdropItems.length === 0) return defaults;

  const totalWidthCm =
    backdropItems.reduce((sum, item) => sum + (item.widthCm || 100), 0) +
    Math.max(0, backdropItems.length - 1) * panelGapCm;

  const maxHeightCm = Math.max(...backdropItems.map((item) => item.heightCm || 200), 1);

  const setupRatio = totalWidthCm / maxHeightCm;

  let falImageSize: FalImageSize;
  if      (setupRatio < 0.65) falImageSize = "portrait_16_9";
  else if (setupRatio < 0.90) falImageSize = "portrait_4_3";
  else if (setupRatio < 1.15) falImageSize = "square_hd";
  else if (setupRatio < 1.55) falImageSize = "landscape_4_3";
  else                         falImageSize = "landscape_16_9";

  return {
    falImageSize,
    cssAspectRatio: CSS_RATIOS[falImageSize],
    totalWidthCm,
    maxHeightCm,
    setupRatio,
  };
}
