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
  /** Arch + Open Frame dense garland guide — 0 when not that layout. */
  archOpenFrameMainGarlandBalloons: number;
  archOpenFrameMiniClusterBalloons: number;
  /** Radius range (px) and lane count of the main garland's thick-mass style. */
  archOpenFrameMainGarlandMinRadiusPx: number;
  archOpenFrameMainGarlandMaxRadiusPx: number;
  archOpenFrameMainGarlandLaneCount:   number;
  archOpenFrameMainGarlandStyle:       string;
  /** Actual frame-border thickness (px) drawn for open_arch_frame — 0 when absent. */
  archOpenFrameFrameThicknessPx: number;
  /** Geometry version tag for the open-frame band drawing. */
  archOpenFrameGeometryStyle:    string;
  /** Arch + Shimmer composition guide (arch-side dense garland + shimmer-side
   *  accent cluster) balloon count — 0 when not that layout. */
  archShimmerCompositionBalloons: number;
  /** Bounding box (panel-local px, same coordinate space as PanelLayout) of
   *  the shimmer-side accent cluster — used to exclude it from the
   *  post-render shimmer recolor mask so those balloons are never tinted.
   *  Null when not that layout. */
  archShimmerAccentZone: { xMin: number; xMax: number; yMin: number; yMax: number } | null;
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

// ═══════════════════════════════════════════════════════════════════════════
// GOLDEN SHIMMER METHOD — do not modify without re-verifying Arch + Shimmer
// and Single Shimmer render quality end-to-end. This is the current source
// of truth for the good shimmer-wall look and is shared by both layouts
// (see singleShimmerUsesArchShimmerMethod in the route diagnostics).
//
// Builds a shimmer-tile <defs><pattern> that reads as a dense, fine-grained
// event sequin wall — a flat single-color tile fill with a thin neutral grid
// line, at a small tile size so the model reads it as texture, not shapes.
//
// KEEP:
//   - flat single-color tile <rect> (one solid fill per tile)
//   - thin neutral grid stroke (rgba(60,60,90,0.50), stroke-width 0.7)
//   - small tile size: Math.max(10, Math.round(panel.pw * 0.05)) at both
//     call sites below (~20 tiles across the panel)
// DO NOT:
//   - reintroduce a large checkerboard / 2x2 light-dark-shaded paillette
//     pattern (tried as "v2 large paillette checker" and reverted)
//   - enlarge the tile size so individual tiles become big, distinct squares
//   - do anything that makes tiles readable as separate shapes at a glance
//
// v2 ("large paillette checker") tried a 2x2 light/dark checkerboard at a much
// bigger tile size to make individual sequins more readable — it backfired:
// the edit model copied the checker cells literally as visible square
// patchwork/mosaic blocks instead of a sequin texture, degrading the
// previously-good Arch + Shimmer look even with color=silver. Restored here
// to the smaller flat-tile version that produced the good result.
// ═══════════════════════════════════════════════════════════════════════════
function shimmerTilePatternDefs(patId: string, tileSize: number, baseFill: string): string {
  return [
    `<defs>`,
    `  <pattern id="${patId}" patternUnits="userSpaceOnUse" width="${tileSize}" height="${tileSize}">`,
    `    <rect width="${tileSize}" height="${tileSize}" fill="${baseFill}"/>`,
    `    <rect width="${tileSize}" height="${tileSize}" fill="none" stroke="rgba(60,60,90,0.50)" stroke-width="0.7"/>`,
    `  </pattern>`,
    `</defs>`,
  ].join("\n    ");
}

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

// Open arch frame — a THICK freestanding decor prop, not a thin doorway
// outline. Drawn as one filled band (outer arch silhouette minus the inner
// arch silhouette, via fill-rule="evenodd") so the frame has real visual
// material/mass, matching a premium event arch cutout — with a clean hollow
// arch-shaped opening cut through the center, never a wire outline.
function openArchFramePath(
  cx: number, pw: number, apexY: number, floorY: number,
  fillColor: string,
): { svg: string; frameThicknessPx: number } {
  const closedArch = (r: number, left: number, right: number, topY: number): string => {
    const springY = topY + r;
    return `M ${left},${floorY} L ${left},${springY} A ${r},${r} 0 0 1 ${right},${springY} L ${right},${floorY} Z`;
  };
  const rOuter = pw / 2;
  // Bold, substantial frame border — roughly a fifth of the panel's own
  // width, clamped so the hollow opening always stays clearly visible
  // (inner radius never collapses below ~54% of the outer radius).
  const frameT = Math.max(20, Math.min(rOuter * 0.46, pw * 0.20));
  const rInner = rOuter - frameT;

  const outerPath = closedArch(rOuter, cx - rOuter, cx + rOuter, apexY);
  const innerPath = closedArch(rInner, cx - rInner, cx + rInner, apexY + frameT);

  const svg = [
    // Solid filled band — outer arch silhouette with the inner arch punched
    // out (evenodd). This is the frame's real material, giving it visual weight.
    `<path d="${outerPath} ${innerPath}" fill-rule="evenodd" fill="${fillColor}" stroke="rgba(120,120,120,0.30)" stroke-width="1.5"/>`,
    // Inner-rim shading — a subtle darker line along the hollow opening to
    // sell material depth/thickness, not just a flat painted outline.
    `<path d="${innerPath}" fill="none" stroke="rgba(90,90,90,0.30)" stroke-width="1.2"/>`,
  ].join("\n    ");

  return { svg, frameThicknessPx: Math.round(frameT) };
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
  // Sequin-disc tile fill for shimmer_wall panels — defaults to the original silver-gray
  // so any caller that doesn't pass it keeps the pre-existing look.
  shimmerColorHex?: string,
): SilhouetteResult {
  const shimmerTileFill = shimmerColorHex ?? "#D8D8E4";
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

  // Dense garland guide counters — set only in their layout branches,
  // reported in the result for diagnostics.
  let doubleArchGarlandBalloonsLeft  = 0;
  let doubleArchGarlandBalloonsRight = 0;
  let archOpenFrameMainGarlandBalloons = 0;
  let archOpenFrameMiniClusterBalloons = 0;
  let archOpenFrameMainGarlandMinRadiusPx = 0;
  let archOpenFrameMainGarlandMaxRadiusPx = 0;
  let archOpenFrameMainGarlandLaneCount   = 0;
  // Set whenever an open_arch_frame panel is drawn — reports the actual
  // frame-border thickness (px) of the thick decor-prop geometry fix.
  let archOpenFrameFrameThicknessPx = 0;
  // Set whenever the arch_shimmer layout (one arch + one shimmer_wall, no
  // open frame) draws its composition — see drawArchShimmerComposition below.
  let archShimmerCompositionBalloons = 0;
  let archShimmerAccentZone: { xMin: number; xMax: number; yMin: number; yMax: number } | null = null;

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

    // Open arch frame: a thick filled decor-prop band with a hollow center —
    // same neutral fill family as the paired solid arch (MULTI_PANEL_FILLS),
    // so the pair reads as one coordinated set, not a wire outline vs a board.
    if (shape === "open_arch_frame") {
      const frameFill = MULTI_PANEL_FILLS[sortedIdx % MULTI_PANEL_FILLS.length];
      const frame = openArchFramePath(panel.cx, panel.pw, panel.apexY, panel.floorY, frameFill);
      content.push(frame.svg);
      archOpenFrameFrameThicknessPx = frame.frameThicknessPx;
      return;
    }

    if (isMultiPanel) {
      const baseFill = MULTI_PANEL_FILLS[sortedIdx % MULTI_PANEL_FILLS.length];

      if (isShimmer) {
        // Shimmer wall: dense small tile grid so the edit model reads it as a
        // fine sequin-textured wall, not a matte board and not visible mosaic blocks.
        // GOLDEN SHIMMER METHOD (see shimmerTilePatternDefs above) — do not
        // enlarge tileSize or swap in a checkerboard/paillette pattern here.
        const patId    = `shimmerTile_${sortedIdx}`;
        const tileSize = Math.max(10, Math.round(panel.pw * 0.05)); // ~20 tiles across the panel
        content.push(shimmerTilePatternDefs(patId, tileSize, shimmerTileFill));
        content.push(panelPathOrShape(panel.cx, panel.pw, panel.apexY, panel.floorY, shape, `url(#${patId})`));
      } else {
        content.push(panelPathOrShape(panel.cx, panel.pw, panel.apexY, panel.floorY, shape, MULTI_PANEL_FILLS[sortedIdx % MULTI_PANEL_FILLS.length]));
      }
    } else if (isShimmer) {
      // Single shimmer wall: force a clean rectangle (never arch edges) with tile grid.
      // Using <rect> directly avoids any arch-like path the panelEdgeOnly/panelPathOrShape
      // functions might generate, which could mislead the edit model into adding an arch.
      // GOLDEN SHIMMER METHOD (see shimmerTilePatternDefs above) — same tileSize
      // formula as the arch_shimmer branch so single_shimmer stays at parity.
      const patId    = `shimmerTileSingle`;
      const tileSize = Math.max(10, Math.round(panel.pw * 0.05));
      const left     = panel.cx - panel.pw / 2;
      const panelH   = panel.floorY - panel.apexY;
      content.push([
        shimmerTilePatternDefs(patId, tileSize, shimmerTileFill),
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
        // Dense organic garland helper — thick layered band: floor/base cluster
        // → staggered climb band up the outer edge → crown cluster over the top
        // shoulder. Shared by double_arch (both arches) and arch_open_frame
        // (solid arch only). Never a thin single-file row.
        const drawDenseGarland = (p: typeof layout.panels[0], side: "left" | "right", colorOffset: number): number => {
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

        // Thick organic MASS garland for Arch + Open Frame's solid arch —
        // a real decorator-style balloon cluster, not a thin dotted outline.
        // Radii scale off the panel's own width (p.pw) so the mass reads as
        // proportionally thick regardless of arch size. Style: "thick_organic_mass_v2".
        const drawThickOrganicMainGarland = (
          p: typeof layout.panels[0], side: "left" | "right", colorOffset: number,
        ): { count: number; minR: number; maxR: number; lanes: number } => {
          const dir   = side === "left" ? -1 : 1;
          const edgeX = p.cx + dir * (p.pw / 2);
          const Hp    = p.floorY - p.apexY;
          let n = 0;
          let minR = Infinity, maxR = 0;
          const put = (bx: number, by: number, br: number) => {
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" ${balloonAttrs(colorOffset + n)}/>`);
            n++;
            if (br < minR) minR = br;
            if (br > maxR) maxR = br;
          };

          // Radius scale relative to panel width — large/medium/small anchors.
          const rLarge  = Math.max(20, Math.min(50, p.pw * 0.17));
          const rMed    = Math.max(14, Math.min(34, p.pw * 0.12));
          const rSmall  = Math.max(9,  Math.min(22, p.pw * 0.08));

          // 1) Floor/base cluster — 16 heavily overlapping balloons mounded at
          //    the outer base, several large anchors for a dense floor pile.
          const BASE: [number, number, "L" | "M" | "S"][] = [
            [   4,  10, "L"], [  32,  14, "L"], [ -20,  16, "L"], [  16,  38, "L"],
            [ -10,  30, "M"], [  44,  32, "M"], [  22,  56, "M"], [  -2,  56, "M"],
            [  50,  54, "S"], [   6,  74, "S"], [ -18,  46, "S"], [  36,  74, "S"],
            [  14,  92, "M"], [ -12,  86, "S"], [  46,  90, "S"], [   0, 104, "S"],
          ];
          const sizeR = { L: rLarge, M: rMed, S: rSmall };
          for (const [ox, up, sz] of BASE) put(edgeX + dir * ox, p.floorY - up, sizeR[sz]);

          // 2) Side climb — 30 balloons across 5 staggered lanes, overlapping
          //    35–60% between neighbors, forming a genuinely thick band from
          //    just above the base to the spring line.
          const climbN  = 30;
          const laneOffsets = [-rLarge * 0.5, rLarge * 0.15, rLarge * 0.85, rLarge * 1.5, rLarge * 2.1];
          const laneSizes: ("L" | "M" | "S")[] = ["M", "L", "M", "S", "S"];
          for (let i = 0; i < climbN; i++) {
            const t = i / (climbN - 1);
            const y = p.floorY - Hp * (0.16 + t * 0.62); // 16% → 78% panel height
            const lane = i % 5;
            const wobble = ((i * 17) % 13) - 6; // deterministic organic jitter
            const x = edgeX + dir * (laneOffsets[lane] + wobble);
            const sz = laneSizes[lane];
            put(x, y, sizeR[sz]);
          }

          // 3) Crown curl — 16 balloons wrapping the outer shoulder over the
          //    top of the arch arc in 3 depth lanes, large near the crown apex.
          const rArc  = p.pw / 2;
          const arcCx = p.cx;
          const arcCy = p.apexY + rArc;
          const angFrom = side === "left" ? 178 : 2;
          const angTo   = side === "left" ? 268 : -88;
          const crownN = 16;
          for (let i = 0; i < crownN; i++) {
            const t   = i / (crownN - 1);
            const ang = ((angFrom + (angTo - angFrom) * t) * Math.PI) / 180;
            const depthLane = i % 3;
            const rad = rArc + [-rSmall * 0.4, rMed * 0.6, rLarge * 0.85][depthLane];
            const x   = arcCx + rad * Math.cos(ang);
            const y   = arcCy + rad * Math.sin(ang);
            const sz: "L" | "M" | "S" = depthLane === 2 ? "L" : depthLane === 1 ? "M" : "S";
            put(x, y, sizeR[sz]);
          }

          return { count: n, minR: Math.round(minR), maxR: Math.round(maxR), lanes: 5 };
        };

        // Arch + Shimmer composition — TWO independently well-composed
        // treatments rather than one interpolated bridge:
        //   - the arch gets its own full, proven-good dense garland
        //     (drawDenseGarland — the same function double_arch uses on both
        //     its arches), on the arch's OUTER side (away from the shimmer wall)
        //   - the shimmer wall gets its own standalone accent cluster on its
        //     near-top corner (the corner adjacent to the arch)
        //
        // An earlier version interpolated balloons across the panel gap to
        // physically connect the two into one continuous mass ("bridge
        // garland"). A real render comparison showed that read as an awkward,
        // over-engineered composition — reverted in favor of this simpler,
        // proven pattern that matches the older, visually-successful
        // arrangement: lush arch garland + elegant shimmer-side accent,
        // no forced connecting bridge.
        //
        // Direction-agnostic: mirrors via `dir` so it reads correctly whether
        // the arch or the shimmer wall ends up on the left (panel order
        // normally has arch first/left per applySetupTemplate, but this
        // doesn't assume that).
        const drawArchShimmerComposition = (
          archP: typeof layout.panels[0], shimmerP: typeof layout.panels[0], colorOffset: number,
        ): { total: number; accentZone: { xMin: number; xMax: number; yMin: number; yMax: number } } => {
          const shimmerOnRight = shimmerP.cx > archP.cx;
          const archOuterSide: "left" | "right" = shimmerOnRight ? "left" : "right";
          const archCount = drawDenseGarland(archP, archOuterSide, colorOffset);

          const dir = shimmerOnRight ? 1 : -1;
          const shimmerNearX = shimmerOnRight ? shimmerP.cx - shimmerP.pw / 2 : shimmerP.cx + shimmerP.pw / 2;
          const shimmerTopY  = shimmerP.apexY;
          const rLarge = Math.max(16, Math.min(26, shimmerP.pw * 0.11));
          const rMed   = Math.max(12, Math.min(20, shimmerP.pw * 0.08));
          const rSmall = Math.max(9,  Math.min(15, shimmerP.pw * 0.055));

          // Standalone accent cluster — elegant, well-composed corner accent,
          // 3 depth lanes for real volume (not a token handful of dots),
          // placed on the shimmer wall's near-top corner only.
          const OX_MIN = 4, OX_MAX = 30, OY_MIN = -9, OY_MAX = 38;
          let accentN = 0;
          const putAccent = (bx: number, by: number, br: number) => {
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" ${balloonAttrs(colorOffset + archCount + accentN)}/>`);
            accentN++;
          };
          const accentCount = 12;
          for (let i = 0; i < accentCount; i++) {
            const t    = i / (accentCount - 1);
            const lane = i % 3;
            const ox   = dir * (OX_MIN + t * (OX_MAX - OX_MIN) + (((i * 7) % 9) - 4));
            const oy   = OY_MIN + t * (OY_MAX - OY_MIN) + (((i * 5) % 7) - 3);
            const br   = lane === 2 ? rLarge : lane === 1 ? rMed : rSmall;
            putAccent(shimmerNearX + ox, shimmerTopY + oy, br);
          }

          // Bounding zone for the accent cluster (panel-local px, same space
          // as PanelLayout) — reported so route.ts can exclude this known
          // balloon region from the shimmer recolor mask, so the recolor
          // never tints these balloons. Derived from the exact same
          // OX_MIN/OX_MAX/OY_MIN/OY_MAX/jitter bounds used to place them
          // above, plus each balloon's own radius.
          const jitterMax = 4;
          const oxSpan = OX_MAX + jitterMax;
          const accentZone = {
            xMin: shimmerNearX + Math.min(0, dir * oxSpan) - rLarge,
            xMax: shimmerNearX + Math.max(0, dir * oxSpan) + rLarge,
            yMin: shimmerTopY + OY_MIN - rLarge,
            yMax: shimmerTopY + OY_MAX + jitterMax + rLarge,
          };

          return { total: archCount + accentN, accentZone };
        };

        const archPanels = layout.panels.filter(
          (p) => (backdropItems[p.idx]?.type ?? "") === "arch",
        );
        const shimmerPanels = layout.panels.filter(
          (p) => (backdropItems[p.idx]?.type ?? "") === "shimmer_wall",
        );
        const framePanel = layout.panels.find(
          (p) => (backdropItems[p.idx]?.type ?? "") === "open_arch_frame",
        );

        if (archPanels.length === 2) {
          // Double arch: mirrored dense garlands, center stays clean.
          const pair = [...archPanels].sort((a, b) => a.cx - b.cx);
          doubleArchGarlandBalloonsLeft  = drawDenseGarland(pair[0], "left", 0);
          doubleArchGarlandBalloonsRight = drawDenseGarland(pair[1], "right", 7);
        } else if (framePanel && archPanels.length === 1) {
          // Arch + Open Frame: the SOLID ARCH carries a thick organic-mass
          // garland (floor base → outer edge climb → over the crown, ~62
          // heavily overlapping balloons in varied sizes — not a dotted
          // outline). The hollow frame gets only a small matching mini-cluster
          // on its OUTER top shoulder — never inside the hollow opening.
          const solidArch = archPanels[0];
          const archOuterSide: "left" | "right" = solidArch.cx < framePanel.cx ? "left" : "right";
          const mainResult = drawThickOrganicMainGarland(solidArch, archOuterSide, 0);
          archOpenFrameMainGarlandBalloons     = mainResult.count;
          archOpenFrameMainGarlandMinRadiusPx  = mainResult.minR;
          archOpenFrameMainGarlandMaxRadiusPx  = mainResult.maxR;
          archOpenFrameMainGarlandLaneCount    = mainResult.lanes;

          // Mini shoulder cluster — 15 balloons (medium + small, no tiny dots)
          // in two overlapping depth lanes hugging the frame's outer shoulder
          // arc (upper quarter only), all OUTSIDE the hollow band.
          const rF        = framePanel.pw / 2;
          const springCy  = framePanel.apexY + rF;
          const rFMed     = Math.max(13, Math.min(26, framePanel.pw * 0.11));
          const rFSmall   = Math.max(9,  Math.min(18, framePanel.pw * 0.075));
          const frameOuterRight = framePanel.cx > solidArch.cx; // frame's outer side faces away from the arch
          const angFrom = frameOuterRight ? -80 : 260;
          const angTo   = frameOuterRight ? -4  : 184;
          const miniN = 15;
          let miniCount = 0;
          for (let i = 0; i < miniN; i++) {
            const t    = i / (miniN - 1);
            const ang  = ((angFrom + (angTo - angFrom) * t) * Math.PI) / 180;
            const lane = i % 2;
            const rad  = rF + (lane === 0 ? rFMed * 0.7 : rFMed * 1.5) + (i % 3 === 0 ? 4 : 0);
            const bx   = framePanel.cx + rad * Math.cos(ang);
            const by   = springCy + rad * Math.sin(ang);
            const br   = lane === 0 ? rFMed : rFSmall;
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" ${balloonAttrs(9 + miniCount)}/>`);
            miniCount++;
          }
          archOpenFrameMiniClusterBalloons = miniCount;
        } else if (framePanel) {
          // Shimmer + Open Frame (no solid arch): compact accent cluster on the
          // frame's top-right shoulder only — hollow silhouette stays visible.
          const r        = framePanel.pw / 2;
          const springCy = framePanel.apexY + r;
          const numBalloons = 8;
          for (let i = 0; i < numBalloons; i++) {
            const t        = i / (numBalloons - 1);
            const angleDeg = -62 + t * 72;
            const angleRad = (angleDeg * Math.PI) / 180;
            const rr       = r + Math.round(W * 0.018) + (i % 2 === 0 ? 4 : -3);
            const bx       = framePanel.cx + rr * Math.cos(angleRad);
            const by       = springCy + rr * Math.sin(angleRad);
            const br       = i < 2 ? 18 : 10 + ((i * 5) % 7);
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br}" ${balloonAttrs(i)}/>`);
          }
        } else if (!framePanel && archPanels.length === 1 && shimmerPanels.length === 1) {
          // Arch + Shimmer: one arch, one shimmer_wall, no open frame — draw
          // the two-treatment composition instead of falling through to the
          // generic single-side vertical garland below (which would leave the
          // arch with no garland at all).
          const result = drawArchShimmerComposition(archPanels[0], shimmerPanels[0], 0);
          archShimmerCompositionBalloons = result.total;
          archShimmerAccentZone = result.accentZone;
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
    archOpenFrameMainGarlandBalloons,
    archOpenFrameMiniClusterBalloons,
    archOpenFrameMainGarlandMinRadiusPx,
    archOpenFrameMainGarlandMaxRadiusPx,
    archOpenFrameMainGarlandLaneCount,
    archOpenFrameMainGarlandStyle: archOpenFrameMainGarlandBalloons > 0 ? "thick_organic_mass_v2" : "none",
    archOpenFrameFrameThicknessPx,
    archOpenFrameGeometryStyle: archOpenFrameFrameThicknessPx > 0 ? "thick_decor_prop_v2" : "none",
    archShimmerCompositionBalloons,
    archShimmerAccentZone,
  };
}

/** Normalized (0..1) bounding box of a panel within the full composed canvas. */
export interface RegionFraction {
  xFrac: number;
  yFrac: number;
  wFrac: number;
  hFrac: number;
}

export interface ShimmerMaskGeometry {
  /** Exact shimmer_wall panel bounds — no padding, no search window. */
  panel: RegionFraction;
  /** Known foreground objects (plinths) to punch out of the recolor mask,
   *  since they can visually sit in front of the shimmer wall's own footprint. */
  excludeRects: RegionFraction[];
}

/**
 * Computes the shimmer_wall panel's EXACT bounding box (no padding) plus any
 * known foreground objects to exclude, both as fractions of the full
 * rendered canvas — used by the deterministic post-render shimmer recolor
 * step (app/api/generate-controlled-render/route.ts) to build a precise mask
 * without touching the AI prompt/guide.
 *
 * v3: reverted from a padded "search window" + texture-based width
 * refinement (v2) back to pure geometry per explicit product decision — the
 * padding/texture-search approach leaked color onto background wall/plinth
 * in real renders, which is unacceptable. This version trades a small risk
 * of under-coverage (a thin sliver of un-recolored silver at the true edge,
 * if the edit model renders the panel slightly wider than predicted) for
 * eliminating bleed entirely, which real-render testing shows is the right
 * tradeoff: the model has been reliable about panel position/vertical extent
 * throughout this project, and horizontal drift (when it happens) is modest.
 *
 * Reuses the exact same layout math (VIEWBOX, calculateExactLayout, the 0.80
 * SCALE and margin transform) as the main silhouette generator, so the mask
 * matches what the guide showed the edit model.
 *
 * Returns null when there is no shimmer_wall panel in the scene.
 */
export function computeShimmerWallMaskGeometry(
  backdropItems: BackdropItem[],
  plinthSizes:   PlinthSize[],
  balloonStyle:  BalloonStyleId,
): ShimmerMaskGeometry | null {
  const { falImageSize } = calculateRenderAspectRatio(backdropItems);
  const [Wbase, H]       = VIEWBOX[falImageSize];
  const isMultiPanel     = backdropItems.length > 1;
  const W                = isMultiPanel ? Math.round(Wbase * 1.4) : Wbase;
  const layout           = calculateExactLayout(backdropItems, plinthSizes, W, H);

  const shimmerIdx = backdropItems.findIndex((item) => item.type === "shimmer_wall");
  if (shimmerIdx === -1) return null;
  const panel = layout.panels.find((p) => p.idx === shimmerIdx);
  if (!panel) return null;

  const SCALE   = 0.80;
  const marginX = Math.round(W * (1 - SCALE) / 2);
  const marginY = Math.round(H * (1 - SCALE) / 2);

  const toFrac = (xMin: number, xMax: number, yMin: number, yMax: number): RegionFraction => {
    const outerLeft   = marginX + xMin * SCALE;
    const outerRight  = marginX + xMax * SCALE;
    const outerTop    = marginY + yMin * SCALE;
    const outerBottom = marginY + yMax * SCALE;
    const xFrac = Math.max(0, outerLeft / W);
    const yFrac = Math.max(0, outerTop / H);
    const wFrac = Math.min(1, outerRight / W) - xFrac;
    const hFrac = Math.min(1, outerBottom / H) - yFrac;
    return { xFrac, yFrac, wFrac, hFrac };
  };

  // Real-render comparison (pre-recolor AI output vs. post-recolor result)
  // proved two of this function's earlier assumptions wrong:
  //
  // 1) The plinth's x-position override below (replicating the *guide's*
  //    drawn position) doesn't match reality, because the AI doesn't
  //    actually follow the guide dot for the plinth — it follows the TEXT
  //    prompt instead, which unconditionally says "Place it front-left of
  //    the backdrop" (buildLayoutRefEditPrompt.ts plinthDesc), regardless of
  //    layout. A real single_shimmer+pink render placed the plinth clearly
  //    front-left, not centered at W*0.50 as the old override assumed —
  //    leaving the exclusion hole nowhere near the actual plinth and letting
  //    it get tinted. "Front-left" has no exact coordinate, so instead of
  //    guessing a second fixed x, the exclusion is anchored at the panel's
  //    OWN left edge (known precisely) and sized off the plinth's own
  //    diameter/height — robust to wherever "front-left" actually lands,
  //    as long as it's in the panel's left neighborhood (which is the only
  //    case that can bleed onto the panel anyway).
  //
  // 2) A purely exact, unpadded panel rectangle still bled onto the
  //    single_shimmer corner garland: that layout's "half" balloon style
  //    draws one dense, premium garland cascading from the panel's top-right
  //    corner down its right edge to the floor (the "Arch / rect / other"
  //    branch above), and in real renders that garland visibly drapes well
  //    into the panel's own right ~third and top ~sixth — not just grazing
  //    the edge. Since balloon guide-dot positions undershoot how generously
  //    the AI drapes the garland, the fix insets the panel rect itself on
  //    those two edges (coverage loss on that strip, accepted per the
  //    project's "never bleed onto balloons" priority) rather than trying to
  //    predict individual balloon positions.
  // 3) For arch_shimmer (the only multi-panel case here), a real render
  //    comparison against its own pre-recolor output showed the panel's
  //    predicted top edge sits a modest ~5% of panel height ABOVE where the
  //    sequin texture actually starts — bleeding a flat tinted band onto the
  //    bare wall above it. single_shimmer's top edge measured pixel-perfect
  //    in the same comparison, so this inset is scoped to the multi-panel
  //    case only (isMultiPanel), not applied universally.
  const singleShimmerLocal = backdropItems.length === 1 && backdropItems[0]?.type === "shimmer_wall";
  const hasCornerGarland    = singleShimmerLocal && balloonStyle === "half";

  const panelLeft  = panel.cx - panel.pw / 2;
  const panelRight = panel.cx + panel.pw / 2;
  const panelTop   = panel.apexY;
  const panelHeight = panel.floorY - panel.apexY;

  const panelRect = toFrac(
    panelLeft,
    hasCornerGarland ? panelRight - panel.pw * 0.32 : panelRight,
    hasCornerGarland ? panelTop + panelHeight * 0.16 : isMultiPanel ? panelTop + panelHeight * 0.07 : panelTop,
    panel.floorY,
  );

  const excludeRects: RegionFraction[] = singleShimmerLocal
    ? layout.plinths.map((pl) => {
        const padX = Math.max(10, pl.diameterPx * 0.25);
        const padY = Math.max(10, pl.heightPx * 0.15);
        return toFrac(
          panelLeft - padX, panelLeft + pl.diameterPx * 1.3 + padX,
          pl.bottomY - pl.heightPx * 1.15 - padY, pl.bottomY + padY,
        );
      })
    : layout.plinths.map((pl) => {
        const padX = Math.max(10, pl.diameterPx * 0.35);
        const padY = Math.max(10, pl.heightPx * 0.12);
        return toFrac(
          pl.cx - pl.diameterPx / 2 - padX, pl.cx + pl.diameterPx / 2 + padX,
          pl.bottomY - pl.heightPx - padY, pl.bottomY + padY,
        );
      });

  return { panel: panelRect, excludeRects };
}

/**
 * Transforms a panel-space rect (same coordinate system as PanelLayout — e.g.
 * SilhouetteResult.archShimmerAccentZone) into a canvas-fraction
 * RegionFraction, using the same W/H/SCALE/margin transform as
 * computeShimmerWallMaskGeometry — so a known balloon-cluster zone can also
 * be punched out of the shimmer recolor mask, guaranteed consistent with
 * where the guide actually drew those balloons (same source values, not a
 * re-derived approximation).
 */
export function panelRectToFraction(
  backdropItems: BackdropItem[],
  rect: { xMin: number; xMax: number; yMin: number; yMax: number },
): RegionFraction {
  const { falImageSize } = calculateRenderAspectRatio(backdropItems);
  const [Wbase, H]       = VIEWBOX[falImageSize];
  const isMultiPanel     = backdropItems.length > 1;
  const W                = isMultiPanel ? Math.round(Wbase * 1.4) : Wbase;
  const SCALE   = 0.80;
  const marginX = Math.round(W * (1 - SCALE) / 2);
  const marginY = Math.round(H * (1 - SCALE) / 2);
  const outerLeft   = marginX + rect.xMin * SCALE;
  const outerRight  = marginX + rect.xMax * SCALE;
  const outerTop    = marginY + rect.yMin * SCALE;
  const outerBottom = marginY + rect.yMax * SCALE;
  const xFrac = Math.max(0, outerLeft / W);
  const yFrac = Math.max(0, outerTop / H);
  const wFrac = Math.min(1, outerRight / W) - xFrac;
  const hFrac = Math.min(1, outerBottom / H) - yFrac;
  return { xFrac, yFrac, wFrac, hFrac };
}
