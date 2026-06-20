/**
 * Exact layout engine — computes canvas-pixel positions from production dimensions.
 *
 * Customer Approval Preview and production exports are generated from scene state.
 * AI render is NOT the source of truth.
 *
 * All positions are in canvas pixels. Callers pass canvasW/canvasH and receive
 * exact rects for every panel, plinth, and text safe area.
 */

import type { BackdropItem, PlinthSize } from "./config";
import { getPlinthDimensions } from "./layoutDimensions";

export interface PanelLayout {
  idx:         number;
  cx:          number;  // horizontal center (px)
  pw:          number;  // panel width (px)
  apexY:       number;  // topmost point (px)
  floorY:      number;  // floor line (px)
  widthCm:     number;
  heightCm:    number;
  aspectRatio: number;  // widthCm / heightCm — 0.5 for all standard arches
  /** Safe area for text overlays, expressed as % of canvas */
  textSafeArea: { xPct: number; yPct: number; wPct: number; hPct: number };
}

export interface PlinthLayout {
  idx:        number;
  cx:         number;
  bottomY:    number;
  heightPx:   number;
  diameterPx: number;
  size:       PlinthSize;
}

export interface ExactLayout {
  panels:  PanelLayout[];
  plinths: PlinthLayout[];
  floorY:  number;
  canvasW: number;
  canvasH: number;
}

/** Horizontal center positions for plinths (% of canvas width). */
const PLINTH_X_PCT: Record<number, number[]> = {
  1: [0.50],
  2: [0.35, 0.65],
  3: [0.25, 0.50, 0.75],
};

export function calculateExactLayout(
  items:       BackdropItem[],
  plinthSizes: PlinthSize[],
  canvasW:     number,
  canvasH:     number,
): ExactLayout {
  const count   = Math.max(1, Math.min(3, items.length));
  const slotW   = canvasW / count;
  const floorY  = canvasH * 0.9;

  const maxHeightCm = Math.max(...items.map(it => it.heightCm ?? 200), 1);

  // --- Panels ---
  const panels: PanelLayout[] = [];

  for (let i = 0; i < count; i++) {
    const item = items[i] ?? items[0];
    const cx   = slotW * (i + 0.5);

    const wCm = item?.widthCm  ?? 100;
    const hCm = item?.heightCm ?? 200;

    // Taller panels reach higher up the canvas
    const heightRatio  = hCm / maxHeightCm;
    const apexFactor   = 0.05 + 0.12 * (1 - heightRatio);
    const apexY        = canvasH * apexFactor;
    const panelHeightPx = floorY - apexY;

    // True aspect ratio — arch_66ft = 100/200 = 0.5 (narrow portrait)
    const aspect      = wCm / hCm;
    const intrinsicPw = panelHeightPx * aspect;
    const pw          = Math.max(slotW * 0.22, Math.min(slotW * 0.80, intrinsicPw));

    // Text safe area as % of full canvas
    const safeXPct = ((cx - pw / 2) / canvasW) * 100;
    const safeYPct = (apexY / canvasH) * 100;
    const safeWPct = (pw / canvasW) * 100;
    const safeHPct = ((floorY - apexY) / canvasH) * 100 * 0.7; // upper 70% of panel

    panels.push({
      idx: i, cx, pw, apexY, floorY,
      widthCm: wCm, heightCm: hCm,
      aspectRatio: aspect,
      textSafeArea: { xPct: safeXPct, yPct: safeYPct, wPct: safeWPct, hPct: safeHPct },
    });
  }

  // --- Plinths ---
  const plinthCount = Math.min(3, plinthSizes.length);
  const plinthXPcts = PLINTH_X_PCT[plinthCount] ?? [0.5];

  // Derive px-per-cm from the tallest panel
  const refPanel   = panels[0];
  const refHeightPx = refPanel ? (refPanel.floorY - refPanel.apexY) : canvasH * 0.7;
  const pxPerCm    = refHeightPx / maxHeightCm;

  const plinths: PlinthLayout[] = plinthSizes.slice(0, plinthCount).map((size, i) => {
    const dims = getPlinthDimensions(size);
    return {
      idx:        i,
      cx:         (plinthXPcts[i] ?? 0.5) * canvasW,
      bottomY:    floorY,
      heightPx:   dims.heightCm   * pxPerCm,
      diameterPx: dims.diameterCm * pxPerCm,
      size,
    };
  });

  return { panels, plinths, floorY, canvasW, canvasH };
}

/** Log layout details in development for each panel. */
export function debugLayout(layout: ExactLayout): void {
  if (process.env.NODE_ENV !== "development") return;
  console.group("[ExactLayout] Customer Approval Preview layout");
  layout.panels.forEach((p) => {
    console.log(
      `  Panel ${p.idx + 1}: widthCm=${p.widthCm} heightCm=${p.heightCm} ` +
      `aspectRatio=${p.aspectRatio.toFixed(3)} ` +
      `pw=${p.pw.toFixed(0)}px apexY=${p.apexY.toFixed(0)}px`,
    );
  });
  layout.plinths.forEach((pl) => {
    const d = getPlinthDimensions(pl.size);
    console.log(
      `  Plinth ${pl.idx + 1}: size=${pl.size} ` +
      `diameterCm=${d.diameterCm} heightCm=${d.heightCm} ` +
      `heightPx=${pl.heightPx.toFixed(0)}px`,
    );
  });
  console.groupEnd();
}
