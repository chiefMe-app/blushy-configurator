// What a render depends on (Phase 0.5c): the scene a render was made for, and
// a short key for it. The browser and the render API compute the same key, so
// a stored render (renders/<user id>/<key>.jpg) is known to belong to a design
// exactly when the design's key matches.
import type { BuilderConfig } from "@/lib/config";

/**
 * Stable description of every visual field that affects the Final Design Render.
 * Excludes non-visual fields (customer name, WhatsApp, venue form, package scope).
 * (Moved from components/SetupPreview.tsx, unchanged.)
 */
export function computeSceneHash(config: BuilderConfig): string {
  const d = config.decor;
  return JSON.stringify({
    theme:         config.theme,
    eventType:     config.eventType,
    backdropItems: d.backdropItems.map((i) => ({
      id: i.id, type: i.type, sizeId: i.sizeId,
      widthCm: i.widthCm, heightCm: i.heightCm, color: i.color,
      // text INCLUDED: customized text is baked into the AI render, so a text
      // change must trigger a fresh render (no longer an instant overlay)
      // 2026-10-26: size and the Typography System lettering too — a font or
      // size change must not be answered with the previous render.
      text:    { enabled: i.text.enabled, value: i.text.value.trim(), fontStyle: i.text.fontStyle, color: i.text.color, size: i.text.size, lettering: i.text.lettering },
      graphic: { enabled: i.graphic.enabled, style: i.graphic.style, assetId: i.graphic.assetId },
    })),
    backdropColor: d.backdropColor,
    balloonStyle:  d.balloonStyle,
    balloonColors: d.balloonColors,
    // Shimmer wall color — included so a shimmer-color-only change is treated
    // as a scene change (cache miss) rather than silently reusing the last
    // rendered (wrong-colored) shimmer wall.
    shimmerColor:  d.shimmerColor,
    plinthSizes:   d.plinthSizes,
    backdropPrint: d.backdropPrint,
    cutouts:       d.cutouts,
    cakeTable:     d.cakeTable,
  });
}

/** A short, file-name-safe key for a scene description. */
export function renderKey(sceneHash: string): string {
  let a = 5381, b = 52711;
  for (let i = 0; i < sceneHash.length; i++) {
    const c = sceneHash.charCodeAt(i);
    a = ((a << 5) + a + c) | 0;
    b = ((b << 5) + b + c) | 0;
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36) + sceneHash.length.toString(36);
}

/** The key of the render this design would have. */
export const renderKeyOf = (config: BuilderConfig) => renderKey(computeSceneHash(config));

export const RENDER_BUCKET = "renders";
