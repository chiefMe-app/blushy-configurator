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
  small:  { label: "Small",  diameterCm: 40, heightCm: 60 },
  medium: { label: "Medium", diameterCm: 40, heightCm: 75 },
  large:  { label: "Large",  diameterCm: 40, heightCm: 90 },
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
  if (type === "round")        return { widthCm: 120, heightCm: 120 };
  if (type === "shimmer_wall") return { widthCm: 200, heightCm: 200 };
  if (type === "wavy")         return { widthCm: 100, heightCm: 200 };
  return { widthCm: 100, heightCm: 200 };
}

/** Resolve plinth production dimensions. */
export function getPlinthDimensions(size: string): { diameterCm: number; heightCm: number } {
  if (size in PLINTH_DIMS) return PLINTH_DIMS[size as PlinthDimKey];
  return PLINTH_DIMS.medium;
}
