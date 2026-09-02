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
//
// Double Arch (2026-07-12) no longer calls this — after 8 real-render
// attempts (including a variant of this function with several different
// opaque fill treatments) the edit model still wouldn't reliably paint a
// solid white plinth from any guide marker here, so Double Arch's plinth is
// now suppressed from the guide entirely and composited deterministically
// after the AI render instead (see computeDoubleArchPlinthOverlayGeometry
// and its use in route.ts). This function is unchanged from before that
// experiment and still serves Round scenes.
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

// Filled cylindrical plinth marker for the Double Arch gap. plinthEdge is a
// faint outline that works for Single Arch only because it overlaps the
// tinted arch panel; centered in Double Arch's empty white gap the same
// outline is nearly invisible and the edit model simply omits the plinth
// (verified 2026-07-19 — prompt asked for the plinth, guide had the faint
// marker, render came back without it). The arches themselves are copied
// faithfully because they are FILLED shapes, so the plinth marker gets the
// same treatment: a solid light-gray filled body with visible side edges and
// cap ellipses, giving the model an unmissable object to paint as the white
// cylinder.
function plinthFilledCylinder(cx: number, bottomY: number, heightPx: number, diameterPx: number): string {
  const visualWidth = Math.min(diameterPx, Math.round(heightPx / 3.0));
  const rx    = visualWidth / 2;
  const ry    = Math.max(3, Math.round(rx * 0.45));
  const topY  = bottomY - heightPx;
  return [
    // Solid body — pure white like the real product, with a strong outline so
    // it contrasts against BOTH the white gap and the tinted arch panel it
    // partially overlaps (a light-gray fill blended into the beige panel and
    // the model dropped it)
    `<rect x="${cx - rx}" y="${topY}" width="${visualWidth}" height="${heightPx}" fill="#FFFFFF" stroke="rgba(85,85,85,0.72)" stroke-width="2"/>`,
    // Bottom cap — grounds the cylinder on the floor line
    `<ellipse cx="${cx}" cy="${bottomY}" rx="${rx}" ry="${ry}" fill="#F1EEEA" stroke="rgba(85,85,85,0.60)" stroke-width="1.6"/>`,
    // Top cap — primary cylinder cue
    `<ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ry}" fill="#FBFAF8" stroke="rgba(75,75,75,0.75)" stroke-width="2"/>`,
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

  // 2026-07-20: the dashed outline and the "150cm" label were being COPIED
  // into the finished photograph by the edit model — a ghost rectangle with
  // measurement text sat in the render where the standee would later be
  // composited. The placeholder now only softly reserves the footprint: a
  // very low-contrast fill, no dashes, no stroke, no text. The prompt
  // ("keep the left-hand floor area clear") does the rest of the work.
  void cornerR; void fontSize; void label;
  return [
    `<rect x="${(cx - rx).toFixed(1)}" y="${topY.toFixed(1)}" width="${widthPx.toFixed(1)}" height="${heightPx.toFixed(1)}" ` +
      `rx="${(widthPx * 0.3).toFixed(1)}" ry="${(widthPx * 0.3).toFixed(1)}" fill="#FAFAFA" opacity="0.55"/>`,
    `<ellipse cx="${cx.toFixed(1)}" cy="${bottomY.toFixed(1)}" ` +
      `rx="${(rx * 1.15).toFixed(1)}" ry="${baseRy.toFixed(1)}" fill="#F2F2F2" opacity="0.5"/>`,
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

  // The layout canvas must match the rendered image's aspect ratio EXACTLY.
  // Multi-panel scenes used to be laid out on a 1.4x wider virtual canvas (to
  // dodge the old panel-width cap); the guide PNG was then 1075x1024 while the
  // render was 768x1024, so the edit model compressed the whole reference
  // horizontally — arches came out narrow and balloons came out as flat discs
  // (2026-09-01 report: "I really don't like the balloons the Double Arch
  // produces"). calculateExactLayout now preserves aspect on its own.
  const isMultiPanel = backdropItems.length > 1;
  const W = Wbase;

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
  //
  // ...EXCEPT when every panel is the same product type (Double Arch): the
  // distinct hues were copied straight into the photograph, so the customer
  // got one blue arch next to one white arch even though both were ordered in
  // the same colour (2026-09-01 report). Same-type sets share one fill; mixed
  // sets (arch + shimmer wall) keep the distinguishing hues.
  //
  // 2026-09-01 (2): the neutral fills also meant the guide carried NO colour
  // information at all, so setting the large arch to white changed nothing in
  // the render — the edit model had only the prompt to go on and painted the
  // panels whatever the theme suggested. The panel's own configured colour now
  // wins whenever one is set; the neutral fills remain the fallback.
  const uniformPanelFill =
    backdropItems.length > 1 &&
    backdropItems.every((i) => i.type === backdropItems[0].type);
  const fillForPanel = (sortedIdx: number, panelIdx?: number): string => {
    const own = (backdropItems[panelIdx ?? sortedIdx] as { color?: string } | undefined)?.color;
    if (own && /^#[0-9a-fA-F]{6}$/.test(own)) return own;
    return MULTI_PANEL_FILLS[(uniformPanelFill ? 0 : sortedIdx) % MULTI_PANEL_FILLS.length];
  };

  const sorted = [...layout.panels].sort((a, b) => a.zOrder - b.zOrder);
  sorted.forEach((panel, sortedIdx) => {
    const item      = backdropItems[panel.idx];
    const shape     = (item?.type ?? "arch") as BackdropShapeId;
    const isShimmer = shape === "shimmer_wall";

    // Open arch frame: a thick filled decor-prop band with a hollow center —
    // same neutral fill family as the paired solid arch (MULTI_PANEL_FILLS),
    // so the pair reads as one coordinated set, not a wire outline vs a board.
    if (shape === "open_arch_frame") {
      const frameFill = fillForPanel(sortedIdx, panel.idx);
      const frame = openArchFramePath(panel.cx, panel.pw, panel.apexY, panel.floorY, frameFill);
      content.push(frame.svg);
      archOpenFrameFrameThicknessPx = frame.frameThicknessPx;
      return;
    }

    if (isMultiPanel) {
      const baseFill = fillForPanel(sortedIdx, panel.idx);

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
        content.push(panelPathOrShape(panel.cx, panel.pw, panel.apexY, panel.floorY, shape, fillForPanel(sortedIdx, panel.idx)));
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
  // Double Arch plinth history: 8 real-render attempts (2026-07-12) under
  // the OLD prompt/garland pipeline couldn't get the AI to paint a solid
  // plinth from a guide marker, so it was suppressed and later composited
  // deterministically (SVG overlay). RE-ATTEMPTED 2026-07-19 by product
  // request ("plinth same as single arch"): the prompt pipeline has since
  // been rewritten (mirrored-single-arch garland clauses, no contradictory
  // "keep the gap bare" wording, connected-mass negatives). First retry used
  // the same faint plinthEdge marker Single Arch uses, but centered in the
  // empty white gap that outline is nearly invisible and the model omitted
  // the plinth — Single Arch only gets away with it because its marker
  // overlaps the tinted panel. Double Arch therefore uses the FILLED
  // plinthFilledCylinder marker (solid shape, like the arch panels the model
  // copies faithfully), centered in the gap (the same gap-midpoint math
  // computeDoubleArchPlinthOverlayGeometry uses).
  // Standees are composited on the VIEWER'S LEFT, directly in front of the
  // backdrop (see ZONES_STANDARD). The half-garland plinth normally sits on
  // that same open left side, so it ended up hidden underneath the standee —
  // the plinth appeared to vanish whenever a character was added
  // (2026-07-20 bug report). When standees are present the plinth moves to
  // the right of centre instead, keeping both objects visible.
  const hasStandeeGuideItems = (cutoutGuideItems ?? []).some((i) => i.quantity > 0);

  for (const p of layout.plinths) {
    let plinthCx: number;
    if (isDoubleArch) {
      // Anchor on the LEFT arch's inner edge so the marker half-overlaps the
      // filled panel — the same overlap cue that makes Single Arch's plinth
      // render reliably. A cylinder floating fully inside the empty gap was
      // ignored by the edit model in three verification renders (2026-07-19),
      // even drawn filled and prompt-hard-locked.
      const leftPanel = layout.panels.reduce((a, b) => (a.cx <= b.cx ? a : b));
      plinthCx = Math.round(leftPanel.cx + leftPanel.pw / 2);
    } else if (singleShimmer) {
      plinthCx = Math.round(W * 0.50); // centered in front of shimmer wall
    } else if (singleRound && balloonStyle === "half" && layout.panels.length === 1) {
      // Left side of the round circle, clear of the right-arc garland
      const rPanel = layout.panels[0];
      plinthCx = Math.round(rPanel.cx - rPanel.pw * 0.40);
    } else if (balloonStyle === "half") {
      plinthCx = hasStandeeGuideItems
        ? Math.round(W * 0.62)  // standee owns the left — plinth sits right of centre
        : Math.round(W * 0.28); // open left side, away from right-side garland
    } else {
      plinthCx = p.cx;
    }
    // Round scenes: use filled cylinder so the plinth reads as a clear
    // solid object, not just outline edges that the model may skip or
    // merge with the background.
    if (singleRound) {
      content.push(plinthCylinder(plinthCx, p.bottomY, p.heightPx, p.diameterPx));
    } else if (isDoubleArch) {
      // Foreground cue: drop the plinth base ~5% below the arch floor line so
      // it reads as standing IN FRONT of the gap, not as a background artifact
      // between the panels — mid-gap objects at the shared floor line were
      // smoothed away by the edit model even when drawn filled (2026-07-19).
      const daBottomY = Math.min(p.bottomY + Math.round(H * 0.05), H - 6);
      content.push(plinthFilledCylinder(plinthCx, daBottomY, p.heightPx, p.diameterPx));
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

    // Guide balloons are shaded spheres, not flat discs.
    //
    // 2026-09-01: with flat single-colour fills the edit model reproduced the
    // guide literally and the garland came back as stacked overlapping DISCS
    // rather than balloons. A radial gradient with an off-centre highlight and
    // a darker rim gives each guide balloon the light falloff of a real latex
    // sphere, so copying the guide closely now produces the right result
    // instead of the wrong one.
    const shade = (hex: string, factor: number): string => {
      const h = hex.replace("#", "");
      const ch = (i: number) => {
        const v = parseInt(h.slice(i, i + 2), 16);
        return Math.max(0, Math.min(255, Math.round(factor < 1 ? v * factor : v + (255 - v) * (factor - 1))));
      };
      return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
    };

    const gradientIds = new Map<string, string>();
    if (hasSelectedColors) {
      colors.forEach((hex, i) => {
        if (gradientIds.has(hex)) return;
        const id = `balloonSphere_${i}`;
        gradientIds.set(hex, id);
        // No separate <defs> block exists in this SVG builder — every element
        // goes into the flat `content` array. A <radialGradient> pushed here
        // still resolves correctly via url(#id) regardless of position.
        content.push(
          `<radialGradient id="${id}" cx="35%" cy="30%" r="72%">` +
            `<stop offset="0%" stop-color="${shade(hex, 1.55)}" stop-opacity="0.95"/>` +
            `<stop offset="55%" stop-color="${hex}" stop-opacity="0.9"/>` +
            `<stop offset="100%" stop-color="${shade(hex, 0.72)}" stop-opacity="0.95"/>` +
          `</radialGradient>`,
        );
      });
    }

    const balloonAttrs = (idx: number): string => {
      if (!hasSelectedColors) {
        return `fill="rgba(200,218,235,0.08)" stroke="rgba(85,85,85,0.30)" stroke-width="1"`;
      }
      const hex = colors[idx % colors.length] ?? colors[0];
      const id  = gradientIds.get(hex);
      const fill = id ? `url(#${id})` : hexToRgba(hex, 0.76);
      return `fill="${fill}" stroke="${shade(hex, 0.6)}" stroke-width="1" stroke-opacity="0.45"`;
    };

    // Every paid garland tier draws from the SAME organic-mass engine below.
    //
    // 2026-09-01: this dispatch used to be gated on `balloonStyle === "half"`,
    // so Full Garland and Premium Organic — the two more expensive tiers — fell
    // through to a legacy path that drew 10 thin circles offset 5% of the canvas
    // width OUTSIDE each panel edge plus a row of circles floating in the air
    // above the panels. Detached from the panels, those guide dots read to the
    // edit model as helium balloons on strings rather than a garland, and a
    // Double Arch render came back with no garland at all (the model ignored the
    // floating dots) — the downstream correction pass then invented balloon
    // bouquets. Tier now controls DENSITY and COVERAGE, never geometry.
    const isFullerTier = balloonStyle === "full" || balloonStyle === "premium";
    if (balloonStyle === "half" || isFullerTier) {
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
        //
        // `tight` (2026-07-18, double_arch): the default 5-lane spread pushes
        // small balloons out to 2.1x rLarge from the edge — a real Double
        // Arch render showed those outer-lane small balloons separating from
        // the band and floating as isolated spheres beside the garland
        // (inter-lane gaps exceed the small radii once jitter lands wrong).
        // Tight mode compacts the climb to 4 lanes capped at 1.3x rLarge,
        // drops the small-only outer lanes (outer lanes get medium balloons
        // that still overlap their neighbors), halves the jitter, and pulls
        // the crown's outer depth lane in — every guide balloon then overlaps
        // the connected mass, so nothing reads as a stray floating balloon.
        // `matchSingleArchProportions` (2026-09-02) makes a narrow panel draw
        // the same garland Single Arch draws, in panel-relative terms — see
        // the SINGLE_ARCH_RATIO note on the radii below.
        const drawThickOrganicMainGarland = (
          p: typeof layout.panels[0], side: "left" | "right", colorOffset: number,
          tight = false, matchSingleArchProportions = false,
        ): { count: number; minR: number; maxR: number; lanes: number } => {
          const dir       = side === "left" ? -1 : 1;
          const panelEdge = p.cx + dir * (p.pw / 2);
          const Hp        = p.floorY - p.apexY;
          let n = 0;
          let minR = Infinity, maxR = 0;
          const put = (bx: number, by: number, br: number) => {
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" ${balloonAttrs(colorOffset + n)}/>`);
            n++;
            if (br < minR) minR = br;
            if (br > maxR) maxR = br;
          };

          // Radius scale relative to panel width — large/medium/small anchors.
          //
          // 2026-09-02, the actual root cause of the Double Arch balloon
          // complaints. These formulas are capped in ABSOLUTE pixels, and a
          // Single Arch panel is wide enough (403px) to hit every cap:
          // 403*0.17=68 clamps to 50, 403*0.28=113 clamps to 80. So Single
          // Arch really draws balloons at 0.124 and 0.198 of its panel width.
          // A Double Arch panel is narrow (266px / 222px) and never reaches a
          // cap, so it uses the raw 0.17 and 0.28 — making its balloons 41%
          // larger RELATIVE TO THEIR ARCH than the layout the customer
          // approved. That is the oversized, merged-blob look, and it has been
          // there since the caps were tuned for one panel. Double Arch now
          // reuses Single Arch's realised ratios, so its garland is the same
          // garland in panel-relative terms — "like the second one, mirrored".
          const SINGLE_ARCH_RATIO = { L: 0.124, M: 0.084, S: 0.055, X: 0.198 };
          const r = (capped: number, ratio: number) =>
            matchSingleArchProportions ? p.pw * ratio : capped;

          const rLarge  = r(Math.max(20, Math.min(50, p.pw * 0.17)), SINGLE_ARCH_RATIO.L);
          const rMed    = r(Math.max(14, Math.min(34, p.pw * 0.12)), SINGLE_ARCH_RATIO.M);
          const rSmall  = r(Math.max(9,  Math.min(22, p.pw * 0.08)), SINGLE_ARCH_RATIO.S);
          // 36-inch statement anchor (tight/double-arch only): a real 36"
          // balloon is ~3x a 12" one. The guide must SHOW that scale — with
          // only L/M/S circles the model rendered a uniform mid-size garland
          // (2026-07-20 product feedback: balloons too small, not enough mass
          // low down; sizes must read as 36" / 12" / 5").
          const rXL     = r(Math.max(30, Math.min(80, p.pw * 0.28)), SINGLE_ARCH_RATIO.X);

          // 2026-09-02: rendering the guide to PNG and actually LOOKING at it
          // finally explained the flat-disc bug that five prompt/count fixes
          // could not touch. Three of the four climb lanes, and most of the
          // base cluster, carry POSITIVE (outward) offsets from panelEdge, so
          // the garland mass was being drawn almost entirely in the empty wall
          // BESIDE the arch instead of on it — a free-standing tower of hugely
          // overlapping circles whose union silhouette is a scalloped column.
          // The edit model was reproducing that guide faithfully; the render
          // was correct, the guide was wrong. (Line ~1066 records the same
          // "line sat OUTSIDE the panel edge" failure from 2026-07-18.)
          // Anchoring the offsets about one balloon inboard of the edge makes
          // the mass straddle the arch, which is how a decorator actually ties
          // a garland on, and is what the working Single Arch guide looks like.
          const edgeX = panelEdge - dir * rLarge * 0.9;

          // 1) Floor/base cluster — 16 heavily overlapping balloons mounded at
          //    the outer base, several large anchors for a dense floor pile.
          const BASE: [number, number, "L" | "M" | "S"][] = [
            [   4,  10, "L"], [  32,  14, "L"], [ -20,  16, "L"], [  16,  38, "L"],
            [ -10,  30, "M"], [  44,  32, "M"], [  22,  56, "M"], [  -2,  56, "M"],
            [  50,  54, "S"], [   6,  74, "S"], [ -18,  46, "S"], [  36,  74, "S"],
            [  14,  92, "M"], [ -12,  86, "S"], [  46,  90, "S"], [   0, 104, "S"],
          ];
          // Plumper mix in tight mode (2026-07-20 feedback: "fuller, fewer
          // 12in, fewer 5in"): the S slot stops being a 5-inch filler and
          // becomes a near-medium balloon, so the band has no thin gappy
          // stretches. 5-inch balloons remain only as prompt-level accents.
          const sizeR = { X: rXL, L: rLarge, M: rMed, S: tight ? rMed * 0.86 : rSmall };
          // Tight (double_arch) is also BOTTOM-HEAVY (2026-07-19): a real
          // render at uniform density read as an evenly spaced side border /
          // trim rather than a decorator garland. The base cluster is
          // enlarged, the climb concentrates balloons low and tapers both
          // its width and its balloon radii toward the top, and the crown is
          // lighter — so the guide's own silhouette is a fat floor mound
          // flowing up into a slim shoulder curl, which the img2img pass
          // then reproduces instead of an even strip.
          const baseScale = tight ? 1.3 : 1;
          const upScale   = tight ? 1.25 : 1; // taller mound — more volume low down
          if (tight) {
            // Three 36" giant statement anchors seated IN the floor mound —
            // the biggest objects in the garland, unmistakably larger than
            // everything else, exactly where a decorator parks them.
            put(edgeX + dir * 16,  p.floorY - rXL * 0.72, rXL);
            put(edgeX + dir * -24, p.floorY - rXL * 0.60, rXL * 0.88);
            put(edgeX + dir * 54,  p.floorY - rXL * 0.55, rXL * 0.78);
          }
          for (const [ox, up, sz] of BASE) {
            put(edgeX + dir * ox * (tight ? 1.15 : 1), p.floorY - up * upScale, sizeR[sz] * baseScale);
          }

          // 2) Side climb — 30 balloons across staggered lanes, overlapping
          //    35–60% between neighbors, forming a genuinely thick band from
          //    just above the base to the spring line. Tight mode: 4 compact
          //    lanes, medium outer balloons, half jitter, and a bottom-heavy
          //    taper — tEase concentrates balloons low, spread/radius shrink
          //    with height (see comment above).
          // Bigger balloons need proportionally fewer of them to fill the same
          // climb — otherwise they simply pile up on top of each other.
          const climbN  = 30;
          const laneOffsets = tight
            ? [-rLarge * 0.5, rLarge * 0.1, rLarge * 0.7, rLarge * 1.3]
            : [-rLarge * 0.5, rLarge * 0.15, rLarge * 0.85, rLarge * 1.5, rLarge * 2.1];
          const laneSizes: ("L" | "M" | "S")[] = tight
            ? ["M", "L", "L", "M"] // bigger overall body (2026-07-20 feedback)
            : ["M", "L", "M", "S", "S"];
          const wobbleMod = tight ? 7 : 13;
          for (let i = 0; i < climbN; i++) {
            const t = i / (climbN - 1);
            const tEase = tight ? Math.pow(t, 1.5) : t; // tight: denser sampling near the floor
            const y = p.floorY - Hp * (0.16 + tEase * 0.62); // 16% → 78% panel height
            const lane = i % laneOffsets.length;
            const wobble = ((i * 17) % wobbleMod) - Math.floor(wobbleMod / 2); // deterministic organic jitter
            const spread = tight ? 1 - 0.42 * tEase : 1;   // band narrows as it rises
            const rTaper = tight ? 1.3 - 0.55 * tEase : 1; // balloons shrink as they rise
            const x = edgeX + dir * (laneOffsets[lane] * spread + wobble);
            const sz = laneSizes[lane];
            put(x, y, sizeR[sz] * rTaper);
          }

          // 3) Crown curl — balloons wrapping the outer shoulder over the
          //    top of the arch arc in 3 depth lanes. Default: 16, large near
          //    the apex. Tight mode: 11 medium/small only — a deliberately
          //    LIGHTER crown so the whole garland reads bottom-heavy.
          const rArc  = p.pw / 2;
          const arcCx = p.cx;
          const arcCy = p.apexY + rArc;
          const angFrom = side === "left" ? 178 : 2;
          const angTo   = side === "left" ? 268 : -88;
          const crownN = tight ? 11 : 16;
          for (let i = 0; i < crownN; i++) {
            const t   = i / (crownN - 1);
            const ang = ((angFrom + (angTo - angFrom) * t) * Math.PI) / 180;
            const depthLane = i % 3;
            const rad = rArc + (tight
              ? [-rSmall * 0.4, rMed * 0.35, rMed * 0.6]
              : [-rSmall * 0.4, rMed * 0.6, rLarge * 0.85])[depthLane];
            const x   = arcCx + rad * Math.cos(ang);
            const y   = arcCy + rad * Math.sin(ang);
            const sz: "L" | "M" | "S" = tight
              ? (depthLane === 2 ? "M" : "S")
              : (depthLane === 2 ? "L" : depthLane === 1 ? "M" : "S");
            put(x, y, sizeR[sz]);
          }

          return { count: n, minR: Math.round(minR), maxR: Math.round(maxR), lanes: laneOffsets.length };
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
          // Double arch (2026-07-18 geometry fix): each arch carries the same
          // thick organic MASS garland already proven on Arch + Open Frame's
          // solid arch (drawThickOrganicMainGarland, "thick_organic_mass_v2"),
          // mirrored onto its own outer side. Two earlier guide styles failed
          // in real renders: the old bespoke drawDenseGarland (unreliable
          // look), then a thin sine-line copy of Single Arch's guide — that
          // one rendered as a sparse detached vertical bead column, because
          // the whole line sat OUTSIDE the panel edge (offset ~5% of canvas
          // width into empty wall) and the busier two-panel scene reproduced
          // the thin floating guide literally instead of elaborating it.
          // The mass garland fixes the GEOMETRY, not just the count: a dense
          // floor/base cluster at the outer base, a 30-balloon 5-lane climb
          // whose innermost lane overlaps the panel face (so the garland
          // physically hugs the arch edge), and a crown curl over the top
          // shoulder — heavily overlapping large/medium/small radii scaled
          // to the panel's own width, a genuine 2-D organic mass rather than
          // any dotted path. Outer sides only — the center gap stays clean.
          // Both arches draw Single Arch's exact garland recipe, mirrored, at
          // Single Arch's panel-relative balloon size. Two experiments in
          // between — scaling balloons UP by 1.4, and a high-contrast
          // giant/small lane cycle — both made it worse and are reverted; the
          // measured defect was that these narrow panels miss the absolute
          // pixel caps that quietly shrink Single Arch's balloons.
          const pair = [...archPanels].sort((a, b) => a.cx - b.cx);
          doubleArchGarlandBalloonsLeft  = drawThickOrganicMainGarland(pair[0], "left", 0, true, true).count;
          doubleArchGarlandBalloonsRight = drawThickOrganicMainGarland(pair[1], "right", 62, true, true).count;
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
        } else if (archPanels.length === 1 && layout.panels.length === 1) {
          // Single arch: use the same thick organic mass the Double Arch
          // garlands use. The previous guide here was a single-file sine-wave
          // column of 22 circles, which the edit model reproduced with visibly
          // thin, gappy stretches (2026-07-20 feedback: "balloons have very
          // thin parts, should look fuller").
          drawThickOrganicMainGarland(archPanels[0], "right", 0, true);
          // Full / Premium mirror the mass onto the left edge too, so the
          // customer sees the extra coverage they paid for. Half stays
          // one-sided (that asymmetry is the look Half Garland sells).
          if (isFullerTier) {
            drawThickOrganicMainGarland(archPanels[0], "left", 62, true);
          }
        } else {
          // Multi-panel fallback: right-side vertical garland from top-right corner to floor
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

    const betweenGap = Math.round(W * 0.012); // gap between consecutive standees
    // The composite drops standees just left of centre, overlapping the panel's
    // left edge (ZONES_STANDARD). The guide reserves that same footprint —
    // previously it sat fully outside the panel, so the model happily painted
    // the plinth/garland exactly where the standee would later land.
    let curRight = Math.round(groupLeft + (layout.panels[0]?.pw ?? 0) * 0.12);

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
  const W                = Wbase; void isMultiPanel;
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
  const W                = Wbase; void isMultiPanel;
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

/**
 * Double Arch's plinth footprint (cake plinth centered in the gap between
 * the two arches), as a fraction of the full rendered canvas — used by
 * route.ts's deterministic post-render plinth composite (2026-07-12,
 * replacing 8 failed real-render attempts at getting the edit model to
 * paint the plinth itself; see the comment above the removed guide call in
 * the panels-drawing section).
 *
 * Reuses the exact same layout math (VIEWBOX, calculateExactLayout, the
 * 0.80 SCALE and margin transform) as the main silhouette generator and the
 * same gap-midpoint x-position the guide always used for this plinth, so
 * the composite lands exactly where the guide/prompt always intended it —
 * centered in the same clean gap the separation-lock fixes now keep clear.
 *
 * Returns null when the scene isn't Double Arch or has no plinth.
 */
export function computeDoubleArchPlinthOverlayGeometry(
  backdropItems: BackdropItem[],
  plinthSizes:   PlinthSize[],
): RegionFraction | null {
  const isDoubleArch = backdropItems.length === 2 && backdropItems.every((i) => i.type === "arch");
  if (!isDoubleArch || plinthSizes.length === 0) return null;

  const { falImageSize } = calculateRenderAspectRatio(backdropItems);
  const [Wbase, H]       = VIEWBOX[falImageSize];
  const W                = Math.round(Wbase * 1.4); // Double Arch is always multi-panel
  const layout            = calculateExactLayout(backdropItems, plinthSizes, W, H);
  const pl = layout.plinths[0];
  if (!pl || layout.panels.length !== 2) return null;

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

  // Same gap-midpoint the (now-removed) guide marker used — the visual gap
  // between the two arch bases, which the separation-lock fixes keep clean.
  const gLeft  = Math.min(...layout.panels.map((pp) => pp.cx - pp.pw / 2));
  const gRight = Math.max(...layout.panels.map((pp) => pp.cx + pp.pw / 2));
  const plinthCx = Math.round((gLeft + gRight) / 2);

  return toFrac(
    plinthCx - pl.diameterPx / 2, plinthCx + pl.diameterPx / 2,
    pl.bottomY - pl.heightPx, pl.bottomY,
  );
}

/**
 * Geometry of the backdrop group as fractions of the rendered image, plus the
 * reference panel's real-world height.
 *
 * Standee compositing needs this (2026-07-20): sizing a standee as a fraction
 * of the IMAGE made a 150cm figure look tiny next to a 220cm arch, and
 * anchoring its feet at a fixed image fraction put it in the foreground —
 * "it's still standing in front". With the panel's own rect the standee can be
 * scaled from the true cm ratio and stood on the SAME floor line as the
 * backdrop, just outside its edge.
 */
export function computeBackdropGroupGeometry(
  backdropItems: BackdropItem[],
  plinthSizes:   PlinthSize[],
): { leftFrac: number; rightFrac: number; floorYFrac: number; apexYFrac: number; refHeightCm: number } | null {
  if (backdropItems.length === 0) return null;

  const { falImageSize } = calculateRenderAspectRatio(backdropItems);
  const [Wbase, H]       = VIEWBOX[falImageSize];
  const isMultiPanel     = backdropItems.length > 1;
  const W                = Wbase; void isMultiPanel;
  const layout           = calculateExactLayout(backdropItems, plinthSizes, W, H);
  if (layout.panels.length === 0) return null;

  const SCALE   = 0.80;
  const marginX = Math.round(W * (1 - SCALE) / 2);
  const marginY = Math.round(H * (1 - SCALE) / 2);

  const groupLeft  = Math.min(...layout.panels.map((p) => p.cx - p.pw / 2));
  const groupRight = Math.max(...layout.panels.map((p) => p.cx + p.pw / 2));
  const groupApex  = Math.min(...layout.panels.map((p) => p.apexY));
  const refPanel   = layout.panels[0];
  const refItem    = backdropItems[refPanel.idx] as { heightCm?: number } | undefined;

  return {
    leftFrac:   (marginX + groupLeft  * SCALE) / W,
    rightFrac:  (marginX + groupRight * SCALE) / W,
    floorYFrac: (marginY + layout.floorY * SCALE) / H,
    apexYFrac:  (marginY + groupApex   * SCALE) / H,
    refHeightCm: refItem?.heightCm ?? 200,
  };
}
