/**
 * Central dimension config — the source of truth for all production sizes.
 *
 * Customer Approval Preview and production exports are generated from scene state.
 * AI render is NOT the source of truth.
 */

export const ARCH_DIMS = {
  arch_4ft:  { label: "4FT / 1.2M",   widthCm: 60,  heightCm: 120 },
  arch_5ft:  { label: "5FT / 1.5M",   widthCm: 75,  heightCm: 150 },
  arch_6ft:  { label: "6FT / 1.8M",   widthCm: 90,  heightCm: 180 },
  arch_66ft: { label: "6.6FT / 2M",   widthCm: 100, heightCm: 200 },
  arch_72ft: { label: "7.2FT / 2.2M", widthCm: 110, heightCm: 220 },
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

/** Resolve production width/height for any panel type + sizeId. */
export function getPanelDimensions(
  type: string,
  sizeId?: string,
): { widthCm: number; heightCm: number } {
  if (type === "arch" && sizeId && sizeId in ARCH_DIMS) {
    return ARCH_DIMS[sizeId as ArchDimKey];
  }
  if (type === "rect" && sizeId && sizeId in RECT_DIMS) {
    return RECT_DIMS[sizeId as RectDimKey];
  }
  // Defaults for unsized types
  if (type === "round")        return { widthCm: 120, heightCm: 120 };
  if (type === "shimmer_wall") return { widthCm: 80,  heightCm: 210 };
  if (type === "wavy")         return { widthCm: 100, heightCm: 200 };
  return { widthCm: 100, heightCm: 200 };
}

/** Resolve plinth production dimensions. */
export function getPlinthDimensions(size: string): { diameterCm: number; heightCm: number } {
  if (size in PLINTH_DIMS) return PLINTH_DIMS[size as PlinthDimKey];
  return PLINTH_DIMS.medium;
}
