/**
 * Scene model — the single source of truth for:
 *   - Customer Approval Preview (LiveSetupPreview.tsx canvas)
 *   - AI Inspiration Render prompt (generatePrompt.ts)
 *   - Pricing (computeTotal / priceBreakdown)
 *   - Future production export / finalize
 *
 * Build once from BuilderConfig; pass to any consumer.
 * Do NOT duplicate panel logic in individual consumers.
 */

import type {
  BuilderConfig,
  BackdropItem,
  ThemeId,
  BackdropShapeId,
  BalloonStyleId,
  FontStyle,
  DecorConfig,
  TextColor,
  GraphicStyle,
  PlinthSize,
  CutoutSize,
  CutoutPosition,
  ShimmerColorId,
  NumberLight,
  NeonSign,
} from "./config";
import { getPlinthDimensions } from "./layoutDimensions";
import { normalizeCutouts, normalizeBalloonStyle } from "@/lib/config";

// ---------------------------------------------------------------------------
// Legacy shimmer_wall sanitization
// ---------------------------------------------------------------------------

/**
 * Shimmer wall was removed from the product (2026-07-12) — the recolor
 * pipeline was too unreliable, focus shifted to arch-based designs. Old
 * saved configs/sessions (or a stale client request) can still send a
 * shimmer_wall backdropItem; rather than let a panel type nothing downstream
 * expects to see anymore flow through, remap it in-place to a same-slot arch
 * panel (medium size) so every SceneModel this builds always resolves to a
 * currently-supported layout.
 *
 * Double Arch was removed from the product on 2026-07-13, then restored on
 * 2026-07-18 with simplified balloon behavior (see setupLayoutCatalog.ts).
 * It is a real two-arch-panel layout again, so arch panels are capped at 2
 * (not 1) — a third+ arch panel from a stale/hand-crafted request is still
 * dropped, since no product layout uses more than two.
 *
 * This is the single choke point both buildSceneModel() and
 * buildSceneModelFromItems() route through, so no caller needs its own
 * shimmer_wall or extra-arch handling.
 */
function sanitizeBackdropItems(items: BackdropItem[]): BackdropItem[] {
  // 2026-09-05: shimmer_wall is a supported panel again, so it is no longer
  // remapped to an arch on the way through. The guide and prompt branches for it
  // were never deleted — see the GOLDEN SHIMMER METHOD block in
  // buildLayoutRefEditPrompt — only the way to select one.
  let archCount = 0;
  return items
    .filter((item) => {
      if (item.type !== "arch") return true;
      archCount++;
      return archCount <= 2;
    })
    // 2026-09-08: nothing is printed on an open arch frame — the customer
    // asked for it to offer colour only. The options are hidden in the UI;
    // this makes sure a config saved before that change cannot still send
    // lettering or a graphic through to the render.
    .map((item) =>
      item.type === "open_arch_frame"
        ? {
            ...item,
            text:    { ...item.text, enabled: false },
            graphic: { ...item.graphic, enabled: false },
          }
        : item,
    );
}

// ---------------------------------------------------------------------------
// Scene model types
// ---------------------------------------------------------------------------

export interface ScenePanel {
  /** Stable unique ID from backdropItems */
  id:       string;
  type:     BackdropShapeId;
  sizeId?:  string;
  widthCm:  number;
  heightCm: number;
  /** Resolved color — per-panel color if set, otherwise global backdropColor */
  color:    string;
  /** Selection order (0-indexed) */
  order: number;
  text: {
    enabled:   boolean;
    value:     string;
    fontStyle: FontStyle;
    color:     TextColor;
  };
  graphic: {
    enabled: boolean;
    style:   GraphicStyle;
    source?: "preset" | "custom";
    assetId?: string;
  };
}

export interface SceneBalloons {
  style:  BalloonStyleId;
  /** Resolved palette — per-config colors or theme defaults */
  colors: string[];
}

export interface ScenePlinth {
  idx:        number;
  size:       PlinthSize;
  diameterCm: number;
  heightCm:   number;
}

export type SceneCutouts = DecorConfig["cutouts"];

/**
 * Fully resolved, consumer-ready scene description.
 * All color resolution and fallbacks are applied here.
 * Consumers (preview, AI prompt, export) should NOT re-implement this logic.
 */
export interface SceneModel {
  theme:      ThemeId;
  panels:     ScenePanel[];
  balloons:   SceneBalloons;
  plinths:    ScenePlinth[];
  cutouts:    SceneCutouts;
  /** Florals and greenery worked into the balloon garland. */
  garlandFlorals: boolean;
  /** Illuminated marquee number standing beside the backdrop. */
  numberLight: NumberLight;
  /** Neon LED sign on the backdrop, or in a balloon ring's open centre. */
  neonSign: NeonSign;
  /** Estimated total price in AED — from config.estimatedTotal */
  totalPrice: number;
  /**
   * Shimmer wall color — set when a shimmer_wall panel is in the scene.
   * Null when no shimmer wall is selected. Defaults to "silver" if shimmer wall
   * is present but no color has been chosen (backward compat for old saved state).
   */
  shimmerColor: ShimmerColorId | null;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a fully resolved SceneModel from a BuilderConfig.
 * This is the primary entry point used by the customer-facing preview.
 */
export function buildSceneModel(config: BuilderConfig): SceneModel {
  const d           = config.decor;
  const globalColor = d.backdropColor;

  // Panels: resolve per-item color, falling back to global backdrop color.
  const panels: ScenePanel[] = sanitizeBackdropItems(d.backdropItems)
    .slice(0, 3)
    .map<ScenePanel>((item, i) => ({
      id:       item.id,
      type:     item.type,
      sizeId:   item.sizeId,
      widthCm:  item.widthCm,
      heightCm: item.heightCm,
      color:    item.color || globalColor,
      order:    i,
      text: {
        enabled:   item.text.enabled,
        value:     item.text.value.trim(),
        fontStyle: item.text.fontStyle,
        color:     item.text.color,
      },
      graphic: {
        enabled: item.graphic.enabled,
        style:   item.graphic.style,
        source:  item.graphic.source,
        assetId: item.graphic.assetId,
      },
    }));

  const balloons: SceneBalloons = {
    // Fold retired tiers (half/premium) into the surviving garland so the
    // guide and the prompt never see an id that is no longer sold.
    style:  normalizeBalloonStyle(d.balloonStyle),
    colors: d.balloonColors.length > 0 ? [...d.balloonColors] : [],
  };

  const plinths: ScenePlinth[] = d.plinthSizes
    .slice(0, 3)
    .map<ScenePlinth>((size, i) => {
      const dims = getPlinthDimensions(size);
      return { idx: i, size, diameterCm: dims.diameterCm, heightCm: dims.heightCm };
    });

  const cutouts: SceneCutouts = normalizeCutouts(d.cutouts);

  return {
    theme:        config.theme,
    panels,
    balloons,
    plinths,
    cutouts,
    garlandFlorals: d.garlandFlorals === true,
    numberLight:    d.numberLight ?? { enabled: false, value: "1" },
    // 2026-09-08: the sign never lands on an open arch frame — there is no
    // board face for it to hang on. The option is hidden in the UI; this
    // moves an older saved choice onto the first piece that can carry it.
    neonSign:       (() => {
      const n = d.neonSign ?? { enabled: false, text: "Happy Birthday" };
      const idx = Number.isInteger(n.panelIndex) ? Number(n.panelIndex) : 0;
      if (panels[idx]?.type !== "open_arch_frame") return n;
      const alt = panels.findIndex((p) => p.type !== "open_arch_frame");
      return { ...n, panelIndex: alt < 0 ? 0 : alt };
    })(),
    totalPrice:   config.estimatedTotal,
    // Resolved only when a shimmer wall is actually in the scene; defaults to
    // silver for older saved configs that predate the colour picker.
    shimmerColor: panels.some((p) => p.type === "shimmer_wall")
      ? (d.shimmerColor ?? "silver")
      : null,
  };
}

/**
 * Build a SceneModel from the raw fields that the API route receives.
 * Used by the AI Inspiration Render pipeline so both the preview and
 * the AI prompt are driven from the same resolved scene data.
 */
export function buildSceneModelFromItems(
  theme: ThemeId,
  items: BackdropItem[],
  globalColor: string,
  balloonStyle: BalloonStyleId,
  balloonColors: string[],
  plinthSizes: PlinthSize[],
  cutoutSize: CutoutSize,
  cutoutPosition: CutoutPosition,
): SceneModel {
  const panels: ScenePanel[] = sanitizeBackdropItems(items).slice(0, 3).map<ScenePanel>((item, i) => ({
    id:       item.id,
    type:     item.type,
    sizeId:   item.sizeId,
    widthCm:  item.widthCm,
    heightCm: item.heightCm,
    color:    item.color || globalColor,
    order:    i,
    text: {
      enabled:   item.text.enabled,
      value:     item.text.value.trim(),
      fontStyle: item.text.fontStyle,
      color:     item.text.color,
    },
    graphic: {
      enabled: item.graphic.enabled,
      style:   item.graphic.style,
      source:  item.graphic.source,
      assetId: item.graphic.assetId,
    },
  }));

  const plinths: ScenePlinth[] = plinthSizes.slice(0, 3).map<ScenePlinth>((size, i) => {
    const dims = getPlinthDimensions(size);
    return { idx: i, size, diameterCm: dims.diameterCm, heightCm: dims.heightCm };
  });
  
  const cutouts: SceneCutouts = normalizeCutouts({
  size: cutoutSize,
  position: cutoutPosition,
});

  return {
  theme,
  panels,
  balloons: { style: normalizeBalloonStyle(balloonStyle), colors: balloonColors },
  plinths,
  cutouts,
  garlandFlorals: false,
  numberLight: { enabled: false, value: "1" },
  neonSign: { enabled: false, text: "Happy Birthday" },
  totalPrice: 0,
  shimmerColor: panels.some((p) => p.type === "shimmer_wall") ? "silver" : null,
};
}
