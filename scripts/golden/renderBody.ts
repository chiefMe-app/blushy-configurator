// The body components/SetupPreview.tsx runFirstGenerate() POSTs to
// /api/generate-controlled-render, built from a BuilderConfig. The two hashes
// it also sends (currentSceneHash, structureHash) come from functions private
// to SetupPreview; they only key the cache and are left out here and in the
// parity comparison.
import { buildSceneModel } from "@/lib/buildSceneModel";
import { calculateRenderAspectRatio } from "@/lib/calculateRenderAspectRatio";
import type { BuilderConfig } from "@/lib/config";

export function renderBody(config: BuilderConfig) {
  const d = config.decor;
  return {
    promptInput: {
      theme: config.theme,
      package: config.package,
      eventType: config.eventType,
      backdropItems: d.backdropItems,
      backdropColor: d.backdropColor,
      balloonStyle: d.balloonStyle,
      balloonColors: d.balloonColors,
      shimmerColor: d.shimmerColor,
      backdropText: d.backdropText,
      backdropPrint: d.backdropPrint,
      cutouts: d.cutouts,
      plinthSizes: d.plinthSizes,
    },
    sceneModel: buildSceneModel(config),
    renderAspectRatio: calculateRenderAspectRatio(d.backdropItems).falImageSize,
    renderMode: "first_generate",
    force: true,
    sempertexSelection: d.sempertexSelection ?? [],
  };
}

/** A body as JSON would carry it (undefined dropped), minus the cache hashes. */
export function comparableBody(body: Record<string, unknown>) {
  const { currentSceneHash: _a, structureHash: _b, ...rest } = body;
  return JSON.parse(JSON.stringify(rest));
}
