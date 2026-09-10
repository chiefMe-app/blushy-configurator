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

  // Max panel width per count — keeps groups tight without overflow.
  //
  // 2026-09-01: the two-panel cap used to be 0.42 x canvasW, which squeezed a
  // 120x220 arch well below its true aspect. The guide compensated by drawing
  // multi-panel scenes on a 1.4x wider virtual canvas — but that canvas no
  // longer matched the rendered image's aspect, so the edit model squashed the
  // whole reference horizontally and produced flat, disc-shaped balloons. The
  // cap is now generous; the group-scale step below keeps things on canvas and
  // preserves aspect while doing it.
  // 2026-09-10: a lone ARCH gets a higher cap so a wide board (the customer's
  // 120x220) renders at its true aspect instead of being clamped to ~0.70
  // canvasW and coming out too narrow. Scoped to arch only — a round backdrop
  // is 200x200 and would balloon to a bigger disc under a higher cap. The
  // left-shift below keeps the right-side garland inside the frame.
  const singleArch = count === 1 && items[0]?.type === "arch";
  const maxPwByCount = count === 1 ? (singleArch ? canvasW * 0.82 : canvasW * 0.70) : count === 2 ? canvasW * 0.60 : canvasW * 0.36;

  // Tallest panel's own height budget — apex fixed at 5% of canvas height,
  // exactly the old single-panel apexFactor baseline (heightRatio=1 always
  // resolved to apexFactor=0.05), so the tallest/reference panel's position
  // is unchanged from before.
  // 2026-09-09: Triple Arch — a centre board with a half arch either side. The
  // customer reference has all three touching, so it takes the same shoulder to
  // shoulder overlap the unequal-height arch pair gets.
  const isTripleArch = count === 3
    && items.filter((it) => it?.type === "half_arch").length === 2
    && items.some((it) => it?.type === "arch");
  // Its garland runs OVER the tops of all three boards, so unlike every other
  // layout it needs real headroom above the tallest one. At the usual 5% the
  // crown balloons were clamped down onto the apex and the render dropped them,
  // leaving the centre board bare.
  // 2026-09-10: a lone arch gets real headroom too. Its garland is now a
  // transcription of the customer's reference photo, and that composition runs
  // ABOVE the board's top edge (to 1.10 board-heights) and out past its right
  // edge (to 0.27). At the old 5% the crown was clamped against the canvas top
  // and the cascade ran off the right. 24% reproduces the reference's own
  // framing, which carries about 22% headroom above the board.
  const tallestPanelHeightPx = floorY - canvasH * (isTripleArch ? 0.22 : singleArch ? 0.24 : 0.05);

  // --- Compute intrinsic sizes and z-orders ---
  const rawPanels = items.slice(0, count).map((item, i) => {
    const wCm = item?.widthCm  ?? 100;
    const hCm = item?.heightCm ?? 200;
    // Shorter panels get a height EXACTLY proportional to their real-world
    // heightCm relative to the tallest panel (not an approximate "stagger").
    // The previous formula (apexFactor = 0.05 + 0.12*(1-heightRatio)) only
    // weakly differentiated heights — e.g. Double Arch's 220cm vs 200cm
    // arches (a real 10% difference) rendered only ~1.3% shorter in the
    // guide, which the edit model then read as "same size". Since pw below
    // is derived from panelHeightPx * aspect, this single change also makes
    // width scale correctly with the configured widthCm.
    const heightRatio   = hCm / maxHeightCm;
    const panelHeightPx = tallestPanelHeightPx * heightRatio;
    const apexY         = floorY - panelHeightPx;
    const aspect        = wCm / hCm;
    const pw = Math.max(canvasW * 0.08, Math.min(maxPwByCount, panelHeightPx * aspect));

    // z-order: tallest = 0 (behind), shortest = count-1 (in front)
    const sorted = [...items.slice(0, count)]
      .map((it, idx) => ({ idx, h: it?.heightCm ?? 200 }))
      .sort((a, b) => b.h - a.h);
    const zOrder = sorted.findIndex(s => s.idx === i);

    return { i, wCm, hCm, apexY, pw, aspect, zOrder };
  });

  // Gap between panels (tight, event-like).
  //
  // History, because it flip-flopped: the gap used to be widened to a plinth's
  // own diameter whenever a Double Arch had a plinth, so the plinth had real
  // floor space BETWEEN the two boards. Since 2026-09-05 the plinth stands
  // centred in FRONT of the whole group instead, so that padding was pushing
  // the boards apart for no reason at all.
  // 2026-09-08: removed, and Double Arch goes further — the customer wants the
  // two boards touching, with the shorter one standing slightly in FRONT of the
  // taller ("dipdibe olsunlar hatta small/medium olan biraz onunde olsun").
  // When the two arches are different heights they now OVERLAP slightly and the
  // shorter one is stepped forward; the z-order already draws the shorter one
  // last, so the overlap reads as depth rather than as a collision.
  const bothArches = count === 2 && items.every((it) => it?.type === "arch");
  const rawGap = count === 1 ? 0 : Math.max(6, canvasW * 0.008);

  // Scale group down if it overflows canvas. The gap has to shrink with the
  // panels — scaling only the panels (the old behaviour) left a full-size gap
  // in a smaller group, so the last panel ran off the canvas edge once the
  // guide stopped being drawn on an over-wide virtual canvas (2026-09-01).
  const rawTotalW = rawPanels.reduce((s, p) => s + p.pw, 0) + (count - 1) * rawGap;
  // 2026-09-02: the panel group used to be allowed 90% of the canvas, leaving
  // only ~5% (38px of 768) of clear wall on each side. Multi-panel setups hang
  // a balloon garland off each OUTER edge, and that garland needs roughly 75px
  // — so it was drawn straight off the edge of the canvas and clipped, which
  // is why Double Arch's garlands rendered as flat towers cut down one side
  // instead of rounded balloons (measured by rendering the guide to PNG:
  // garland xSpan -33..215 on a 0..768 canvas). The frame has to hold the
  // whole installation, arches AND garlands, exactly like a real venue photo,
  // so multi-panel groups now reserve that margin. Single-panel scenes are
  // unchanged — their panel cap already leaves room and they render correctly.
  const maxGroupW = canvasW * (count === 1 ? 0.90 : 0.78);
  const groupScale = rawTotalW > maxGroupW ? maxGroupW / rawTotalW : 1;
  const gap = rawGap * groupScale;

  // Two arches of DIFFERENT heights sit shoulder to shoulder with a small
  // overlap, the shorter one stepped forward. Equal-height pairs keep the plain
  // gap — overlapping two identical silhouettes just looks like a mistake.
  const heightsDiffer = (bothArches && new Set(rawPanels.map((r) => r.hCm)).size > 1) || isTripleArch;
  const minPwScaled   = Math.min(...rawPanels.map((r) => r.pw * groupScale));
  // 2026-09-09: the Triple Arch overlaps harder than the arch pair. The
  // customer wants all three literally touching ("dipdibe"), and at -3.5% the
  // render still left a visible sliver of wall between the boards.
  const effGap        = isTripleArch ? -minPwScaled * 0.10 : heightsDiffer ? -minPwScaled * 0.035 : gap;
  // How far forward the shorter board stands, as a share of the tallest board's
  // own height. Same idea as plinthForwardPx in the guide: in this projection,
  // nearer the camera means lower on the canvas.
  const tallestPanelPx = Math.max(...rawPanels.map((r) => (floorY - r.apexY) * groupScale));
  const forwardStepPx  = heightsDiffer ? tallestPanelPx * 0.030 : 0;

  const totalGroupW = rawPanels.reduce((s, p) => s + p.pw * groupScale, 0)
    + (count - 1) * effGap;

  // --- Assign x positions (selection order = left-to-right) ---
  const panels: PanelLayout[] = [];
  // A lone arch sits board-LEFT, garland-right, the way the customer's
  // reference is framed — and, with the wider cap above, this is also what
  // keeps the right-side cascade from running off the canvas. Every other
  // single panel (round, banner) stays centred.
  let xCursor = singleArch
    ? canvasW * 0.026
    : (canvasW - totalGroupW) / 2;

  for (const raw of rawPanels) {
    const pw  = raw.pw * groupScale;
    const cx  = xCursor + pw / 2;
    xCursor  += pw + effGap;

    // zOrder 0 is the tallest, drawn first and therefore behind. Anything after
    // it is a shorter board, and that is the one that steps forward.
    const forward = raw.zOrder > 0 ? forwardStepPx : 0;
    const panelFloorY = floorY + forward;

    // Scale height by the same factor as width — scaling width alone (the old
    // behaviour) squashed each panel's aspect ratio, and the edit model copied
    // that distortion into the photograph.
    const apexY = floorY - (floorY - raw.apexY) * groupScale + forward;

    const safeXPct = ((cx - pw / 2) / canvasW) * 100;
    const safeYPct = (apexY / canvasH) * 100;
    const safeWPct = (pw / canvasW) * 100;
    const safeHPct = ((floorY - apexY) / canvasH) * 100 * 0.7;

    panels.push({
      idx:         raw.i,
      cx, pw,
      apexY,
      floorY: panelFloorY,
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

  // 2026-09-09: the tallest plinth stands in the MIDDLE. The sizes arrive in
  // descending order (XXL, XL, L), which would otherwise line them up as a
  // staircase from the left; the customer wants the big one centre-stage with
  // the smaller ones either side of it. Index 1 is the centre position in
  // PLINTH_X_PCT, and the guide spaces them by index too.
  const orderedPlinthSizes = (() => {
    const src = plinthSizes.slice(0, plinthCount);
    if (src.length < 3) return src;
    const rank: Record<string, number> = { large: 3, medium: 2, small: 1 };
    const desc = [...src].sort((a, b) => (rank[b] ?? 0) - (rank[a] ?? 0));
    // biggest centre, second on the left, smallest on the right
    return [desc[1], desc[0], ...desc.slice(2)];
  })();

  const plinths: PlinthLayout[] = orderedPlinthSizes.map((size, i) => {
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
