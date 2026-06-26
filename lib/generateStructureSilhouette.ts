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
  svg:          string;
  viewBoxW:     number;
  viewBoxH:     number;
  falImageSize: FalImageSize;
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
    const centerY = apexY + r;
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
    const centerY = apexY + r;
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generateStructureSilhouette(
  backdropItems:  BackdropItem[],
  plinthSizes:    PlinthSize[],
  balloonStyle:   BalloonStyleId,
  balloonColors?: string[],
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

  const colors: string[] = (balloonColors && balloonColors.length > 0)
    ? balloonColors.slice(0, 4)
    : ["#C8D8E8", "#E8EEF4", "#B0C8DC"];

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
  });

  // v4: Cylindrical plinth edge guide — no fill, no block
  const singleShimmer = backdropItems.length === 1 && backdropItems[0]?.type === "shimmer_wall";
  for (const p of layout.plinths) {
    const plinthCx = singleShimmer
      ? Math.round(W * 0.50)   // centered in front of the shimmer wall
      : balloonStyle === "half"
        ? Math.round(W * 0.28) // open left side, away from right-side garland
        : p.cx;
    content.push(plinthEdge(plinthCx, p.bottomY, p.heightPx, p.diameterPx));
  }

  // v4: Individual balloon circles — no filled blob, organic circles follow right-side path.
  // Avoids vertical slab boundary that the filled blob created.
  if (balloonStyle !== "none" && layout.panels.length > 0) {
    const groupRight = Math.max(...layout.panels.map((p) => p.cx + p.pw / 2));
    const groupLeft  = Math.min(...layout.panels.map((p) => p.cx - p.pw / 2));
    const groupTop   = Math.min(...layout.panels.map((p) => p.apexY));
    const floorY     = layout.floorY;
    const dy         = floorY - groupTop;
    const primary    = colors[0];
    const secondary  = colors[1] ?? colors[0];

    // Individual balloon circles along the configured path — no blobs, no slabs
    const balloonStroke = `stroke="rgba(85,85,85,0.30)" stroke-width="1"`;
    const balloonFill   = `fill="rgba(200,218,235,0.08)"`;

    if (balloonStyle === "half") {
      // Right-side half garland: circles from top-right corner to floor
      // Positioned outside the panel right edge with organic jitter
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
        content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r}" ${balloonFill} ${balloonStroke}/>`);
      }

    } else if (balloonStyle === "full" || balloonStyle === "premium") {
      const numPerSide = balloonStyle === "premium" ? 14 : 10;
      const offset     = Math.round(W * 0.05);

      const drawSide = (edgeX: number, dir: 1 | -1) => {
        for (let i = 0; i < numPerSide; i++) {
          const t  = i / (numPerSide - 1);
          const bx = edgeX + dir * (offset + (((i * 5) % 14)));
          const by = groupTop + t * dy;
          const r  = 12 + ((i * 7) % 9);
          content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r}" ${balloonFill} ${balloonStroke}/>`);
        }
      };
      drawSide(groupRight,  1);
      drawSide(groupLeft,  -1);
      // Top arc circles
      for (let i = 0; i < numPerSide; i++) {
        const t  = i / (numPerSide - 1);
        const bx = groupLeft + t * (groupRight - groupLeft);
        const by = groupTop - offset + (((i * 5) % 12));
        content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${12 + ((i * 3) % 7)}" ${balloonFill} ${balloonStroke}/>`);
      }
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

  return { svg, viewBoxW: W, viewBoxH: H, falImageSize };
}
