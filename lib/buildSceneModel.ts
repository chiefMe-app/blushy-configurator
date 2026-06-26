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
  TextColor,
  GraphicStyle,
  PlinthSize,
  CutoutSize,
  CutoutPosition,
  ShimmerColorId,
} from "./config";
import { getPlinthDimensions } from "./layoutDimensions";

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

export interface SceneCutouts {
  size:     CutoutSize;
  position: CutoutPosition;
}

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
  const panels: ScenePanel[] = d.backdropItems
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
      },
    }));

  const balloons: SceneBalloons = {
    style:  d.balloonStyle,
    colors: d.balloonColors.length > 0 ? [...d.balloonColors] : [],
  };

  const plinths: ScenePlinth[] = d.plinthSizes
    .slice(0, 3)
    .map<ScenePlinth>((size, i) => {
      const dims = getPlinthDimensions(size);
      return { idx: i, size, diameterCm: dims.diameterCm, heightCm: dims.heightCm };
    });

  const cutouts: SceneCutouts = {
    size:     d.cutouts.size,
    position: d.cutouts.position,
  };

  const hasShimmer = d.backdropItems.some((item) => item.type === "shimmer_wall");

  return {
    theme:        config.theme,
    panels,
    balloons,
    plinths,
    cutouts,
    totalPrice:   config.estimatedTotal,
    // Default to "silver" when shimmer wall is present but no color chosen (backward compat)
    shimmerColor: hasShimmer ? (d.shimmerColor ?? "silver") : null,
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
  const panels: ScenePanel[] = items.slice(0, 3).map<ScenePanel>((item, i) => ({
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
    },
  }));

  const plinths: ScenePlinth[] = plinthSizes.slice(0, 3).map<ScenePlinth>((size, i) => {
    const dims = getPlinthDimensions(size);
    return { idx: i, size, diameterCm: dims.diameterCm, heightCm: dims.heightCm };
  });

  return {
    theme,
    panels,
    balloons:     { style: balloonStyle, colors: balloonColors },
    plinths,
    cutouts:      { size: cutoutSize, position: cutoutPosition },
    totalPrice:   0,
    shimmerColor: items.some((i) => i.type === "shimmer_wall") ? "silver" : null,
  };
}
