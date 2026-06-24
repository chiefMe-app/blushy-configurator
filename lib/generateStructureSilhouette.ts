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

function panelPathOrShape(
  cx: number, pw: number, apexY: number, floorY: number,
  shape: BackdropShapeId,
): string {
  const r     = pw / 2;
  const left  = cx - r;
  const right = cx + r;

  if (shape === "round") {
    const centerY = apexY + r;
    return `<circle cx="${cx}" cy="${centerY}" r="${r}" fill="#F0ECE8" stroke="rgba(0,0,0,0.20)" stroke-width="2"/>`;
  }

  if (shape === "rect" || shape === "shimmer_wall") {
    const h = floorY - apexY;
    return `<rect x="${left}" y="${apexY}" width="${pw}" height="${h}" fill="#F0ECE8" stroke="rgba(0,0,0,0.20)" stroke-width="2"/>`;
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
    return `<path d="${pts.join(" ")}" fill="#F0ECE8" stroke="rgba(0,0,0,0.20)" stroke-width="2"/>`;
  }

  // arch / default — the most important case: 100×200cm → r = pw/2, springY = apexY + r
  const springY = apexY + r;
  const d = [
    `M ${left},${floorY}`,
    `L ${left},${springY}`,
    `A ${r},${r} 0 0 1 ${right},${springY}`,
    `L ${right},${floorY}`,
    "Z",
  ].join(" ");
  return `<path d="${d}" fill="#F0ECE8" stroke="rgba(0,0,0,0.20)" stroke-width="2"/>`;
}

function plinthRect(cx: number, bottomY: number, heightPx: number, diameterPx: number): string {
  // Enforce visual height:width ≥ 2.8 so it never reads as a squat podium or cake stand.
  const visualWidth = Math.min(diameterPx, Math.round(heightPx / 2.8));
  const rx   = visualWidth / 2;
  const topY = bottomY - heightPx;
  return [
    // floor shadow
    `<ellipse cx="${cx}" cy="${bottomY + 3}" rx="${(rx * 0.9).toFixed(1)}" ry="${(rx * 0.18).toFixed(1)}" fill="rgba(0,0,0,0.13)"/>`,
    // body — drawn as a rectangle, unambiguously a tall column
    `<rect x="${cx - rx}" y="${topY}" width="${visualWidth}" height="${heightPx}" fill="#FFFFFF" stroke="rgba(0,0,0,0.15)" stroke-width="1.5"/>`,
    // top cap line
    `<line x1="${cx - rx}" y1="${topY}" x2="${cx + rx}" y2="${topY}" stroke="rgba(0,0,0,0.28)" stroke-width="2"/>`,
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
  const [W, H]           = VIEWBOX[falImageSize];

  const layout = calculateExactLayout(backdropItems, plinthSizes, W, H);

  const colors: string[] = (balloonColors && balloonColors.length > 0)
    ? balloonColors.slice(0, 4)
    : ["#C8D8E8", "#E8EEF4", "#B0C8DC"];

  const lines: string[] = [];

  // Background
  lines.push(`<rect width="${W}" height="${H}" fill="#D8D4D0"/>`);

  // Floor area
  lines.push(`<rect x="0" y="${layout.floorY}" width="${W}" height="${H - layout.floorY}" fill="#C4C0BC"/>`);
  lines.push(`<line x1="0" y1="${layout.floorY}" x2="${W}" y2="${layout.floorY}" stroke="#A8A4A0" stroke-width="2"/>`);

  // Backdrop panels (tallest first via zOrder)
  const sorted = [...layout.panels].sort((a, b) => a.zOrder - b.zOrder);
  for (const panel of sorted) {
    const item  = backdropItems[panel.idx];
    const shape = (item?.type ?? "arch") as BackdropShapeId;
    lines.push(panelPathOrShape(panel.cx, panel.pw, panel.apexY, panel.floorY, shape));
  }

  // Plinths — tall narrow rectangles, placed on the open side when half garland is configured.
  for (const p of layout.plinths) {
    // When a half garland runs down the right side, shift the plinth to the open left zone
    // so it is clearly separated from the garland in the silhouette.
    const plinthCx = balloonStyle === "half"
      ? Math.round(W * 0.28)
      : p.cx;
    lines.push(plinthRect(plinthCx, p.bottomY, p.heightPx, p.diameterPx));
  }

  // Balloon garland — drawn as one continuous organic filled blob, not separate circles.
  // Canny/ControlNet reads this as a single mass rather than a bead chain.
  if (balloonStyle !== "none" && layout.panels.length > 0) {
    const groupRight = Math.max(...layout.panels.map((p) => p.cx + p.pw / 2));
    const groupLeft  = Math.min(...layout.panels.map((p) => p.cx - p.pw / 2));
    const groupTop   = Math.min(...layout.panels.map((p) => p.apexY));
    const floorY     = layout.floorY;
    const dy         = floorY - groupTop;
    const primary    = colors[0];
    const secondary  = colors[1] ?? colors[0];

    if (balloonStyle === "half") {
      // Garland anchored to the right side of the panel group.
      // ax = inner (left) edge of garland = right edge of panels.
      // gw = horizontal width of the garland mass.
      const ax = groupRight;
      const gw = W * 0.14;

      // Single closed path: outer right edge curves organically from top to floor,
      // inner left edge follows the panel side, base widens into a compact floor cluster.
      const d = [
        // Start: top inner corner (panel right edge, panel top)
        `M ${ax},${groupTop}`,
        // Top burst: sweeps out to the right
        `Q ${ax + gw * 0.55},${groupTop - H * 0.008}  ${ax + gw * 0.95},${groupTop + dy * 0.13}`,
        // Upper mid: slight inward as it flows down
        `Q ${ax + gw * 0.88},${groupTop + dy * 0.28}  ${ax + gw * 0.72},${groupTop + dy * 0.46}`,
        // Lower mid: stays roughly same width, slight outward bow
        `Q ${ax + gw * 0.70},${groupTop + dy * 0.62}  ${ax + gw * 0.76},${groupTop + dy * 0.76}`,
        // Approach to floor: curves into base cluster
        `Q ${ax + gw * 0.88},${floorY - H * 0.03}  ${ax + gw * 0.78},${floorY}`,
        // Floor base: compact same-side cluster, does NOT extend far left
        `L ${ax - gw * 0.04},${floorY}`,
        // Inner edge: back up along the panel right side
        `Q ${ax},${floorY - dy * 0.12}  ${ax},${groupTop + dy * 0.3}`,
        `Q ${ax},${groupTop + dy * 0.08}  ${ax},${groupTop}`,
        `Z`,
      ].join(" ");

      // Soft blur shadow for organic depth
      lines.push(`<defs><filter id="gBlur"><feGaussianBlur stdDeviation="5"/></filter></defs>`);
      lines.push(`<path d="${d}" fill="${primary}" opacity="0.22" filter="url(#gBlur)"/>`);
      // Main garland silhouette — one solid readable mass
      lines.push(`<path d="${d}" fill="${primary}" opacity="0.88"/>`);
      // Soft internal color hints (no stroke) — suggests color variation without beads
      lines.push(`<ellipse cx="${(ax + gw*0.5).toFixed(1)}" cy="${(groupTop + dy*0.18).toFixed(1)}" rx="${(gw*0.32).toFixed(1)}" ry="${(dy*0.10).toFixed(1)}" fill="${secondary}" opacity="0.35"/>`);
      lines.push(`<ellipse cx="${(ax + gw*0.48).toFixed(1)}" cy="${(groupTop + dy*0.52).toFixed(1)}" rx="${(gw*0.26).toFixed(1)}" ry="${(dy*0.09).toFixed(1)}" fill="${secondary}" opacity="0.28"/>`);

    } else if (balloonStyle === "full" || balloonStyle === "premium") {
      const gw = W * (balloonStyle === "premium" ? 0.12 : 0.10);

      // Right side blob
      const makeStrip = (edgeX: number, dir: 1 | -1): string => {
        const ox = dir * gw;
        const d = [
          `M ${edgeX},${groupTop}`,
          `Q ${edgeX + ox * 0.9},${groupTop + dy * 0.1}  ${edgeX + ox},${groupTop + dy * 0.35}`,
          `Q ${edgeX + ox},${groupTop + dy * 0.65}  ${edgeX + ox * 0.85},${floorY}`,
          `L ${edgeX},${floorY}`,
          `Q ${edgeX},${groupTop + dy * 0.5}  ${edgeX},${groupTop}`,
          `Z`,
        ].join(" ");
        return `<path d="${d}" fill="${primary}" opacity="0.85"/>`;
      };
      // Top arc blob
      const topArcD = [
        `M ${groupLeft},${groupTop}`,
        `Q ${groupLeft + (groupRight-groupLeft)*0.5},${groupTop - gw * 0.9}  ${groupRight},${groupTop}`,
        `Q ${groupRight},${groupTop + gw * 0.3}  ${groupRight - gw * 0.3},${groupTop + gw * 0.4}`,
        `Q ${groupLeft + (groupRight-groupLeft)*0.5},${groupTop - gw * 0.2}  ${groupLeft + gw * 0.3},${groupTop + gw * 0.4}`,
        `Q ${groupLeft},${groupTop + gw * 0.3}  ${groupLeft},${groupTop}`,
        `Z`,
      ].join(" ");

      lines.push(`<defs><filter id="gBlur"><feGaussianBlur stdDeviation="5"/></filter></defs>`);
      lines.push(makeStrip(groupRight,  1));
      lines.push(makeStrip(groupLeft,  -1));
      lines.push(`<path d="${topArcD}" fill="${primary}" opacity="0.85"/>`);
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `  ${lines.join("\n  ")}`,
    `</svg>`,
  ].join("\n");

  return { svg, viewBoxW: W, viewBoxH: H, falImageSize };
}
