/**
 * Central dimension config — the source of truth for all production sizes.
 *
 * Customer Approval Preview and production exports are generated from scene state.
 * AI render is NOT the source of truth.
 */

export const ARCH_DIMS = {
  small:  { label: "Small",            widthCm: 80,  heightCm: 180, ftLabel: "2.6 x 5.9 ft" },
  medium: { label: "Medium / Standard",widthCm: 100, heightCm: 200, ftLabel: "3.3 x 6.6 ft" },
  large:  { label: "Large",            widthCm: 120, heightCm: 220, ftLabel: "4.0 x 7.2 ft" },
} as const;

export const RECT_DIMS = {
  rect_100x200: { label: "100 × 200 cm", widthCm: 100, heightCm: 200 },
  rect_80x180:  { label: "80 × 180 cm",  widthCm: 80,  heightCm: 180 },
} as const;

export const PLINTH_DIMS = {
  // Real product sizes (2026-09-03): the three cylinders are L/XL/XXL and
  // get narrower as they get shorter — 33/36/40cm diameters, not a flat 40.
  small:  { label: "L",   diameterCm: 33, heightCm: 60 },
  medium: { label: "XL",  diameterCm: 36, heightCm: 75 },
  large:  { label: "XXL", diameterCm: 40, heightCm: 90 },
  xl:     { label: "XL",     diameterCm: 40, heightCm: 120 },
} as const;

export type ArchDimKey  = keyof typeof ARCH_DIMS;
export type RectDimKey  = keyof typeof RECT_DIMS;
export type PlinthDimKey = keyof typeof PLINTH_DIMS;

/** Maps legacy arch sizeIds (arch_4ft … arch_72ft) to the nearest new ID. */
const LEGACY_ARCH_MAP: Record<string, ArchDimKey> = {
  arch_4ft:  "small",
  arch_5ft:  "small",
  arch_6ft:  "small",
  arch_66ft: "medium",
  arch_72ft: "large",
};

export function normalizeArchSizeId(sizeId: string): ArchDimKey {
  if (sizeId in ARCH_DIMS)       return sizeId as ArchDimKey;
  if (sizeId in LEGACY_ARCH_MAP) return LEGACY_ARCH_MAP[sizeId];
  return "medium"; // safe fallback
}

/** Resolve production width/height for any panel type + sizeId. */
export function getPanelDimensions(
  type: string,
  sizeId?: string,
): { widthCm: number; heightCm: number } {
  if (type === "arch" && sizeId) {
    return ARCH_DIMS[normalizeArchSizeId(sizeId)];
  }
  if (type === "rect" && sizeId && sizeId in RECT_DIMS) {
    return RECT_DIMS[sizeId as RectDimKey];
  }
  // Defaults for unsized types
  if (type === "round")        return { widthCm: 200, heightCm: 200 };
  if (type === "shimmer_wall") return { widthCm: 200, heightCm: 200 };
  if (type === "wavy")         return { widthCm: 100, heightCm: 200 };
  return { widthCm: 100, heightCm: 200 };
}

/**
 * Resolve plinth production dimensions.
 *
 * An id that is not in PLINTH_DIMS falls back to medium, which is 75cm x 36cm.
 * That fallback is silent, so a bad id anywhere upstream looks exactly like a
 * deliberate XL selection (2026-09-03: a plinth reported as the wrong size had
 * precisely those dimensions). It still falls back rather than throwing — a
 * render must not fail over this — but it now says so in the server log, and
 * resolvePlinthSize below lets callers report what actually happened.
 */
export function getPlinthDimensions(size: string): { diameterCm: number; heightCm: number } {
  if (size in PLINTH_DIMS) return PLINTH_DIMS[size as PlinthDimKey];
  console.warn(`[layoutDimensions] unknown plinth size "${size}" — falling back to medium (75cm x 36cm)`);
  return PLINTH_DIMS.medium;
}

/** Same lookup, plus whether the id was recognised. For diagnostics. */
export function resolvePlinthSize(size: string): {
  diameterCm: number; heightCm: number; recognised: boolean;
} {
  const recognised = size in PLINTH_DIMS;
  const dims = recognised ? PLINTH_DIMS[size as PlinthDimKey] : PLINTH_DIMS.medium;
  return { ...dims, recognised };
}
