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
  /** Render order: 0 = drawn first (tallest, behind); higher = drawn later (in front) */
  zOrder:      number;
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
  const floorY  = canvasH * 0.9;

  const maxHeightCm = Math.max(...items.map(it => it.heightCm ?? 200), 1);

  // Max panel width per count — keeps groups tight without overflow
  const maxPwByCount = count === 1 ? canvasW * 0.70 : count === 2 ? canvasW * 0.42 : canvasW * 0.30;

  // --- Compute intrinsic sizes and z-orders ---
  const rawPanels = items.slice(0, count).map((item, i) => {
    const wCm = item?.widthCm  ?? 100;
    const hCm = item?.heightCm ?? 200;
    const heightRatio   = hCm / maxHeightCm;
    const apexFactor    = 0.05 + 0.12 * (1 - heightRatio);
    const apexY         = canvasH * apexFactor;
    const panelHeightPx = floorY - apexY;
    const aspect        = wCm / hCm;
    const pw = Math.max(canvasW * 0.08, Math.min(maxPwByCount, panelHeightPx * aspect));

    // z-order: tallest = 0 (behind), shortest = count-1 (in front)
    const sorted = [...items.slice(0, count)]
      .map((it, idx) => ({ idx, h: it?.heightCm ?? 200 }))
      .sort((a, b) => b.h - a.h);
    const zOrder = sorted.findIndex(s => s.idx === i);

    return { i, wCm, hCm, apexY, pw, aspect, zOrder };
  });

  // Gap between panels (tight, event-like)
  const gap = count === 1 ? 0 : Math.max(6, canvasW * 0.008);

  // Scale group down if it overflows canvas
  let totalGroupW = rawPanels.reduce((s, p) => s + p.pw, 0) + (count - 1) * gap;
  const maxGroupW = canvasW * 0.90;
  const groupScale = totalGroupW > maxGroupW ? maxGroupW / totalGroupW : 1;
  totalGroupW *= groupScale;

  // --- Assign x positions (selection order = left-to-right) ---
  const panels: PanelLayout[] = [];
  let xCursor = (canvasW - totalGroupW) / 2;

  for (const raw of rawPanels) {
    const pw  = raw.pw * groupScale;
    const cx  = xCursor + pw / 2;
    xCursor  += pw + gap;

    const safeXPct = ((cx - pw / 2) / canvasW) * 100;
    const safeYPct = (raw.apexY / canvasH) * 100;
    const safeWPct = (pw / canvasW) * 100;
    const safeHPct = ((floorY - raw.apexY) / canvasH) * 100 * 0.7;

    panels.push({
      idx:         raw.i,
      cx, pw,
      apexY:       raw.apexY,
      floorY,
      widthCm:     raw.wCm,
      heightCm:    raw.hCm,
      aspectRatio: raw.aspect,
      zOrder:      raw.zOrder,
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

/** Log layout details in development for each panel and plinth. */
export function debugLayout(layout: ExactLayout, items?: BackdropItem[]): void {
  if (process.env.NODE_ENV !== "development") return;
  console.group("[ExactLayout] Customer Approval Preview layout");
  // Sort by zOrder for readable depth output
  [...layout.panels].sort((a, b) => a.zOrder - b.zOrder).forEach((p) => {
    const item = items?.[p.idx];
    console.log(
      `  Panel ${p.idx + 1} (z=${p.zOrder}): ` +
      `id=${item?.id ?? "?"} type=${item?.type ?? "?"} sizeId=${item?.sizeId ?? "?"} ` +
      `widthCm=${p.widthCm} heightCm=${p.heightCm} aspectRatio=${p.aspectRatio.toFixed(3)} ` +
      `x=${p.cx.toFixed(0)} y=${p.apexY.toFixed(0)} ` +
      `widthPx=${p.pw.toFixed(0)} heightPx=${(p.floorY - p.apexY).toFixed(0)}`,
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
