/**
 * Generates a deterministic SVG structure silhouette for layout-guided render experiments.
 *
 * Returns a plain SVG string — no canvas, no PNG, no browser APIs.
 * Server-safe: can be called from a Next.js API route.
 *
 * Key correctness goals:
 *   - Canvas aspect ratio matches the fal image_size that would be used for this setup
 *   - Arch panels are drawn taller than wide (portrait orientation for 100×200cm)
 *   - Plinth is drawn as a tall narrow rectangle — height:width unambiguously > 1
 *   - Half garland is a series of organic circles on ONE side only, reaching the floor
 *   - No text is rendered
 *
 * Used exclusively by /api/generate-structure-render-test.
 * Never imported by production components.
 */

import type { BackdropItem, PlinthSize, BackdropShapeId, BalloonStyleId } from "./config";
import { calculateExactLayout } from "./calculateExactLayout";
import { calculateRenderAspectRatio } from "./calculateRenderAspectRatio";
import type { FalImageSize } from "./calculateRenderAspectRatio";

// ViewBox dimensions that match each fal image_size exactly.
// The silhouette must have the same aspect ratio as the AI render it will guide.
const VIEWBOX: Record<FalImageSize, [number, number]> = {
  portrait_16_9:  [576,  1024],
  portrait_4_3:   [768,  1024],
  square_hd:      [768,   768],
  landscape_4_3:  [768,   576],
  landscape_16_9: [1024,  576],
};

export interface SilhouetteResult {
  svg:                      string;
  viewBoxW:                 number;
  viewBoxH:                 number;
  falImageSize:             FalImageSize;
  cutoutPlaceholderCount:   number;
  cutoutPlaceholderHeightsCm: number[];
  /** Double Arch dense garland guide — balloons drawn per side (0 when not double arch). */
  doubleArchGarlandBalloonsLeft:  number;
  doubleArchGarlandBalloonsRight: number;
}

/** One size tier of standee cutout to draw in the guide. */
export interface CutoutGuideItem {
  heightCm: number;
  quantity: number;
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

// Distinct fills for multi-panel setups — subtle hue differences so the edit model
// can distinguish each board even when panels overlap.
const MULTI_PANEL_FILLS = ["#EDE8E2", "#E2EAF0", "#EAE2F0"] as const;

function panelPathOrShape(
  cx: number, pw: number, apexY: number, floorY: number,
  shape: BackdropShapeId,
  fillColor = "#F0ECE8",
): string {
  const r     = pw / 2;
  const left  = cx - r;
  const right = cx + r;

  // Very light grey stroke only — avoid any hard outline that Canny reads as a structural border
  const stroke = `stroke="rgba(150,150,150,0.14)" stroke-width="1"`;

  if (shape === "round") {
    // Bottom of circle must touch floorY exactly — no floating gap
    const centerY = floorY - r;
    return `<circle cx="${cx}" cy="${centerY}" r="${r}" fill="${fillColor}" ${stroke}/>`;
  }

  if (shape === "rect" || shape === "shimmer_wall") {
    const h = floorY - apexY;
    return `<rect x="${left}" y="${apexY}" width="${pw}" height="${h}" fill="${fillColor}" ${stroke}/>`;
  }

  if (shape === "wavy") {
    const amp    = pw * 0.08;
    const segs   = 3;
    const segW   = pw / segs;
    const topY   = apexY + amp;
    const pts    = [`M ${left},${floorY}`, `L ${left},${topY + amp}`];
    for (let i = 0; i < segs; i++) {
      const x1 = left + (i + 0.5) * segW;
      const x2 = Math.min(left + (i + 1) * segW, right);
      const y1 = i % 2 === 0 ? topY - amp : topY + amp * 2;
      pts.push(`Q ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${(topY + amp).toFixed(1)}`);
    }
    pts.push(`L ${right},${floorY}`, "Z");
    return `<path d="${pts.join(" ")}" fill="${fillColor}" ${stroke}/>`;
  }

  // arch — the most important case for structure guidance
  const springY = apexY + r;
  const d = [
    `M ${left},${floorY}`,
    `L ${left},${springY}`,
    `A ${r},${r} 0 0 1 ${right},${springY}`,
    `L ${right},${floorY}`,
    "Z",
  ].join(" ");
  return `<path d="${d}" fill="${fillColor}" ${stroke}/>`;
}

// v3: Cylindrical plinth — top ellipse is the dominant Canny cue.
// Side body edges are barely visible (not rectangular-box signal).
// No floor platform, no podium base — just the slim column and its top.
function plinthCylinder(cx: number, bottomY: number, heightPx: number, diameterPx: number): string {
  // Enforce ≥ 3:1 — slim column, not podium
  const visualWidth = Math.min(diameterPx, Math.round(heightPx / 3.0));
  const rx    = visualWidth / 2;
  // Prominent top ellipse: ry = rx * 0.45 is clearly elliptical and unambiguous
  const ryTop = Math.max(3, Math.round(rx * 0.45));
  const topY  = bottomY - heightPx;
  return [
    // Cylinder body — near-invisible side edges so Canny sees the top/bottom ellipses, not a box
    `<rect x="${cx - rx}" y="${topY}" width="${visualWidth}" height="${heightPx}" fill="#FDFCFB" stroke="rgba(150,150,150,0.12)" stroke-width="0.5"/>`,
    // Bottom cap ellipse — subtle, indicates curved base not a flat floor block
    `<ellipse cx="${cx}" cy="${bottomY}" rx="${rx}" ry="${ryTop}" fill="rgba(235,232,228,0.70)" stroke="rgba(140,140,140,0.14)" stroke-width="0.5"/>`,
    // Top cap ellipse — the primary cylinder cue; make it clearly visible
    `<ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ryTop}" fill="#F5F3F0" stroke="rgba(130,130,130,0.30)" stroke-width="1"/>`,
  ].join("\n    ");
}

// ---------------------------------------------------------------------------
// v4: Pure edge/line guide functions — no fills, no slabs, no floor lines
// ---------------------------------------------------------------------------

// Arch outline only — no fill, no base line, no panel thickness.
// Open-bottom path: Canny sees only the arch top curve and two side lines.
function panelEdgeOnly(
  cx: number, pw: number, apexY: number, floorY: number,
  shape: BackdropShapeId,
): string {
  const r     = pw / 2;
  const left  = cx - r;
  const right = cx + r;
  const edgeStroke = `fill="none" stroke="rgba(95,95,95,0.45)" stroke-width="2" stroke-linecap="round"`;

  if (shape === "round") {
    // Bottom of circle must touch floorY exactly — no floating gap
    const centerY = floorY - r;
    return `<circle cx="${cx}" cy="${centerY}" r="${r}" fill="none" stroke="rgba(95,95,95,0.42)" stroke-width="2"/>`;
  }
  if (shape === "rect" || shape === "shimmer_wall") {
    // Three sides only (no bottom) so there's no horizontal base-line signal
    const d = `M ${left},${floorY} L ${left},${apexY} L ${right},${apexY} L ${right},${floorY}`;
    return `<path d="${d}" ${edgeStroke}/>`;
  }
  if (shape === "wavy") {
    const amp = pw * 0.08;
    const segs = 3;
    const segW = pw / segs;
    const topY = apexY + amp;
    const pts = [`M ${left},${floorY}`, `L ${left},${topY + amp}`];
    for (let i = 0; i < segs; i++) {
      const x1 = left + (i + 0.5) * segW;
      const x2 = Math.min(left + (i + 1) * segW, right);
      const y1 = i % 2 === 0 ? topY - amp : topY + amp * 2;
      pts.push(`Q ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${(topY + amp).toFixed(1)}`);
    }
    pts.push(`L ${right},${floorY}`); // open bottom
    return `<path d="${pts.join(" ")}" ${edgeStroke}/>`;
  }
  // arch — open-bottom outline: two side lines + top arc, no horizontal base
  const springY = apexY + r;
  const d = [
    `M ${left},${floorY}`,
    `L ${left},${springY}`,
    `A ${r},${r} 0 0 1 ${right},${springY}`,
    `L ${right},${floorY}`,
  ].join(" ");
  return `<path d="${d}" ${edgeStroke}/>`;
}

// Cylindrical plinth edge guide — two vertical lines + top and bottom ellipses.
// No rectangular fill, no block, no base platform.
function plinthEdge(cx: number, bottomY: number, heightPx: number, diameterPx: number): string {
  const visualWidth = Math.min(diameterPx, Math.round(heightPx / 3.0));
  const rx    = visualWidth / 2;
  const ryTop = Math.max(3, Math.round(rx * 0.45));
  const topY  = bottomY - heightPx;

  return [
    // Left vertical edge — very faint
    `<line x1="${cx - rx}" y1="${topY}" x2="${cx - rx}" y2="${bottomY}" stroke="rgba(90,90,90,0.22)" stroke-width="0.8"/>`,
    // Right vertical edge — very faint
    `<line x1="${cx + rx}" y1="${topY}" x2="${cx + rx}" y2="${bottomY}" stroke="rgba(90,90,90,0.22)" stroke-width="0.8"/>`,
    // Bottom ellipse — subtle, faint
    `<ellipse cx="${cx}" cy="${bottomY}" rx="${rx}" ry="${ryTop}" fill="none" stroke="rgba(90,90,90,0.20)" stroke-width="0.8"/>`,
    // Top ellipse — primary cylinder cue, clearly visible
    `<ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ryTop}" fill="none" stroke="rgba(80,80,80,0.48)" stroke-width="1.6"/>`,
  ].join("\n    ");
}

// Open arch frame — hollow arch outline: outer + inner arch paths, no fill.
// Reads as a freestanding empty arch frame prop, never a solid panel.
function openArchFramePath(cx: number, pw: number, apexY: number, floorY: number): string {
  const drawArch = (r: number, left: number, right: number, topY: number): string => {
    const springY = topY + r;
    return `M ${left},${floorY} L ${left},${springY} A ${r},${r} 0 0 1 ${right},${springY} L ${right},${floorY}`;
  };
  const rOuter = pw / 2;
  // Thin frame band — reads as a slim flat foam-board/MDF frame, not a chunky
  // tubular arch. Narrow gap between outer and inner outlines is the key cue.
  const frameT = Math.max(5, Math.round(pw * 0.07));
  const rInner = rOuter - frameT;
  const stroke = `fill="none" stroke="rgba(95,95,95,0.55)" stroke-width="2" stroke-linecap="round"`;
  return [
    `<path d="${drawArch(rOuter, cx - rOuter, cx + rOuter, apexY)}" ${stroke}/>`,
    `<path d="${drawArch(rInner, cx - rInner, cx + rInner, apexY + frameT)}" ${stroke}/>`,
  ].join("\n    ");
}

// Escape user text for safe embedding in SVG markup.
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Customized text guide — the exact selected text drawn faintly on the target
// solid panel (upper-middle) so the edit model bakes it into the board surface.
// Never drawn on shimmer walls or open arch frames.
function customTextGuide(cx: number, pw: number, apexY: number, floorY: number, text: string): string {
  const panelH   = floorY - apexY;
  const y        = apexY + panelH * 0.30;
  // Scale font to fit the panel width for the given string length
  const fontSize = Math.max(12, Math.min(Math.round(pw * 0.12), Math.round((pw * 0.85) / Math.max(4, text.length) * 1.9)));
  const safe     = escapeXml(text);
  return (
    // White halo stroke behind for contrast, then the gray fill copy on top —
    // subtle but legible enough for the edit model to read and follow.
    `<text x="${cx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" ` +
      `font-family="DejaVu Sans, Arial, sans-serif" font-weight="600" font-size="${fontSize}" ` +
      `fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="4" stroke-linejoin="round">${safe}</text>` +
    `<text x="${cx.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" ` +
      `font-family="DejaVu Sans, Arial, sans-serif" font-weight="600" font-size="${fontSize}" ` +
      `fill="rgba(110,110,110,0.65)">${safe}</text>`
  );
}

// Low-opacity theme-graphic guide area on the panel surface — helps the edit
// model bake the printed illustration into the backdrop, not paste a sticker.
function themeGraphicGuideArea(cx: number, pw: number, apexY: number, floorY: number): string {
  const panelH = floorY - apexY;
  const gw = pw * 0.55;
  const gh = panelH * 0.35;
  const gx = cx - gw / 2;
  const gy = apexY + panelH * 0.32;
  return `<rect x="${gx.toFixed(1)}" y="${gy.toFixed(1)}" width="${gw.toFixed(1)}" height="${gh.toFixed(1)}" rx="${Math.round(gw * 0.06)}" ` +
    `fill="rgba(175,175,200,0.14)" stroke="rgba(130,130,160,0.22)" stroke-width="1" stroke-dasharray="4,3"/>`;
}

// ---------------------------------------------------------------------------
// Cutout standee placeholder — dashed rounded silhouette + base foot + label
// ---------------------------------------------------------------------------

function standeeGuide(cx: number, bottomY: number, heightPx: number, label: string): string {
  const widthPx  = Math.max(28, Math.round(heightPx * 0.22));
  const rx       = widthPx / 2;
  const topY     = bottomY - heightPx;
  const cornerR  = Math.round(widthPx * 0.30); // rounded head top
  const baseRy   = Math.max(4, Math.round(widthPx * 0.15));
  const fontSize = Math.max(9, Math.min(13, Math.round(widthPx * 0.55)));

  return [
    // Body silhouette — light fill, dashed outline so it reads as a guide placeholder
    `<rect x="${(cx - rx).toFixed(1)}" y="${topY.toFixed(1)}" width="${widthPx.toFixed(1)}" height="${heightPx.toFixed(1)}" ` +
      `rx="${cornerR}" ry="${cornerR}" ` +
      `fill="#F4F4F4" stroke="#999999" stroke-width="1.2" stroke-dasharray="5,3"/>`,
    // Base foot ellipse — suggests the standee rests on the floor
    `<ellipse cx="${cx.toFixed(1)}" cy="${bottomY.toFixed(1)}" ` +
      `rx="${(rx * 1.3).toFixed(1)}" ry="${baseRy.toFixed(1)}" ` +
      `fill="#E4E4E4" stroke="#AAAAAA" stroke-width="0.8"/>`,
    // Size label below the base
    `<text x="${cx.toFixed(1)}" y="${(bottomY + baseRy + fontSize + 2).toFixed(1)}" ` +
      `text-anchor="middle" font-size="${fontSize}" font-family="sans-serif" fill="#777777">${label}</text>`,
  ].join("\n    ");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generateStructureSilhouette(
  backdropItems:    BackdropItem[],
  plinthSizes:      PlinthSize[],
  balloonStyle:     BalloonStyleId,
  balloonColors?:   string[],
  cutoutGuideItems?: CutoutGuideItem[],
): SilhouetteResult {
  const { falImageSize } = calculateRenderAspectRatio(backdropItems);
  const [Wbase, H]       = VIEWBOX[falImageSize];

  // For multi-panel setups, widen the layout canvas so calculateExactLayout's
  // maxPwByCount cap (0.42 × canvasW) doesn't compress panel widths below their
  // true aspect ratio. A 1.4× wider virtual canvas gives each panel enough
  // room to render at its configured widthCm / heightCm ratio.
  const isMultiPanel = backdropItems.length > 1;
  const W = isMultiPanel ? Math.round(Wbase * 1.4) : Wbase;

  const layout = calculateExactLayout(backdropItems, plinthSizes, W, H);

  // When selected hex colors are provided, build a weighted guide sequence that makes
  // white and the primary pastel dominant, and pushes warm/saturated accents (yellow,
  // gold) to appear only once — at the end.  Warmth is measured as R+G-B*2 so that
  // pure yellows score highest and are reliably placed last in the cycling order.
  const colors: string[] = (() => {
    if (!balloonColors || balloonColors.length === 0) {
      return ["#C8D8E8", "#E8EEF4", "#B0C8DC"];
    }
    const raw = balloonColors.slice(0, 5);
    if (raw.length === 1) return raw;

    const warmth = (hex: string): number => {
      const h = hex.replace(/^#/, "");
      if (h.length < 6) return 0;
      return parseInt(h.slice(0,2),16) + parseInt(h.slice(2,4),16) - parseInt(h.slice(4,6),16)*2;
    };

    const wh  = raw.find(c => c.toLowerCase() === "#ffffff" || c.toLowerCase() === "#fff") ?? null;
    const pri = raw.find(c => c.toLowerCase() !== "#ffffff" && c.toLowerCase() !== "#fff") ?? raw[0];
    // Rest sorted by warmth ascending — warmest (yellow/gold) goes last
    const rest = raw
      .filter(c => c !== wh && c !== pri)
      .sort((a, b) => warmth(a) - warmth(b));

    const W = wh ?? pri;
    // Pattern: white+primary dominant (4+3 slots), accents once each, warmest accent last
    const seq: string[] = [W, pri, W, pri];
    if (rest[0]) seq.push(rest[0]);
    seq.push(W);
    if (rest[1]) seq.push(rest[1]);
    seq.push(pri, W);
    if (rest.length > 0) seq.push(rest[rest.length - 1]);
    return seq;
  })();

  // Zoomed-out composition: scale the scene to 80% of the canvas to create margins
  // on all sides. This ensures the full arch, plinth, and garland are fully visible
  // with no cropping, matching the wider camera angle requested in the Replicate prompt.
  const SCALE  = 0.80;
  const marginX = Math.round(W * (1 - SCALE) / 2);
  const marginY = Math.round(H * (1 - SCALE) / 2);

  // bg: full-canvas background only (not scaled)
  const bgLines: string[] = [];
  // content: everything else — scaled and centered
  const content: string[] = [];

  // Double Arch dense garland guide counters — set only in the double_arch
  // mirrored garland branch, reported in the result for diagnostics.
  let doubleArchGarlandBalloonsLeft  = 0;
  let doubleArchGarlandBalloonsRight = 0;

  // v4: pure white background — no fills, no color signals, edge map only
  bgLines.push(`<rect width="${W}" height="${H}" fill="#FFFFFF"/>`);

  // Single panel: v4 edge-only (proven to work well for single-panel).
  // Multi-panel: filled with distinct per-panel hues so the edit model can distinguish
  // each board as a separate physical object and not merge or omit panels.
  const sorted = [...layout.panels].sort((a, b) => a.zOrder - b.zOrder);
  sorted.forEach((panel, sortedIdx) => {
    const item      = backdropItems[panel.idx];
    const shape     = (item?.type ?? "arch") as BackdropShapeId;
    const isShimmer = shape === "shimmer_wall";

    // Open arch frame: always drawn as a hollow outline — never filled —
    // in both single and multi-panel setups.
    if (shape === "open_arch_frame") {
      content.push(openArchFramePath(panel.cx, panel.pw, panel.apexY, panel.floorY));
      return;
    }

    if (isMultiPanel) {
      const baseFill = MULTI_PANEL_FILLS[sortedIdx % MULTI_PANEL_FILLS.length];

      if (isShimmer) {
        // Shimmer wall: high-contrast square tile grid so the edit model reads it
        // as a tiled sequin wall, not a matte board.
        const patId    = `shimmerTile_${sortedIdx}`;
        const tileSize = Math.max(10, Math.round(panel.pw * 0.05)); // ~20 tiles across the panel
        content.push([
          `<defs>`,
          `  <pattern id="${patId}" patternUnits="userSpaceOnUse" width="${tileSize}" height="${tileSize}">`,
          `    <rect width="${tileSize}" height="${tileSize}" fill="#D8D8E4"/>`,
          `    <rect width="${tileSize}" height="${tileSize}" fill="none" stroke="rgba(60,60,90,0.50)" stroke-width="0.7"/>`,
          `  </pattern>`,
          `</defs>`,
        ].join("\n    "));
        content.push(panelPathOrShape(panel.cx, panel.pw, panel.apexY, panel.floorY, shape, `url(#${patId})`));
      } else {
        content.push(panelPathOrShape(panel.cx, panel.pw, panel.apexY, panel.floorY, shape, MULTI_PANEL_FILLS[sortedIdx % MULTI_PANEL_FILLS.length]));
      }
    } else if (isShimmer) {
      // Single shimmer wall: force a clean rectangle (never arch edges) with tile grid.
      // Using <rect> directly avoids any arch-like path the panelEdgeOnly/panelPathOrShape
      // functions might generate, which could mislead the edit model into adding an arch.
      const patId    = `shimmerTileSingle`;
      const tileSize = Math.max(10, Math.round(panel.pw * 0.05));
      const left     = panel.cx - panel.pw / 2;
      const panelH   = panel.floorY - panel.apexY;
      content.push([
        `<defs>`,
        `  <pattern id="${patId}" patternUnits="userSpaceOnUse" width="${tileSize}" height="${tileSize}">`,
        `    <rect width="${tileSize}" height="${tileSize}" fill="#D8D8E4"/>`,
        `    <rect width="${tileSize}" height="${tileSize}" fill="none" stroke="rgba(60,60,90,0.50)" stroke-width="0.7"/>`,
        `  </pattern>`,
        `</defs>`,
        // Explicit rectangle — no arch path, no rounded top, clean square silhouette
        `<rect x="${left.toFixed(1)}" y="${panel.apexY.toFixed(1)}" width="${panel.pw.toFixed(1)}" height="${panelH.toFixed(1)}" fill="url(#${patId})" stroke="rgba(100,100,130,0.35)" stroke-width="1"/>`,
      ].join("\n    "));
    } else {
      content.push(panelEdgeOnly(panel.cx, panel.pw, panel.apexY, panel.floorY, shape));
    }

    // Theme graphic guide area — faint print zone on the panel surface so the
    // edit model bakes the illustration into the backdrop (not a sticker).
    if (item?.graphic?.enabled && !isShimmer) {
      content.push(themeGraphicGuideArea(panel.cx, panel.pw, panel.apexY, panel.floorY));
    }

    // Customized text guide — exact text, upper-middle of solid panels only.
    // (Open arch frames return early above; shimmer walls are excluded here.)
    const textValue = item?.text?.enabled ? (item.text.value ?? "").trim() : "";
    if (textValue && !isShimmer) {
      content.push(customTextGuide(panel.cx, panel.pw, panel.apexY, panel.floorY, textValue));
    }
  });

  // v4: Cylindrical plinth edge guide — no fill, no block
  const singleShimmer = backdropItems.length === 1 && backdropItems[0]?.type === "shimmer_wall";
  const singleRound   = backdropItems.length === 1 && backdropItems[0]?.type === "round";
  const isDoubleArch  = backdropItems.length === 2 && backdropItems.every((i) => i.type === "arch");
  for (const p of layout.plinths) {
    let plinthCx: number;
    if (isDoubleArch && layout.plinths.length === 1 && layout.panels.length === 2) {
      // Double arch + one plinth: centered in the full setup, in front of the
      // gap between the two arches.
      const gLeft  = Math.min(...layout.panels.map((pp) => pp.cx - pp.pw / 2));
      const gRight = Math.max(...layout.panels.map((pp) => pp.cx + pp.pw / 2));
      plinthCx = Math.round((gLeft + gRight) / 2);
    } else if (singleShimmer) {
      plinthCx = Math.round(W * 0.50); // centered in front of shimmer wall
    } else if (singleRound && balloonStyle === "half" && layout.panels.length === 1) {
      // Left side of the round circle, clear of the right-arc garland
      const rPanel = layout.panels[0];
      plinthCx = Math.round(rPanel.cx - rPanel.pw * 0.40);
    } else if (balloonStyle === "half") {
      plinthCx = Math.round(W * 0.28); // open left side, away from right-side garland
    } else {
      plinthCx = p.cx;
    }
    // Round scenes: use filled cylinder so the plinth reads as a clear solid object,
    // not just outline edges that the model may skip or merge with the background.
    if (singleRound) {
      content.push(plinthCylinder(plinthCx, p.bottomY, p.heightPx, p.diameterPx));
    } else {
      content.push(plinthEdge(plinthCx, p.bottomY, p.heightPx, p.diameterPx));
    }
  }

  // v4: Individual balloon circles — no filled blob, organic circles follow right-side path.
  // Avoids vertical slab boundary that the filled blob created.
  if (balloonStyle !== "none" && layout.panels.length > 0) {
    const groupRight = Math.max(...layout.panels.map((p) => p.cx + p.pw / 2));
    const groupLeft  = Math.min(...layout.panels.map((p) => p.cx - p.pw / 2));
    const groupTop   = Math.min(...layout.panels.map((p) => p.apexY));
    const floorY     = layout.floorY;
    const dy         = floorY - groupTop;
    // When selected hex colors are passed, render guide dots with actual palette colors
    // at 0.75 opacity so the AI color reference in the guide image matches exactly.
    // White (#FFFFFF) gets a gray stroke so it remains visible on the white background.
    const hasSelectedColors = !!(balloonColors && balloonColors.length > 0);

    const hexToRgba = (hex: string, alpha: number): string => {
      const h = hex.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const balloonAttrs = (idx: number): string => {
      if (!hasSelectedColors) {
        return `fill="rgba(200,218,235,0.08)" stroke="rgba(85,85,85,0.30)" stroke-width="1"`;
      }
      const hex     = colors[idx % colors.length] ?? colors[0];
      const isWhite = hex.toLowerCase() === "#ffffff" || hex.toLowerCase() === "#fff";
      const fill    = hexToRgba(hex, 0.76);
      const stroke  = isWhite
        ? `stroke="rgba(160,160,160,0.72)" stroke-width="1.4"`
        : `stroke="rgba(55,55,55,0.22)" stroke-width="1"`;
      return `fill="${fill}" ${stroke}`;
    };

    if (balloonStyle === "half") {
      // Detect single round panel — needs an arc garland, not a vertical side garland.
      // A vertical line of circles next to a circle reads as a support pillar or full ring to the model.
      const isRoundScene =
        backdropItems.length === 1 &&
        (backdropItems[0]?.type ?? "") === "round" &&
        layout.panels.length === 1;

      if (isRoundScene) {
        // Round panel: arc garland along the outer right perimeter only.
        // From 11 o'clock (SVG -120°) clockwise through 12 → 3 → to just past 5 o'clock (SVG +75°).
        // Makes the layout reference unambiguously a partial arc, not a full ring.
        const rPanel   = layout.panels[0];
        const circR    = rPanel.pw / 2;
        const circleCx = rPanel.cx;
        // Anchor to floor so circle bottom == floorY (no floating gap → no invented base)
        const circleCy = rPanel.floorY - circR;
        const outerR   = circR + Math.round(W * 0.038);

        // Right-side arc only: -65° (~1 o'clock, upper-right) to 80° (~5 o'clock, lower-right).
        // Hard guard removes any balloon that falls left of circleCx + circR*0.15
        // so no guide dot can bleed onto the upper-left, left, or lower-left quadrant.
        const startAngleDeg = -65; // ~1 o'clock: upper-right of circle
        const endAngleDeg   =  80; // ~5 o'clock: lower-right, approaching floor
        const numBalloons   = 18;

        for (let i = 0; i < numBalloons; i++) {
          const t        = i / (numBalloons - 1);
          const angleDeg = startAngleDeg + t * (endAngleDeg - startAngleDeg);
          const angleRad = (angleDeg * Math.PI) / 180;
          const radVar   = outerR + (i % 2 === 0 ? Math.round(W * 0.012) : -Math.round(W * 0.006));
          const bx       = circleCx + radVar * Math.cos(angleRad);
          const by       = circleCy + radVar * Math.sin(angleRad);
          // Hard guard: skip any dot left of 15% past circle center — prevents left-side leakage
          if (bx < circleCx + circR * 0.15) continue;
          const br       = i < 3 ? 22 : i > numBalloons - 4 ? 16 : 12 + ((i * 7) % 10);
          content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br}" ${balloonAttrs(i)}/>`);
        }
      } else {
        // Double arch: mirrored DENSE organic garlands. Each side is a thick
        // layered band — floor/base cluster → staggered climb band up the
        // outer edge → crown cluster over the top shoulder. Never a thin
        // single-file row, never a bridge across the pair; center stays clean.
        const archPanels = layout.panels.filter(
          (p) => (backdropItems[p.idx]?.type ?? "") === "arch",
        );
        if (archPanels.length === 2) {
          const pair = [...archPanels].sort((a, b) => a.cx - b.cx);
          const drawDenseGarland = (p: typeof pair[0], side: "left" | "right", colorOffset: number): number => {
            const dir   = side === "left" ? -1 : 1;
            const edgeX = p.cx + dir * (p.pw / 2); // outer edge x
            const Hp    = p.floorY - p.apexY;
            let n = 0;
            const put = (bx: number, by: number, br: number) => {
              content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br}" ${balloonAttrs(colorOffset + n)}/>`);
              n++;
            };

            // 1) Floor/base cluster — 10 balloons mounded at the outer base,
            //    with large anchor balloons. Offsets are deterministic:
            //    [outward-along-dir, up-from-floor, radius]
            const BASE: [number, number, number][] = [
              [  6, 12, 22], [ 30, 16, 18], [-14, 14, 16], [ 14, 34, 15],
              [ -4, 38, 13], [ 40, 30, 12], [ 20, 52, 11], [ -8, 54, 10],
              [ 46, 48,  9], [  8, 68,  8],
            ];
            for (const [ox, up, br] of BASE) put(edgeX + dir * ox, p.floorY - up, br);

            // 2) Side climb — 16 balloons in a thick 4-lane staggered band
            //    hugging the outer edge from above the base to the spring line.
            const climbN = 16;
            for (let i = 0; i < climbN; i++) {
              const t = i / (climbN - 1);
              const y = p.floorY - Hp * (0.20 + t * 0.55); // 20% → 75% panel height
              const lane    = i % 4;                        // 4 lanes = band thickness
              const laneOff = [-10, 4, 18, 30][lane];
              const wobble  = ((i * 13) % 9) - 4;           // deterministic jitter
              const x  = edgeX + dir * (laneOff + wobble);
              const br = lane === 2 ? 15 : lane === 0 ? 8 : 11 + ((i * 5) % 4); // large/med/small/mini mix
              put(x, y, br);
            }

            // 3) Crown cluster — 12 balloons wrapping the outer shoulder over
            //    the top of the arch arc, layered in/on/out of the arc line.
            const rArc  = p.pw / 2;
            const arcCx = p.cx;
            const arcCy = p.apexY + rArc;
            const angFrom = side === "left" ? 180 : 0;   // outer horizontal
            const angTo   = side === "left" ? 255 : -75; // over the shoulder toward crown
            const crownN = 12;
            for (let i = 0; i < crownN; i++) {
              const t   = i / (crownN - 1);
              const ang = ((angFrom + (angTo - angFrom) * t) * Math.PI) / 180;
              const rad = rArc + [-6, 8, 18][i % 3];      // 3 layered depth lanes
              const x   = arcCx + rad * Math.cos(ang);
              const y   = arcCy + rad * Math.sin(ang);
              const br  = i % 5 === 0 ? 17 : i % 3 === 0 ? 13 : 9 + ((i * 7) % 4);
              put(x, y, br);
            }
            return n;
          };
          doubleArchGarlandBalloonsLeft  = drawDenseGarland(pair[0], "left", 0);
          doubleArchGarlandBalloonsRight = drawDenseGarland(pair[1], "right", 7);
        } else {
        // Open-frame layouts: NO full-height garland column. Draw a compact
        // accent cluster hugging the frame's top-right shoulder only, so the
        // hollow frame silhouette stays visible and the opening stays clear.
        const framePanel = layout.panels.find(
          (p) => (backdropItems[p.idx]?.type ?? "") === "open_arch_frame",
        );
        if (framePanel) {
          const r        = framePanel.pw / 2;
          const springCy = framePanel.apexY + r; // arch arc center
          const numBalloons = 8;
          for (let i = 0; i < numBalloons; i++) {
            const t        = i / (numBalloons - 1);
            const angleDeg = -62 + t * 72; // top of crown → right shoulder, upper part only
            const angleRad = (angleDeg * Math.PI) / 180;
            const rr       = r + Math.round(W * 0.018) + (i % 2 === 0 ? 4 : -3);
            const bx       = framePanel.cx + rr * Math.cos(angleRad);
            const by       = springCy + rr * Math.sin(angleRad);
            const br       = i < 2 ? 18 : 10 + ((i * 5) % 7);
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br}" ${balloonAttrs(i)}/>`);
          }
        } else {
          // Arch / rect / other: right-side vertical garland from top-right corner to floor
          const outerOffset = Math.round(W * 0.055);
          const numBalloons = 22;

          for (let i = 0; i < numBalloons; i++) {
            const t   = i / (numBalloons - 1);
            // Sine-wave horizontal jitter — avoids straight vertical line of circles
            const jx  = Math.sin(t * Math.PI * 2.1 + 0.4) * Math.round(W * 0.022);
            // Smaller vertical jitter for organic overlap
            const jy  = (((i * 11) % 28) - 14);
            const bx  = groupRight + outerOffset + jx;
            const by  = groupTop + t * dy + jy;
            // Varied radii: large cluster at top, varied in middle, compact at floor
            const r   = i < 3 ? 20 + ((i * 5) % 7) : i > numBalloons - 4 ? 16 + ((i * 3) % 6) : 12 + ((i * 7) % 9);
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r}" ${balloonAttrs(i)}/>`);
          }
        }
        }
      }

    } else if (balloonStyle === "full" || balloonStyle === "premium") {
      const numPerSide = balloonStyle === "premium" ? 14 : 10;
      const offset     = Math.round(W * 0.05);

      const drawSide = (edgeX: number, dir: 1 | -1, colorOffset = 0) => {
        for (let i = 0; i < numPerSide; i++) {
          const t  = i / (numPerSide - 1);
          const bx = edgeX + dir * (offset + (((i * 5) % 14)));
          const by = groupTop + t * dy;
          const r  = 12 + ((i * 7) % 9);
          content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r}" ${balloonAttrs(colorOffset + i)}/>`);
        }
      };
      drawSide(groupRight,  1, 0);
      drawSide(groupLeft,  -1, numPerSide);
      // Top arc circles
      for (let i = 0; i < numPerSide; i++) {
        const t  = i / (numPerSide - 1);
        const bx = groupLeft + t * (groupRight - groupLeft);
        const by = groupTop - offset + (((i * 5) % 12));
        content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${12 + ((i * 3) % 7)}" ${balloonAttrs(numPerSide * 2 + i)}/>`);
      }
    }
  }

  // ── Cutout standee placeholders ──────────────────────────────────────────
  // Draw one dashed silhouette per selected standee, to the LEFT of the backdrop
  // group (opposite side from the typical right-side half garland).  Heights are
  // scaled relative to the reference backdrop panel so proportions are accurate.
  const cutoutPlaceholderHeightsCm: number[] = [];

  const activeCutouts = (cutoutGuideItems ?? []).filter(i => i.quantity > 0);
  if (activeCutouts.length > 0 && layout.panels.length > 0) {
    const refPanel      = layout.panels[0];
    const refItem       = backdropItems[refPanel.idx];
    const refHeightCm   = (refItem as { heightCm?: number })?.heightCm ?? 200;
    const pxPerCm       = (refPanel.floorY - refPanel.apexY) / refHeightCm;
    const floorY        = layout.floorY;
    const groupLeft     = Math.min(...layout.panels.map((p) => p.cx - p.pw / 2));

    // Build flat list sorted tallest first
    const standeesToDraw: { heightCm: number; label: string }[] = [];
    for (const item of activeCutouts) {
      for (let q = 0; q < item.quantity; q++) {
        standeesToDraw.push({ heightCm: item.heightCm, label: `${item.quantity > 1 ? `${item.quantity}x ` : ""}${item.heightCm}cm` });
      }
    }
    standeesToDraw.sort((a, b) => b.heightCm - a.heightCm);

    const standeeGap = Math.round(W * 0.03); // gap between backdrop and first standee
    const betweenGap = Math.round(W * 0.012); // gap between consecutive standees
    let curRight = groupLeft - standeeGap; // right edge of next standee placement

    for (const standee of standeesToDraw) {
      const heightPx = Math.round(standee.heightCm * pxPerCm);
      const widthPx  = Math.max(28, Math.round(heightPx * 0.22));
      const cx       = curRight - widthPx / 2;

      // Don't draw off the left canvas edge
      if (cx - widthPx / 2 < 4) break;

      content.push(standeeGuide(cx, floorY, heightPx, standee.label));
      cutoutPlaceholderHeightsCm.push(standee.heightCm);
      curRight = cx - widthPx / 2 - betweenGap;
    }
  }

  // Assemble SVG: full-canvas background + scaled content group
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `  ${bgLines.join("\n  ")}`,
    `  <g transform="translate(${marginX},${marginY}) scale(${SCALE})">`,
    `    ${content.join("\n    ")}`,
    `  </g>`,
    `</svg>`,
  ].join("\n");

  return {
    svg,
    viewBoxW:   W,
    viewBoxH:   H,
    falImageSize,
    cutoutPlaceholderCount:      cutoutPlaceholderHeightsCm.length,
    cutoutPlaceholderHeightsCm,
    doubleArchGarlandBalloonsLeft,
    doubleArchGarlandBalloonsRight,
  };
}
