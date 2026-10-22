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
import { resolveTextColorHex } from "./config";
import { textAdvance, textPathD } from "./guideFonts";
import { frozenBannerPrintSvg } from "./bannerPrint";
import { FROZEN_CASTLE_PRINT } from "./bannerCastlePrint";
import { calculateExactLayout } from "./calculateExactLayout";
import { calculateRenderAspectRatio } from "./calculateRenderAspectRatio";
import type { FalImageSize } from "./calculateRenderAspectRatio";

// ViewBox dimensions that match each fal image_size exactly.
// The silhouette must have the same aspect ratio as the AI render it will guide.
// 2026-09-03: square_hd and landscape_4_3 used to be drawn on a 768-based
// canvas while fal renders them at 1024 — the guide was upscaled 1.33x, so a
// Double Arch (which picks square_hd) got a reference with 25% less detail per
// balloon than a Single Arch, whose portrait_16_9 guide matches its output
// exactly. Worse, the smaller canvas made its panels narrow enough to MISS the
// absolute pixel caps in drawThickOrganicMainGarland that quietly set Single
// Arch's balloon size, so the two layouts were drawing different garlands from
// the same code. Every entry now matches its rendered size, which makes Double
// Arch hit those caps too and draw Single Arch's balloons, at Single Arch's
// reference resolution — "the same thing, as a Double Arch version".
const VIEWBOX: Record<FalImageSize, [number, number]> = {
  portrait_16_9:  [576,  1024],
  portrait_4_3:   [768,  1024],
  square_hd:      [1024, 1024],
  landscape_4_3:  [1024,  768],
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
  /** Where each panel's lettering sits, in inner viewBox px (pre-transform).
   *  Feed through panelRectToFraction to get canvas fractions. Used to
   *  recolour the rendered lettering, which the arch edit model paints black
   *  whatever colour it is asked for. */
  textZones: { panelIdx: number; colorHex: string; xMin: number; xMax: number; yMin: number; yMax: number }[];
  /** Centre and radius of every bulb on a block marquee number, as fractions
   *  of the canvas width/height. The render paints the number where the guide
   *  draws it but does not reliably light the bulbs, so the route lights them
   *  afterwards at these points. Empty when there is no such number. */
  marqueeBulbs: { xFrac: number; yFrac: number; rFrac: number }[];
  /** Full-canvas SVG mask (white on black) of any silver lettering, for the
   *  route's chrome pass. Empty string when there is none. */
  silverTextMaskSvg: string;
  /** Lone balloon ring: the lit neon sign, drawn whole-canvas, for the route to lay over the render. */
  neonOverlaySvg: string;
  /** Tint of the metallic lettering the mask above is for (silver, gold, rose gold). */
  textMetalTint: [number, number, number] | null;
  /** Where the lone banner's printed artwork goes, as canvas fractions, or
   *  null when the banner carries no theme graphic. */
  bannerPrintRect: { xFrac: number; yFrac: number; wFrac: number; hFrac: number } | null;
  /** Full-canvas mask (white = print here) for the banner print: the board,
   *  minus every balloon, the plinth and the number standing in front of
   *  it. Empty string when there is no banner print. */
  bannerPrintMaskSvg: string;
  /** True when the banner print was drawn into the guide itself, so the
   *  render paints it and no print needs laying on afterwards. */
  bannerPrintInGuide: boolean;
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
  // Which side a half_arch curves toward. Ignored by every other shape.
  facing: "left" | "right" = "left",
  strongEdge = false,
): string {
  const r     = pw / 2;
  const left  = cx - r;
  const right = cx + r;

  // Very light grey stroke only — avoid any hard outline that Canny reads as a
  // structural border. `strongEdge` opts a caller out of that: see the lone-arch
  // branch, where the board's own proportions are the thing being guided.
  const stroke = strongEdge
    ? `stroke="rgba(90,90,95,0.80)" stroke-width="3"`
    : `stroke="rgba(150,150,150,0.14)" stroke-width="1"`;

  if (shape === "round") {
    // Bottom of circle must touch floorY exactly — no floating gap
    const centerY = floorY - r;
    return `<circle cx="${cx}" cy="${centerY}" r="${r}" fill="${fillColor}" ${stroke}/>`;
  }

  if (shape === "balloon_ring") {
    // No board at all — the ring IS balloons. Only a faint circle to say where
    // they sit; the balloons themselves are drawn by the garland dispatch.
    const centerY = floorY - r;
    return `<circle cx="${cx}" cy="${centerY}" r="${r}" fill="none" stroke="rgba(150,150,150,0.10)" stroke-width="1"/>`;
  }

  if (shape === "banner") {
    // 2026-09-05: a banner is 200x200cm and must render SQUARE.
    // calculateExactLayout fits width and height to separate fractions of the
    // canvas and does not preserve a panel's own aspect — measured, a banner
    // came out at 717 x 870, i.e. portrait. Round gets away with this because
    // its circle is drawn from pw alone; a rect is drawn at the full height, so
    // the banner needs the square built here, bottom-aligned to the floor.
    const side = Math.min(pw, floorY - apexY);
    return `<rect x="${cx - side / 2}" y="${floorY - side}" width="${side}" height="${side}" fill="${fillColor}" ${stroke}/>`;
  }

  if (shape === "half_arch") {
    // 2026-09-09: an arch sliced down the middle. The rounded corner faces
    // OUTWARD, away from the centre board, and the straight edge butts against
    // it — exactly the side pieces in the customer's Triple Arch reference.
    // Which way it faces is decided by the caller and passed in `facing`.
    // (2026-10-22: a full-height sail curve was tried here at the customer's
    // request and reverted the same day — with it the garland floated off the
    // boards and the render was worse: "bir onceki hali daha iyiydi".)
    const h = floorY - apexY;
    const rr = Math.min(pw, h);
    const outerX = facing === "left" ? left : right;
    const innerX = facing === "left" ? right : left;
    const sweep  = facing === "left" ? 1 : 0;
    const d2 = [
      `M ${outerX},${floorY}`,
      `L ${outerX},${(apexY + rr).toFixed(1)}`,
      `A ${rr.toFixed(1)},${rr.toFixed(1)} 0 0 ${sweep} ${innerX},${apexY.toFixed(1)}`,
      `L ${innerX},${floorY}`,
      "Z",
    ].join(" ");
    return `<path d="${d2}" fill="${fillColor}" ${stroke}/>`;
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
  if (shape === "balloon_ring") {
    const centerY = floorY - r;
    return `<circle cx="${cx}" cy="${centerY}" r="${r}" fill="none" stroke="rgba(150,150,150,0.10)" stroke-width="1"/>`;
  }

  if (shape === "banner") {
    // Square, for the reason given in panelShape.
    const side = Math.min(pw, floorY - apexY);
    const l = cx - side / 2, r2 = cx + side / 2, t = floorY - side;
    const d = `M ${l},${floorY} L ${l},${t} L ${r2},${t} L ${r2},${floorY}`;
    return `<path d="${d}" ${edgeStroke}/>`;
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
/**
 * Draw the plinth at its true product proportions and nothing else.
 *
 * Do not add a fudge factor here hoping to steer the render: measured across
 * seven controlled renders on 2026-09-03 (one fixed scene, one fixed seed,
 * only this marker changed), the marker's proportions have NO effect on the
 * plinth the model paints. Marker aspects of 1.4, 2.0, 2.3 and 4.6 — drawn
 * faint as here, and drawn filled in strong contrast — all came back at
 * roughly 1:1, and the slimmest marker of the four produced the fattest
 * plinth. A pre-compensation factor briefly lived here on the theory that the
 * model regressed towards a ~1.9 prior; it was inert and has been removed.
 * The rendered proportion is set by the wording in buildLayoutRefEditPrompt
 * ("pedestal column", plus a comparison against the board's width) — that is
 * the lever, and this marker only says where the plinth goes and how tall.
 *
 * The width used to be Math.min(diameterPx, heightPx/3), which forced every
 * plinth to a 3:1 silhouette and threw the configured diameter away — L, XL
 * and XXL all drew identically even though they are 60x33, 75x36 and 90x40.
 */
function plinthEdge(cx: number, bottomY: number, heightPx: number, diameterPx: number): string {
  const visualWidth = diameterPx;
  const rx    = visualWidth / 2;
  const ryTop = Math.max(3, Math.round(rx * 0.45));
  const topY  = bottomY - heightPx;

  return [
    // Left vertical edge — very faint
    `<line x1="${cx - rx}" y1="${topY}" x2="${cx - rx}" y2="${bottomY}" stroke="rgba(90,90,90,0.22)" stroke-width="0.8"/>`,
    // Right vertical edge — very faint
    `<line x1="${cx + rx}" y1="${topY}" x2="${cx + rx}" y2="${bottomY}" stroke="rgba(90,90,90,0.22)" stroke-width="0.8"/>`,
    // Bottom cap — FRONT arc only. Drawing the whole ellipse here put a
    // complete disc on the floor around the base, and the edit model painted
    // exactly that: a wide flat plate under the column, which is what the
    // customer reported as an extra platform (2026-09-04). An opaque cylinder
    // hides the back half of its own base, so only the near half is drawn.
    `<path d="M ${cx - rx},${bottomY} A ${rx},${ryTop} 0 0 0 ${cx + rx},${bottomY}" fill="none" stroke="rgba(90,90,90,0.20)" stroke-width="0.8"/>`,
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
function plinthFilledCylinder(cx: number, bottomY: number, heightPx: number, diameterPx: number, shaded = false, flatTop = false): string {
  // True diameter — see the note on plinthEdge above.
  const visualWidth = diameterPx;
  const rx    = visualWidth / 2;
  // flatTop: the top seen almost edge-on, as it is from standing eye level.
  // At 0.45 the render drew the top surface wide open, as if looked down
  // on (2026-10-21, "karsidan bakan kisi oyle gormez").
  const ry    = Math.max(3, Math.round(rx * (flatTop ? 0.14 : 0.45)));
  const topY  = bottomY - heightPx;
  return [
    // Solid body — pure white like the real product, with a strong outline so
    // it contrasts against BOTH the white gap and the tinted arch panel it
    // partially overlaps (a light-gray fill blended into the beige panel and
    // the model dropped it)
    // `shaded`: lit from the left and falling off at both sides, so it reads
    // as a round object. Flat white in front of the banner's large flat board
    // was dropped by the render every time (2026-10-21, "plinthe noldu?").
    shaded
      ? `<defs><linearGradient id="plShade${Math.round(cx)}" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0%" stop-color="#C9C7C3"/><stop offset="35%" stop-color="#FFFFFF"/>` +
        `<stop offset="70%" stop-color="#EDEBE7"/><stop offset="100%" stop-color="#B9B7B2"/></linearGradient></defs>` +
        `<rect x="${cx - rx}" y="${topY}" width="${visualWidth}" height="${heightPx}" fill="url(#plShade${Math.round(cx)})" stroke="rgba(85,85,85,0.72)" stroke-width="2"/>`
      : `<rect x="${cx - rx}" y="${topY}" width="${visualWidth}" height="${heightPx}" fill="#FFFFFF" stroke="rgba(85,85,85,0.72)" stroke-width="2"/>`,
    // Bottom cap — front arc only, for the reason given in plinthEdge: a
    // full ellipse here reads as a separate disc lying on the floor.
    `<path d="M ${cx - rx},${bottomY} A ${rx},${ry} 0 0 0 ${cx + rx},${bottomY}" fill="none" stroke="rgba(85,85,85,0.60)" stroke-width="1.6"/>`,
    // Top cap — primary cylinder cue
    `<ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ry}" fill="#FBFAF8" stroke="rgba(75,75,75,0.75)" stroke-width="2"/>`,
  ].join("\n    ");
}

// Open arch frame — a THICK freestanding decor prop, not a thin doorway
// outline. Drawn as one filled band (outer arch silhouette minus the inner
// arch silhouette, via fill-rule="evenodd") so the frame has real visual
// material/mass, matching a premium event arch cutout — with a clean hollow
// arch-shaped opening cut through the center, never a wire outline.
// 2026-09-08: currently UNUSED. The open arch is drawn as a solid filled arch
// silhouette instead (see the open_arch_frame branch below) because the ring
// this builds gave the render a crisp concentric arch line to turn into a
// moulded reveal. Kept because it is the only thing that draws a real hollow
// band, and because the infill still mirrors its frameT formula.
function openArchFramePath(
  cx: number, pw: number, apexY: number, floorY: number,
  fillColor: string,
  openingFill?: string,
): { svg: string; frameThicknessPx: number } {
  const closedArch = (r: number, left: number, right: number, topY: number): string => {
    const springY = topY + r;
    return `M ${left},${floorY} L ${left},${springY} A ${r},${r} 0 0 1 ${right},${springY} L ${right},${floorY} Z`;
  };
  const rOuter = pw / 2;
  // Bold, substantial frame border — roughly a fifth of the panel's own
  // width, clamped so the hollow opening always stays clearly visible
  // (inner radius never collapses below ~54% of the outer radius).
  // 2026-09-08: 0.20 -> 0.12 of the panel width. The customer reference has a
  // THIN border, and a thick one gives the render room to carve a stepped
  // architrave into it — which is what "tirtikli" was.
  const frameT = Math.max(14, Math.min(rOuter * 0.42, pw * 0.15));
  const rInner = rOuter - frameT;

  const outerPath = closedArch(rOuter, cx - rOuter, cx + rOuter, apexY);
  const innerPath = closedArch(rInner, cx - rInner, cx + rInner, apexY + frameT);

  const svg = [
    // 2026-10-21: the opening painted as the wall seen THROUGH it. Left the
    // guide's white, it was read as more board and the frame rendered solid.
    ...(openingFill ? [`<path d="${innerPath}" fill="${openingFill}"/>`] : []),
    // Solid filled band — outer arch silhouette with the inner arch punched
    // out (evenodd). This is the frame's real material, giving it visual weight.
    // 2026-09-08: NO stroke. White-on-white, the fill was invisible and the
    // only thing the model could see was two thin concentric outlines — which
    // is a moulding, and is exactly what it painted. The band is now carried
    // entirely by a flat fill, so what the guide shows is a solid band of
    // material with no lines on it at all.
    `<path d="${outerPath} ${innerPath}" fill-rule="evenodd" fill="${fillColor}"/>`,
    // 2026-09-08: the second, inner-rim path is GONE. The path above already
    // strokes BOTH subpaths, so this drew the inner edge a second time — a
    // double-weight line right where a moulding step would be, and the
    // render duly came back with a stepped picture-frame profile (the
    // customer: "hala flat gelmiyor yuzeyi, tirtikli gibi"). One band, one
    // uniform edge.
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

// Block marquee numeral, drawn the way the customer's reference product is
// built (2026-10-20, "isik bunun gibi olmali"): a deep white box letter with
// a thick body — about 30% of the digit's width — chamfered outer corners,
// and warm bulbs set at even spacing down the middle of every stroke. A
// typeface digit, which is what this used to be for everything but the 1,
// came back as a thin flat foam numeral with no bulbs at all.
//
// Built from seven-segment strokes: every block numeral is exactly that
// shape, and it gives the bulbs a centreline to sit on. The strokes are
// drawn twice — outline colour first, face on top — so the overlaps merge
// into one letter with one outer edge instead of showing seams.
function marqueeBlockDigit(glyph: string, x: number, y: number, w: number, h: number, withDefs: boolean, bulbsOut?: [number, number, number][]): string {
  const t = w * 0.30;
  const midT = h / 2 - t / 2;
  type Pt = [number, number];
  const rect = (rx: number, ry: number, rw: number, rh: number): Pt[] =>
    [[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]];
  const SEG: Record<string, { poly: Pt[]; line: [Pt, Pt] }> = {
    a: { poly: rect(0, 0, w, t),               line: [[t / 2, t / 2], [w - t / 2, t / 2]] },
    b: { poly: rect(w - t, 0, t, h / 2 + t / 2), line: [[w - t / 2, t / 2], [w - t / 2, h / 2]] },
    c: { poly: rect(w - t, midT, t, h - midT),  line: [[w - t / 2, h / 2], [w - t / 2, h - t / 2]] },
    d: { poly: rect(0, h - t, w, t),            line: [[t / 2, h - t / 2], [w - t / 2, h - t / 2]] },
    e: { poly: rect(0, midT, t, h - midT),      line: [[t / 2, h / 2], [t / 2, h - t / 2]] },
    f: { poly: rect(0, 0, t, h / 2 + t / 2),    line: [[t / 2, t / 2], [t / 2, h / 2]] },
    g: { poly: rect(0, midT, w, t),             line: [[t / 2, h / 2], [w - t / 2, h / 2]] },
  };
  const DIGIT: Record<string, string> = {
    "0": "abcdef", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
    "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  };
  let parts: { poly: Pt[]; line: [Pt, Pt] }[];
  if (glyph === "1") {
    // A body down the middle and an angled flag at the top left.
    const bx = w * 0.42;
    parts = [
      { poly: rect(bx, 0, t, h), line: [[bx + t / 2, t / 2], [bx + t / 2, h - t / 2]] },
      { poly: [[bx + t / 2, 0], [bx + t / 2, t * 1.15], [w * 0.06, h * 0.30], [w * 0.06, h * 0.30 - t * 1.05]],
        line: [[bx, t * 0.55], [w * 0.06 + t * 0.45, h * 0.30 - t * 0.6]] },
    ];
  } else {
    parts = (DIGIT[glyph] ?? DIGIT["8"]).split("").map((k) => SEG[k]);
  }
  const at = (q: Pt, ox = 0, oy = 0) => `${(x + q[0] + ox).toFixed(1)},${(y + q[1] + oy).toFixed(1)}`;
  const polyStr = (poly: Pt[], ox = 0, oy = 0) => poly.map((q) => at(q, ox, oy)).join(" ");
  // Chamfered outer corners, by clipping the whole letter to an octagon.
  const c = w * 0.14;
  const id = `mq${Math.round(x)}x${Math.round(y)}`;
  const oct = (ox: number, oy: number) => [
    [c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c],
  ].map((q) => at(q as Pt, ox, oy)).join(" ");
  // The letter's depth: the same shape set slightly back and to the side,
  // in the shade of the box's side wall.
  const dx = w * 0.05, dy = -w * 0.03;
  let out = withDefs
    ? `<defs><radialGradient id="marqueeBulbGlow">` +
      `<stop offset="0%" stop-color="#FFFFFF"/><stop offset="30%" stop-color="#FFF6D8"/>` +
      `<stop offset="55%" stop-color="#FFD978" stop-opacity="0.85"/>` +
      `<stop offset="100%" stop-color="#FFC24A" stop-opacity="0"/></radialGradient></defs>`
    : "";
  out += `<defs><clipPath id="${id}f"><polygon points="${oct(0, 0)}"/></clipPath>` +
    `<clipPath id="${id}b"><polygon points="${oct(dx, dy)}"/></clipPath></defs>`;
  out += `<g clip-path="url(#${id}b)">` +
    parts.map((pt) => `<polygon points="${polyStr(pt.poly, dx, dy)}" fill="#D6D2CB" stroke="#D6D2CB" stroke-width="1"/>`).join("") +
    `</g>`;
  out += `<g clip-path="url(#${id}f)">` +
    parts.map((pt) => `<polygon points="${polyStr(pt.poly)}" fill="#A9A6A0" stroke="#A9A6A0" stroke-width="4" stroke-linejoin="round"/>`).join("") +
    parts.map((pt) => `<polygon points="${polyStr(pt.poly)}" fill="#F7F5F1"/>`).join("") +
    `</g>`;
  // Bulbs at even spacing along each stroke's centreline; where two strokes
  // meet, the shared bulb is drawn once.
  const bulbs: Pt[] = [];
  const step = h * 0.19;
  for (const pt of parts) {
    const [[x0, y0], [x1, y1]] = pt.line;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) {
      const q: Pt = [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n];
      if (!bulbs.some((b) => Math.hypot(b[0] - q[0], b[1] - q[1]) < t * 0.6)) bulbs.push(q);
    }
  }
  const br = w * 0.10;
  if (bulbsOut) for (const q of bulbs) bulbsOut.push([x + q[0], y + q[1], br]);
  out += bulbs.map((q) => `<circle cx="${(x + q[0]).toFixed(1)}" cy="${(y + q[1]).toFixed(1)}" r="${br.toFixed(1)}" fill="url(#marqueeBulbGlow)"/>`).join("");
  return out;
}

// Customized text guide — the exact selected text drawn faintly on the target
// solid panel (upper-middle) so the edit model bakes it into the board surface.
// Never drawn on shimmer walls or open arch frames.
/** Guide lettering styled like the customer's own font and colour choice. */
const TEXT_GUIDE_FONT: Record<string, { family: string; weight: string }> = {
  script:  { family: "Segoe Script, Brush Script MT, Comic Sans MS, cursive", weight: "600" },
  block:   { family: "Arial Black, Impact, DejaVu Sans, sans-serif",         weight: "900" },
  elegant: { family: "Georgia, Times New Roman, DejaVu Serif, serif",        weight: "600" },
};
// Colour comes from resolveTextColorHex so a customer-picked hex is drawn as
// itself. The four presets still resolve to their own fixed values.

// 2026-10-22: the metallic lettering colours and their tint. Each is drawn
// as a mirror (see customTextGuide) and given a chrome pass after the render.
export function metalTextTint(color: string | undefined): [number, number, number] | null {
  if (color === "silver") return [1.0, 1.01, 1.04];
  if (color === "gold") return [1.0, 0.84, 0.50];
  if (color === "rose_gold") return [1.0, 0.80, 0.74];
  return null;
}
// A lightness 0..1 in a metal's tint, as a hex. Low lightness is kept neutral
// so the dark reflected bands read as reflections, not as brown paint.
function tintHex(t: [number, number, number], l: number): string {
  const ch = (k: number) => {
    const base = l * 255;
    const v = l > 0.5 ? base * t[k] : base * (1 + (t[k] - 1) * 0.5);
    return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  };
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

function customTextGuide(
  cx: number, pw: number, apexY: number, floorY: number, text: string,
  opts: {
    hasGraphicBelow?: boolean;
    /** Which side(s) of this panel the garland covers, so the lettering can
     *  be placed where the balloons are not. */
    garlandSide?: "left" | "right" | "both" | "none" | "round" | "banner" | "lonearch" | "lonearchleft" | "shimmer" | "doublearch" | "triple";
    fontStyle?: string;
    color?: string;
  } = {},
): { svg: string; zone: { xMin: number; xMax: number; yMin: number; yMax: number }; fill: string; silverInk: string } {
  const { hasGraphicBelow = false, garlandSide = "none", fontStyle = "script", color = "white" } = opts;
  const panelH = floorY - apexY;
  // The illustration zone starts at 32% of the panel height, so a text
  // baseline at 30% sat right on top of it and the printed artwork swallowed
  // the lettering (2026-09-03). When both are on the same panel the text moves
  // up into the panel's own top band and the zone below starts lower.
  // 2026-10-20: the lone round's garland is the customer's photo — a crown
  // across the top left and a mass down the left side, a cluster low on the
  // right — and it covers exactly the band this used to write in: "Happy"
  // went under the crown and the render dropped the words altogether. The
  // clear part of that disc is right of centre, between the crown and the
  // plinth, which is also where the photo itself has its lettering.
  const roundClear = garlandSide === "round";
  // 2026-10-21: the lone banner's replayed garland runs along the top from a
  // third of the way across and down the right; "Happy" went under the top
  // band. Its reference has the lettering in the middle of the board, left of
  // the garland, which is where it goes.
  const bannerClear = garlandSide === "banner";
  // 2026-10-22: the lone arch's replayed garland is on the right only, and its
  // reference sets the lettering large across the board — about three
  // quarters of its width, a little left of centre.
  // "lonearchleft": the same with the garland on the left (the solid arch
  // beside an open frame, garland on its outer side).
  const loneArchClear = garlandSide === "lonearch" || garlandSide === "lonearchleft";
  // 2026-10-22: the Triple Arch's centre board has its top under the crown,
  // so its lettering sits lower.
  const tripleClear = garlandSide === "triple";
  const y = apexY + panelH * (bannerClear ? 0.40 : roundClear ? 0.36 : tripleClear ? 0.46 : hasGraphicBelow ? 0.17 : 0.30);

  // The garland covers roughly the outer 30% of the board it hangs on. Text
  // drawn across the full width therefore had its first letters hidden behind
  // balloons, and the edit model read the half-covered word off the guide and
  // painted it wrong ("Happy Birthday" came back as "Dopy Birthday"). Drawing
  // the lettering on TOP of the balloons instead fixed the spelling but made
  // the model paint the words floating in front of the garland rather than
  // printed on the board. So the lettering stays under the balloons, in the
  // band of board they leave clear.
  const cover = 0.30;
  const clearW =
    // 2026-10-20: 0.50 -> 0.36, "yazi boyutu daha kuculsun". The font is
    // sized from this width, so the lettering scales down with it.
    roundClear ? pw * 0.36 :
    // 2026-10-22: beside the castle, as in the banner reference — right of
    // centre, about 0.38 of the board across.
    bannerClear ? pw * 0.38 :
    // Beside an open frame, a little smaller: it is laid over the render
    // there and must sit inside the board's clear face.
    loneArchClear ? pw * (garlandSide === "lonearchleft" ? 0.54 : 0.64) :
    garlandSide === "shimmer" ? pw * 0.44 :
    garlandSide === "doublearch" ? pw * 0.66 :
    garlandSide === "triple" ? pw * 0.76 :
    garlandSide === "both" ? pw * (1 - 2 * cover) :
    garlandSide === "none" ? pw * 0.85 :
    pw * (1 - cover) * 0.92;
  const shift =
    roundClear ? pw * 0.11 :
    bannerClear ? pw * 0.05 :
    loneArchClear ? (garlandSide === "lonearchleft" ? pw * 0.06 : -pw * 0.09) :
    garlandSide === "left"  ?  pw * cover / 2 :
    garlandSide === "right" ? -pw * cover / 2 : 0;
  const tx = cx + shift;

  // Wrap the message across lines instead of squeezing it onto one.
  //
  // The old single line shrank the type to fit the clear band, which on
  // anything longer than two words bottomed out at the 11px floor — a
  // three-word message was drawn at 11px on a 228px board. With that little to
  // copy the model improvised: "Happy Birthday Arya" came back as "Happy
  // Birthday / Arya / Arya", the last line echoed, and saying "do not repeat
  // any word" in the prompt did not stop it (2026-09-04). Wrapping at a
  // readable size gives it the real thing to reproduce.
  const words = text.trim().split(/\s+/).filter(Boolean);
  // ~0.5em average glyph advance for the script faces used here.
  const fitFont = (lineChars: number) => (clearW / Math.max(1, lineChars)) / 0.5;
  // Start from a comfortable display size and only shrink if a line demands it.
  let fontSize = Math.round(Math.min(pw * 0.17, fitFont(Math.max(...words.map((w) => w.length)))));
  fontSize = Math.max(12, fontSize);
  const maxChars = Math.max(1, Math.floor(clearW / (fontSize * 0.5)));
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= maxChars) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  if (lines.length === 0) lines.push(text.trim());
  // 2026-10-22, customer reference: the lettering is a thin, slanted,
  // handwritten signature script cut from flat mirror-polished acrylic —
  // "flat + handwrite + angled + shiny". The script face is now Sacramento,
  // which is narrower than the old face, so the size comes from the font's
  // real advance widths rather than an average per character.
  {
    const widest = Math.max(...lines.map((ln) => textAdvance(ln, fontStyle, fontSize)));
    const fitK = (clearW * 0.96) / Math.max(1, widest);
    fontSize = Math.max(12, Math.round(Math.min(fontSize * fitK, pw * 0.24)));
  }
  // 2026-10-22: 1.08 -> 1.34 for the script. Brittany Signature's loops
  // reach far above and below its line, and "Happy" and "Birthday" ran into
  // each other ("birthday birazdan daha asagi insin, kelimeler birbirine
  // girmis").
  const lineGap = fontSize * (fontStyle === "script" ? 1.34 : 1.18);
  const font = TEXT_GUIDE_FONT[fontStyle] ?? TEXT_GUIDE_FONT.script;
  const fill = resolveTextColorHex(color);
  // 2026-10-20: silver lettering is MIRROR acrylic, like the customer's
  // reference ("ICE ICE Baby" cut from polished silver acrylic). Drawn as
  // flat #A7ABB1 it rendered as dull grey paint. It is drawn the way the
  // chrome balloons are: hard bands of white and dark through the letters,
  // which is what reads as a reflective surface.
  // 2026-10-22: gold and rose gold the same way, in their own tints — the
  // lettering colour now follows the theme, and every one of them is shiny.
  const metal = metalTextTint(color);
  const silver = metal !== null;
  const silverDefs = metal
    // 2026-10-20: harder, as hard as the chrome balloons' own mirror-ball
    // gradient ("balonlardaki gibi shiny olsun"). The softer version came
    // back as embossed brushed grey — silver, but not shiny. Blown-white
    // bands against near-black reflected ones is what the balloons have.
    ? `<defs><linearGradient id="mirrorSilverText" x1="0" y1="0" x2="0.25" y2="1">` +
      // 2026-10-22: a FLAT cut-metal sheen now, not a mirror ball. The hard
      // blown-white and near-black bands read as an inflated foil-balloon
      // letter ("happy birthday yazisi flat degil, kabarik duruyor"); the
      // reference is thin flat acrylic, mid-dark with one soft sheen.
      // 2026-10-22: lighter — "font rengi biraz koyu, referanstaki daha
      // ferah": the reference's letters are a soft light silver-grey.
      // 2026-10-22 (later): a touch darker again, "yazinin bir kismi
      // okunmuyor" — at 0.6..0.86 the thin strokes faded into the board.
      [["0%", 0.62], ["40%", 0.50], ["55%", 0.76], ["70%", 0.54], ["100%", 0.48]]
        .map(([o, l]) => `<stop offset="${o}" stop-color="${tintHex(metal, l as number)}"/>`).join("") +
      `</linearGradient></defs>`
    : "";
  // Any near-white lettering needs an outline to exist at all against a white
  // board — judged on the resolved colour, so a customer-picked pale hex gets
  // the same treatment the "white" preset always had.
  const lum = (() => {
    const r = parseInt(fill.slice(1, 3), 16), g = parseInt(fill.slice(3, 5), 16), b = parseInt(fill.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  })();
  const outline = lum > 0.82
    ? ` stroke="rgba(120,120,120,0.85)" stroke-width="1.2"`
    : "";
  // A pale colour would be washed out by the white halo, so the halo darkens
  // for light lettering instead of fighting it.
  const halo = lum > 0.82 ? "rgba(140,140,140,0.55)" : "rgba(255,255,255,0.9)";
  // Centre the block on the intended baseline rather than hanging it below.
  const firstY = y - ((lines.length - 1) * lineGap) / 2;
  // As in the reference: the lines step across — the first set to the left,
  // the next to the right — and the whole block rises slightly to the right.
  const stagger = (i: number) => lines.length < 2 ? 0
    : (i === 0 ? -1 : i === lines.length - 1 ? 1 : 0) * Math.min(fontSize * 0.45, clearW * 0.10);
  const tilt = fontStyle === "script" ? -4 : 0;
  const rot = tilt ? ` transform="rotate(${tilt} ${tx.toFixed(1)} ${y.toFixed(1)})"` : "";
  // The script face is a hairline; on its own it gives a reflection nothing
  // to show on and the render can lose it, so every stroke is thickened.
  const thick = fontStyle === "script" ? fontSize * 0.045 : 0;
  const svg = `<g${rot}>` + lines.map((line, i) => {
    const ly    = firstY + i * lineGap;
    // 2026-10-20: drawn as a path from an embedded font (lib/guideFonts),
    // not as <text>. On Vercel the rasteriser has no fonts installed, so
    // every word came out as a row of empty boxes and the render printed
    // "□□□□□" on the backdrop. Locally it looked fine — Windows has fonts.
    const d = textPathD(line, fontStyle, tx + stagger(i), ly, fontSize);
    // Halo first so the word stays legible wherever it meets a balloon edge.
    return `<path d="${d}" fill="none" stroke="${halo}" stroke-width="${(4 + thick).toFixed(1)}" stroke-linejoin="round"/>` +
           (silver
             // Thickened with a stroke in the same gradient: a script hairline has
             // no surface for a reflection to show on.
             ? `<path d="${d}" fill="url(#mirrorSilverText)" stroke="url(#mirrorSilverText)" stroke-width="${(fontSize * 0.038).toFixed(1)}" stroke-linejoin="round"/>` +
               `<path d="${d}" fill="none" stroke="rgba(60,64,70,0.70)" stroke-width="0.9"/>`
             : `<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="${thick.toFixed(1)}" stroke-linejoin="round"${thick ? "" : outline}/>`);
  }).join("") + `</g>`;
  return {
    svg: silverDefs + svg,
    // Metallic lettering only: the same words in solid white with a thick
    // stroke, for the route's chrome pass to use as a mask. The render puts
    // the words where the guide draws them, so a slightly fattened copy of
    // the guide's letters covers the painted ones and nothing else.
    silverInk: silver
      ? `<g${rot}>` + lines.map((line, i) => {
          const ly = firstY + i * lineGap;
          return `<path d="${textPathD(line, fontStyle, tx + stagger(i), ly, fontSize)}" ` +
            `fill="#FFFFFF" stroke="#FFFFFF" stroke-width="${(fontSize * 0.16).toFixed(1)}" stroke-linejoin="round"/>`;
        }).join("") + `</g>`
      : "",
    // Deliberately larger than the guide's own lettering: the render model
    // draws the words bigger and lower than the guide does, and a box sized to
    // the guide caught only part of them (measured 2026-09-04 — the guide box
    // covered x 223..353 while the painted word ran x 165..365). It is clamped
    // to the board itself, because the recolour keys on dark neutral pixels
    // and the grey wall behind the panel would qualify.
    zone: {
      xMin: Math.max(cx - pw / 2 + pw * 0.04, tx - clearW / 2 - pw * 0.06),
      xMax: Math.min(cx + pw / 2 - pw * 0.04, tx + clearW / 2 + pw * 0.06),
      // Measured against the BOARD, not against the guide's own font size.
      // The guide always draws one line and shrinks the type to fit, hitting
      // its 11px floor on anything long, while the model ignores both and sets
      // the words large across several lines: "Happy Birthday Arya" came back
      // as three lines spanning about a fifth of the board, against a guide
      // font of 11px. A box derived from that font covered the first two lines
      // and left the third the model's black (2026-09-04). The band below is
      // where lettering actually lands on a board, and the pixel tests decide
      // what inside it is ink.
      yMin: apexY + panelH * 0.08,
      yMax: apexY + panelH * 0.55,
    },
    fill,
  };
}

// Low-opacity theme-graphic guide area on the panel surface — helps the edit
// model bake the printed illustration into the backdrop, not paste a sticker.
function themeGraphicGuideArea(
  cx: number, pw: number, apexY: number, floorY: number,
  hasTextAbove = false,
): string {
  const panelH = floorY - apexY;
  const gw = pw * 0.55;
  const gh = panelH * 0.35;
  const gx = cx - gw / 2;
  // Dropped clear of the text band when the same panel also carries lettering.
  const gy = apexY + panelH * (hasTextAbove ? 0.42 : 0.32);
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
  void cornerR; void fontSize; void label; void baseRy;
  // 2026-09-08: the crisp white rounded rect WAS the second number. With a
  // light-up marquee digit also described in the prompt, the model read this
  // tall white rounded shape as another one and painted it — the customer saw
  // two numbers, the left one half-buried behind the composited character
  // ("neden 2 tane number var?"). The footprint is still reserved, but as a
  // soft neutral haze with no crisp edge and no upright silhouette, so there
  // is no shape left to reinterpret as a letterform.
  const gid = `stg${Math.round(cx)}_${Math.round(bottomY)}`;
  return [
    `<defs><radialGradient id="${gid}" cx="50%" cy="55%" r="58%">` +
      `<stop offset="0%" stop-color="#F7F7F7" stop-opacity="0.38"/>` +
      `<stop offset="70%" stop-color="#F7F7F7" stop-opacity="0.15"/>` +
      `<stop offset="100%" stop-color="#F7F7F7" stop-opacity="0"/>` +
      `</radialGradient></defs>`,
    `<ellipse cx="${cx.toFixed(1)}" cy="${(topY + heightPx / 2).toFixed(1)}" ` +
      `rx="${(rx * 1.45).toFixed(1)}" ry="${(heightPx / 2).toFixed(1)}" fill="url(#${gid})"/>`,
    // 2026-09-09: the floor disc is gone. A soft upright haze with a small round
    // pad under it is a lamp, and that is what the render painted — a slim white
    // pole down the left of the backdrop standing on a disc. The haze alone
    // reserves the footprint; the contact shadow is composited with the standee
    // afterwards anyway (see the shadow block in the render route).
  ].join("\n    ");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * BALLOON SIZE STANDARD — one set of families for every setup.
 *
 * 2026-10-15. Each garland in this file had grown its own magic numbers,
 * expressed as a fraction of its panel's width. That is the wrong unit: a
 * balloon is a physical object, so the same fraction gives a 26in balloon on
 * one panel and a 7in one on another, and the setups drifted apart.
 *
 * These are real diameters in centimetres, measured off the customer's
 * reference photo against the board's own width (statement 0.30-0.33 of the
 * board, standard 0.20, filler 0.09, on a 120cm board). Converting through
 * the panel's own widthCm gives every layout the SAME physical balloon — a
 * 16in balloon covers a third of a 120cm arch and a fifth of a 200cm disc,
 * which is exactly what the real thing does.
 */
const BALLOON_DIAMETER_CM = { statement: 40, large: 30, standard: 24, filler: 11 };

/** The four radii in guide pixels for a panel of a given real width. */
function balloonRadiiPx(widthCm: number, widthPx: number): { X: number; L: number; M: number; S: number } {
  const pxPerCm = widthPx / Math.max(1, widthCm || 100);
  const r = (cm: number) => (cm * pxPerCm) / 2;
  return {
    X: r(BALLOON_DIAMETER_CM.statement),
    L: r(BALLOON_DIAMETER_CM.large),
    M: r(BALLOON_DIAMETER_CM.standard),
    S: r(BALLOON_DIAMETER_CM.filler),
  };
}

export function generateStructureSilhouette(
  backdropItems:    BackdropItem[],
  plinthSizes:      PlinthSize[],
  balloonStyle:     BalloonStyleId,
  balloonColors?:   string[],
  cutoutGuideItems?: CutoutGuideItem[],
  // Sequin-disc tile fill for shimmer_wall panels — defaults to the original silver-gray
  // so any caller that doesn't pass it keeps the pre-existing look.
  shimmerColorHex?: string,
  // 2026-09-05: florals and the light-up number are drawn HERE rather than
  // described in the prompt. Both were written as prompt clauses first and both
  // did nothing at all — the render came back pixel-identical with and without
  // them, which is what every mid-prompt addition on this pipeline does. Placed
  // objects belong in the guide.
  extras?: {
    florals?: boolean;
    numberLight?: { enabled: boolean; value: string };
    neonSign?: { enabled: boolean; text: string; panelIndex?: number };
    /** Balloon Ring dressing — "half" leaves the gold hoop bare on one side. */
    ringStyle?: "full" | "half" | "none";
    /**
     * Hexes in the palette whose Sempertex finish is Reflex/Chrome/Metallic.
     * 2026-09-11: the guide painted every balloon with the same matte sphere
     * gradient, so a chrome balloon was drawn as a flat grey ball and the
     * render copied exactly that — the customer's "silver turned grey".
     * Saying "mirror-chrome" in the prompt did not fix it on its own; like
     * every other appearance problem on this pipeline, it had to be drawn.
     */
    chromeColors?: string[];
    /** Hexes in the palette that are clear (transparent) balloons. */
    clearColors?: string[];
    /** Draw the white snowflake ornaments of the reference garlands (Frozen). */
    snowflakes?: boolean;
    /** The render is also given a reference photo (frozenStyleReferences). */
    styleReference?: boolean;
  },
): SilhouetteResult {
  const shimmerTileFill = shimmerColorHex ?? "#D8D8E4";
  /**
   * Deepen a balloon colour for the GUIDE only.
   *
   * 2026-09-11: the customer reported the garland as "too pastel". Measured
   * against the swatches it is: Silk 850 Light Amethyst is hue 251 / sat
   * 0.51, and it was rendering at sat 0.115 — under a quarter. The render
   * bleaches pale colours, so the guide pre-compensates by drawing them
   * deeper; the render's own wash-out then lands near the true swatch.
   *
   * Doing this in the guide rather than the prompt is deliberate. Every
   * wording attempt drifted the HUE instead of the depth — asking for
   * "warm" or "rich" turned the lilac to rose pink (hue 338) and no
   * rewording pulled it back. Saturation is raised here with the hue left
   * exactly alone, which is the part that was actually wrong.
   *
   * Only the guide's fill changes. The palette text, the colour-lock pass
   * and everything the customer is quoted still use the true swatch hex.
   */
  // 2026-09-28: scoped to the LONE ARCH. This was measured and tuned there
  // and then left applying to every layout, which was an unverified side
  // effect — on Single Round, whose guide is a thin arc of small dots, it
  // turned a pale cyan-and-lilac palette into vivid cyan and vivid purple.
  // Other layouts keep the true swatch colour they were approved with.
  const loneArchGuide = backdropItems.length === 1 && backdropItems[0]?.type === "arch";
  const deepenForGuide = (hex: string): string => {
    if (!loneArchGuide) return hex;
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    const v = parseInt(m[1], 16);
    let r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    // Neutrals (white, silver) carry no hue and must not be tinted.
    if (d < 0.04 || mx < 0.05) return hex;
    const l = (mx + mn) / 2;
    // Pull each channel away from the mid-grey of the colour: raises
    // saturation and drops lightness a little, leaving the hue untouched.
    // 1.55, chosen by measurement rather than taste. Pushing to 2.6 deepened
    // the lilac no further (sat 0.128 -> 0.123) and cost most of the blue:
    // the blue balloons fell from 21.7k to 6.9k pixels as the deepened cyan
    // drifted out of the palette the render would accept. 1.55 gives both the
    // deepest lilac measured AND more blue than before it existed.
    const k = 1.55;
    r = Math.min(1, Math.max(0, l + (r - l) * k));
    g = Math.min(1, Math.max(0, l + (g - l) * k));
    b = Math.min(1, Math.max(0, l + (b - l) * k));
    const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
    return `#${to(r)}${to(g)}${to(b)}`;
  };
  const chromeHexSet = new Set(
    (extras?.chromeColors ?? []).map((h) => String(h).toLowerCase()),
  );
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
    // One slot per selected colour, so every colour the customer picked gets
    // the same share of the garland.
    //
    // This used to be [W, pri, W, pri, rest0, W, rest1, pri, W, restLast] —
    // white in four slots of ten and the primary in three, leaving each accent
    // a single slot. Measured on a five-colour palette that produced white 42%
    // of the balloons and 55% of the garland area, the primary 31%, and the
    // other three 9% each; the customer asked for the colours to be spread
    // evenly and for no one colour to dominate (2026-09-04). Ordering still
    // alternates white and the primary with the accents so that neighbours
    // differ, but each appears once.
    const seq: string[] = [W, pri];
    rest.forEach((c, i) => {
      seq.push(c);
      // Break up runs of accents on longer palettes.
      if (i === 0 && rest.length > 2) seq.push(W);
    });
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
  const textZones: { panelIdx: number; colorHex: string; xMin: number; xMax: number; yMin: number; yMax: number }[] = [];
  const marqueeBulbsLayout: [number, number, number][] = [];
  const silverInkLayer: string[] = [];
  const neonOverlayLayer: string[] = [];
  let textMetalTint: [number, number, number] | null = null;
  let bannerPrintLayout: { x: number; y: number; w: number; h: number } | null = null;
  const bannerPrintHoles: string[] = [];
  let bannerPrintInGuide = false;
  // The plinth marker is collected separately and appended after the balloons.
  // Drawn in place it went into the guide BEFORE the garland, so balloon
  // circles covered its base and sides and the model saw a stub of a cylinder
  // — which is why the plinth came out short and fat as soon as a garland was
  // added, and looked right without one (2026-09-03). Drawing it last is also
  // what the real scene looks like: the plinth stands on open floor in FRONT
  // of the boards and the garland, not behind them.
  const plinthLayer: string[] = [];

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
  // 2026-10-21: a lone balloon ring has no board, so the white ground of the
  // guide showed round and through the hoop — and was painted as a white
  // paper backdrop behind it, most of all on the bare hoop. For the ring
  // the guide carries the room instead: a grey wall and a lighter floor.
  // 2026-10-21: the Triple Arch too. Its replayed garland wraps right round
  // the three boards, and the white guide ground inside that wrap rendered as
  // one big white paper backdrop on a stand behind them.
  // 2026-10-22: and the Double Arch, for the same reason — a white paper
  // backdrop on a stand appeared behind its two boards.
  const ringRoomGround = (backdropItems.length === 1 && backdropItems[0]?.type === "balloon_ring")
    || (backdropItems.length === 2 && backdropItems.every((i) => i?.type === "arch"))
    || (backdropItems.filter((i) => i?.type === "half_arch").length === 2 && backdropItems.some((i) => i?.type === "arch"));
  if (ringRoomGround) {
    const fy = marginY + (calculateExactLayout(backdropItems, plinthSizes, W, H).floorY) * SCALE;
    bgLines.push(`<rect width="${W}" height="${H}" fill="#9C9B98"/>`);
    bgLines.push(`<rect y="${fy.toFixed(1)}" width="${W}" height="${(H - fy).toFixed(1)}" fill="#C4C3C0"/>`);
  } else {
  bgLines.push(`<rect width="${W}" height="${H}" fill="#FFFFFF"/>`);
  }

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
  // 2026-09-09: a Triple Arch of three WHITE boards is three invisible shapes on
  // a white ground, and the render duly invented its own arrangement — four and
  // five arches in the same photo. Three boards standing shoulder to shoulder
  // only read as three if the guide actually shows where each one ends, so a
  // near-white board in this layout is drawn with the neutral panel fill and
  // each board gets a different one. (The prompt still states their real
  // colour; this is a guide-legibility fill, exactly like the open arch band.)
  const isTripleArchGuide =
    backdropItems.filter((i) => i?.type === "half_arch").length === 2 &&
    backdropItems.some((i) => i?.type === "arch");
  const fillForPanel = (sortedIdx: number, panelIdx?: number): string => {
    const own = (backdropItems[panelIdx ?? sortedIdx] as { color?: string } | undefined)?.color;
    const nearWhite = !own || /^#(f{6}|F{6})$/.test(own) || own.toUpperCase() === "#FFFFFF";
    if (own && /^#[0-9a-fA-F]{6}$/.test(own) && !(isTripleArchGuide && nearWhite)) return own;
    // 2026-10-21: on the room-coloured ground (see ringRoomGround) the
    // Triple Arch boards read as boards in plain white, outlined; the tints
    // came back as a lilac board.
    if (isTripleArchGuide) return "#F4F2EF";
    const slot = isTripleArchGuide ? (panelIdx ?? sortedIdx) : (uniformPanelFill ? 0 : sortedIdx);
    return MULTI_PANEL_FILLS[slot % MULTI_PANEL_FILLS.length];
  };

  const sorted = [...layout.panels].sort((a, b) => a.zOrder - b.zOrder);
  sorted.forEach((panel, sortedIdx) => {
    const item      = backdropItems[panel.idx];
    const shape     = (item?.type ?? "arch") as BackdropShapeId;
    const isShimmer = shape === "shimmer_wall";

    // Open arch frame. 2026-09-08, after five prompt rewrites and three guide
    // changes all failed to stop the render carving a stepped moulding around
    // the opening: the guide no longer draws a RING at all. It draws the same
    // solid filled arch silhouette the solid backdrop gets — the one shape this
    // pipeline renders as a dead-flat board every single time — and the balloon
    // cluster is what defines the opening on top of it.
    //
    // Why this is not a cheat: the opening is packed edge to edge with balloons
    // in every render and in the customer's own reference photo, so the hole is
    // never actually visible. What the ring was contributing was not a visible
    // hole, it was a crisp concentric arch line, and a crisp concentric arch
    // line in perspective is exactly the cue for a moulded reveal.
    if (shape === "open_arch_frame") {
      // 2026-10-21: HOLLOW again, as in the customer's reference — a thick
      // white arch band with the wall showing through its middle. Drawn solid
      // (the 2026-09-08 change above), with a balloon cluster on its face,
      // it rendered as a solid wall of balloons. The band is light grey on
      // the white guide ground so it reads as an object.
      const hollow = openArchFramePath(panel.cx, panel.pw, panel.apexY, panel.floorY, "#E4E2DE", "#9C9B98");
      content.push(hollow.svg);
      void fillForPanel;
      // Still reported: route.ts and the prompt read this to describe the band.
      archOpenFrameFrameThicknessPx = Math.round(
        Math.max(14, Math.min((panel.pw / 2) * 0.42, panel.pw * 0.15)),
      );
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
        // A half arch curves AWAY from the middle of the group, so which way it
        // faces depends on where it stands.
        const groupMidX = (Math.min(...layout.panels.map((q) => q.cx - q.pw / 2))
          + Math.max(...layout.panels.map((q) => q.cx + q.pw / 2))) / 2;
        // Beside an open frame the solid arch is drawn filled, like the lone
        // arch: a hairline board next to the frame's band was the weaker shape.
        // 2026-10-22: every arch board in a multi-board setup, not just the one
        // beside an open frame — "backdropla balonlar arasinda bosluklar
        // gozukmemesi lazim". On a hairline board the render could not see
        // where the board ended, and the garland stood off it.
        const besideOpenFrame = shape === "arch";
        const ownFillM = fillForPanel(sortedIdx, panel.idx);
        const nearWhiteM = /^#(f[0-9a-f]){3}$/i.test(ownFillM) || ownFillM.toUpperCase() === "#FFFFFF";
        content.push(panelPathOrShape(panel.cx, panel.pw, panel.apexY, panel.floorY, shape,
          besideOpenFrame && nearWhiteM ? "#F1EFEC" : ownFillM, panel.cx <= groupMidX ? "left" : "right",
          // 2026-10-21: the Triple Arch boards outlined too. With the replayed
          // garland covering most of the side boards, the hairline edges left
          // nothing to say three boards stand there, and the render made one
          // big paper backdrop on a stand out of them.
          besideOpenFrame || isTripleArchGuide));
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
    // 2026-10-21: the lone banner too. Drawn as a hairline, its white face
    // left the white plinth marker in front of it with nothing to stand out
    // against, and the render dropped the plinth ("plinthe noldu?").
    } else if (layout.panels.length === 1 && (shape === "arch" || shape === "banner")) {
      // 2026-09-09: a lone arch draws its board FILLED, with a firm edge.
      //
      // panelEdgeOnly gives the board a 2px, 45%-opacity outline. On the
      // 100x220 arch that outline is the ONLY thing in the guide describing the
      // board, it is white-on-white inside, and the garland covers a third of
      // it — so there was almost no board signal to copy and the render kept
      // inventing its own proportions, coming back visibly wider than 100x220
      // however the prompt was worded (customer, twice: "backdrop size dogru
      // degil"). The measured guide was correct all along at aspect 0.4545; the
      // guide simply was not SAYING it loudly enough. This is the same fix that
      // made the open arch frame stop rendering as a chrome box: stop drawing a
      // hairline, draw a filled silhouette.
      //
      // 2026-09-10: the first fill was #F4F2EF on the guide's #FFFFFF ground —
      // four levels of difference, i.e. still invisible, so the render went on
      // sizing the board off the garland and came back 19% short. Overlaying
      // the guide outline on the render is what showed it. The fill is now a
      // definite light grey that cannot be confused with the background. It
      // does not tint the render: the board's colour comes from the prompt,
      // and the same trick is what makes the plinth and the open frame land.
      // 2026-09-11: the fill was hardcoded to #DEDAD4, which ignored the
      // customer's chosen backdrop colour entirely — every lone arch was
      // guided as the same warm grey whatever they picked. It also made a
      // WHITE board render grey-and-blue rather than white (measured
      // 210,207,215 against Arch + Shimmer's neutral 220,219,218).
      // The board now carries its own colour. A near-white one is nudged
      // just off the guide's white ground so the silhouette still reads —
      // only a few levels, since flash traces the 3px edge reliably and the
      // fill no longer has to do that work on its own.
      const ownFill = fillForPanel(sortedIdx, panel.idx);
      const nearWhite = /^#(f[0-9a-f]){3}$/i.test(ownFill)
        || ownFill.toUpperCase() === "#FFFFFF";
      content.push(panelPathOrShape(
        panel.cx, panel.pw, panel.apexY, panel.floorY, shape,
        nearWhite ? "#F1EFEC" : ownFill, "left", true,
      ));
      // 2026-10-21: a Frozen-printed banner carries its print IN the guide.
      // Laid on after the render, the print had to have the plinth cut out
      // of it at the plinth's GUIDE size; the render drew the plinth shorter
      // and an angled white wedge of unprinted board showed above it. Drawn
      // here, the render paints the board printed and stands the plinth and
      // balloons in front of it itself.
      if (shape === "banner" && item?.graphic?.enabled && String(item?.graphic?.assetId ?? "").startsWith("frozen-")) {
        const side = Math.min(panel.pw, panel.floorY - panel.apexY);
        const bl = panel.cx - side / 2, bt = panel.floorY - side;
        // 2026-10-22: the customer's castle artwork (bannerCastlePrint), in
        // place of the drawn snowflake wash.
        void frozenBannerPrintSvg;
        content.push(`<image x="${bl.toFixed(1)}" y="${bt.toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" ` +
          `preserveAspectRatio="xMidYMid slice" href="${FROZEN_CASTLE_PRINT}"/>`);
        bannerPrintInGuide = true;
      }
    } else {
      content.push(panelEdgeOnly(panel.cx, panel.pw, panel.apexY, panel.floorY, shape));
    }

    // Theme graphic guide area — faint print zone on the panel surface so the
    // edit model bakes the illustration into the backdrop (not a sticker).
    const panelTextValue = item?.text?.enabled ? (item.text.value ?? "").trim() : "";
    if (item?.graphic?.enabled && !isShimmer && shape === "banner" && backdropItems.length === 1) {
      // 2026-10-21: the lone banner's print is NOT left to the render. On
      // turbo the model copied any zone drawn here literally (a pale blue
      // rectangle) and painted no illustration whatever the prompt said. The
      // board is left plain in the guide and the route prints the artwork
      // onto it afterwards, in the part of the board the garland leaves
      // clear: the upper left and centre (the crown takes the top right and
      // the left cluster starts just under halfway down — see BANNER_REF).
      const side = Math.min(panel.pw, panel.floorY - panel.apexY);
      const bl = panel.cx - side / 2, bt = panel.floorY - side;
      // 2026-10-21 (later): the WHOLE board — "butun backdropu kaplasin,
      // beyazlik kalmasin". What sits in front of it (balloons, plinth,
      // number) is cut out of the print by bannerPrintMaskSvg.
      bannerPrintLayout = { x: bl, y: bt, w: side, h: side };
    } else if (item?.graphic?.enabled && !isShimmer) {
      content.push(themeGraphicGuideArea(
        panel.cx, panel.pw, panel.apexY, panel.floorY, panelTextValue.length > 0,
      ));
    }

    // Customized text guide — exact text, upper-middle of solid panels only.
    // (Open arch frames return early above.) 2026-10-22: shimmer walls too —
    // their references carry the lettering across the middle of the wall.
    if (panelTextValue) {
      // Which side the garland will hang on, mirroring the dispatch further
      // down so the lettering can sit in the clear part of the board.
      const bothArches = backdropItems.length === 2 && backdropItems.every((i) => i.type === "arch");
      const fullerTier = balloonStyle === "full" || balloonStyle === "premium";
      const meanCx     = layout.panels.reduce((sum, p) => sum + p.cx, 0) / layout.panels.length;
      const garlandSide: "left" | "right" | "both" | "none" | "round" | "banner" | "lonearch" | "lonearchleft" | "shimmer" | "doublearch" | "triple" =
        balloonStyle === "none" ? "none"
          : layout.panels.length === 1 && shape === "round" ? "round"
          : layout.panels.length === 1 && shape === "banner" ? "banner"
          : isShimmer ? "shimmer"
          : shape === "arch" && backdropItems.some((it) => it?.type === "open_arch_frame")
            ? (panel.cx < meanCx ? "lonearchleft" : "lonearch")
          // 2026-10-22: centred on its board ("happy birthday yazisi backdropu
          // ortalasin") — the second board's garland only starts halfway down.
          : bothArches ? "doublearch"
          : layout.panels.length === 1 && shape === "arch" ? (fullerTier ? "lonearch" : "right")
          : "none";
      const textGuide = customTextGuide(
        panel.cx, panel.pw, panel.apexY, panel.floorY, panelTextValue,
        {
          hasGraphicBelow: !!item?.graphic?.enabled,
          garlandSide,
          fontStyle: item?.text?.fontStyle,
          color:     item?.text?.color,
        },
      );
      // 2026-10-22: beside an open frame the lettering is laid over the
      // finished render (into the same overlay as the ring's neon) rather
      // than drawn in the guide. The flash model dropped it on two seeds of
      // three whatever the prompt said ("happy birthday yazisi yok"). A soft
      // shadow under it seats the letters on the board as cut acrylic.
      // (2026-10-22: and on the Triple Arch, where the full model painted the
      // words black.)
      // Not when the render is shot against a reference photo: it copies the
      // photo's own lettering, and the overlay came out doubled on top.
      const overlayText = shape === "arch" && (backdropItems.some((it) => it?.type === "open_arch_frame")
        || (isTripleArchGuide && !extras?.styleReference));
      if (overlayText) {
        if (neonOverlayLayer.length === 0) neonOverlayLayer.push(`<defs><filter id="txtShadow" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>`);
        const shadow = textGuide.svg.replace(/<defs>[\s\S]*?<\/defs>/, "")
          .replace(/(stroke|fill)="(?!none)[^"]*"/g, '$1="rgba(70,72,80,0.30)"')
          .replace(/^<g/, '<g filter="url(#txtShadow)"');
        neonOverlayLayer.push(`<g transform="translate(2.2,3.2)">${shadow}</g>`);
        // Without the guide's halo and hairline outline: laid on a photo those
        // made the letters read hollow.
        neonOverlayLayer.push(textGuide.svg
          .replace(/<path d="([^"]+)" fill="none" stroke="rgba\([^"]*\)" stroke-width="[^"]*" stroke-linejoin="round"\/>/g, "")
          .replace(/<path d="([^"]+)" fill="none" stroke="rgba\(60,64,70,0\.70\)" stroke-width="0\.9"\/>/g, ""));
      } else {
        content.push(textGuide.svg);
      }
      if (textGuide.silverInk && !overlayText) {
        silverInkLayer.push(textGuide.silverInk);
        textMetalTint = textMetalTint ?? metalTextTint(item?.text?.color);
      }
      textZones.push({ panelIdx: panel.idx, colorHex: textGuide.fill, ...textGuide.zone });
    }
  });

  // v4: Cylindrical plinth edge guide — no fill, no block
  const singleRound = backdropItems.length === 1 && backdropItems[0]?.type === "round";

  // Plinths are centred on the decor (2026-09-03, product decision: "the
  // plinths should always centre the decor"). Every layout used to have its
  // own rule — Double Arch at 38% or 62% of the canvas, the half-garland tier
  // at 28% or 62%, the round panel offset left of its own centre — so the
  // plinth sat off to one side and read as a stray object instead of the
  // centrepiece. The backdrop group's midpoint replaces all of them, and
  // several plinths stay a centred group, spread symmetrically about that
  // midpoint so they cannot stack on each other.
  //
  // Worth keeping from the placement history this replaces: for Double Arch
  // the midpoint is in front of the boards, on open floor — it is NOT the gap
  // between them. The gap is a narrow slot this model refuses to put an
  // object into (an 89px plinth in a 111px gap), and roughly ten renders plus
  // 8 earlier attempts were lost to it before the placement left the gap.
  const groupLeftEdge  = Math.min(...layout.panels.map((pl) => pl.cx - pl.pw / 2));
  const groupRightEdge = Math.max(...layout.panels.map((pl) => pl.cx + pl.pw / 2));
  // 2026-09-05: the plinth stands centred in FRONT of the whole setup, on every
  // layout — dead centre of the two boards when there are two, dead centre of
  // the board when there is one. It was briefly moved in front of the arch on
  // Arch + Shimmer; the customer wants it centred there too.
  const decorCxBase = (groupLeftEdge + groupRightEdge) / 2;
  const plinthCount    = layout.plinths.length;
  // 2026-09-09: capped so the row FITS. Three plinths at true scale span 632px
  // on a 576px-wide portrait frame — the row ran off both edges, which is why a
  // three-plinth Single Arch rendered four columns: the model was completing
  // shapes it could only half see.
  const plinthMaxDia   = Math.max(...layout.plinths.map((pl) => pl.diameterPx), 1);
  const plinthSpacing  = plinthCount > 1
    ? Math.min(plinthMaxDia * 1.5, (W * 0.86 - plinthMaxDia) / (plinthCount - 1))
    : plinthMaxDia * 1.5;

  // 2026-09-09: the plinth row SLIDES to open a slot for the marquee number.
  //
  // The number is 90cm and the frame is portrait, so on a scene that also has a
  // character standee there is no free floor left: the standee owns the left,
  // the plinth owns the middle, the garland owns the right, and the number was
  // dropped into the least-bad gap — on top of the plinth, inside the cascade
  // (customer report: "plinth+cutout+number eklenince sacmaladi").
  //
  // Moving the row is POSITIONING, not scaling: every prop keeps its own real
  // centimetres, and with no number the row stays dead centre, which is where
  // it was asked to be on 2026-09-05. An earlier attempt shifted by a flat
  // fraction of the panel width and pushed a three-plinth row off the canvas;
  // this one computes the exact shortfall and clamps it to what the frame has.
  const numberDigitCount = String(extras?.numberLight?.value ?? "").replace(/[^0-9]/g, "").slice(0, 2).length;
  const wantsNumberSlot = !!extras?.numberLight?.enabled && numberDigitCount > 0 && plinthCount > 0;
  // 2026-09-09 (later): the shift is OFF. The customer wants the plinth
  // centred on the backdrop, or on the backdrop set, always — sliding it aside
  // to make room for the number moved it off centre and under the garland. The
  // number is separated by SIDE instead: cutout left, number right.
  // 2026-09-09 (later, same day): the slide is GONE. It was added a few hours
  // earlier to open a slot for the marquee number, and it moved the plinth off
  // centre and under the garland — the customer's rule is that the plinth always
  // centres on the backdrop, or on the backdrop set. The number is kept clear of
  // it by SIDE instead: the character stands left, the number stands right.
  // 2026-10-21: on a HALF-dressed ring the plinth stands in front of the
  // bare right-hand side of the hoop. Centred, it stood on the garland's
  // foot, which spreads along the floor from the left.
  // (2026-10-21: briefly shifted right on a half-dressed ring; reverted the
  // same day — the plinth is centred on the design on every setup, "plinth
  // ortalamali dizayni her seferinde". The ring's foot is trimmed to make
  // room for it instead — see HALF_RING_REF.)
  const decorCx = decorCxBase;

  // 2026-09-05: the plinth stands FORWARD of the decor, nearer the camera, not
  // level with the backdrop. On a balloon ring especially it was sitting on the
  // same floor line as the hoop and reading as though it were inside it. Moving
  // its base down the canvas is what puts it in front in this projection.
  const isRingScene = backdropItems[0]?.type === "balloon_ring";
  // 2026-09-11: every other layout stood the plinth on the SAME floor line as
  // the backdrop, so it rendered flush against the board with no gap. The
  // customer wants it standing about 50cm forward. In this projection,
  // forward means lower on the canvas, so the base is stepped down by the
  // pixel equivalent of 50cm, foreshortened: at a straight-on eye-level
  // camera a floor depth projects to roughly a third of its true length, so
  // the 0.35 factor is that foreshortening and not a fudge.
  const PLINTH_FRONT_GAP_CM = 50;
  const refPanelForGap = layout.panels[0];
  const pxPerCmForGap = refPanelForGap && refPanelForGap.heightCm > 0
    ? (refPanelForGap.floorY - refPanelForGap.apexY) / refPanelForGap.heightCm
    : 0;
  const plinthForwardPx = isRingScene
    ? (layout.floorY - Math.min(...layout.panels.map((pl) => pl.apexY))) * 0.10
    : PLINTH_FRONT_GAP_CM * pxPerCmForGap * 0.35;
  // 2026-09-09: the ACTUAL drawn extent of the plinth row. The marquee number
  // used to be positioned against an estimate rebuilt from decorCx and
  // plinthSpacing, which did not match what was drawn, so it landed on a
  // column anyway.
  // 2026-10-20, lone round with a character: the marquee number stands on
  // the side OPPOSITE the character — "elsanin tam ters tarafinda" — at the
  // plinth's depth, level with the character's feet. Computed here because
  // the garland needs it too (it keeps that floor clear).
  //
  // Not the exact mirror of the character, which would centre it about 1.2
  // disc radii right of centre. Tried at 1.23, 1.1 and 1.0 radii: the render
  // dropped the number every time and filled its place with balloons. At
  // 0.62 and 0.85 it was drawn every time, standing in front of the right
  // cluster — 0.85 is the furthest out that holds.
  const loneRoundNumberRect = (() => {
    const digits = String(extras?.numberLight?.value ?? "").replace(/[^0-9]/g, "").slice(0, 2);
    if (!extras?.numberLight?.enabled || digits.length === 0) return null;
    if (layout.panels.length !== 1 || (backdropItems[layout.panels[0].idx]?.type ?? "") !== "round") return null;
    const standeeCm = Math.max(0, ...(cutoutGuideItems ?? []).map((c) => c.heightCm));
    if (standeeCm <= 0) return null;
    const pn = layout.panels[0];
    const pxPerCm = (pn.floorY - pn.apexY) / Math.max(1, backdropItems[pn.idx]?.heightCm ?? 200);
    const digitH = 90 * pxPerCm, digitW = digitH * 0.60, gap = digitW * 0.14;
    const groupW = digitW * digits.length + gap * (digits.length - 1);
    const cx = pn.cx + 0.85 * (pn.pw / 2);
    const visRight = (W - marginX) / SCALE;
    // A two-digit number is twice as wide and, centred on the same point, ran
    // into the plinth; it never starts closer to the plinth than this.
    const plinthHalf = Math.max(0, ...layout.plinths.map((pl) => pl.diameterPx)) / 2;
    const x = Math.min(
      Math.max(cx - groupW / 2, pn.cx + plinthHalf + digitH * 0.12),
      visRight - groupW - digitH * 0.10,
    );
    // The render paints the plinth's base about 4.5% of the disc's height
    // lower than the guide draws it (measured, 889 -> 915 on a 1024 frame),
    // while it puts the number exactly where it is drawn — so a number drawn
    // level with the plinth came back standing above the floor. It is
    // drawn that much lower so the two meet the floor together.
    const baseY = pn.floorY + plinthForwardPx + (pn.floorY - pn.apexY) * 0.045;
    return { x, w: groupW, top: baseY - digitH, baseY };
  })();
  let plinthDrawnLeftPx: number | null = null;
  let plinthDrawnRightPx: number | null = null;
  let plinthDrawnTopPx: number | null = null;
  layout.plinths.forEach((p, plinthIdx) => {
    // One plinth lands on the midpoint; two straddle it; three sit centred.
    const plinthCx = Math.round(
      decorCx + (plinthIdx - (plinthCount - 1) / 2) * plinthSpacing,
    );
    plinthDrawnLeftPx  = Math.min(plinthDrawnLeftPx  ?? Infinity,  plinthCx - p.diameterPx / 2);
    plinthDrawnRightPx = Math.max(plinthDrawnRightPx ?? -Infinity, plinthCx + p.diameterPx / 2);
    const plinthBottomY = p.bottomY + plinthForwardPx;
    plinthDrawnTopPx = Math.min(plinthDrawnTopPx ?? Infinity, plinthBottomY - p.heightPx);
    // Round scenes: use filled cylinder so the plinth reads as a clear
    // solid object, not just outline edges that the model may skip or
    // merge with the background.
    if (singleRound) {
      // 2026-09-09: the round's own marker is very pale, and standing beside a
      // bold marquee glyph it was simply dropped — the plinth vanished from a
      // round + number render. Scenes with a number get the solid marker here
      // too, the same rule the other layouts already follow.
      plinthLayer.push(wantsNumberSlot
        ? plinthFilledCylinder(plinthCx, plinthBottomY, p.heightPx, p.diameterPx)
        : plinthCylinder(plinthCx, plinthBottomY, p.heightPx, p.diameterPx));
    } else {
      // Double Arch falls through to Single Arch's marker as well. The filled
      // variant and the dropped baseline it used to get were both compensating
      // for the gap placement removed above; standing in front of a panel, the
      // plain outline is what Single Arch renders reliably from.
      // plinthEdge is a faint outline. It survives on a bare panel, but once
      // the boards carry lettering or a printed illustration it is the weakest
      // mark in the guide and the plinth stops being painted — so those scenes
      // get the solid marker instead (see the plinthFilledCylinder comment).
      // 2026-09-05: a shimmer wall counts as surface content. Its guide is a
      // dense sequin grid, and now that the plinth stands at the centre of the
      // group it lands ON that grid — a faint outline there is exactly the
      // "thin sliver in a busy panel" the filled marker exists for.
      const panelsCarrySurfaceContent = backdropItems.some(
        (it) => it?.text?.enabled || it?.graphic?.enabled || it?.type === "shimmer_wall",
      );
      // 2026-09-09: two or three plinths also get the SOLID marker. A row of
      // faint outlines, half-buried in the garland, came back as FOUR columns —
      // the model was re-inventing the row rather than copying it. Filled
      // markers get reproduced as objects; that is the whole reason
      // plinthFilledCylinder exists.
      // 2026-09-09: and whenever a marquee number is in the scene. Standing
      // next to a bold glyph, a faint outline cylinder was read as a SECOND
      // numeral — the render came back with two 1s, the same way the standee
      // placeholder did on 2026-09-08. A solid cylinder with an elliptical top
      // cannot be mistaken for a letterform.
      // 2026-09-10: and on a lone arch, always. Overlaying the guide on the
      // render showed the board coming back 19% shorter than the guide asks
      // while the plinth stayed near its guide size — so the 90cm plinth
      // covered 48% of the board's height instead of 41%, and the whole set
      // read as a squat board with an oversized plinth ("backdrop olcusu
      // tamamen bozulmus"). With the board now a solid region and the plinth
      // still a hairline, the model had one object to scale and one to guess
      // at. Both solid gives it the RATIO, which is the thing being got wrong.
      const loneArchPlinth = backdropItems.length === 1 && backdropItems[0]?.type === "arch";
      const loneBannerPlinth = backdropItems.length === 1 && backdropItems[0]?.type === "banner";
      const loneShimmerPlinth = backdropItems.length === 1 && backdropItems[0]?.type === "shimmer_wall";
      // Arch + Shimmer too: in front of the sequin wall the flat marker was
      // dropped from the render the same way (2026-10-21).
      const archShimmerPlinth = (backdropItems.length === 2 && backdropItems.some((it) => it?.type === "arch") && backdropItems.some((it) => it?.type === "shimmer_wall"))
        // the balloon ring as well: its plinth was dropped too (2026-10-21)
        || (backdropItems.length === 1 && backdropItems[0]?.type === "balloon_ring")
        || (backdropItems.length === 2 && backdropItems.some((it) => it?.type === "open_arch_frame"))
        // 2026-10-22: Double Arch — its plinth's top rendered as a tilted tray
        // ("plinth tepsisi bozuk, duz olsun karsidan bakinca").
        || (backdropItems.length === 2 && backdropItems.every((it) => it?.type === "arch"));
      plinthLayer.push(panelsCarrySurfaceContent || plinthCount > 1 || wantsNumberSlot || loneArchPlinth || loneBannerPlinth || archShimmerPlinth
        ? plinthFilledCylinder(plinthCx, plinthBottomY, p.heightPx, p.diameterPx, loneBannerPlinth || loneShimmerPlinth || archShimmerPlinth, loneBannerPlinth || loneShimmerPlinth || archShimmerPlinth)
        : plinthEdge(plinthCx, plinthBottomY, p.heightPx, p.diameterPx));
    }
  });

  // One px-per-cm for a Balloon Ring scene, shared by the hoop and the marquee
  // number so they stay in proportion to each other.
  //
  // 2026-09-05: the panel box alone is not enough. A 200cm metal frame with
  // balloons tied on top measures about 250cm finished, and at the panel's own
  // 4.35 px/cm that is 1084px on a 1024px canvas — drawn straight off both
  // edges. Clipped guide content is what produced stray balloons the last time
  // it happened, so the scene scale is capped to whatever makes the finished
  // hoop fit with a margin. 1.25 is the measured finished-over-frame ratio.
  const ringLayoutPanel = backdropItems[0]?.type === "balloon_ring" ? layout.panels[0] : null;
  const ringScenePxPerCm = ringLayoutPanel
    ? Math.min(
        (ringLayoutPanel.floorY - ringLayoutPanel.apexY)
          / Math.max(1, backdropItems[0]?.heightCm ?? 200),
        (Math.min(W, H) * 0.92)
          / Math.max(1, (backdropItems[0]?.widthCm ?? 200) * 1.25),
      )
    : null;

  // 2026-09-09: the gold hoop is drawn HERE, not inside the garland dispatch.
  // The dispatch is gated on balloonStyle !== "none", so a bare hoop with no
  // balloons produced an empty guide and the render invented a fully wrapped
  // balloon ring instead of the metal frame that was asked for.
  if (extras?.ringStyle === "half" || extras?.ringStyle === "none") {
    const hp = layout.panels[0];
    if (hp && (backdropItems[hp.idx]?.type ?? "") === "balloon_ring") {
      const pxc = ringScenePxPerCm ?? ((hp.floorY - hp.apexY) / Math.max(1, backdropItems[hp.idx]?.heightCm ?? 200));
      const hr  = ((backdropItems[hp.idx]?.widthCm ?? 200) / 2) * pxc;
      // The bare hoop is the only object in its scene, so it is drawn thicker —
      // a hairline circle on a white ground is the kind of faint marker this
      // pipeline drops.
      const hw  = Math.max(3, hr * (extras.ringStyle === "none" ? 0.045 : 0.028));
      content.push(
        `<circle cx="${hp.cx.toFixed(1)}" cy="${(hp.floorY - hr).toFixed(1)}" r="${hr.toFixed(1)}" ` +
        // 2026-10-21: white, as in the customer's newest ring reference.
        `fill="none" stroke="#F3F2EF" stroke-width="${hw.toFixed(1)}"/>`,
      );
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
          // The highlight used to be lightened 55% towards white and sat over
          // the inner 55% of every balloon at 90-95% opacity, so most of each
          // guide balloon was a washed-out near-white and the white page showed
          // through on top of that. The edit model copied exactly that: measured
          // 2026-09-04 on the customer palette, Arctic Blue #BAE6FD has a chroma
          // of 67 but the rendered garland averaged a chroma of 8 — grey, not
          // blue, which is what the customer was reporting. The sphere still
          // needs light falloff to avoid rendering as flat discs, so the
          // highlight is kept but pulled back, the true colour now covers more
          // of the balloon, and nothing is translucent.
          chromeHexSet.has(hex.toLowerCase())
            // A mirror ball, not a matte sphere: a small blown highlight, a
            // dark reflected band through the middle and a bright rim where
            // the room wraps around the edge. That high-contrast signature is
            // what reads as chrome, and it is what the render copies.
            ? `<radialGradient id="${id}" cx="34%" cy="26%" r="82%">` +
                `<stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>` +
                `<stop offset="12%" stop-color="${shade(hex, 1.45)}" stop-opacity="1"/>` +
                `<stop offset="34%" stop-color="${hex}" stop-opacity="1"/>` +
                `<stop offset="62%" stop-color="${shade(hex, 0.42)}" stop-opacity="1"/>` +
                `<stop offset="84%" stop-color="${shade(hex, 1.12)}" stop-opacity="1"/>` +
                `<stop offset="100%" stop-color="${shade(hex, 0.55)}" stop-opacity="1"/>` +
              `</radialGradient>`
            : (() => {
                const deep = deepenForGuide(hex);
                return `<radialGradient id="${id}" cx="35%" cy="30%" r="72%">` +
                  `<stop offset="0%" stop-color="${shade(deep, 1.28)}" stop-opacity="1"/>` +
                  `<stop offset="42%" stop-color="${deep}" stop-opacity="1"/>` +
                  `<stop offset="100%" stop-color="${shade(deep, 0.78)}" stop-opacity="1"/>` +
                `</radialGradient>`;
              })(),
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

    // ── Reference replays ─────────────────────────────────────────────────
    // 2026-10-21: "setuplari bunlarin aynisi olcak sekilde yapar misin?
    // balonlarin lokasyonlari renkleri snowflakeler ayni olsun." One photo per
    // setup, each transcribed into a table: every balloon's centre and radius
    // read off a grid laid over the photo, in the photo's own pixels, plus the
    // white snowflake ornaments tucked into the garland. Slots are the colour
    // in the photo — W white, B pastel blue, L lavender, S chrome silver,
    // C clear bubble — and F a snowflake. The tables are mapped onto OUR
    // boards by the boards' own edges, so the board sizes stay ours ("size
    // lari degistirme"); only where the balloons sit comes from the photo.
    type RefSlot = "W" | "B" | "L" | "S" | "C" | "F";
    type RefItem = [number, number, number, RefSlot];
    const clearHexSet = new Set((extras?.clearColors ?? []).map((h) => String(h).toLowerCase()));
    const refRoles = (() => {
      const uniq: number[] = [];
      colors.forEach((c, i) => {
        if (!uniq.some((j) => colors[j].toLowerCase() === c.toLowerCase())) uniq.push(i);
      });
      const rgbOf = (hex: string) => {
        const h = hex.replace(/^#/, "");
        return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) || 0);
      };
      const hueOf = (hex: string): number => {
        const [r, g, b] = rgbOf(hex).map((v) => v / 255);
        const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
        if (d < 1e-6) return -1;
        let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
        return h;
      };
      const isWhite = (hex: string) => rgbOf(hex).every((v) => v >= 235);
      const chrome = uniq.find((i) => chromeHexSet.has(colors[i].toLowerCase()));
      const clear  = uniq.find((i) => clearHexSet.has(colors[i].toLowerCase()));
      const white  = uniq.find((i) => i !== chrome && i !== clear && isWhite(colors[i]));
      // Every other near-white is left out of the pool as well: an unflagged
      // clear (#F0F4F8) was handed out to the photo's blue and lilac balloons
      // as grey-white, and the render turned them all clear (2026-10-22).
      const rest   = uniq.filter((i) => i !== chrome && i !== clear && i !== white && !isWhite(colors[i]));
      const blue   = rest.find((i) => { const h = hueOf(colors[i]); return h >= 170 && h < 238; });
      const lav    = rest.find((i) => { const h = hueOf(colors[i]); return i !== blue && h >= 238 && h < 320; });
      const others = rest.filter((i) => i !== blue && i !== lav);
      const fallback = uniq.length > 0 ? uniq : [0];
      return { chrome, clear, white, blue, lav, others, rest: rest.length > 0 ? rest : fallback };
    })();
    // Colour for a photo slot. Chrome, white and clear go to the customer's
    // chrome, white and clear when they picked them; the photo's blue and
    // lavender go to their blue and lavender, sharing out any other colours
    // they picked, and simply share the palette when it has neither.
    const refSlotCount: Record<string, number> = {};
    const refColorFor = (slot: RefSlot): number => {
      const k = (refSlotCount[slot] = (refSlotCount[slot] ?? 0) + 1) - 1;
      const { chrome, clear, white, blue, lav, others, rest } = refRoles;
      if (slot === "S" && chrome !== undefined) return chrome;
      if (slot === "W" && white !== undefined) return white;
      if (slot === "C" && clear !== undefined) return clear;
      if (slot === "C" && white !== undefined) return white;
      const own = slot === "B" ? blue : slot === "L" ? lav : undefined;
      if (own !== undefined) return others.length > 0 && k % 3 === 2 ? others[Math.floor(k / 3) % others.length] : own;
      return rest[(2 * k + (slot === "L" ? 1 : 0)) % rest.length];
    };
    // A clear bubble balloon: the wall shows through it, with a bright rim
    // and a window highlight. Drawn as a tinted disc it rendered as a white
    // balloon.
    const clearBalloonSvg = (x: number, y: number, r: number): string => {
      const sw = Math.max(1.2, r * 0.035).toFixed(1);
      const rot = `rotate(-38 ${(x - r * 0.40).toFixed(1)} ${(y - r * 0.42).toFixed(1)})`;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="rgba(226,233,239,0.30)" stroke="#8A96A2" stroke-width="${sw}" stroke-opacity="0.9"/>` +
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.90).toFixed(1)}" fill="none" stroke="#FFFFFF" stroke-width="${(r * 0.05).toFixed(1)}" stroke-opacity="0.55"/>` +
        `<ellipse cx="${(x - r * 0.40).toFixed(1)}" cy="${(y - r * 0.42).toFixed(1)}" rx="${(r * 0.24).toFixed(1)}" ry="${(r * 0.11).toFixed(1)}" transform="${rot}" fill="#FFFFFF" fill-opacity="0.92"/>` +
        `<ellipse cx="${(x + r * 0.42).toFixed(1)}" cy="${(y + r * 0.44).toFixed(1)}" rx="${(r * 0.14).toFixed(1)}" ry="${(r * 0.06).toFixed(1)}" transform="rotate(-38 ${(x + r * 0.42).toFixed(1)} ${(y + r * 0.44).toFixed(1)})" fill="#FFFFFF" fill-opacity="0.6"/>`;
    };
    // A white glitter-foam snowflake ornament, six feathered arms. Outlined
    // in grey first so a white flake still reads against white balloons.
    const snowflakeSvg = (x: number, y: number, R: number, rotDeg: number): string => {
      const segs: string[] = [];
      const P = (px: number, py: number) => `${px.toFixed(1)},${py.toFixed(1)}`;
      for (let k = 0; k < 6; k++) {
        const a = ((rotDeg + k * 60) * Math.PI) / 180;
        segs.push(`M${P(x, y)}L${P(x + R * Math.cos(a), y + R * Math.sin(a))}`);
        for (const [d, len] of [[0.36, 0.30], [0.60, 0.25], [0.82, 0.15]] as const) {
          const bx = x + R * d * Math.cos(a), by = y + R * d * Math.sin(a);
          for (const s of [-1, 1]) {
            const b = a + s * (50 * Math.PI) / 180;
            segs.push(`M${P(bx, by)}L${P(bx + R * len * Math.cos(b), by + R * len * Math.sin(b))}`);
          }
        }
      }
      const d = segs.join("");
      const w = Math.max(1.6, R * 0.10);
      return `<path d="${d}" fill="none" stroke="#7D8A97" stroke-width="${(w + 2.6).toFixed(1)}" stroke-linecap="round" stroke-opacity="0.85"/>` +
        `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>` +
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(R * 0.14).toFixed(1)}" fill="#FFFFFF" stroke="#7D8A97" stroke-width="1.2"/>`;
    };
    // x mapping through anchor pairs [photo x, our x], linear between them and
    // at `sOut` beyond the outermost two.
    const refPieceX = (anchors: [number, number][], sOut: number) => (rx: number): number => {
      const a = [...anchors].sort((p, q) => p[0] - q[0]);
      if (rx <= a[0][0]) return a[0][1] + (rx - a[0][0]) * sOut;
      const last = a[a.length - 1];
      if (rx >= last[0]) return last[1] + (rx - last[0]) * sOut;
      for (let i = 0; i < a.length - 1; i++) {
        if (rx <= a[i + 1][0]) {
          const t = (rx - a[i][0]) / (a[i + 1][0] - a[i][0]);
          return a[i][1] + t * (a[i + 1][1] - a[i][1]);
        }
      }
      return last[1];
    };
    type RefPlaced = { x: number; y: number; r: number; slot: RefSlot; ci: number };
    // Map a table onto the guide and draw it. Bigger balloons go down first so
    // the small ones read as tucked into them; snowflakes go on top. Colours
    // are assigned in the table's own order so the photo's colour runs stay
    // where they are.
    const drawRefTable = (
      table: RefItem[],
      mapX: (rx: number) => number,
      mapY: (ry: number) => number,
      s: number,
      opts: {
        fill?: number;
        maxBottom?: number;
        keepClear?: { l: number; r: number; top: number }[];
        keep?: (b: RefPlaced) => boolean;
        /** Filler size as a fraction of the height scale; 0 turns fillers off. */
        filler?: number;
      } = {},
    ): RefPlaced[] => {
      const fill = opts.fill ?? 1.08;
      const vl = -marginX / SCALE + (W * 0.012) / SCALE;
      const vr = (W - marginX) / SCALE - (W * 0.012) / SCALE;
      const out: RefPlaced[] = [];
      for (const [x, y, r, slot] of table) {
        const br = r * s * (slot === "F" ? 1 : fill);
        let bx = mapX(x), by = mapY(y);
        if (slot !== "F" && opts.maxBottom !== undefined && by + br > opts.maxBottom) by = opts.maxBottom - br;
        // Stay on the canvas.
        if (bx - br * 0.6 < vl) bx = vl + br * 0.6;
        if (bx + br * 0.6 > vr) bx = vr - br * 0.6;
        // Slide anything that would sit across a kept-clear box (the plinth's
        // face) sideways, away from its middle, just far enough.
        for (const kc of opts.keepClear ?? []) {
          if (by + br * 0.3 < kc.top) continue;
          const mid = (kc.l + kc.r) / 2;
          if (bx < mid && bx + br > kc.l) bx = kc.l - br;
          else if (bx >= mid && bx - br < kc.r) bx = kc.r + br;
        }
        out.push({ x: bx, y: by, r: br, slot, ci: slot === "F" ? -1 : refColorFor(slot) });
      }
      const kept = opts.keep ? out.filter(opts.keep) : out;
      // Fillers. Read off a photo, only the balloons whose outline shows can
      // be transcribed; the photo's garland is solid because a layer of small
      // balloons further back fills every gap between those. Drawn without
      // them the replay came back as the photo's balloons with daylight
      // between them. So any gap that sits BETWEEN transcribed balloons —
      // close to at least two of them — gets a small one, behind the rest.
      const fillers: RefPlaced[] = [];
      const fr = (opts.filler ?? 13) * s;
      const body = kept.filter((b) => b.slot !== "F");
      if (fr > 0 && body.length > 3) {
        const minX = Math.min(...body.map((b) => b.x - b.r)), maxX = Math.max(...body.map((b) => b.x + b.r));
        const minY = Math.min(...body.map((b) => b.y - b.r)), maxY = Math.max(...body.map((b) => b.y + b.r));
        // Mostly the pastels: with a quarter of them chrome the render read the
        // garland as mostly silver and turned big whites chrome to match.
        const fillSlots: RefSlot[] = ["B", "W", "L", "B", "S", "L", "W", "B", "L", "W"];
        let fk = 0;
        const step = fr * 1.1;
        for (let gy = minY; gy <= maxY; gy += step) {
          for (let gx = minX + ((Math.round((gy - minY) / step) % 2) * step) / 2; gx <= maxX; gx += step) {
            // Near counts transcribed balloons only — counting fillers too let
            // them chain outward and fill the garland's whole bounding box.
            let near = 0, inside = false;
            for (const b of body) {
              const e = Math.hypot(gx - b.x, gy - b.y) - b.r;
              if (e < -fr * 0.15) { inside = true; break; }
              if (e < fr * 0.9) near++;
            }
            if (!inside) {
              for (const b of fillers) {
                if (Math.hypot(gx - b.x, gy - b.y) < b.r + fr * 0.85) { inside = true; break; }
              }
            }
            if (inside || near < 2) continue;
            if (opts.maxBottom !== undefined && gy + fr > opts.maxBottom) continue;
            if ((opts.keepClear ?? []).some((kc) => gy + fr * 0.3 >= kc.top && gx + fr > kc.l && gx - fr < kc.r)) continue;
            const slot = fillSlots[fk++ % fillSlots.length];
            fillers.push({ x: gx, y: gy, r: fr, slot, ci: refColorFor(slot) });
          }
        }
      }
      for (const b of fillers) {
        content.push(`<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r.toFixed(1)}" ${balloonAttrs(b.ci)}/>`);
      }
      const balloons = kept.filter((b) => b.slot !== "F").sort((a, b) => b.r - a.r);
      for (const b of balloons) {
        const hex = (colors[b.ci % Math.max(1, colors.length)] ?? "").toLowerCase();
        content.push(hasSelectedColors && clearHexSet.has(hex)
          ? clearBalloonSvg(b.x, b.y, b.r)
          : `<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r.toFixed(1)}" ${balloonAttrs(b.ci)}/>`);
      }
      if (extras?.snowflakes) {
        kept.filter((b) => b.slot === "F").forEach((b, i) => {
          content.push(snowflakeSvg(b.x, b.y, b.r, 8 + ((i * 23) % 30)));
        });
      }
      return kept;
    };
    // The plinth's face, kept clear of balloons.
    const plinthKeepClear = (): { l: number; r: number; top: number }[] =>
      plinthDrawnLeftPx !== null && plinthDrawnRightPx !== null && plinthDrawnTopPx !== null
        ? [{ l: (plinthDrawnLeftPx as number) - W * 0.006, r: (plinthDrawnRightPx as number) + W * 0.006, top: plinthDrawnTopPx as number }]
        : [];

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
        // Round panel: a customer photo, TRANSCRIBED. (2026-10-21: the table
        // further down is now their lavender reference; the history of the
        // method follows.)
        //
        // 2026-10-20: "make the balloon amount and balloon locations exactly
        // like the blue balloon reference". The procedural horseshoe (about
        // 236 balloons walked evenly round the rim) could be tuned towards
        // that photo but never become it: the photo is not a ring at all. It
        // is about 90 balloons in two masses — a heavy one that starts as a
        // crown just left of 12 o'clock, runs down the whole left side and
        // spills well out past the rim onto the floor, and a separate cluster
        // that starts just below 3 o'clock and comes down to the floor on the
        // right. The top right quarter of the disc and the floor between the
        // two masses are left bare.
        //
        // So the table below IS the photo: every balloon's centre and radius
        // read off a grid laid over it, in the photo's own pixels. The disc
        // there is centred at (520, 584) with a radius of 280, and everything
        // is scaled from that onto our disc. The slot letter is the balloon's
        // colour in the photo — B chrome blue, P pastel blue, S chrome silver,
        // W white — mapped onto the customer's palette below, so the photo's
        // colour distribution carries across without its colours. The clear
        // bubble balloons on poles in the photo are separate props and are
        // not part of the garland.
        const rPanel   = layout.panels[0];
        const circR    = rPanel.pw / 2;
        const circleCx = rPanel.cx;
        // Anchor to floor so circle bottom == floorY (no floating gap → no invented base)
        const circleCy = rPanel.floorY - circR;

        // 2026-10-21: the table is now the customer's lavender and blue round
        // (see "Reference replays" above), replacing the blue installation.
        // In that photo the disc is centred at (545, 670) with a radius of
        // 425 and stands on the floor at 1095: a long garland from the crown
        // down the whole left side and out onto the floor, a short cluster on
        // the lower right, snowflakes along both and inside the clear bubbles.
        const REF_CX = 545, REF_CY = 670, REF_R = 425;
        const ROUND_REF: RefItem[] = [
          // crown, from 1 o'clock back over the top to 10 o'clock
          [576, 195, 77, "L"], [549, 326, 42, "L"], [599, 303, 27, "W"], [649, 265, 38, "S"],
          [661, 326, 27, "S"], [672, 203, 35, "W"], [742, 257, 58, "C"], [453, 205, 52, "B"],
          [512, 220, 30, "S"], [435, 257, 14, "S"], [556, 262, 30, "W"], [475, 276, 50, "B"],
          [469, 361, 50, "B"], [408, 415, 31, "W"], [319, 280, 96, "W"], [204, 392, 65, "C"],
          [338, 353, 38, "L"], [292, 395, 17, "W"],
          [734, 268, 35, "F"], [419, 315, 50, "F"], [208, 395, 42, "F"],
          // down the left side
          [135, 472, 31, "L"], [188, 468, 25, "S"], [231, 465, 17, "W"], [312, 457, 58, "S"],
          [246, 530, 46, "W"], [296, 557, 27, "B"], [362, 518, 17, "B"], [346, 472, 15, "L"],
          [ 95, 585, 70, "S"], [150, 530, 19, "W"], [208, 658, 23, "W"], [246, 705, 38, "B"],
          [173, 705, 31, "W"], [112, 685, 31, "B"], [323, 712, 62, "C"], [ 92, 774, 65, "B"],
          [227, 770, 31, "S"], [188, 816, 19, "W"], [312, 843, 73, "L"], [ 46, 925, 58, "W"],
          [285, 958, 38, "B"], [419, 939, 54, "S"], [254, 916, 19, "B"],
          [254, 612, 48, "F"], [315, 720, 30, "F"], [177, 878, 50, "F"],
          // the foot, out on the floor
          [162,1031,104, "W"], [ 46,1065, 58, "L"], [338,1058, 73, "C"], [450,1081, 50, "W"],
          [250,1112, 29, "W"], [288,1081, 27, "L"], [485,1038, 15, "B"],
          [338,1046, 42, "F"],
          // the cluster on the lower right
          [1015, 701, 29, "S"], [1011, 758, 36, "W"], [ 951, 794, 46, "B"], [1044, 840, 50, "C"],
          [ 919, 879, 50, "L"], [1047, 926, 32, "W"], [ 869, 951, 29, "S"], [ 933, 954, 25, "W"],
          [ 811, 979, 39, "B"], [1076, 976, 25, "L"], [ 911, 994, 21, "W"], [ 858,1033, 46, "W"],
          [ 997,1040, 86, "B"], [ 783,1069, 39, "S"], [ 736,1051, 32, "W"], [ 883,1097, 36, "L"],
          [1033, 854, 32, "F"], [ 990, 919, 43, "F"],
        ];

        // ---- photo coordinates -> our disc --------------------------------
        // The whole scene is drawn at SCALE inside a margin, so the visible
        // canvas in these coordinates runs from -marginX/SCALE to
        // (W - marginX)/SCALE, not 0 to W. Whatever spills past the rim is
        // drawn in, by the least amount that keeps every balloon on it.
        const visLeft  = -marginX / SCALE;
        const visRight = (W - marginX) / SCALE;
        const limitU = (Math.min(circleCx - visLeft, visRight - circleCx) - (W * 0.015) / SCALE) / circR;
        let squeeze = 1;
        for (const [x, , r, slot] of ROUND_REF) {
          if (slot === "F") continue;
          const u = Math.abs(x - REF_CX) / REF_R, rr = r / REF_R;
          if (u > 1 && u + rr > limitU) squeeze = Math.min(squeeze, Math.max(0, (limitU - rr - 1) / (u - 1)));
        }
        const maxBottomV = 1 + (plinthForwardPx / circR) + 0.03;
        const roundPre: RefItem[] = ROUND_REF.map(([x, y, r, slot]) => {
          let u = (x - REF_CX) / REF_R;
          if (Math.abs(u) > 1) u = Math.sign(u) * (1 + (Math.abs(u) - 1) * squeeze);
          return [circleCx + u * circR, circleCy + ((y - REF_CY) / REF_R) * circR, r, slot];
        });
        // A marquee number stands in front of the lower right. Drawn over the
        // balloons there it was dropped from the render — a white digit on a
        // heap of white and pastel circles reads as more balloons — so the
        // balloons it would hide are left out.
        const nr = loneRoundNumberRect;
        drawRefTable(roundPre, (x) => x, (y) => y, circR / REF_R, {
          maxBottom: circleCy + maxBottomV * circR,
          keepClear: plinthKeepClear(),
          keep: (b) => {
            if (!nr) return true;
            if (b.slot === "F") return !(b.x > nr.x && b.x < nr.x + nr.w && b.y > nr.top);
            return !(b.x > nr.x + nr.w * 0.08 && b.x < nr.x + nr.w * 0.92 && b.y > nr.top + (nr.baseY - nr.top) * 0.05);
          },
        });
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
        // Banner frame garland — for the square 2x2m board.
        //
        // 2026-09-05. The banner first borrowed the arch garland, and the guide
        // showed why that cannot work: the arch crown walks an arc of radius
        // pw/2 centred at the arch spring line, which on a square board runs
        // from the mid-right edge up to the top corner and NEVER crosses the
        // top. The banner came back with two thin side columns, no top band and
        // a single balloon on the floor. An arch garland follows a curved top;
        // a square has corners.
        //
        // This walks the board OUTLINE instead — up the left side, across the
        // top, down the right side — dropping heavily overlapping balloons of
        // varied size along it, two deep, with a mound at each bottom corner.
        // The band straddles the edge and leans outward so it frames the board
        // without covering the artwork (customer: "banneri cok kapatmasin").
        const drawBannerFrameGarland = (
          p: typeof layout.panels[0],
          side: number,
          seed: number,
        ): number => {
          const left = p.cx - side / 2;
          const right = p.cx + side / 2;
          const top = p.floorY - side;
          let n = 0;
          const placed: { x: number; y: number; r: number }[] = [];

          let st = (seed + 1) * 9973;
          const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };

          const rXL = Math.max(28, Math.min(66, side * 0.092));
          const rL  = Math.max(20, Math.min(52, side * 0.075));
          const rM  = Math.max(14, Math.min(36, side * 0.052));
          const rS  = Math.max(10, Math.min(24, side * 0.034));

          const areaByColor = new Array(Math.max(1, colors.length)).fill(0) as number[];
          const lastUsedAt  = new Array(Math.max(1, colors.length)).fill(-1) as number[];
          const leastUsedColor = (): number => {
            let best = 0;
            for (let i = 1; i < areaByColor.length; i++) {
              const d = areaByColor[i] - areaByColor[best];
              if (d < -1e-6) best = i;
              else if (Math.abs(d) <= 1e-6 && lastUsedAt[i] < lastUsedAt[best]) best = i;
            }
            return best;
          };
          const put = (bx: number, by: number, br: number) => {
            for (const q of placed) {
              const d = Math.hypot(bx - q.x, by - q.y);
              if ((br + q.r - d) / (2 * Math.min(br, q.r)) > 0.88) return;
            }
            placed.push({ x: bx, y: by, r: br });
            const ci = leastUsedColor();
            areaByColor[ci] += Math.PI * br * br;
            lastUsedAt[ci] = n;
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" ${balloonAttrs(ci)}/>`);
            n++;
          };
          const pickR = (): number => {
            const roll = rnd();
            if (roll < 0.20) return rXL;
            if (roll < 0.52) return rL;
            if (roll < 0.80) return rM;
            return rS;
          };

          // Walk the outline. `outward` is the unit normal pointing away from
          // the board, so the band can be biased off the artwork.
          // How full the band is at a given height. 1 at the floor, falling as it
          // rises: real garlands pool at the base and thin out toward the top,
          // and a band of constant thickness is what made this read as a rope
          // ("ip gibi duruyor"). Drives radius, depth AND spacing together —
          // varying only one of them still looks mechanical.
          const fullness = (y: number): number => {
            const u = Math.max(0, Math.min(1, (p.floorY - y) / side));
            return 1 - 0.30 * u;
          };

          const walk = (
            fromX: number, fromY: number, toX: number, toY: number,
            outX: number, outY: number,
          ) => {
            const len = Math.hypot(toX - fromX, toY - fromY);
            const ux = (toX - fromX) / len, uy = (toY - fromY) / len;
            let t = 0;
            let guard = 0;
            while (t < len && guard++ < 160) {
              const y0 = fromY + uy * t;
              const f = fullness(y0);
              const r = pickR() * f;
              // The band straddles the board edge — mostly outboard, but
              // overlapping onto the face, the way the arch garland does. It used
              // to be r * (0.45..1.0), always OUTWARD, so no balloon touched the
              // board and the render came back as a free-standing arch.
              const off = r * (rnd() * 1.15 - 0.45);
              put(fromX + ux * t + outX * off, y0 + outY * off, r);
              // Second lane, just outboard.
              const r2 = pickR() * 0.9 * f;
              put(
                fromX + ux * (t + r * 0.45) + outX * r2 * (0.35 + rnd() * 0.45),
                fromY + uy * (t + r * 0.45) + outY * r2 * (0.35 + rnd() * 0.45),
                r2,
              );
              // Third lane sits on the board face. Near the floor it is always
              // there; near the top it mostly is not, which is the taper.
              if (rnd() < 0.45 + 0.55 * f) {
                const r3 = pickR() * 0.7 * f;
                put(
                  fromX + ux * (t + r * 0.8) - outX * r3 * (0.35 + rnd() * 0.35),
                  fromY + uy * (t + r * 0.8) - outY * r3 * (0.35 + rnd() * 0.35),
                  r3,
                );
              }
              // A fourth, occasional balloon breaks the even edge that reads as a
              // rope. Low down only.
              if (rnd() < 0.45 * f * f) {
                const r4 = pickR() * 0.8 * f;
                put(
                  fromX + ux * (t + r * 1.1) + outX * r4 * (1.0 + rnd() * 0.5),
                  fromY + uy * (t + r * 1.1) + outY * r4 * (1.0 + rnd() * 0.5),
                  r4,
                );
              }
              t += r * (0.40 + rnd() * 0.25);
            }
          };

          // Floor mound at a bottom corner — where a real garland pools.
          const mound = (mx: number, dir: number) => {
            // 2026-09-05: enlarged. The customer wants the garland fullest where
            // it meets the floor ("yere degen yerler daha dolu"), and nine
            // balloons in three rows was a neat little heap rather than a pile.
            const table: [number, number, number][] = [
              [0, 0.50, 1.00], [0.80, 0.40, 0.86], [-0.62, 0.38, 0.78],
              [1.50, 0.45, 0.62], [-1.20, 0.44, 0.56],
              [0.35, 1.15, 0.78], [-0.35, 1.05, 0.68], [1.25, 0.95, 0.60],
              [-1.05, 1.20, 0.48], [1.85, 1.05, 0.42],
              [0.10, 1.85, 0.62], [0.95, 1.75, 0.52], [-0.72, 1.60, 0.50],
              [1.60, 1.80, 0.38], [-1.30, 1.90, 0.34],
              [0.45, 2.55, 0.44], [-0.40, 2.45, 0.40], [1.20, 2.40, 0.34],
            ];
            for (const [ox, up, sc] of table) {
              const r = rXL * sc;
              put(
                mx + dir * (ox * rXL * 0.62 - rXL * 0.30) + (rnd() * 2 - 1) * rM * 0.35,
                p.floorY - up * rXL * 0.62 + (rnd() * 2 - 1) * rM * 0.25,
                r,
              );
            }
          };

          mound(left, -1);
          mound(right, 1);
          walk(left,  p.floorY - rXL * 0.6, left,  top,  -1, 0);
          walk(left,  top, right, top, 0, -1);
          walk(right, top, right, p.floorY - rXL * 0.6, 1, 0);
          return n;
        };

        const drawThickOrganicMainGarland = (
          p: typeof layout.panels[0], side: "left" | "right", colorOffset: number,
          tight = false,
          // Single Arch passes this. It cannot be inferred from `tight`, which
          // Single Arch also sets — that flag selects the fuller, bottom-heavy
          // mass and both layouts want it. This one is specifically about how
          // closely balloons may be packed.
          looseSpacing = false,
          // 2026-09-08: Double Arch turns this OFF. The three 36" anchors below
          // came out of 2026-07-20 feedback that the garland had no mass low
          // down, but on Double Arch they read as one enormous ball parked at
          // the foot of each leg — the customer crossed both of them out and
          // asked for the same volume built from 12" and 5" balloons instead.
          // Single Arch keeps them; its look was approved with them in.
          giantAnchors = true,
          // 2026-09-09: Single Arch composition, from the customer's Elsa
          // reference. The crown normally stops on the shoulder, well short of
          // the apex, so the top of the board is bare and the garland reads as a
          // side trim. With this on it starts PAST the apex (upper middle) and
          // thickens toward the top outer corner before handing over to the
          // vertical climb: top cluster -> heavy top corner -> right cascade.
          crownOverTop = false,
        ): { count: number; minR: number; maxR: number; lanes: number } => {
          const dir       = side === "left" ? -1 : 1;
          const panelEdge = p.cx + dir * (p.pw / 2);
          const Hp        = p.floorY - p.apexY;
          let n = 0;
          let minR = Infinity, maxR = 0;
          // Placed balloons, kept so new ones can be checked against them.
          const placed: { x: number; y: number; r: number }[] = [];
          // How deeply a balloon may sit inside its neighbour, as a fraction of
          // the smaller one's diameter. Measured on the single-arch guide
          // before this existed: 99% of balloons were overlapped by more than
          // 55%, which is why the render came back as fused blobs rather than
          // balloons ("some of them look very fat and cramped"). Real garland
          // balloons touch and nest a little; they do not swallow each other.
          // Double Arch is left alone at its previous behaviour, which the
          // customer approved, by allowing it a much deeper limit.
          // crownOverTop packs tighter than plain looseSpacing: the reference
          // band is continuous, with balloons touching, not a spaced-out string.
          // 2026-09-10: raised to 0.86 for the lone arch. The pink reference
          // the customer set as the target is a CONTINUOUS mass with balloons
          // pressed into each other, no wall showing through the band; at 0.74
          // the render still had gaps between the spheres. Not as deep as
          // Double Arch's 0.95 (which fuses them), but enough to read as full.
          const maxNestFrac = crownOverTop ? 0.86 : looseSpacing ? 0.55 : 0.95;
          // Colour is chosen by which one currently covers the least AREA, not
          // by a running counter. Balloon sizes vary a lot here — a palette can
          // come out even by count and still look dominated by one colour if it
          // happens to land on the giants — and area is what the eye reads.
          const areaByColor = new Array(Math.max(1, colors.length)).fill(0) as number[];
          // Ties rotate rather than always falling to the first colour, which
          // otherwise takes every balloon placed before any area accumulates.
          const lastUsedAt = new Array(Math.max(1, colors.length)).fill(-1) as number[];
          const leastUsedColor = (): number => {
            let best = 0;
            for (let i = 1; i < areaByColor.length; i++) {
              const d = areaByColor[i] - areaByColor[best];
              if (d < -1e-6) best = i;
              else if (Math.abs(d) <= 1e-6 && lastUsedAt[i] < lastUsedAt[best]) best = i;
            }
            return best;
          };
          const put = (bx: number, by: number, br: number) => {
            for (const q of placed) {
              const d  = Math.hypot(bx - q.x, by - q.y);
              const ov = (br + q.r - d) / (2 * Math.min(br, q.r));
              if (ov > maxNestFrac) return;   // too deeply buried — skip it
            }
            placed.push({ x: bx, y: by, r: br });
            const ci = leastUsedColor();
            areaByColor[ci] += Math.PI * br * br;
            lastUsedAt[ci] = n;
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" ${balloonAttrs(ci)}/>`);
            n++;
            if (br < minR) minR = br;
            if (br > maxR) maxR = br;
          };

          // Seeded per garland (via colorOffset, which differs left vs right)
          // so placement is organic but a given setup always renders the same
          // guide — the render cache and the fixed seed both depend on that.
          let prngState = (colorOffset + 1) * 9973;
          const rnd = () => {
            prngState = (prngState * 1664525 + 1013904223) >>> 0;
            return prngState / 4294967296;
          };
          const baseRnd = rnd;

          // Radius scale relative to panel width — large/medium/small anchors.
          // These caps are what actually set Single Arch's balloon size; with
          // the guide canvas now matching the rendered size, a Double Arch
          // panel is wide enough to reach them too, so both layouts draw the
          // same balloons with no special-casing.
          // 2026-09-09 (second pass): the first attempt at "bigger balloons"
          // for the lone arch was wrong by a factor of two, and rendering the
          // guide to PNG showed it plainly — these constants are RADII, so
          // p.pw * 0.23 draws a balloon 46% of the board's width. On a 100cm
          // board that is a 46cm (18") balloon in the L slot and a 60cm (24")
          // one in the XL slot, which is why the render came back as a column
          // of beach balls and did not resemble the customer reference at all.
          // The reference garland is 5"/10"/12" latex with the odd 18" anchor,
          // so the lone-arch radii are derived from real balloon diameters
          // against the panel width: r = (inches * 2.54 / widthCm) / 2.
          // Other layouts keep the values they were approved with.
          // 2026-10-15: on the shared standard now (see balloonRadiiPx). The
          // old fractions-of-pw gave each layout a different physical balloon;
          // on a Double Arch panel the S slot was a 7.6in balloon, which is
          // not a filler at all.
          const famP   = balloonRadiiPx(p.widthCm, p.pw);
          const rLarge = famP.L;
          const rMed   = famP.M;
          const rSmall = famP.S;
          // 36-inch statement anchor (tight/double-arch only): a real 36"
          // balloon is ~3x a 12" one. The guide must SHOW that scale — with
          // only L/M/S circles the model rendered a uniform mid-size garland
          // (2026-07-20 product feedback: balloons too small, not enough mass
          // low down; sizes must read as 36" / 12" / 5").
          // The statement anchor. At p.pw * 0.28 this was a 26in balloon on a
          // 120cm panel — the beach-ball scale the customer rejected on
          // 2026-09-09. It is a 40cm (16in) statement balloon now, the size
          // measured on their reference.
          const rXL     = famP.X;

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
          // crownOverTop keeps the band right on the panel edge so it hugs the
          // board; the wider inboard bias in bandO then lays most of the mass
          // over the board face rather than out in the room.
          const edgeX = panelEdge - dir * rLarge * (crownOverTop ? 0.55 : 0.9);

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
          // crownOverTop keeps L and M close together so the ribbon reads even,
          // and lifts S off the floor of the range so the fillers are real
          // balloons rather than dots.
          // The lone arch now uses the real four-size mix (18/12/10/5) rather
          // than four shades of "large", so the band reads as a decorator
          // garland with genuine 5-inch fillers tucked between the 12s.
          const sizeR = crownOverTop
            ? { X: rXL, L: rLarge, M: rMed, S: rSmall }
            : { X: rXL, L: rLarge, M: rMed, S: tight ? rMed * 0.86 : rSmall };
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
          if (tight && giantAnchors) {
            // Three 36" giant statement anchors seated IN the floor mound —
            // the biggest objects in the garland, unmistakably larger than
            // everything else, exactly where a decorator parks them.
            put(edgeX + dir * 16,  p.floorY - rXL * 0.72, rXL);
            put(edgeX + dir * -24, p.floorY - rXL * 0.60, rXL * 0.88);
            put(edgeX + dir * 54,  p.floorY - rXL * 0.55, rXL * 0.78);
          } else if (tight) {
            // Same mass, no single giant: three large anchors instead of three
            // 36" ones, then a scatter of 12" and 5" balloons through the mound
            // so the volume is built out of many balloons rather than one.
            put(edgeX + dir * 16,  p.floorY - rLarge * 0.95, rLarge * 1.05);
            put(edgeX + dir * -24, p.floorY - rLarge * 0.80, rLarge * 0.92);
            put(edgeX + dir * 54,  p.floorY - rLarge * 0.72, rLarge * 0.85);
            // The 12"/5" scatter that replaces the giant is placed at the END of
            // this function, not here: run before the climb it consumed the
            // space the climb needed and the overlap check then rejected most
            // of it, leaving the garland in disconnected clumps.
          }
          // Jittered off the fixed table so the mound is a pile rather than a
          // repeatable arrangement, and every fourth balloon is bumped up a
          // size — a real floor cluster is where the biggest balloons land.
          for (const [ox, up, sz] of BASE) {
            const jx = (baseRnd() * 2 - 1) * rMed * 0.45;
            const jy = (baseRnd() * 2 - 1) * rMed * 0.35;
            const bumped = baseRnd() < 0.25 ? "L" : sz;
            put(
              edgeX + dir * (ox * (tight ? 1.15 : 1)) + jx,
              p.floorY - up * upScale + jy,
              sizeR[bumped] * baseScale,
            );
          }

          // 2) Side climb.
          //
          // 2026-09-03 rewrite. The old climb placed a fixed 30 balloons at a
          // fixed vertical pitch, cycling 4 lane offsets and a 4-entry size
          // pattern with a +/-3px wobble. Three things followed from that, and
          // together they are why the render never looked like a real garland
          // however the sizes were tuned (customer: "the shape and size the
          // balloons should be isn't organic"):
          //   - the pitch was unrelated to balloon size, so neighbours sat ~14px
          //     apart while being ~100px across, i.e. ~87% overlapped, fusing
          //     into one scalloped mass rather than reading as balloons;
          //   - cycling the lanes put every 4th balloon at the same offset,
          //     drawing visible columns;
          //   - cycling the sizes made the pattern repeat on the same period.
          // The result is a woven, mechanical lattice — which is exactly what
          // the renders came back as.
          //
          // Now it walks up the spine instead: each step advances by a fraction
          // of the balloon just placed, so spacing tracks size and neighbours
          // touch and nest instead of stacking; the perpendicular offset and
          // the size are both drawn from a seeded PRNG, so nothing repeats on a
          // period. Weights approximate a real decorator's mix — mostly 12in
          // with several 36in statement balloons and 5in fillers — and shift
          // with height so the giants sit low and the accents drift to the top.
          // Seeded per garland, so a given setup still renders identically.
          const pickSize = (t: number): "X" | "L" | "M" | "S" => {
            // t: 0 at the floor, 1 at the spring line.
            const roll = rnd();
            // Fewer giants outside tight mode: with the wider spacing above,
            // two 36in balloons landing near each other low down were the
            // fused white blobs in the lower third of the single-arch garland.
            // 2026-09-09 (second pass): with the radii back at true balloon
            // scale the lone arch wants MANY 5-inch fillers, which is what
            // gives the reference garland its stuffed, gap-free look — a 5"
            // is now genuinely small, so a high S share adds density instead
            // of shrinking the band the way it did at the old inflated radii.
            // 2026-09-10: the pink reference is not a uniform band — it has a
            // handful of bold statement balloons standing proud of the rest,
            // and plenty of small ones packed into the gaps between them. So
            // both ends of the mix go up: more XL, more S, fewer plain mediums.
            // 2026-09-10 (later): the customer's reference is BIG balloons
            // packed tight — the small balloons in it are almost all bundled
            // into the rosettes below, not loose in the band. A high loose-S
            // share (0.36) plus the old fill pass put a cloud of little
            // balloons "flying" between the big ones ("cok fazla minik minik
            // balonlar ucusuyor"). Small share drops hard; XL statement
            // balloons stay, since the reference clearly has several.
            // A few statement balloons, not many: too many big ones made the
            // band lumpy and uneven. The reference is mostly one size with the
            // odd big accent.
            // 2026-10-15: big-dominant everywhere, matching the customer's
            // reference — large balloons carry the garland and the mediums
            // fill between them. The old mix put 12-32% of the band in the
            // filler slot and split the rest nearly evenly, which read as a
            // fine busy band rather than a chunky one.
            const xlChance = crownOverTop ? 0.08 * (1 - t) : 0.12 * (1 - t);
            const sChance  = crownOverTop ? 0.12 : 0.08;
            if (roll < xlChance) return "X";
            if (roll < xlChance + sChance) return "S";
            return rnd() < 0.70 ? "L" : "M";
          };

          const climbFromY = p.floorY - Hp * 0.16;
          const climbToY   = p.floorY - Hp * 0.78;
          let   climbY     = climbFromY;
          let   guard      = 0;
          while (climbY > climbToY && guard++ < 80) {
            const t      = (climbFromY - climbY) / (climbFromY - climbToY);
            const spread = tight ? 1 - 0.42 * t : 1;    // band narrows as it rises
            const rTaper = tight ? 1.25 - 0.45 * t : 1; // balloons shrink as they rise
            const rBall  = sizeR[pickSize(t)] * rTaper;

            // Perpendicular offset across the band, straddling the panel edge.
            //
            // 2026-09-04, and then reverted on 2026-09-05.
            //
            // Double Arch's garland was leaning in over the board face near the
            // top, so a drift term pushed the band centre outward as it climbed
            // (rLarge * 1.5 * t). It moved the wrong thing. Measured on the
            // guide, band centre by height as a fraction of rLarge, negative =
            // inboard of the panel edge, right panel:
            //   with drift:  -0.76 -0.45 -1.06 -0.85 -0.45 -0.17 -0.04 +0.52 -0.45 -0.78
            //   single arch: -0.58 -1.04 -1.22 -1.09 -0.84 -0.24 -0.75 -0.41 +0.21 -0.43
            // The drift made the climb swing 1.6 * rLarge from inboard to
            // outboard and then the crown pulled it back in — an S, with the
            // middle of the garland detached from the arch and floating in the
            // wall (customer, 2026-09-05: "S ciziyor gibi"). The single arch
            // they asked it to match holds a roughly straight column near
            // -0.8, which is what this line gives with no drift at all.
            //
            // The inward curl that started this was never the climb: it is the
            // CROWN, which walks the shoulder arc from 2 deg to -52 deg at
            // radius rArc about the panel centre, so its last balloons sit up
            // to 0.6 * rArc inboard. Single Arch's crown does the same and
            // reads correctly there, so it is left alone.
            // Narrower across the band on the lone arch, so the ribbon stays
            // against the board edge instead of drifting into the wall — but
            // measured in rLarge, which halved on 2026-09-09 when the radii
            // were corrected to real balloon sizes. 1.15 rLarge was then only
            // ~53px of band, thinner than one balloon, so the garland came out
            // single-file. 1.9 restores a band about two balloons deep.
            // 2026-09-10 (later): pulled the band back IN. At 2.4/1.05 the lower
            // cascade bulged far out into the room as a fat lumpy mass detached
            // from the board — the customer's reference instead HUGS the arch
            // edge in a neat band about two balloons deep that follows the
            // board's curve. Biased inboard (more negative than positive) so the
            // mass straddles the edge and sits mostly ON the board, the way a
            // real garland is tied to the frame.
            const bandW = crownOverTop ? 1.7 : 1.7;
            const bandO = crownOverTop ? 1.15 : 0.75;
            const off = (rnd() * bandW - bandO) * rLarge * spread;
            put(edgeX + dir * off, climbY, rBall);

            // A real garland is two balloons deep, not a single file. Most
            // steps drop a companion on the opposite side of the spine at a
            // slightly different height, which fills the gaps between the
            // main balloons and gives the band front-to-back depth without
            // reintroducing a repeating lane.
            // 2026-09-04: the single-arch garland was reading as fat and
            // cramped — balloons fusing into blobs rather than sitting as
            // individual spheres. On this layout the band is not narrowed by
            // the tight-mode taper, so the companion drop and the deep overlap
            // that suit Double Arch stack up into a solid mass here. Double
            // Arch keeps its own values, which the customer approved.
            // 2026-09-10: the lone arch always drops a companion, and often a
            // SECOND one on the near side, so the cascade is three balloons deep
            // like the reference instead of a single ribbon with one backer.
            if (rnd() < (crownOverTop ? 1.0 : looseSpacing ? 0.85 : 0.75)) {
              const cSize = sizeR[pickSize(Math.min(1, t + 0.25))] * rTaper * 0.85;
              const cOff  = off + (off > 0 ? -1 : 1) * (0.5 + rnd() * 0.6) * rLarge * spread;
              put(edgeX + dir * cOff, climbY - rBall * (rnd() * 0.5 - 0.25), cSize);
            }
            // A second backer keeps the band three deep, but medium-sized and
            // kept close to the spine so it reads as part of the packed mass,
            // not a small balloon floating off on its own.
            if (crownOverTop && rnd() < 0.4) {
              const c2 = sizeR[pickSize(Math.min(1, t + 0.15))] * rTaper * 0.9;
              const o2 = off + (rnd() * 0.7 - 0.35) * rLarge * spread;
              put(edgeX + dir * o2, climbY - rBall * (rnd() * 0.5 - 0.1), c2);
            }

            // Advance by most of this balloon's own size: enough overlap to
            // read as a connected garland, little enough to stay individual.
            // Advance further per step when not in tight mode, so neighbours
            // touch and nest instead of merging: at 0.55 of a radius they
            // overlapped by more than half and fused.
            // The lone arch steps tighter than the loose default: at real
            // balloon scale a 0.95-1.25 radius pitch left visible wall between
            // neighbours, and the reference garland has no gaps at all.
            climbY -= rBall * (crownOverTop
              ? 0.44 + rnd() * 0.16
              : looseSpacing ? 0.95 + rnd() * 0.30 : 0.55 + rnd() * 0.25);
          }

          // 3) Crown curl — balloons wrapping the outer shoulder over the
          //    top of the arch arc in 3 depth lanes. Default: 16, large near
          //    the apex. Tight mode: 11 medium/small only — a deliberately
          //    LIGHTER crown so the whole garland reads bottom-heavy.
          const rArc  = p.pw / 2;
          const arcCx = p.cx;
          const arcCy = p.apexY + rArc;
          const angFrom = crownOverTop
            // Starts past the apex, on the far side of the top, so the mass
            // begins upper-middle exactly as the reference does.
            ? (side === "left" ? 298 : -118)
            : (side === "left" ? 178 : 2);
          // Tight mode stops well short of the apex (2026-09-03): walked all
          // the way to the top, the last few shrinking balloons stood up
          // above the arch as a thin horn, and now that the edit model
          // re-creates the garland from the guide it painted that horn as a
          // pointed tip. The crown is a rounded cluster of large balloons on
          // the shoulder — the reference Single Arch look — not a tail.
          const angTo   = crownOverTop
            ? (side === "left" ? 180 : 0)
            : tight
              ? (side === "left" ? 232 : -52)
              : (side === "left" ? 268 : -88);
          // Walked along the arc the same way the climb is walked up the edge,
          // for the same reason — the old version cycled 3 depth lanes and a
          // 3-entry size pattern, which drew a beaded trim over the shoulder.
          let crownAng = angFrom;
          let crownGuard = 0;
          const angStep = (angTo - angFrom) > 0 ? 1 : -1;
          while (Math.abs(crownAng - angFrom) < Math.abs(angTo - angFrom) && crownGuard++ < (crownOverTop ? 90 : 40)) {
            const t     = Math.abs(crownAng - angFrom) / Math.abs(angTo - angFrom);
            const rBall = crownOverTop
              // Light where it meets the apex, heaviest at the outer corner:
              // pickSize takes 0 = biggest, so this walks DOWN as t rises.
              ? sizeR[pickSize(Math.max(0, 0.90 - 0.80 * t))]
              : tight
                ? sizeR[pickSize(0.15 + 0.35 * t)]        // large cluster, not a shrinking trim
                : sizeR[pickSize(0.55 + 0.45 * t)];
            // Depth also grows toward the corner, so the band is a thin run over
            // the top and a deep cluster where it turns down the side.
            const rad   = crownOverTop
              ? rArc + (rnd() * (0.5 + 1.1 * t) - 0.35) * rMed
              : rArc + (rnd() * 1.5 - 0.4) * rMed;
            const a     = (crownAng * Math.PI) / 180;
            put(arcCx + rad * Math.cos(a), arcCy + rad * Math.sin(a), rBall);
            // Advance along the arc by roughly this balloon's own footprint.
            crownAng += angStep * ((rBall * (0.62 + rnd() * 0.28)) / rArc) * (180 / Math.PI);
          }

          // 2026-09-10: lone-arch fill + balloon-flower clusters, from the pink
          // reference. Two things the reference has that a plain climb does not:
          //   (a) it is STUFFED — 5" balloons tucked into every interstice so no
          //       wall shows through the band;
          //   (b) little rosettes — a small balloon ringed by five 5" balloons —
          //       dotted along the run, which is what reads as "flowers".
          // Both are placed last, over the finished mass, so they fill gaps
          // rather than pushing the main balloons apart (the base-cluster note).
          if (crownOverTop) {
            // 2026-09-10 (later): rosettes only, and TIGHT. The reference's
            // "flowers" are five 5" balloons pressed hard against a centre one
            // so the whole thing reads as a single tight ball the size of a
            // medium balloon. The first version spread the petals 1.5 radii out
            // (a loose splat) and ALSO scattered loose 5" balloons beside every
            // other spine balloon — which is the cloud of flying minis the
            // customer flagged. The loose fill is gone; petals pull in to 1.05
            // radii; and each flower is seated INSIDE the band (0.5 rLarge in),
            // not hung off its outer edge.
            const spine = placed.slice();
            const rosette = (cxp: number, cyp: number, rr: number) => {
              put(cxp, cyp, rr * 0.95);                // heart
              for (let k = 0; k < 5; k++) {
                const a = (k / 5) * Math.PI * 2 + rnd() * 0.6;
                put(cxp + Math.cos(a) * rr * 1.05, cyp + Math.sin(a) * rr * 1.05, rr * 0.8);
              }
            };
            let flowers = 0;
            for (const q of spine) {
              if (flowers < 5 && rnd() < 0.12 && q.y < p.floorY - rLarge * 2 && q.r > rMed * 0.8) {
                rosette(q.x - dir * rLarge * 0.5, q.y, rSmall);
                flowers++;
              }
            }
          }
          if (tight && !giantAnchors) {
            for (let i = 0; i < 18; i++) {
              const ox = (baseRnd() * 2 - 1) * rLarge * 2.2;
              const up = baseRnd() * rLarge * 3.0;
              put(
                edgeX + dir * 12 + ox,
                p.floorY - up,
                (i % 3 === 0 ? rSmall : rMed) * (0.85 + baseRnd() * 0.35),
                );
            }
          }
          // 2026-09-09: and a filler pass over the WHOLE garland, not just the
          // floor. The customer asked for many small balloons and some very
          // small ones tucked into the gaps — the size mix was reading as too
          // even because the only filler ran along the base. Candidates are
          // sampled next to balloons already placed, so the fillers land in the
          // band instead of scattering into the wall; `put` rejects anything
          // that would sit too deep inside a neighbour.
          if (crownOverTop) {
            // 2026-09-09: 46 -> 70, and weighted toward the LOWER half of the
            // cascade. The customer circled the bottom third of the vertical
            // run as too thin; the top was already dense because the crown
            // ramp piles mass into the corner.
            const anchors = [...placed];
            const midY = p.apexY + (p.floorY - p.apexY) * 0.45;
            const lower = anchors.filter((q) => q.y > midY);
            for (let i = 0; i < 70; i++) {
              const pool = (i % 3 !== 0 && lower.length > 0) ? lower : anchors;
              const q = pool[Math.floor(baseRnd() * pool.length)];
              if (!q) break;
              const ang = baseRnd() * Math.PI * 2;
              const rr  = (baseRnd() < 0.45 ? rSmall * 0.62 : rSmall) * (0.85 + baseRnd() * 0.5);
              const d2  = q.r + rr * (0.55 + baseRnd() * 0.5);
              put(q.x + Math.cos(ang) * d2, q.y + Math.sin(ang) * d2, rr);
            }
          }
          return { count: n, minR: Math.round(minR), maxR: Math.round(maxR), lanes: 4 };
        };

        // ===================================================================
        // Lone-arch STATEMENT HALF-GARLAND — built to the customer's written
        // brief (2026-09-11), which replaced the earlier photo transcription.
        //
        // The brief is a set of hard rules rather than one photo, so this walks
        // the board's own CONTOUR and places balloons against it. The contour is
        // the thing the rules keep talking about: attached to the edge with no
        // visible gap, following the backdrop, one smooth top-to-bottom flow.
        //
        //   - one half-garland, on the RIGHT OUTER edge only; the left side of
        //     the arch stays completely clean;
        //   - a dense cluster of large balloons at the top-right crown, then a
        //     cascade down the right edge whose standard balloons taper as they
        //     fall, ending in a connected floor cluster at the OUTER bottom
        //     corner — never centred, never spread across the base, never in
        //     front of the panel or the plinth;
        //   - exactly three size families (36in statement / 12in standard /
        //     5in filler), with the statement balloons clearly the largest and
        //     at least five of them spread over top, side and base;
        //   - 5in balloons only ever appear as small clusters tucked against a
        //     larger balloon, never loose on their own.
        //
        // Sizes are in units of the board's HEIGHT, which is 220cm, so they are
        // real balloon sizes. They are NOT literal 36/12/5 inch diameters: a
        // true 36in balloon is 91cm, three quarters of a 120cm board, and the
        // customer rejected that scale as beach balls on 2026-09-09. What the
        // brief is really asking for is three clearly separated families with a
        // bold statement size, which is what these give (about 17in / 8in / 3in
        // on a 120cm board, a 5.2 : 2.4 : 1 ratio against the real 7.2 : 2.4 : 1).
        // ===================================================================
        // 2026-10-21: Single Arch REPLAYS the customer's lavender and blue
        // reference (see "Reference replays" above). In the photo the board
        // runs x 173..650 and from its crown at y 333 to the floor at 1270;
        // the garland starts on the crown's left shoulder with a big clear
        // bubble and a big white, crosses the top, and comes down the whole
        // right edge into a heavy foot, with five snowflakes along it.
        const SINGLE_ARCH_REF: RefItem[] = [
          // crown
          [407, 160, 94, "W"], [247, 197, 75, "C"], [529, 144, 29, "L"], [570, 212, 68, "B"],
          [679, 244, 43, "W"], [471, 234, 46, "S"], [264, 230, 21, "L"], [304, 219, 18, "B"],
          [396, 226, 25, "B"], [268, 284, 43, "W"], [229, 330, 32, "B"], [361, 319, 32, "B"],
          [407, 269, 32, "L"], [439, 316, 25, "S"], [471, 291, 18, "W"], [454, 351, 20, "W"],
          [536, 260, 14, "B"], [575, 259, 20, "B"], [549, 345, 79, "B"], [732, 387, 61, "C"],
          [643, 359, 20, "B"], [643, 409, 32, "L"], [586, 423, 21, "B"], [700, 441, 25, "W"],
          [600, 466, 25, "L"],
          [339, 257, 40, "F"], [661, 298, 60, "F"],
          // down the right edge
          [661, 493, 44, "S"], [586, 479, 29, "L"], [729, 486, 20, "B"], [800, 507, 54, "W"],
          [711, 543, 26, "W"], [661, 571, 30, "B"], [614, 550, 29, "B"], [761, 589, 39, "L"],
          [857, 600, 34, "L"], [694, 657, 69, "B"], [889, 693, 57, "C"], [718, 754, 39, "W"],
          [836, 754, 46, "L"], [771, 739, 18, "S"], [775, 807, 44, "B"], [671, 782, 25, "W"],
          [828, 852, 40, "S"], [895, 840, 27, "B"], [857, 811, 16, "S"], [685, 890, 58, "C"],
          [770, 866, 16, "W"], [774, 944, 57, "W"],
          [796, 675, 68, "F"], [891, 951, 64, "F"],
          // the foot
          [727,1005, 16, "B"], [691, 991, 16, "L"], [784,1034, 39, "L"], [845,1001, 32, "L"],
          [859,1066, 39, "L"], [934,1044, 43, "C"], [679,1085, 73, "B"], [781,1123, 46, "S"],
          [877,1119, 20, "S"], [920,1123, 25, "W"], [702,1162, 32, "S"], [759,1180, 18, "W"],
          [634,1162, 16, "B"], [899,1239,100, "B"], [595,1244, 71, "L"], [724,1201, 25, "W"],
          [681,1212, 21, "L"], [774,1223, 25, "B"], [699,1280, 61, "W"], [848,1335, 28, "L"],
          [790,1345, 18, "B"],
          [802,1269, 54, "F"],
        ];
        // 2026-10-21: Double Arch REPLAYS the customer's reference: a tall
        // garland up the left arch's outer edge, from the floor to just over
        // its crown, and a lower cluster on the right arch's outer edge from
        // about halfway up. No snowflakes in this one. In the photo the left
        // board runs x 433..758, y 150..800 and the right one x 765..1083,
        // y 242..800.
        const DOUBLE_ARCH_LEFT_REF: RefItem[] = [
          [444, 147, 36, "C"], [487, 133, 29, "W"], [544, 136, 21, "L"], [516, 151, 18, "W"],
          [484, 169, 16, "S"], [544, 197, 39, "L"], [594, 176, 18, "B"], [594, 154, 25, "C"],
          [484, 190, 14, "W"], [405, 222, 32, "C"], [462, 229, 46, "S"], [534, 258, 27, "W"],
          [416, 261, 16, "B"], [444, 261, 13, "B"], [348, 311, 43, "C"], [419, 319, 46, "B"],
          [505, 279, 16, "S"], [480, 290, 16, "W"], [498, 311, 20, "W"], [512, 365, 50, "C"],
          [423, 394, 36, "S"], [366, 429, 36, "L"], [473, 447, 29, "W"], [394, 451, 16, "S"],
          [423, 465, 16, "B"], [444, 454, 16, "W"], [297, 495, 44, "C"], [385, 551, 77, "B"],
          [512, 499, 46, "W"], [473, 542, 18, "B"], [444, 481, 14, "B"], [480, 585, 29, "S"],
          [519, 574, 21, "W"], [441, 621, 32, "S"], [544, 667, 61, "S"], [244, 639, 57, "W"],
          [341, 649, 39, "L"], [394, 637, 18, "W"], [416, 685, 37, "L"], [462, 710, 30, "W"],
          [316, 761, 89, "B"], [184, 753, 43, "C"], [466, 792, 57, "W"], [423, 735, 14, "S"],
          [544, 803, 25, "S"], [509, 735, 20, "S"], [566, 767, 21, "L"], [534, 764, 14, "B"],
          [587, 799, 18, "L"], [537, 828, 14, "S"],
          // 2026-10-22: snowflakes, as on the other Frozen setups (the photo has
          // none; the customer asked for them).
          [440, 190, 44, "F"], [372, 420, 40, "F"], [262, 700, 46, "F"], [506, 640, 34, "F"],
        ];
        const DOUBLE_ARCH_RIGHT_REF: RefItem[] = [
          [1112, 370, 32, "C"], [1116, 445, 32, "C"], [1080, 474, 16, "S"], [1109, 466, 14, "W"],
          [1126, 509, 36, "L"], [1066, 534, 14, "S"], [1084, 534, 14, "W"], [1205, 552, 50, "C"],
          [1119, 584, 50, "S"], [1048, 599, 32, "B"], [1066, 634, 16, "W"], [1119, 666, 25, "S"],
          [1059, 677, 29, "L"], [1212, 677, 64, "W"], [1312, 684, 36, "C"], [1134, 699, 16, "W"],
          [1144, 724, 11, "B"], [1087, 764, 63, "B"], [ 984, 763, 50, "C"], [1166, 763, 39, "S"],
          [1248, 777, 43, "L"], [1348, 770, 39, "W"], [1273, 731, 16, "S"], [1294, 749, 14, "S"],
          [1169, 820, 14, "S"], [1305, 806, 18, "S"],
          [1096, 520, 34, "F"], [1250, 715, 42, "F"],
        ];
        // 2026-10-21: Shimmer Wall REPLAYS the customer's reference: a full
        // height garland column up EACH side of the wall, from the floor to
        // just over its top, with snowflakes along both. In the photo the wall
        // runs x 510..1190, y 140..810.
        const SHIMMER_LEFT_REF: RefItem[] = [
          [500, 118, 40, "L"], [560, 118, 28, "S"], [408, 134, 24, "C"], [444, 130, 16, "S"],
          [416, 222, 88, "B"], [520, 174, 24, "W"], [488, 282, 28, "W"], [324, 366, 48, "C"],
          [444, 334, 40, "B"], [388, 326, 18, "W"], [412, 382, 20, "L"], [520, 354, 40, "S"],
          [488, 334, 16, "B"], [484, 370, 16, "W"], [456, 374, 14, "B"], [392, 422, 32, "W"],
          [460, 426, 28, "B"], [500, 442, 44, "S"], [340, 490, 66, "W"], [456, 486, 24, "B"],
          [428, 462, 22, "L"], [492, 526, 44, "B"], [420, 546, 24, "W"], [252, 614, 60, "C"],
          [384, 590, 44, "B"], [440, 586, 20, "W"], [500, 610, 36, "L"], [444, 642, 44, "W"],
          [556, 662, 44, "W"], [504, 662, 16, "S"], [252, 734, 72, "B"], [456, 734, 48, "S"],
          [560, 746, 56, "W"], [360, 790, 52, "L"], [500, 802, 32, "B"], [516, 766, 16, "L"],
          [436, 822, 16, "S"], [484, 678, 16, "B"],
          [568, 238, 64, "F"], [344, 670, 64, "F"],
        ];
        const SHIMMER_RIGHT_REF: RefItem[] = [
          [1150,  97, 58, "C"], [1258, 142, 46, "L"], [1300, 226, 79, "W"], [1192, 284, 42, "B"],
          [1258, 313, 21, "S"], [1262, 342, 16, "S"], [1325, 338, 54, "B"], [1408, 313, 58, "C"],
          [1242, 388, 46, "S"], [1183, 372, 25, "L"], [1429, 438, 58, "L"], [1208, 463, 42, "W"],
          [1258, 455, 16, "S"], [1375, 372, 25, "L"], [1271, 577, 88, "W"], [1492, 552, 46, "C"],
          [1404, 568, 38, "S"], [1371, 518, 25, "L"], [1342, 622, 25, "W"], [1388, 618, 21, "L"],
          [1479, 706,104, "B"], [1192, 693, 50, "C"], [1271, 681, 21, "S"], [1262, 731, 33, "W"],
          [1312, 681, 29, "W"], [1204, 768, 46, "B"], [1275, 789, 38, "S"], [1412, 802, 42, "L"],
          [1346, 789, 25, "B"], [1350, 822, 21, "B"], [1233, 814, 21, "L"],
          [1183, 188, 66, "F"], [1346, 422, 71, "F"], [1346, 718, 62, "F"],
        ];
        const SHIMMER_REF_WALL = { l: 510, r: 1190, top: 140, floor: 810 };
        // 2026-10-21: Arch + Shimmer REPLAYS the customer's reference: a
        // full-height garland column up the arch's outer edge and another up
        // the shimmer wall's outer edge, from the floor to over their tops,
        // with snowflakes in both. In the photo the arch runs x 470..730,
        // y 130..810, and the wall x 730..1370, y 170..810.
        const ARCH_SHIMMER_ARCH_REF: RefItem[] = [
          [336, 162, 40, "C"], [432, 134, 40, "B"], [324, 246, 36, "W"], [380, 266, 48, "B"],
          [472, 270, 24, "S"], [476, 218, 20, "L"], [488, 186, 16, "B"], [424, 314, 32, "W"],
          [280, 346, 44, "C"], [424, 358, 28, "S"], [384, 338, 20, "S"], [352, 346, 20, "L"],
          [500, 346, 48, "B"], [356, 406, 56, "W"], [308, 494, 32, "L"], [352, 490, 18, "S"],
          [388, 526, 44, "L"], [428, 482, 20, "S"], [464, 518, 24, "S"], [244, 570, 48, "C"],
          [324, 526, 24, "S"], [452, 590, 52, "W"], [520, 630, 48, "C"], [500, 578, 20, "S"],
          [228, 706, 84, "B"], [380, 674, 32, "S"], [416, 646, 20, "B"], [344, 718, 28, "L"],
          [500, 726, 48, "L"], [320, 758, 20, "S"], [384, 770, 44, "W"], [320, 790, 20, "L"],
          [436, 794, 20, "B"], [456, 754, 16, "S"], [272, 498, 20, "L"],
          [412, 218, 60, "F"], [468, 410, 40, "F"], [344, 610, 64, "F"], [436, 714, 36, "F"],
        ];
        const ARCH_SHIMMER_WALL_REF: RefItem[] = [
          [1350, 140, 48, "W"], [1274, 124, 24, "B"], [1206, 148, 32, "C"], [1254, 164, 20, "B"],
          [1294, 176, 20, "L"], [1222, 224, 44, "W"], [1346, 252, 64, "B"], [1262, 264, 18, "S"],
          [1278, 212, 16, "L"], [1462, 260, 40, "C"], [1298, 316, 32, "L"], [1330, 324, 24, "S"],
          [1466, 348, 36, "L"], [1282, 380, 36, "C"], [1354, 384, 44, "W"], [1422, 416, 20, "S"],
          [1306, 452, 40, "W"], [1362, 460, 24, "B"], [1366, 474, 40, "B"], [1502, 474, 28, "C"],
          [1294, 554, 40, "L"], [1334, 578, 44, "S"], [1446, 562, 52, "W"], [1362, 530, 16, "B"],
          [1322, 526, 16, "S"], [1290, 622, 24, "S"], [1394, 622, 32, "C"], [1282, 662, 16, "B"],
          [1246, 726, 76, "L"], [1478, 702, 80, "B"], [1326, 770, 44, "W"], [1394, 758, 24, "S"],
          [1342, 650, 24, "W"], [1378, 806, 20, "L"], [1426, 806, 20, "L"], [1426, 782, 14, "B"],
          [1414, 324, 56, "F"], [1418, 460, 36, "F"], [1350, 690, 56, "F"],
        ];
        // 2026-10-21: Arch + Open Frame REPLAYS the customer's reference: on
        // the solid arch a garland from over its crown down the whole outer
        // side to the floor, and on the open frame one from over its crown —
        // a few balloons showing behind it through the opening — down its
        // outer side, both thick with snowflakes. The few balloons seen
        // through the frame's opening are left out: our frame is taller for
        // its width, and they landed in the middle of the opening. In the
        // photo the arch runs
        // x 392..736, y 245..955 and the frame x 709..1091, y 355..962.
        const ARCH_FRAME_ARCH_REF: RefItem[] = [
          [520,  87, 83, "B"], [411, 157, 65, "W"], [255, 170, 52, "C"], [320, 183, 30, "L"],
          [355, 243, 48, "B"], [463, 243, 43, "B"], [503, 196, 26, "S"], [559, 209, 30, "S"],
          [533, 174, 16, "S"], [524, 243, 22, "W"], [594, 165, 26, "W"], [377, 296, 22, "S"],
          [333, 287, 17, "B"], [424, 291, 26, "W"], [207, 335, 48, "S"], [316, 357, 52, "B"],
          [242, 365, 26, "S"], [259, 430, 48, "W"], [320, 448, 22, "S"], [290, 491, 35, "B"],
          [342, 483, 26, "W"], [120, 525, 46, "C"], [197, 505, 62, "W"], [287, 543, 17, "B"],
          [317, 547, 16, "S"], [352, 547, 22, "S"], [300, 595, 52, "B"], [100, 734, 78, "B"],
          [261, 673, 43, "L"], [209, 673, 17, "B"], [309, 769, 35, "W"], [248, 743, 35, "S"],
          [196, 721, 17, "B"], [183, 751, 17, "B"], [196, 830, 65, "W"], [383, 851, 74, "B"],
          [ 65, 886, 43, "S"], [252, 873, 17, "B"], [104, 930, 48, "W"], [230, 934, 48, "L"],
          [ 65, 960, 17, "S"],
          [394,  78, 61, "F"], [350, 105, 45, "F"], [250, 257, 74, "F"], [146, 409, 57, "F"],
          [342, 426, 43, "F"], [152, 630, 65, "F"], [348, 725, 52, "F"], [ 96, 825, 43, "F"],
          [287, 851, 39, "F"], [322, 938, 43, "F"],
        ];
        const ARCH_FRAME_FRAME_REF: RefItem[] = [
          [ 875, 267, 59, "B"], [ 788, 295, 45, "C"], [ 970, 322, 36, "S"], [1015, 304, 16, "S"],
          [1015, 285, 45, "W"], [1093, 299, 50, "C"], [1061, 381, 59, "L"], [ 870, 358, 36, "B"],
          [ 761, 385, 36, "W"], [1184, 476, 68, "B"], [1115, 440, 22, "W"], [1156, 576, 59, "W"],
          [1111, 531, 20, "W"], [1148, 600, 56, "W"], [1144, 664, 32, "S"], [1212, 692, 48, "L"],
          [1160, 708, 16, "B"], [1184, 732, 16, "B"], [1136, 772, 44, "B"], [1104, 820, 20, "S"],
          [1176, 856, 52, "L"], [1232, 916, 60, "B"], [1096, 852, 16, "S"], [1140, 952, 20, "S"],
          [1148, 920, 16, "W"],
          [ 984, 217, 64, "F"], [ 793, 335, 50, "F"], [1147, 385, 41, "F"], [1129, 490, 50, "F"],
          [1216, 764, 60, "F"], [1104, 912, 40, "F"],
          // 2026-10-22, the customer's newer reference: the garland also comes
          // THROUGH the opening — down its inner right side from under the
          // crown, then out over the floor and forward, past the front of the
          // frame ("open arch frame in icinden gecerek one dogru gelmeli").
          // The upper part of that stream was dropped after the first render:
          // drawn from the crown down, it stood in the opening like a pillar.
          // What remains is the part the customer marked — a pile in the
          // lower opening that runs out over the floor and forward.
          [ 990, 760, 24, "S"], [ 955, 805, 36, "B"], [ 995, 840, 22, "W"], [ 905, 845, 30, "L"],
          [ 960, 870, 44, "W"], [ 870, 905, 28, "S"], [ 925, 925, 38, "B"], [ 990, 915, 26, "L"],
          [ 845, 960, 42, "L"], [ 905, 985, 50, "B"], [ 975, 975, 32, "W"], [ 820,1025, 32, "W"],
          [ 880,1045, 40, "L"], [ 945,1035, 28, "S"], [ 850, 995, 18, "S"], [ 905,1070, 26, "W"],
          // ...joined to the outer garland over the frame's leg.
          [1030, 845, 30, "W"], [1052, 905, 36, "B"], [1022, 955, 28, "L"], [1062, 970, 24, "S"],
          [1035,1005, 30, "W"],
          [ 875, 935, 44, "F"],
        ];
        // See the Triple Arch branch for how this is mapped.
        const TRIPLE_ARCH_REF: RefItem[] = [
          // the left board, floor to crown
          [302, 265, 35, "C"], [356, 277, 19, "L"], [402, 285, 38, "B"], [364, 315, 23, "L"],
          [475, 254, 27, "C"], [552, 435, 14, "S"], [245, 404, 50, "W"], [279, 320, 22, "B"],
          [356, 412, 27, "B"], [329, 465, 35, "W"], [375, 454, 17, "B"], [379, 488, 23, "S"],
          [264, 473, 23, "B"], [198, 515, 35, "C"], [293, 527, 45, "B"], [352, 519, 15, "S"],
          [379, 568, 46, "W"], [322, 622, 38, "L"], [275, 615, 14, "B"], [229, 672, 77, "B"],
          [372, 642, 19, "S"], [348, 688, 46, "S"], [402, 672, 27, "C"], [475, 734, 42, "C"],
          [391, 730, 15, "S"], [375, 761, 23, "L"], [437, 784, 54, "B"], [302, 780, 62, "W"],
          [375, 818, 23, "L"], [218, 818, 31, "S"], [122, 799, 35, "C"], [229, 776, 17, "B"],
          [156, 830, 17, "S"], [491, 811, 23, "C"], [118, 742, 23, "C"],
          [348, 346, 54, "F"], [248, 560, 50, "F"], [175, 768, 46, "F"],
          [410, 396, 22, "F"], [456, 626, 27, "F"],
          // across the centre board
          [764, 130, 84, "B"], [592, 124, 36, "C"], [660, 124, 20, "C"], [644, 176, 36, "S"],
          [696, 200, 18, "S"], [736, 188, 28, "L"], [792, 216, 36, "W"], [748, 228, 14, "L"],
          [664, 244, 36, "B"], [712, 232, 16, "S"], [568, 252, 60, "L"], [524, 192, 36, "C"],
          [468, 284, 24, "S"], [484, 336, 36, "S"], [548, 376, 40, "C"], [560, 336, 16, "B"],
          [588, 340, 14, "S"], [532, 328, 14, "S"], [872, 104, 28, "C"], [932, 120, 32, "S"],
          [868, 160, 20, "B"], [968, 172, 28, "B"], [944, 208, 40, "B"], [900, 268, 28, "B"],
          [840, 252, 24, "W"], [948, 260, 16, "B"], [984, 276, 16, "S"], [936, 320, 28, "W"],
          [976, 316, 24, "S"], [984, 384, 28, "B"], [960, 356, 16, "S"],
          [484, 268, 24, "F"], [868, 192, 56, "F"], [668, 324, 22, "F"], [930, 384, 24, "F"],
          // the right board, crown to floor
          [1032, 266, 32, "C"], [1064, 326, 36, "S"], [1040, 350, 20, "B"], [1028, 382, 20, "L"],
          [ 992, 418, 20, "L"], [1008, 330, 14, "S"], [1152, 282, 56, "B"], [1236, 278, 28, "C"],
          [1296, 326, 48, "W"], [1236, 390, 40, "L"], [1288, 434, 32, "B"], [1356, 410, 44, "C"],
          [1180, 390, 20, "S"], [1188, 434, 20, "S"], [1224, 438, 14, "S"], [1200, 470, 16, "W"],
          [1224, 522, 68, "B"], [1312, 470, 16, "S"], [1332, 506, 32, "C"], [1376, 538, 28, "C"],
          [1316, 522, 16, "S"], [1160, 534, 20, "S"], [1156, 608, 48, "C"], [1312, 604, 60, "W"],
          [1224, 588, 20, "B"], [1188, 668, 40, "S"], [1236, 632, 22, "B"], [1260, 676, 32, "L"],
          [1384, 656, 32, "C"], [1328, 688, 32, "B"], [1172, 712, 16, "S"], [1092, 732, 40, "C"],
          [1152, 744, 20, "B"], [1224, 764, 60, "W"], [1404, 776, 36, "B"], [1144, 808, 32, "L"],
          [1092, 804, 28, "B"], [1368, 812, 36, "B"], [1312, 820, 20, "B"], [1436, 820, 16, "S"],
          [1312, 792, 16, "S"], [1124, 772, 16, "S"],
          [1012, 282, 20, "F"], [1196, 334, 64, "F"], [1336, 740, 52, "F"], [1112, 530, 28, "F"],
        ];
        // A photo board rect mapped onto one of ours: its two side edges onto
        // our side edges, its floor onto our floor, and the height scale for
        // everything outside the board and for the balloon sizes. `mirror`
        // flips the photo about the board's centre, for a garland on the other
        // side from the photo's.
        const refBoardMap = (
          p: typeof layout.panels[0], mirror: boolean,
          ref: { l: number; r: number; top: number; floor: number },
        ) => {
          const s = (p.floorY - p.apexY) / (ref.floor - ref.top);
          const l = p.cx - p.pw / 2, r = p.cx + p.pw / 2;
          const x0 = refPieceX([[ref.l, l], [ref.r, r]], s);
          return {
            s,
            x: mirror ? (rx: number) => 2 * p.cx - x0(rx) : x0,
            y: (ry: number) => p.floorY - (ref.floor - ry) * s,
          };
        };
        // refBoardMap, with whatever the table puts out past the board's two
        // side edges drawn in by the least that keeps it on the canvas — the
        // photos are wider frames than some of ours.
        const refBoardMapFit = (
          p: typeof layout.panels[0], mirror: boolean,
          ref: { l: number; r: number; top: number; floor: number }, table: RefItem[],
        ) => {
          const m = refBoardMap(p, mirror, ref);
          const visL = -marginX / SCALE + (W * 0.015) / SCALE;
          const visR = (W - marginX) / SCALE - (W * 0.015) / SCALE;
          const l = p.cx - p.pw / 2, r = p.cx + p.pw / 2;
          // In photo terms: the side beyond ref.l lands on our left unless mirrored.
          let sLo = m.s, sHi = m.s;
          for (const [x, , rr, slot] of table) {
            if (slot === "F") continue;
            const room = (side: "L" | "R") => side === "L" ? l - visL : visR - r;
            if (x < ref.l) sLo = Math.min(sLo, Math.max(0, (room(mirror ? "R" : "L") - rr * m.s * 1.08) / (ref.l - x)));
            if (x > ref.r) sHi = Math.min(sHi, Math.max(0, (room(mirror ? "L" : "R") - rr * m.s * 1.08) / (x - ref.r)));
          }
          const x0 = (rx: number) => rx < ref.l ? l + (rx - ref.l) * sLo
            : rx > ref.r ? r + (rx - ref.r) * sHi : m.x(rx);
          const x0n = (rx: number) => rx < ref.l ? l + (rx - ref.l) * sLo
            : rx > ref.r ? r + (rx - ref.r) * sHi : refPieceX([[ref.l, l], [ref.r, r]], m.s)(rx);
          // And the same over the top: the photos carry more headroom over
          // the garland's crown than some of our layouts do.
          const visT = -marginY / SCALE + (H * 0.012) / SCALE;
          let sUp = m.s;
          for (const [, y, rr, slot] of table) {
            if (slot !== "F" && y < ref.top) sUp = Math.min(sUp, Math.max(0, (p.apexY - visT - rr * m.s * 1.08) / (ref.top - y)));
          }
          const y0 = (ry: number) => ry < ref.top ? p.apexY - (ref.top - ry) * sUp : m.y(ry);
          return { s: m.s, y: y0, x: mirror ? (rx: number) => 2 * p.cx - x0n(rx) : x0 };
        };
        // 2026-10-22: arch boards are mapped by their OUTLINE, not by x and y
        // separately. "balonlari backdropa gore ayarlaman lazim ... backdropla
        // balonlar arasinda bosluklar gozukmemesi lazim": the photos' boards
        // are narrower for their height than ours, so a straight x/y scale put
        // the crown at the right height but beside a dome that, being wider,
        // falls away sooner — the wall showed between them. Each balloon now
        // keeps its place relative to the board's edge: round the dome by its
        // angle from the dome's centre, down the sides by how far down the
        // straight edge it sits, and at the same distance in or out from the
        // edge (in height-scaled units). What then stands out past the canvas
        // at the sides or the top is drawn in, by the least that fits.
        const archContourMap = (
          p: typeof layout.panels[0], mirror: boolean,
          // `spring`: where the photo's dome meets its straight sides. The
          // photos' boards are not half-circles — some are flatter, some
          // taller — so their dome is taken as a half-ellipse to that height.
          ref: { l: number; r: number; top: number; floor: number; spring?: number }, table: RefItem[],
        ): { table: RefItem[]; s: number } => {
          const s = (p.floorY - p.apexY) / (ref.floor - ref.top);
          const Rr = (ref.r - ref.l) / 2, cxr = (ref.l + ref.r) / 2;
          const spr = ref.spring ?? ref.top + Rr, Hr = spr - ref.top;
          const R = p.pw / 2, sp = p.apexY + R;
          const l = p.cx - R, r = p.cx + R;
          let mapped: RefItem[] = table.map(([x0, y, rr, slot]) => {
            const x = mirror ? 2 * cxr - x0 : x0;
            if (y <= spr) {
              // Nearest point on the photo's dome along the line from its
              // centre, the distance out from it, and the same direction on
              // ours (a half-circle).
              const dx = x - cxr, dy = y - spr;
              const rho = Math.hypot(dx / Rr, dy / Hr) || 1;
              const ex = dx / rho, ey = dy / rho;
              const d = Math.hypot(dx - ex, dy - ey) * (rho >= 1 ? 1 : -1);
              const ux = ex / Rr, uy = ey / Hr, un = Math.hypot(ux, uy) || 1;
              const rad = R + d * s;
              return [p.cx + (ux / un) * rad, sp + (uy / un) * rad, rr, slot];
            }
            const left = x < cxr;
            const d = left ? ref.l - x : x - ref.r;
            const f = (y - spr) / (ref.floor - spr);
            const Y = f <= 1 ? sp + f * (p.floorY - sp) : p.floorY + (y - ref.floor) * s;
            return [left ? l - d * s : r + d * s, Y, rr, slot];
          });
          // Then the crown is settled onto the dome. No model of the photo's
          // board fits it exactly (their tops are squarer than an ellipse), and
          // our dome falls away sooner, so the crown could still stand off it
          // with wall showing under it — the gap the customer circled. Across
          // the dome, each vertical strip of the crown moves down until its
          // lowest balloon laps over the dome by a fifth of itself, as the
          // photos' do; the shift is blended from strip to strip, so the crown
          // keeps its shape.
          {
            const NB = 14, binW = (2 * R) / NB;
            const surf = (X: number) => sp - Math.sqrt(Math.max(0, R * R - (X - p.cx) * (X - p.cx)));
            const need: number[] = new Array(NB).fill(Infinity);
            for (const [X, Y, rr, slot] of mapped) {
              if (slot === "F" || Y > sp || Math.abs(X - p.cx) >= R) continue;
              const br = rr * s * 1.08;
              const b = Math.min(NB - 1, Math.max(0, Math.floor((X - l) / binW)));
              need[b] = Math.min(need[b], surf(X) - (Y + br) + 0.2 * br);
            }
            const shift = need.map((v) => (isFinite(v) && v > 0 ? v : 0));
            const shiftAt = (X: number): number => {
              const t = (X - l) / binW - 0.5;
              if (t <= 0) return shift[0];
              if (t >= NB - 1) return shift[NB - 1];
              const i = Math.floor(t);
              return shift[i] + (shift[i + 1] - shift[i]) * (t - i);
            };
            mapped = mapped.map(([X, Y, rr, slot]) =>
              Y <= sp && Math.abs(X - p.cx) < R ? [X, Y + shiftAt(X), rr, slot] : [X, Y, rr, slot]);
          }
          // And the sides likewise (2026-10-22, the customer circled wall
          // showing between the arch's outer edge and its garland): down each
          // straight side, in bands, the balloons outside the board move in
          // until the band's innermost one laps over the edge by a fifth of
          // itself.
          {
            const bandH = (p.floorY - sp) / 10;
            const need = new Map<string, number>();
            const key = (X: number, Y: number) => `${X < l ? "l" : "r"}${Math.floor((Y - sp) / bandH)}`;
            for (const [X, Y, rr, slot] of mapped) {
              if (slot === "F" || Y <= sp || Y > p.floorY || (X >= l && X <= r)) continue;
              const br = rr * s * 1.08;
              const gap = (X < l ? l - X : X - r) - br;
              const k = key(X, Y);
              need.set(k, Math.min(need.get(k) ?? Infinity, gap + 0.2 * br));
            }
            mapped = mapped.map(([X, Y, rr, slot]) => {
              if (Y <= sp || (X >= l && X <= r)) return [X, Y, rr, slot];
              const sh = need.get(key(X, Y));
              if (sh === undefined || !isFinite(sh) || sh <= 0) return [X, Y, rr, slot];
              return [X < l ? X + sh : X - sh, Y, rr, slot];
            });
          }
          const visL = -marginX / SCALE + (W * 0.015) / SCALE;
          const visR = (W - marginX) / SCALE - (W * 0.015) / SCALE;
          const visT = -marginY / SCALE + (H * 0.012) / SCALE;
          let kL = 1, kR = 1, kT = 1;
          for (const [X, Y, rr, slot] of mapped) {
            if (slot === "F") continue;
            const br = rr * s * 1.08;
            if (X < l && X - br < visL) kL = Math.min(kL, Math.max(0, (l - visL - br) / (l - X)));
            if (X > r && X + br > visR) kR = Math.min(kR, Math.max(0, (visR - r - br) / (X - r)));
            if (Y < p.apexY && Y - br < visT) kT = Math.min(kT, Math.max(0, (p.apexY - visT - br) / (p.apexY - Y)));
          }
          mapped = mapped.map(([X, Y, rr, slot]) => [
            X < l ? l - (l - X) * kL : X > r ? r + (X - r) * kR : X,
            Y < p.apexY ? p.apexY - (p.apexY - Y) * kT : Y, rr, slot]);
          return { table: mapped, s };
        };
        const idMap = (v: number) => v;
        const drawSingleArchRef = (p: typeof layout.panels[0], side: "left" | "right"): number => {
          const m = archContourMap(p, side === "left", { l: 173, r: 650, top: 333, floor: 1270, spring: 470 }, SINGLE_ARCH_REF);
          return drawRefTable(m.table, idMap, idMap, m.s, {
            maxBottom: p.floorY + plinthForwardPx * 1.5,
            keepClear: plinthKeepClear(),
          }).length;
        };

        const drawLoneArchStatementGarland = (
          p: typeof layout.panels[0], side: "left" | "right",
        ): number => {
          const dir    = side === "left" ? -1 : 1;
          const edge   = p.cx + dir * (p.pw / 2);
          const boardH = p.floorY - p.apexY;
          const domeR  = p.pw / 2;
          const domeCy = p.apexY + domeR;

          // 2026-10-15: sized off the customer's reference photo. Measured
          // there against the board's own width, the balloons run:
          //   statement  0.30-0.33 pw across   standard 0.20 pw   filler 0.09 pw
          // The statement size already matched; the standard and the filler
          // were both a little under, which is part of why the garland read
          // as finer-grained than the reference. pw is 0.5455 of boardH on a
          // 120x220 board, so these are those fractions converted.
          const R36 = 0.090 * boardH;   // statement  (~0.33 pw across)
          const R12 = 0.054 * boardH;   // standard   (~0.20 pw across)
          const R5  = 0.024 * boardH;   // filler     (~0.09 pw across)

          let n = 0;

          // ---------------------------------------------------------------
          // OMBRE colour assignment.
          //
          // 2026-09-11. Every other garland in this file picks the colour that
          // currently covers the least AREA, which deliberately interleaves the
          // palette evenly. The customer's preferred reference does the
          // opposite: it runs an ombre down the garland. Measured on it, the
          // mean hue of the balloon column by height goes 205, 207, 218, 243,
          // 253, 257, 258, 287 — a clean monotonic sweep from blue at the crown
          // to lilac at the floor. The same measurement on the area-balanced
          // render oscillates (274, 231, 254, 225, neutral, 279, 216), i.e. no
          // gradient at all. That is the single biggest difference between the
          // two, so colour here is chosen by POSITION down the garland.
          //
          // The customer's palette still decides WHICH colours appear; only the
          // order they appear in is derived. Chromatic colours are sorted by
          // hue and spread across t, so the sweep runs blue -> lilac for this
          // palette and something sensible for any other. Neutrals (white,
          // silver, greys) carry no hue to sort by, so they are threaded
          // through as accents the way the reference threads its chrome.
          // ---------------------------------------------------------------
          const hueOf = (hex: string): { h: number; s: number } => {
            const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
            if (!m) return { h: -1, s: 0 };
            const v = parseInt(m[1], 16);
            const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
            const sat = mx === 0 ? 0 : d / mx;
            if (d < 1e-6) return { h: -1, s: sat };
            let h: number;
            if (mx === r) h = ((g - b) / d) % 6;
            else if (mx === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60; if (h < 0) h += 360;
            return { h, s: sat };
          };
          const chromatic: number[] = [];
          const neutral:   number[] = [];
          colors.forEach((hex, i) => {
            const { h, s } = hueOf(hex);
            if (h >= 0 && s >= 0.08) chromatic.push(i); else neutral.push(i);
          });
          chromatic.sort((a, b) => hueOf(colors[a]).h - hueOf(colors[b]).h);
          let accentTick = 0;
          const colorAt = (t: number): number => {
            // Thread the neutrals through as accents. Roughly every third
            // balloon, which is about the density of chrome in the reference.
            if (neutral.length > 0 && accentTick++ % 3 === 2) {
              return neutral[Math.floor(accentTick / 3) % neutral.length];
            }
            if (chromatic.length === 0) {
              return neutral.length > 0 ? neutral[accentTick % neutral.length] : 0;
            }
            const pos = Math.max(0, Math.min(0.999, t)) * chromatic.length;
            let k = Math.floor(pos);
            // Soften the join: near a boundary some balloons take the next
            // colour, so the change reads as a blend rather than a hard stripe.
            const frac = pos - k;
            if (frac > 0.68 && k + 1 < chromatic.length && accentTick % 2 === 0) k += 1;
            return chromatic[Math.min(k, chromatic.length - 1)];
          };

          // Every balloon drawn so far, so a new one can be checked against
          // its neighbours.
          //
          // 2026-09-11: this garland had NO overlap check at all, unlike
          // drawThickOrganicMainGarland which has maxNestFrac. Balloons were
          // free to bury each other, and the customer circled the result: a
          // balloon squashed between two larger ones, reading as crushed
          // rather than nested. A balloon that would sit more than `maxNest`
          // of its diameter inside a neighbour is now skipped.
          //
          // `guard` is off for the 5in fillers and rosette petals, which are
          // deliberately tucked against a parent and would all be rejected.
          const drawn: { x: number; y: number; r: number }[] = [];
          const maxNest = 0.86;
          const put = (bx: number, by: number, br: number, t = 0.5, guard = true) => {
            if (guard) {
              for (const q of drawn) {
                const d  = Math.hypot(bx - q.x, by - q.y);
                const ov = (br + q.r - d) / (2 * Math.min(br, q.r));
                if (ov > maxNest) return;
              }
            }
            drawn.push({ x: bx, y: by, r: br });
            const ci = colorAt(t);
            content.push(`<circle cx=\"${bx.toFixed(1)}\" cy=\"${by.toFixed(1)}\" r=\"${br.toFixed(1)}\" ${balloonAttrs(ci)}/>`);
            n++;
          };
          let seed = 20260911;
          const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

          // The contour, as one parameter t from 0 (crown) to 1 (floor).
          // t <= CROWN_T rides the dome from just left of the apex round to the
          // right spring point; after that it runs straight down the right edge.
          // The two meet exactly at the spring point, so the flow is continuous
          // and never doubles back.
          const CROWN_T = 0.40;
          const A_FROM  = -16 * Math.PI / 180;   // just past the apex, so the crown
          const A_TO    =  90 * Math.PI / 180;   // reads anchored on top, not beside
          const pathAt = (t: number) => {
            if (t <= CROWN_T) {
              const a = A_FROM + (A_TO - A_FROM) * (t / CROWN_T);
              return {
                x: p.cx + dir * Math.sin(a) * domeR,
                y: domeCy - Math.cos(a) * domeR,
                nx: dir * Math.sin(a),
                ny: -Math.cos(a),
              };
            }
            const u = (t - CROWN_T) / (1 - CROWN_T);
            return { x: edge, y: domeCy + u * (p.floorY - domeCy), nx: dir, ny: 0 };
          };

          // off is measured in units of the balloon's own radius along the
          // OUTWARD normal. Slightly negative means the balloon laps over the
          // board edge, which is what makes the garland read as installed ON the
          // structure with no gap; it is never negative enough to carry a balloon
          // across the face of the panel.
          type Node = { t: number; off: number; size: "L" | "M" };
          const NODES: Node[] = [
            // dense large-balloon crown on the top right
            // 2026-10-15: statement balloons go from 5 of 23 to 12 of 23.
            // The reference garland is BIG-dominant — large balloons carry it
            // and the mediums fill between them — where this table had it the
            // other way round and read as a finer, busier band.
            { t: 0.000, off:  0.10, size: "M" },
            { t: 0.045, off: -0.15, size: "L" },
            { t: 0.085, off:  0.45, size: "L" },
            { t: 0.130, off: -0.20, size: "M" },
            { t: 0.170, off:  0.55, size: "L" },
            { t: 0.210, off:  0.00, size: "L" },
            { t: 0.255, off:  0.60, size: "M" },
            { t: 0.295, off: -0.15, size: "L" },
            { t: 0.335, off:  0.50, size: "L" },
            { t: 0.380, off: -0.10, size: "M" },
            // cascade down the outer edge
            { t: 0.425, off:  0.55, size: "L" },
            { t: 0.468, off: -0.12, size: "M" },
            { t: 0.510, off:  0.50, size: "L" },
            { t: 0.553, off: -0.05, size: "L" },
            { t: 0.595, off:  0.55, size: "M" },
            { t: 0.637, off: -0.10, size: "L" },
            { t: 0.678, off:  0.45, size: "M" },
            { t: 0.718, off:  0.00, size: "L" },
            { t: 0.760, off:  0.55, size: "L" },
            { t: 0.800, off: -0.08, size: "M" },
            { t: 0.840, off:  0.45, size: "L" },
            { t: 0.878, off:  0.05, size: "M" },
            { t: 0.915, off:  0.50, size: "L" },
          ];

          // Standard balloons taper as the cascade falls (the brief asks for
          // gradually smaller balloons down the right edge); statement balloons
          // keep their full size wherever they land, so they stay clearly the
          // largest at the top, down the side AND in the base cluster.
          const placed: { x: number; y: number; r: number; t: number }[] = [];
          let ni = 0;
          for (const nd of NODES) {
            const q = pathAt(nd.t);
            // Only a slight taper: at 0.22 the band narrowed noticeably by the
            // floor, while the reference keeps full-size balloons all the way
            // down into the base cluster.
            const r = nd.size === "L" ? R36 : R12 * (1 - 0.08 * nd.t);
            const x = q.x + q.nx * nd.off * r;
            const y = q.y + q.ny * nd.off * r;
            put(x, y, r, nd.t);
            placed.push({ x, y, r, t: nd.t });

            // Depth. The brief asks for a lush, layered, clustered garland and
            // rules out "a thin single-file chain", which is exactly what one
            // balloon per contour node produces. Each node therefore carries a
            // companion nested OUTWARD of it, and every other node a second one
            // set along the contour to close the gap to the next node. Both are
            // pushed outward or along the flow, never inward, so the layering
            // can never march across the face of the panel.
            const na = Math.atan2(q.ny, q.nx);
            const ca = na + (rnd() - 0.5) * 1.2;
            const cr = r * (0.70 + rnd() * 0.22);
            const cx2 = x + Math.cos(ca) * r * 0.88;
            const cy2 = y + Math.sin(ca) * r * 0.88;
            put(cx2, cy2, cr, nd.t);
            placed.push({ x: cx2, y: cy2, r: cr, t: nd.t });

            // Every third node, not every second: at every second the run came
            // back visually noisy next to the reference, which is a cleaner
            // column of larger balloons.
            if (ni % 3 === 0) {
              // tangent = normal rotated a quarter turn, i.e. down the flow
              const ta = na + Math.PI / 2;
              const tr = r * (0.72 + rnd() * 0.18);
              const tx = x + Math.cos(ta) * r * 0.95 + q.nx * tr * 0.35;
              const ty = y + Math.sin(ta) * r * 0.95 + q.ny * tr * 0.35;
              put(tx, ty, tr, nd.t);
              placed.push({ x: tx, y: ty, r: tr, t: nd.t });
            }
            ni++;
          }

          // 2026-09-11: a second, outer layer down the middle of the cascade.
          // The customer marked that stretch of the outer face as too thin and
          // asked for more balloons there. These sit further out along the
          // normal than the main run (0.95-1.35 radii against 0.45-0.55), so
          // they build the band outward rather than crowding the spine, and
          // the overlap guard above drops any that would bury a neighbour.
          // Two staggered outer rows rather than one. The overlap guard above
          // rejects roughly a fifth of what is offered, so offering more is how
          // the outer face actually ends up denser — the guard keeps whichever
          // of them fit without burying a neighbour.
          const OUTER_FILL: { t: number; off: number; size: "L" | "M" }[] = [
            { t: 0.425, off: 1.00, size: "M" },
            { t: 0.445, off: 1.32, size: "M" },
            { t: 0.478, off: 1.02, size: "M" },
            { t: 0.495, off: 1.34, size: "M" },
            { t: 0.522, off: 0.98, size: "L" },
            { t: 0.545, off: 1.30, size: "M" },
            { t: 0.575, off: 1.04, size: "M" },
            { t: 0.600, off: 1.34, size: "M" },
            { t: 0.628, off: 0.98, size: "M" },
            { t: 0.650, off: 1.30, size: "L" },
            { t: 0.678, off: 1.02, size: "M" },
            { t: 0.700, off: 1.32, size: "M" },
            { t: 0.726, off: 0.98, size: "M" },
            { t: 0.750, off: 1.30, size: "L" },
            { t: 0.775, off: 1.04, size: "M" },
            { t: 0.795, off: 1.32, size: "M" },
          ];
          for (const nd of OUTER_FILL) {
            const q = pathAt(nd.t);
            const r = nd.size === "L" ? R36 * 0.92 : R12 * (1 - 0.08 * nd.t);
            const x = q.x + q.nx * nd.off * r;
            const y = q.y + q.ny * nd.off * r;
            put(x, y, r, nd.t);
            placed.push({ x, y, r, t: nd.t });
          }

          // Floor cluster: sits on the OUTER bottom corner, trailing outward and
          // down onto the floor. Anchored to the last cascade balloon so it is
          // visibly part of the garland rather than a separate pile, and held to
          // the outer side — the inboard reach is capped at a third of a standard
          // balloon so nothing builds up in front of the panel or the plinth.
          const baseY = p.floorY;
          const BASE: { ox: number; oy: number; size: "L" | "M" | "S" }[] = [
            { ox:  0.10, oy: -0.34, size: "L" },
            { ox:  0.78, oy: -0.30, size: "L" },
            { ox:  0.62, oy: -0.16, size: "M" },
            { ox: -0.22, oy: -0.12, size: "M" },
            { ox:  0.34, oy: -0.05, size: "M" },
            { ox:  0.88, oy: -0.06, size: "M" },
            { ox:  0.18, oy: -0.60, size: "M" },
            { ox:  0.66, oy: -0.44, size: "M" },
            { ox:  1.06, oy: -0.22, size: "M" },
            { ox:  1.28, oy: -0.05, size: "M" },
            { ox: -0.06, oy: -0.62, size: "M" },
            { ox:  0.42, oy: -0.78, size: "M" },
            { ox:  0.96, oy: -0.62, size: "M" },
            { ox:  1.34, oy: -0.40, size: "M" },
            { ox:  0.02, oy: -0.04, size: "M" },
          ];
          for (const b of BASE) {
            const r = b.size === "L" ? R36 : R12;
            const x = edge + dir * b.ox * R36;
            const y = baseY + b.oy * R36 - r * 0.15;
            // t = 1: the floor cluster is the far end of the ombre.
            put(x, y, r, 1);
            placed.push({ x, y, r, t: 1 });
          }

          // 5in fillers, LAST and only ever tucked against a larger balloon, so
          // they read as the small clusters the brief describes and never as
          // loose balloons floating in the scene. Every one is pushed outward
          // from its parent's centre, so a filler can never end up in front of
          // the panel that its parent is sitting beside.
          // 2026-09-11: far fewer of these. At one cluster on every second
          // balloon, two or three at a time, the run carried ~75 little
          // balloons and read as visual noise beside the reference, which is a
          // clean column of large balloons with only occasional small ones.
          // Each filler inherits its parent's place in the ombre so an accent
          // never lands in the wrong colour band.
          for (let i = 0; i < placed.length; i += 4) {
            const q = placed[i];
            const count = 1 + (rnd() < 0.35 ? 1 : 0);
            for (let k = 0; k < count; k++) {
              const a = (-0.5 + rnd() * 1.0) + (dir > 0 ? 0 : Math.PI);
              const d = q.r + R5 * 0.6;
              put(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * 0.8, R5 * (0.85 + rnd() * 0.4), q.t, false);
            }
          }
          return n;
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
        // The approved Shimmer Wall garland (see the lone shimmer branch for
        // its source), as a function so Arch + Shimmer can use it too. `side`
        // is the edge its column runs down; "left" mirrors the photo.
        const drawShimmerRefGarland = (sp: typeof layout.panels[0], side: "left" | "right"): void => {
        type ShimBalloon = [number, number, number, "P" | "L" | "S"];
        const SHIM_REF: ShimBalloon[] = [
          // top band, from about a third of the way across to past the right corner
          [430, 156, 28, "P"], [420, 180, 24, "P"], [485, 125, 22, "L"], [472, 154, 18, "L"],
          [475, 193, 23, "P"], [493, 175, 17, "S"], [519, 146, 21, "S"], [548, 133, 26, "P"],
          [551, 177, 20, "S"], [525, 198, 23, "P"], [585, 154, 27, "P"], [567, 201, 23, "L"],
          [625, 130, 26, "P"], [617, 188, 25, "P"], [651, 159, 24, "S"], [690, 125, 26, "S"],
          [664, 214, 28, "L"], [701, 175, 29, "L"], [762, 140, 40, "L"], [722, 217, 31, "L"],
          [819, 159, 24, "P"], [843, 133, 21, "S"], [796, 212, 29, "S"], [853, 188, 26, "S"],
          [827, 243, 25, "S"], [769, 262, 29, "L"], [796, 280, 24, "L"], [853, 264, 22, "P"],
          // right column, lavender and chrome alternating down to the floor
          [807, 320, 23, "S"], [853, 317, 22, "L"], [787, 360, 27, "L"], [833, 360, 27, "L"],
          [803, 390, 20, "S"], [767, 397, 23, "L"], [840, 403, 19, "L"], [807, 433, 30, "L"],
          [770, 447, 20, "S"], [847, 467, 23, "S"], [803, 480, 19, "S"], [770, 490, 27, "L"],
          [823, 513, 20, "L"], [780, 540, 30, "L"], [833, 540, 17, "S"], [817, 580, 25, "S"],
          [767, 587, 20, "S"], [843, 597, 20, "L"], [800, 623, 23, "L"], [767, 647, 27, "L"],
          [827, 660, 23, "S"], [793, 687, 25, "L"], [747, 700, 20, "S"], [853, 703, 23, "S"],
          [783, 730, 27, "P"],
          // floor cluster, pale blue
          [763, 770, 33, "P"], [850, 747, 33, "P"], [827, 780, 30, "P"], [783, 820, 37, "P"],
          [877, 807, 33, "P"], [850, 837, 23, "S"], [737, 837, 20, "S"], [713, 767, 27, "L"],
          [720, 807, 25, "L"], [668, 812, 30, "L"],
        ];
        // (the panel is the parameter now)
        const sLeft = sp.cx - sp.pw / 2, sTop = sp.apexY;
        const sx = sp.pw / 578, sy = (sp.floorY - sp.apexY) / 670, sr = (sx + sy) / 2;
        const sUniq: number[] = [];
        colors.forEach((c, i) => {
          if (!sUniq.some((j) => colors[j].toLowerCase() === c.toLowerCase())) sUniq.push(i);
        });
        const sIsWhite = (hex: string) => {
          const h = hex.replace(/^#/, "");
          return h.length >= 6 && [0, 2, 4].every((k) => parseInt(h.slice(k, k + 2), 16) >= 235);
        };
        const sChrome = sUniq.find((i) => chromeHexSet.has(colors[i].toLowerCase()));
        const sWhite  = sUniq.find((i) => sIsWhite(colors[i]));
        const sRest   = sUniq.filter((i) => i !== sChrome && i !== sWhite);
        const sPool   = sRest.length > 0 ? sRest : sUniq;
        let sLav = 0;
        const sColour = (slot: ShimBalloon[3]): number => {
          if (slot === "S") return sChrome ?? sPool[0];
          if (slot === "P") return sPool[0];
          // The photo's pale lavender is half white, half lilac; with white in
          // the palette the two take turns.
          const k = sLav++;
          if (sWhite !== undefined && k % 2 === 1) return sWhite;
          return sPool[1 % sPool.length];
        };
        const sPlaced = SHIM_REF.map(([x, y, r, slot]) => ({
          bx: side === "right" ? sLeft + (x - 222) * sx : sLeft + sp.pw - (x - 222) * sx,
          by: Math.min(sTop + (y - 165) * sy, sp.floorY + plinthForwardPx - r * sr),
          br: r * sr * 1.15,
          ci: sColour(slot),
        })).sort((m, n) => n.br - m.br);
        for (const b of sPlaced) {
          content.push(`<circle cx=\"${b.bx.toFixed(1)}\" cy=\"${b.by.toFixed(1)}\" r=\"${b.br.toFixed(1)}\" ${balloonAttrs(b.ci)}/>`);
        }
        };

        const drawArchShimmerComposition = (
          archP: typeof layout.panels[0], shimmerP: typeof layout.panels[0], colorOffset: number,
        ): { total: number; accentZone: { xMin: number; xMax: number; yMin: number; yMax: number } } => {
          const shimmerOnRight = shimmerP.cx > archP.cx;
          const archOuterSide: "left" | "right" = shimmerOnRight ? "left" : "right";
          // 2026-09-05: was drawDenseGarland, which is the thin one — the arch
          // ended up with a bead line while the shimmer wall carried the mass,
          // the reverse of what this composition is for. It now takes the same
          // organic mass Single Arch uses, so the arch side reads big and full
          // ("soldaki balonlar daha buyuk ve daha cok olsunlar").
          // Two passes on the same side with different seeds. One pass on this
          // frame left visible holes — measured on the guide, the middle fifth of
          // the column held one balloon against seven lower down, which is the
          // "eksikler" the customer saw. The arch here is small (a 16:9 frame for
          // a 120cm arch beside a 200cm wall) so the absolute radius caps make one
          // walk too sparse to close.
          const archCount = drawThickOrganicMainGarland(archP, archOuterSide, colorOffset, true, false).count
            + drawThickOrganicMainGarland(archP, archOuterSide, colorOffset + 37, true, false).count;

          const dir = shimmerOnRight ? 1 : -1;
          const shimmerNearX = shimmerOnRight ? shimmerP.cx - shimmerP.pw / 2 : shimmerP.cx + shimmerP.pw / 2;
          const shimmerTopY  = shimmerP.apexY;
          // On the shared standard, so the accent cluster beside a shimmer
          // wall is made of the same balloons as every other garland. At
          // pw * 0.11 on a 200cm wall these were 4in balloons.
          const famS   = balloonRadiiPx(shimmerP.widthCm, shimmerP.pw);
          const rLarge = famS.L;
          const rMed   = famS.M;
          const rSmall = famS.S;

          // Standalone accent cluster — elegant, well-composed corner accent,
          // 3 depth lanes for real volume (not a token handful of dots),
          // placed on the shimmer wall's near-top corner only.
          const OX_MIN = 4, OX_MAX = 30, OY_MIN = -9, OY_MAX = 38;
          let accentN = 0;
          const putAccent = (bx: number, by: number, br: number) => {
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" ${balloonAttrs(colorOffset + archCount + accentN)}/>`);
            accentN++;
          };
          // 2026-09-05: was 12. On Arch + Shimmer the two garlands hang off the
          // OUTER edges, and this inner cluster read as a couple of stray
          // balloons floating in the seam between the boards — the customer
          // circled exactly those. The composition is the two outer garlands.
          const accentCount = 0;
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
        const halfArchPanels = layout.panels.filter(
          (p) => (backdropItems[p.idx]?.type ?? "") === "half_arch",
        );

        // 2026-09-09: Triple Arch. The reference is ONE mass: a very full
        // garland running right across the tops of all three boards, plus a
        // dense pile on the floor at each outer end. There is no full-height
        // side garland — the first attempt gave each half arch one and the
        // render read those vertical masses as EXTRA ARCHES, coming back with
        // five boards instead of three. The crown run follows the actual
        // silhouette of whichever board is highest at each x.
        if (halfArchPanels.length === 2 && archPanels.length === 1) {
          // 2026-10-21: REPLAYS the customer's reference (TRIPLE_ARCH_REF):
          // one garland from the floor at the left, up over the left board,
          // across the top of the centre board and down the right board to
          // the floor, with snowflakes along it and five small flat ones on
          // the board faces. In the photo the boards run x 204..562 (top 346),
          // 562..982 (top 255) and 982..1340 (top 350), all on the floor at
          // 825. The photo's centre board stands taller over its sides than
          // ours, so the height scale is the side boards' own out on the
          // sides and the centre board's over it, blended across each join.
          const ordT = [...layout.panels].sort((a, b) => a.cx - b.cx);
          const [tL, tC, tR] = ordT;
          const sSide = ((tL.floorY - tL.apexY) + (tR.floorY - tR.apexY)) / 2 / (825 - 348);
          const sCen  = (tC.floorY - tC.apexY) / (825 - 255);
          // 2026-10-22: the side garlands keep their distance from each side
          // board's OUTER edge at the height scale, as the balloons do. The
          // photo's side boards are nearly square (0.75 wide for their
          // height) and ours are half as wide as tall, so squeezing the photo
          // x into our boards buried them under the garland ("balonlar
          // backdropu sarmis"); this way the inner half of each stays clear.
          const lOut = tL.cx - tL.pw / 2, rOut = tR.cx + tR.pw / 2;
          const tx = refPieceX([
            [204, lOut], [350, Math.min(lOut + 146 * sSide, tC.cx - tC.pw / 2 - 8)],
            [562, tC.cx - tC.pw / 2], [982, tC.cx + tC.pw / 2],
            [1194, Math.max(rOut - 146 * sSide, tC.cx + tC.pw / 2 + 8)], [1340, rOut],
          ], sSide);
          const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
          const tFloor = Math.max(...ordT.map((p) => p.floorY));
          // The y of a photo point depends on which board it rides, so the
          // map is built per balloon: pre-mapping y with its own x.
          const tTable: RefItem[] = TRIPLE_ARCH_REF.map(([x, y, r, slot]) => {
            const w = smooth(470, 600, x) * (1 - smooth(944, 1074, x));
            const sy = sSide + (sCen - sSide) * w;
            return [x, tFloor - (825 - y) * sy, r, slot];
          });
          drawRefTable(tTable, tx, (yy) => yy, sCen,
            { maxBottom: tFloor + plinthForwardPx * 1.5, keepClear: plinthKeepClear() });
        } else if (false as boolean) {
          const ordered = [...layout.panels].sort((a, b) => a.cx - b.cx);
          const leftP  = ordered[0];
          const rightP = ordered[ordered.length - 1];

          // Height of the tallest board at a given x — an arch is a semicircle
          // on straight legs, a half arch is a quarter of one.
          const groupMid = (leftP.cx - leftP.pw / 2 + rightP.cx + rightP.pw / 2) / 2;
          const topYAt = (x: number): number | null => {
            let best: number | null = null;
            for (const p of layout.panels) {
              const l = p.cx - p.pw / 2, r = p.cx + p.pw / 2;
              if (x < l || x > r) continue;
              const type = backdropItems[p.idx]?.type ?? "arch";
              let y: number;
              if (type === "half_arch") {
                const h  = p.floorY - p.apexY;
                const rr = Math.min(p.pw, h);
                const innerX = p.cx <= groupMid ? r : l;
                const dx = Math.min(rr, Math.abs(x - innerX));
                y = p.apexY + rr - Math.sqrt(Math.max(0, rr * rr - dx * dx));
              } else {
                const rr = p.pw / 2;
                const dx = Math.min(rr, Math.abs(x - p.cx));
                y = p.apexY + rr - Math.sqrt(Math.max(0, rr * rr - dx * dx));
              }
              if (best === null || y < best) best = y;
            }
            return best;
          };

          // Sized off the CENTRE board, not the little side one — the customer
          // asked for the reference density ("dolu dolu"), and scaling from the
          // narrow half arch made every balloon a third too small.
          const centreP = ordered[1] ?? leftP;
          const rBig = Math.max(22, Math.min(58, centreP.pw * 0.20));
          const rMid = rBig * 0.68;
          const rLil = rBig * 0.45;
          let cst = 20260909;
          const crnd = () => { cst = (cst * 1664525 + 1013904223) >>> 0; return cst / 4294967296; };
          const areaC = new Array(Math.max(1, colors.length)).fill(0) as number[];
          const pickC = (): number => {
            let b = 0;
            for (let i = 1; i < areaC.length; i++) if (areaC[i] < areaC[b]) b = i;
            return b;
          };
          const placedC: { x: number; y: number; r: number }[] = [];
          const putC = (bx: number, byRaw: number, br: number): void => {
            // The layout leaves only 5% of canvas height above the tallest board,
            // so an unclamped crown lane runs straight off the top and the render
            // fills the clipped strip with junk (the same failure the marquee
            // number had at x = -10).
            const by = Math.max(br + 3, byRaw);
            for (const q of placedC) {
              const dd = Math.hypot(bx - q.x, by - q.y);
              if ((br + q.r - dd) / (2 * Math.min(br, q.r)) > 0.88) return;
            }
            placedC.push({ x: bx, y: by, r: br });
            const ci = pickC();
            areaC[ci] += Math.PI * br * br;
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" ${balloonAttrs(ci)}/>`);
          };

          const runL = leftP.cx - leftP.pw / 2;
          const runR = rightP.cx + rightP.pw / 2;
          const step = rBig * 0.34;
          for (let x = runL; x <= runR; x += step) {
            const ty = topYAt(x);
            if (ty === null) continue;
            // Three lanes: one sitting on the board top, one riding above it,
            // one tucked just below so the run reads as a mass, not a string.
            for (const lane of [0, 1, 2, 3]) {
              const rr = lane === 0 ? rBig * (0.85 + crnd() * 0.35)
                : lane === 1 ? rMid * (0.85 + crnd() * 0.4)
                : lane === 2 ? rLil * (0.85 + crnd() * 0.5)
                : rMid * (0.70 + crnd() * 0.5);
              // 2026-09-09: every lane now sits ON or ABOVE the board's top
              // edge. Two of the four used to hang BELOW it (+0.85 and +1.85 of
              // a radius), which put balloons across the face of the boards —
              // the customer's reference has the garland riding the top edge
              // with the board faces left clean.
              const off = lane === 0 ? -rr * 0.20
                : lane === 1 ? -rr * 1.05
                : lane === 2 ? -rr * 1.95
                : -rr * 0.45;  // 2026-09-09: above the edge too — at +0.45 this
                              // lane still sat on the board faces.
              putC(
                x + (crnd() * 2 - 1) * rMid * 0.55,
                ty + off + (crnd() * 2 - 1) * rLil * 0.5,
                rr,
              );
            }
          }

          // 2026-09-09: heavy clusters over the two JOINS, and one over the
          // centre crown. A uniform band across the tops kept being dropped by
          // the render — it came back as two separate garlands on the side
          // boards with the middle bare — and the customer's reference is in
          // fact thickest exactly at these three points. A localised mass is
          // reproduced where an even strip is not.
          {
            const centreP2 = ordered[1] ?? leftP;
            const joinL = (leftP.cx + leftP.pw / 2 + centreP2.cx - centreP2.pw / 2) / 2;
            const joinR = (centreP2.cx + centreP2.pw / 2 + rightP.cx - rightP.pw / 2) / 2;
            for (const jx of [joinL, centreP2.cx, joinR]) {
              const jy = topYAt(jx);
              if (jy === null) continue;
              for (let i = 0; i < 16; i++) {
                const a3 = crnd() * Math.PI * 2;
                const dd = Math.pow(crnd(), 0.7) * rBig * 1.5;
                const rr = i % 3 === 0 ? rBig * (0.9 + crnd() * 0.3) : rMid * (0.8 + crnd() * 0.5);
                // Biased UPWARD: an even disc around the join spread balloons
                // down over the board faces, which is what the customer keeps
                // circling. Everything sits on or above the top line.
                putC(
                  jx + Math.cos(a3) * dd,
                  jy - Math.abs(Math.sin(a3)) * dd * 0.85 - rr * 0.30,
                  rr,
                );
              }
            }
          }

          // A dense pile on the floor at each outer end, as in the reference —
          // this is where the mass goes instead of down the sides.
          for (const [p, dir] of [[leftP, -1], [rightP, 1]] as const) {
            const edgeX = p.cx + dir * (p.pw / 2);
            for (let i = 0; i < 26; i++) {
              const t  = Math.pow(crnd(), 1.4);
              const ox = dir * (t * p.pw * 0.55) - dir * p.pw * 0.10;
              const up = Math.pow(crnd(), 1.3) * rBig * 3.6;
              putC(
                edgeX + ox + (crnd() * 2 - 1) * rMid * 0.5,
                p.floorY - up - rMid * 0.35,
                i % 4 === 0 ? rBig * 0.95 : rMid * (0.80 + crnd() * 0.55),
              );
            }
          }
        } else if (archPanels.length === 2) {
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
          // Identical call to the Single Arch one below, mirrored per arch —
          // no double-arch-specific parameters at all. Several attempts at
          // special-casing the balloon size here (a 1.4x scale, panel-relative
          // ratios, a high-contrast giant/small lane cycle) all failed; the
          // real difference was the guide canvas, fixed in VIEWBOX.
          const pair = [...archPanels].sort((a, b) => a.cx - b.cx);
          // 2026-09-05: looseSpacing added here too. The customer asked for the
          // Double Arch garland to be arranged like the Single Arch one they
          // approved, and that flag IS the difference between the two: nesting
          // depth 0.55 vs 0.95 of a diameter, giant chance 0.10 vs 0.20,
          // companion chance 0.85 vs 0.75, and a climb step of 0.95-1.25 of a
          // radius vs 0.55-0.80. Double Arch was left on the tighter numbers
          // only because it had been approved earlier.
          // 2026-09-08: giantAnchors off — see the flag. The customer crossed
          // out the single huge balloon at the foot of each leg and asked for
          // the same volume in 12" and 5" balloons.
          // 2026-09-08: each leg is drawn TWICE at different seeds, the trick
          // drawArchShimmerComposition and Arch + Open Frame already use. The
          // customer circled a bare patch halfway up BOTH legs; a single pass
          // leaves a hole wherever its overlap check rejects a candidate, and a
          // second pass with a different seed lands in exactly those holes.
          // 2026-09-09: a THIRD pass per leg. Two passes closed most of the
          // holes but the customer circled a thin stretch halfway up each leg
          // again; every pass rejects candidates that sit too deep inside an
          // existing balloon, so the reliable way to fill what is left is
          // another seed rather than looser packing (looser packing was tried
          // on Arch + Open Frame and thinned the garland into a single chain).
          // 2026-10-21: both replaced by the customer's reference (see
          // DOUBLE_ARCH_LEFT_REF), each table on its own board.
          void drawThickOrganicMainGarland;
          const mL = archContourMap(pair[0], false, { l: 433, r: 760, top: 145, floor: 800, spring: 300 }, DOUBLE_ARCH_LEFT_REF);
          const mR = archContourMap(pair[1], false, { l: 769, r: 1080, top: 239, floor: 800, spring: 311 }, DOUBLE_ARCH_RIGHT_REF);
          const daBottom = layout.floorY + plinthForwardPx * 1.5;
          doubleArchGarlandBalloonsLeft = drawRefTable(mL.table, idMap, idMap, mL.s,
            { maxBottom: daBottom, keepClear: plinthKeepClear() }).length;
          doubleArchGarlandBalloonsRight = drawRefTable(mR.table, idMap, idMap, mR.s,
            { maxBottom: daBottom, keepClear: plinthKeepClear() }).length;
        } else if (framePanel && archPanels.length === 1) {
          // 2026-10-21, customer reference: a solid arch with its garland down
          // its OUTER edge, and an OPEN arch frame — a thick white hollow arch
          // you see the wall through — standing beside it with ITS garland down
          // its outer edge, the plinth centred between. Both are the approved
          // Single Arch statement garland. The old version packed the frame's
          // opening with a balloon cluster, which rendered as a wall of
          // balloons ("arch+open frame diyince bu cikti yanlis").
          // 2026-10-21 (later): both replaced by the customer's newer
          // reference (ARCH_FRAME_ARCH_REF), the arch on the left there;
          // mirrored when ours stands on the right.
          const solidArch = archPanels[0];
          const archLeftOfFrame = solidArch.cx < framePanel.cx;
          const mfa = archContourMap(solidArch, !archLeftOfFrame, { l: 392, r: 736, top: 245, floor: 955, spring: 480 }, ARCH_FRAME_ARCH_REF);
          const mff = archContourMap(framePanel, !archLeftOfFrame, { l: 709, r: 1091, top: 355, floor: 962, spring: 510 }, ARCH_FRAME_FRAME_REF);
          const afOpts = { maxBottom: layout.floorY + plinthForwardPx * 1.5, keepClear: plinthKeepClear() };
          archOpenFrameMainGarlandBalloons = drawRefTable(mfa.table, idMap, idMap, mfa.s, afOpts).length;
          archOpenFrameMiniClusterBalloons = drawRefTable(mff.table, idMap, idMap, mff.s, afOpts).length;
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
          // 2026-10-21: "arch + shimmer cok kotu — son yaptigin shimmer wall
          // gibi olsun ve son yaptigin single arch ile birlestir". The two
          // approved garlands, each on its panel's OUTER edge so they frame the
          // pair: the Single Arch statement garland, and the Shimmer Wall's
          // band-and-column. The bespoke composition this replaces came back as
          // a thin column on the arch and nothing on the shimmer.
          void drawArchShimmerComposition;
          // 2026-10-21: both replaced by the customer's reference
          // (ARCH_SHIMMER_ARCH_REF), the arch on the left there; mirrored when
          // ours stands on the right.
          const archOnLeft = archPanels[0].cx < shimmerPanels[0].cx;
          const aRef = { l: 470, r: 732, top: 133, floor: 810, spring: 300 };
          const wRef = { l: 730, r: 1370, top: 170, floor: 810 };
          const ma = archContourMap(archPanels[0], !archOnLeft, aRef, ARCH_SHIMMER_ARCH_REF);
          const mw = refBoardMapFit(shimmerPanels[0], !archOnLeft, wRef, ARCH_SHIMMER_WALL_REF);
          const asOpts = { maxBottom: layout.floorY + plinthForwardPx * 1.5, keepClear: plinthKeepClear() };
          archShimmerCompositionBalloons =
            drawRefTable(ma.table, idMap, idMap, ma.s, asOpts).length +
            drawRefTable(ARCH_SHIMMER_WALL_REF, mw.x, mw.y, mw.s, asOpts).length;
        } else if (
          layout.panels.length === 1 &&
          (backdropItems[layout.panels[0].idx]?.type ?? "") === "shimmer_wall"
        ) {
          // 2026-10-21: a lone Shimmer Wall REPLAYS the customer's approved
          // render ("son yolladigim render gibi yapalim"). It had no branch of
          // its own and fell to the multi-panel fallback below — a 22-circle
          // single-file column off the right edge — which the render turned
          // into loose helium balloons on strings beside a paper roll.
          //
          // The approved render's garland, read off a grid in its pixels: a
          // band along the top from about a third of the way across, over the
          // right corner, down the right edge to a cluster on the floor. There
          // the wall spans x 222..735 and y 165..835 (its foot on the floor), and
          // the table scales from that rect onto ours. Slots: P pale blue, L pale
          // lavender, S chrome, mapped onto the customer's palette.
          // 2026-10-21: scaled as if that wall ran to x 800 — the centre line of
          // its right column — so the column straddles our wall's right edge
          // instead of standing beside it with a strip of bare wall between
          // ("yesille isaretledigim yerdeki space olmamali").
          // 2026-10-21: replaced by the customer's two-column reference (see
          // SHIMMER_LEFT_REF). The photo is a wide frame with room either side
          // of the columns; ours is square, so what stands out past each edge
          // of the wall is drawn in, by the least that keeps it on the canvas.
          void drawShimmerRefGarland;
          const sp0 = layout.panels[0];
          const ms = refBoardMap(sp0, false, SHIMMER_REF_WALL);
          const visL = -marginX / SCALE + (W * 0.015) / SCALE;
          const visR = (W - marginX) / SCALE - (W * 0.015) / SCALE;
          const wl = sp0.cx - sp0.pw / 2, wr = sp0.cx + sp0.pw / 2;
          let sL = ms.s, sR = ms.s;
          for (const [x, , r, slot] of SHIMMER_LEFT_REF) {
            if (slot !== "F" && x < SHIMMER_REF_WALL.l) sL = Math.min(sL, Math.max(0, (wl - visL - r * ms.s * 1.08) / (SHIMMER_REF_WALL.l - x)));
          }
          for (const [x, , r, slot] of SHIMMER_RIGHT_REF) {
            if (slot !== "F" && x > SHIMMER_REF_WALL.r) sR = Math.min(sR, Math.max(0, (visR - wr - r * ms.s * 1.08) / (x - SHIMMER_REF_WALL.r)));
          }
          const msx = (rx: number) => rx < SHIMMER_REF_WALL.l ? wl + (rx - SHIMMER_REF_WALL.l) * sL
            : rx > SHIMMER_REF_WALL.r ? wr + (rx - SHIMMER_REF_WALL.r) * sR : ms.x(rx);
          const msOpts = { maxBottom: sp0.floorY + plinthForwardPx * 1.5, keepClear: plinthKeepClear() };
          drawRefTable(SHIMMER_LEFT_REF, msx, ms.y, ms.s, msOpts);
          drawRefTable(SHIMMER_RIGHT_REF, msx, ms.y, ms.s, msOpts);
        } else if (
          layout.panels.length === 1 &&
          (backdropItems[layout.panels[0].idx]?.type ?? "") === "balloon_ring"
        ) {
          // Hollow balloon ring: a dense hoop of balloons with a completely open
          // centre. Reuses the banner frame walk's ideas — several lanes of
          // heavily overlapping balloons of mixed size — but around a circle, and
          // biased OUTWARD so nothing creeps into the opening, which is the whole
          // point of the setup (and where the neon sign goes).
          const rp = layout.panels[0];
          // 2026-09-05: the ring was NOT 2 metres. It was sized as half the
          // smaller of the panel box (calculateExactLayout returns 717 x 870 for
          // a 200x200cm ring — it does not preserve a panel's own aspect), which
          // put the balloon centre-line at 165cm while the balloons themselves
          // pushed the finished hoop out to 221cm. The customer asked for a 2m
          // ring, so 2m is what the FINISHED hoop measures — the thing you would
          // put a tape across.
          //
          // 2026-09-05, corrected: the 200cm is the METAL RING itself. The
          // balloons are tied onto that frame and sit outside it, so the finished
          // piece measures more than 2m — the first version targeted the finished
          // hoop instead, which made the frame only 149cm.
          //
          // Everything else in the guide scales off the panel height (the marquee
          // number measures a correct 90cm that way), so the same px-per-cm is
          // used here.
          const ringPxPerCm = ringScenePxPerCm ?? ((rp.floorY - rp.apexY) / Math.max(1, backdropItems[rp.idx]?.heightCm ?? 200));
          const RING_FRAME_CM = backdropItems[rp.idx]?.widthCm ?? 200;
          const ringR = (RING_FRAME_CM / 2) * ringPxPerCm;
          const ringCx = rp.cx;
          const ringCy = rp.floorY - ringR;
          let rst = 777331;
          const rrnd = () => { rst = (rst * 1664525 + 1013904223) >>> 0; return rst / 4294967296; };
          // On the shared standard. The hoop's real width is its diameter,
          // so the families come off that the same way every other layout's
          // come off their panel width.
          const famRing = balloonRadiiPx(RING_FRAME_CM, ringR * 2);
          const rXLr = famRing.X;
          const rLr  = famRing.L;
          const rMr  = famRing.M;
          const rSr  = famRing.S;
          const pickRing = (): number => {
            const roll = rrnd();
            // Big-dominant: large carries the hoop, standard fills between,
            // and the filler is an accent rather than a third of the ring.
            if (roll < 0.14) return rXLr;
            if (roll < 0.66) return rLr;
            if (roll < 0.92) return rMr;
            return rSr;
          };
          const ringPlaced: { x: number; y: number; r: number }[] = [];
          const ringArea = new Array(Math.max(1, colors.length)).fill(0) as number[];
          const ringLast = new Array(Math.max(1, colors.length)).fill(-1) as number[];
          let rn = 0;
          const ringPut = (bx: number, by: number, br: number) => {
            for (const q of ringPlaced) {
              const d = Math.hypot(bx - q.x, by - q.y);
              if ((br + q.r - d) / (2 * Math.min(br, q.r)) > 0.86) return;
            }
            ringPlaced.push({ x: bx, y: by, r: br });
            let best = 0;
            for (let i = 1; i < ringArea.length; i++) {
              const dd = ringArea[i] - ringArea[best];
              if (dd < -1e-6) best = i;
              else if (Math.abs(dd) <= 1e-6 && ringLast[i] < ringLast[best]) best = i;
            }
            ringArea[best] += Math.PI * br * br;
            ringLast[best] = rn;
            content.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" ${balloonAttrs(best)}/>`);
            rn++;
          };
          // 2026-10-21: HALF replays the customer's reference — a bare gold
          // hoop with the garland covering it from about 1 o'clock, over the
          // top, down the whole left side and into a heavy foot that spreads
          // along the floor to about 5 o'clock; the right of the hoop stays
          // bare. Read off a grid over the photo: there the hoop is centred at
          // (525, 670) with a radius of 387. Slots: S chrome, W white, P pale
          // blue, L lilac, K pink — K shares lilac's colour on a short palette.
          // 2026-10-21 (later): both dressings REPLAY the customer's newer
          // reference (see "Reference replays"). HALF: a bare hoop on the
          // left, the garland from about 10 o'clock over the top and down the
          // whole right side to a foot on the floor. FULL: the garland right
          // round the hoop from floor to floor, open only at the bottom where
          // the plinth stands. Snowflakes along both. In the half photo the
          // hoop is centred at (425, 396) with a radius of 223, in the full
          // one at (1500, 365) with a radius of 260.
          const HALF_RING_REF: RefItem[] = [
            [257, 172, 38, "C"], [318, 138, 23, "B"], [399, 118, 65, "W"], [384, 199, 23, "L"],
            [418, 192, 15, "S"], [457, 176, 27, "B"], [476, 111, 23, "W"], [495, 126, 15, "L"],
            [476, 145, 15, "B"], [480, 207, 23, "W"], [511, 168, 31, "S"], [538, 138, 35, "L"],
            [565, 161, 15, "W"], [565, 184, 23, "L"], [526, 222, 27, "W"], [630, 130, 42, "C"],
            [588, 253, 38, "W"], [595, 199, 15, "L"], [672, 222, 54, "B"], [626, 276, 23, "W"],
            [626, 330, 23, "B"], [649, 376, 27, "W"], [634, 318, 14, "L"], [770, 311, 35, "C"],
            [724, 353, 27, "L"], [701, 388, 19, "S"], [739, 388, 15, "B"], [778, 399, 35, "C"],
            [731, 422, 27, "W"], [651, 426, 19, "B"], [689, 453, 31, "L"], [612, 484, 46, "C"],
            [782, 507, 73, "B"], [620, 534, 35, "W"], [628, 545, 23, "S"], [532, 576, 38, "C"],
            [578, 576, 27, "L"], [608, 599, 23, "W"], [735, 607, 38, "W"], [658, 618, 31, "L"],
            [578, 622, 23, "B"], [612, 630, 15, "S"], [785, 618, 15, "S"], [658, 568, 14, "W"],
            [330, 184, 46, "F"], [676, 322, 35, "F"], [685, 538, 54, "F"],
          ];
          const FULL_RING_REF: RefItem[] = [
            // over the top
            [1406,  95, 52, "L"], [1506,  43, 38, "C"], [1492, 124, 38, "W"], [1659, 100, 57, "B"],
            [1530, 157, 24, "S"], [1616, 186, 19, "S"], [1368, 167, 24, "W"], [1454, 152, 17, "B"],
            [1325, 133, 29, "C"], [1601, 195, 22, "W"], [1749, 167, 38, "C"], [1687, 176, 24, "L"],
            [1320, 157, 24, "L"], [1320, 243, 38, "W"], [1201, 205, 33, "C"], [1216, 276, 38, "L"],
            [1263, 243, 17, "B"], [1287, 286, 14, "B"], [1682, 238, 33, "W"], [1725, 252, 19, "S"],
            [1701, 300, 33, "W"], [1549, 186, 19, "S"],
            [1568, 119, 38, "F"], [1273, 176, 38, "F"], [1716, 200, 43, "F"], [1778, 295, 38, "F"],
            // down the left side
            [1261, 262, 17, "B"], [1276, 327, 35, "S"], [1157, 350, 38, "C"], [1261, 388, 27, "W"],
            [1207, 419, 27, "B"], [1280, 423, 23, "W"], [1299, 465, 54, "L"], [1126, 465, 50, "C"],
            [1222, 465, 23, "S"], [1184, 488, 31, "W"], [1230, 527, 38, "W"], [1130, 565, 73, "L"],
            [1361, 519, 38, "C"], [1284, 512, 15, "B"], [1322, 538, 15, "B"], [1315, 581, 38, "S"],
            [1368, 565, 27, "L"], [1380, 596, 23, "W"], [1203, 635, 23, "W"], [1253, 627, 23, "B"],
            [1292, 635, 19, "B"], [1334, 635, 14, "S"],
            [1215, 358, 46, "F"], [1234, 573, 42, "F"],
            // down the right side
            [1810, 258, 58, "B"], [1812, 340, 28, "L"], [1856, 352, 36, "C"], [1740, 396, 40, "W"],
            [1792, 396, 20, "S"], [1848, 420, 36, "W"], [1896, 416, 32, "C"], [1800, 460, 40, "S"],
            [1684, 456, 36, "C"], [1880, 480, 20, "W"], [1748, 532, 32, "L"], [1880, 556, 76, "B"],
            [1664, 556, 48, "W"], [1788, 524, 17, "S"], [1776, 564, 20, "W"], [1736, 616, 24, "S"],
            [1836, 628, 24, "L"], [1704, 616, 16, "B"],
            [1700, 460, 48, "F"], [1800, 584, 44, "F"],
          ];
          if (extras?.ringStyle === "half" || extras?.ringStyle === "full" || !extras?.ringStyle) {
            const half = extras?.ringStyle === "half";
            const [rcx, rcy, rr0] = half ? [425, 396, 223] : [1500, 365, 260];
            const hs = ringR / rr0;
            const tbl = half ? HALF_RING_REF : FULL_RING_REF;
            // What spills out past the hoop at the sides is drawn in, by the
            // least amount that keeps it on the canvas (as on the round).
            const vL = -marginX / SCALE + (W * 0.015) / SCALE, vR = (W - marginX) / SCALE - (W * 0.015) / SCALE;
            const limU = Math.min(ringCx - vL, vR - ringCx) / ringR;
            let sq = 1;
            for (const [x, , r, slot] of tbl) {
              if (slot === "F") continue;
              const u = Math.abs(x - rcx) / rr0, rr = (r * 1.08) / rr0;
              if (u > 1 && u + rr > limU) sq = Math.min(sq, Math.max(0, (limU - rr - 1) / (u - 1)));
            }
            const ux = (x: number) => {
              const u = (x - rcx) / rr0;
              return ringCx + ringR * (Math.abs(u) > 1 ? Math.sign(u) * (1 + (Math.abs(u) - 1) * sq) : u);
            };
            drawRefTable(tbl, ux, (y) => ringCy + (y - rcy) * hs, hs,
              { maxBottom: rp.floorY + plinthForwardPx, keepClear: plinthKeepClear() });
          }
          void ringPut; void pickRing;
          let ang = 0;
          let ringGuard = 0;
          // 2026-09-09: "half" dresses the ring the way the customer's own
          // Instagram post does — a bare gold metal hoop with the garland
          // covering one side of it only. The hoop is drawn FIRST so the
          // balloons overlap it, and the walk runs over an arc instead of the
          // full circle: from upper-left, over the top, down the right and into
          // a pile at the bottom right.
          const ringHalf = extras?.ringStyle === "half";
          const ringBare = extras?.ringStyle === "none";
          const angFrom = ringHalf ? (-175 * Math.PI) / 180 : 0;
          const angTo   = ringHalf ? (60 * Math.PI) / 180 : Math.PI * 2;
          // The hoop itself is drawn earlier, outside this dispatch — see the
          // ringStyle block above layout-panel drawing.
          ang = angFrom;
          // 2026-10-21 (later): FULL is the reference replay above now.
          while (false && !ringBare && !ringHalf && ang < angTo && ringGuard++ < 400) {
            const r1 = pickRing();
            // Offsets are >= 0 measured outward from the ring line, so the
            // opening stays clear.
            // 2026-10-21: FULL is fully dressed — "ringin tamami balonla
            // dolmali". The walk used to put balloons only OUTSIDE the hoop
            // line, one to three deep and often fewer, which rendered as a thin
            // bead necklace round the frame. Lanes now straddle the hoop, one
            // inside it as well as two outside, every one placed, so the hoop
            // disappears under a thick wreath while the middle stays open.
            for (const [mul, scale] of [[-0.85, 0.8], [0.1, 1], [0.95, 0.85], [1.7, 0.6]] as [number, number][]) {
              if (mul > 1.5 && rrnd() > 0.7) continue;
              const rr = r1 * scale;
              const rad = ringR + rr * mul;
              const a2 = ang + (rrnd() * 0.10 - 0.05);
              ringPut(ringCx + rad * Math.cos(a2), ringCy + rad * Math.sin(a2), rr);
            }
            ang += (r1 * (0.48 + rrnd() * 0.22)) / ringR;
          }

          // The half-wrapped ring ends in a pile on the floor at the bottom
          // right, as in the reference — the garland runs off the hoop and
          // spreads out on the ground rather than stopping in mid-air.
          if (false && ringHalf && !ringBare) {
            for (let i = 0; i < 18; i++) {
              const t  = Math.pow(rrnd(), 1.3);
              const ox = ringR * (0.30 + t * 0.95);
              const up = Math.pow(rrnd(), 1.25) * rLr * 3.0;
              ringPut(
                ringCx + ox + (rrnd() * 2 - 1) * rMr * 0.6,
                rp.floorY - up - rMr * 0.3,
                i % 4 === 0 ? rXLr * 0.9 : rLr * (0.75 + rrnd() * 0.5),
              );
            }
          }
        } else if (
          layout.panels.length === 1 &&
          (backdropItems[layout.panels[0].idx]?.type ?? "") === "banner"
        ) {
          // 2026-09-05: a single Banner takes the Single Arch garland. Without
          // this it fell to the multi-panel fallback below — a 22-circle
          // sine-wave column — and the render turned that thin bead line into a
          // garland wrapping the whole banner, which is not what the setup sells.
          //
          // The garland must be measured against the SQUARE, not against the
          // layout rect. calculateExactLayout hands back 717 x 870 for a 2x2m
          // banner (it fits width and height to separate fractions of the
          // canvas), and panelShape builds the square from min(pw, height) —
          // so the board top is 154px BELOW layout.apexY. Passing the layout
          // panel straight in climbed the garland against a board 154px taller
          // than the one actually drawn, which is why the top band floated above
          // the banner and the sides stopped short of the floor.
          const bp = layout.panels[0];
          const bSide = Math.min(bp.pw, bp.floorY - bp.apexY);
          // 2026-10-21: the banner REPLAYS the customer's reference photo
          // ("make the balloon amount and locations exactly like the other
          // balloon reference") instead of walking a frame round the board:
          // a crown over the top right corner that runs down the whole right
          // edge to the floor, and a separate cluster from just under halfway
          // down the left edge to the floor. Big balloons with small grape
          // clusters tucked against them; the rest of the board stays clear.
          // Same method as the round (see ROUND_REF): balloons read off a grid
          // over the photo, in its pixels. There the board's top left corner is
          // at (140, 195) and the floor 445px below it; everything scales from
          // that square onto ours. Slots are the photo's colours — W white,
          // S chrome, B light blue, T dark teal, L lilac, D dusty pink — and
          // map onto the customer's palette below. The photo's four silver
          // star foils are not drawn.
          void drawBannerFrameGarland;
          // 2026-10-21: now the customer's lavender and blue banner (see
          // "Reference replays"): a band along the top from about a third of
          // the way across, over the top right corner and down the whole right
          // edge to the floor, with seven snowflakes along it; the left of the
          // board stays clear for the print. In that photo the board runs
          // x 76..1064, from y 136 to the floor at 1091.
          const BANNER_REF: RefItem[] = [
            // along the top
            [380, 120, 35, "L"], [576,  66, 88, "B"], [568, 178, 46, "W"], [445, 185, 38, "W"],
            [507, 166, 19, "S"], [503, 212, 31, "W"], [465, 208, 12, "B"], [684, 132, 42, "S"],
            [722,  66, 42, "C"], [792, 120, 35, "W"], [868, 128, 35, "C"], [630, 158, 15, "B"],
            [634, 185, 14, "B"], [749, 185, 27, "W"], [761, 147, 19, "B"], [799, 170, 23, "L"],
            [622, 258, 35, "L"], [668, 212, 23, "B"], [576, 255, 19, "B"], [541, 228, 17, "L"],
            [726, 285, 15, "B"], [676, 166, 15, "W"],
            [449, 116, 58, "F"], [707, 232, 62, "F"],
            // over the corner and down the right edge
            [ 850, 280, 88, "B"], [1028, 217, 81, "W"], [ 920, 163, 46, "C"], [1143, 332, 58, "C"],
            [1058, 355, 42, "S"], [ 997, 317, 27, "L"], [ 958, 325, 19, "L"], [ 958, 286, 15, "B"],
            [1001, 352, 15, "W"], [ 943, 402, 65, "W"], [1039, 432, 27, "S"], [1182, 478, 54, "B"],
            [ 982, 486, 46, "W"], [1028, 471, 15, "B"], [ 982, 536, 17, "S"], [1039, 548, 38, "L"],
            [1105, 602, 58, "L"], [ 958, 609, 50, "B"], [1074, 394, 15, "B"], [1051, 670, 50, "S"],
            [1178, 716, 62, "C"], [ 966, 720, 38, "L"], [ 920, 728, 19, "S"], [1035, 735, 17, "W"],
            [ 997, 785, 54, "W"], [1120, 762, 50, "W"], [1078, 828, 31, "B"], [1128, 828, 19, "S"],
            [1189, 820, 42, "L"], [1028, 866, 38, "L"],
            [ 847, 436, 42, "F"], [1112, 494, 73, "F"], [ 920, 889, 62, "F"],
            // the foot
            [1135, 962,115, "B"], [ 970, 966, 35, "S"], [ 866,1024, 88, "L"], [1028,1028, 38, "W"],
            [1081,1082, 42, "L"], [1020,1105, 23, "B"], [ 935,1005, 17, "S"],
            [ 958,1062, 58, "F"],
          ];
          const bLeft = bp.cx - bSide / 2;
          const bs = bSide / (1091 - 136);
          const bx0 = refPieceX([[76, bLeft], [1064, bLeft + bSide]], bs);
          const bKept = drawRefTable(BANNER_REF, bx0, (ry) => bp.floorY - (1091 - ry) * bs, bs, {
            maxBottom: bp.floorY + plinthForwardPx + bSide * 0.03,
            keepClear: plinthKeepClear(),
          });
          for (const b of bKept) {
            bannerPrintHoles.push(`<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${(b.r * (b.slot === "F" ? 0.8 : 1.03)).toFixed(1)}" fill="#000000"/>`);
          }
        } else if (archPanels.length === 1 && layout.panels.length === 1) {
          // Single arch: use the same thick organic mass the Double Arch
          // garlands use. The previous guide here was a single-file sine-wave
          // column of 22 circles, which the edit model reproduced with visibly
          // thin, gappy stretches (2026-07-20 feedback: "balloons have very
          // thin parts, should look fuller").
          // 2026-09-09: giantAnchors OFF here too. The three 36" statement
          // balloons seated in the floor mound came back as enormous white
          // spheres parked at the foot of the arch — the same thing the
          // customer crossed out on Double Arch on 2026-09-08, reported again
          // here as "single arch backdrop asiri kotu olmus balonlar". The
          // volume low down now comes from the bottom-heavy climb alone.
          // 2026-09-09: giantAnchors back ON. Turning them off on 2026-09-08 was
          // meant to fix "balonlar asiri kotu", and it made the arrangement worse
          // — the customer asked for the previous behaviour back by name. The
          // giant balls they crossed out on Double Arch are a Double Arch
          // problem; Single Arch was approved WITH them.
          // 2026-09-09: rebuilt to the customer's Elsa reference — top cluster,
          // heavy top-right corner, vertical cascade down the right side.
          //
          // The left mirror is GONE. Full/Premium used to repeat the whole mass
          // on the left edge, and with a crown on both shoulders that reads as a
          // near-complete rectangular border round the board — the exact thing
          // the customer rejected. The extra coverage those tiers sell is now
          // spent on the right, where the reference puts it: a second pass at a
          // different seed thickens the same cascade instead of opening a second
          // one opposite it.
          // 2026-09-10: the lone arch no longer generates its garland — it
          // REPLAYS the customer's reference composition (see
          // REFERENCE_LONE_ARCH above). They asked for a near one-to-one copy
          // of a specific photo, and tuning a generator kept producing a
          // different-but-plausible garland instead. The tier no longer adds a
          // second pass: the reference is one specific arrangement, and
          // doubling it would stop being that arrangement.
          void drawLoneArchStatementGarland;
          drawSingleArchRef(archPanels[0], "right");
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
  // Right-hand edge of the reserved standee band, so the marquee number can be
  // placed on the LEFT of the setup without landing on top of the character.
  let standeeBandRightPx: number | null = null;

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
    const standeeBandStart = curRight;

    for (const standee of standeesToDraw) {
      const heightPx = Math.round(standee.heightCm * pxPerCm);
      const widthPx  = Math.max(28, Math.round(heightPx * 0.22));
      const cx       = curRight - widthPx / 2;

      // Don't draw off the left canvas edge
      if (cx - widthPx / 2 < 4) break;

      // 2026-09-09: no footprint haze when a marquee number is in the scene.
      // A tall pale upright shape beside a described marquee number is read as
      // ANOTHER number — the render came back with one on each side, the same
      // failure the old rectangular placeholder caused on 2026-09-08. The left
      // floor is protected by the front-loaded ban instead.
      if (!extras?.numberLight?.enabled) content.push(standeeGuide(cx, floorY, heightPx, standee.label));
      cutoutPlaceholderHeightsCm.push(standee.heightCm);
      standeeBandRightPx = standeeBandStart;
      curRight = cx - widthPx / 2 - betweenGap;
    }
  }

  // ── Florals and greenery worked into the garland ─────────────────────────
  // 2026-09-08: rewritten. The first version drew a thin stem with a few small
  // sage leaves next to about a quarter of the balloons — roughly 25px of
  // hairline detail beside a 60px balloon — and the customer's report was
  // simply "hicbisi gelmiyor": not one of them survived into the render. Faint
  // thin markers get dropped by this pipeline; filled, high-contrast ones get
  // reproduced (the plinthFilledCylinder precedent).
  //
  // What is drawn now matches the reference the customer sent: a big floral
  // cluster mounded at the FOOT of each garland, plus a few medium clusters
  // tucked in up the climb. A cluster is a real flower shape — radiating sage
  // leaves, then blooms built from six petals around a yellow centre — never a
  // pale circle, which would just read as another balloon.
  if (extras?.florals && balloonStyle !== "none") {
    const balloons = content
      .map((el) => /<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/.exec(el))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({ x: +m[1], y: +m[2], r: +m[3] }));

    let fst = 20260905;
    const frnd = () => { fst = (fst * 1664525 + 1013904223) >>> 0; return fst / 4294967296; };

    const LEAF = "#8FA68A", LEAF_D = "#6E8A6B";
    const BLOOMS = ["#FFFFFF", "#FCF4E4", "#F6E1E7", "#F2E9D8", "#E9E1F1"];

    const floralCluster = (cx: number, cy: number, R: number): void => {
      const leafN = 8 + Math.floor(frnd() * 5);
      for (let i = 0; i < leafN; i++) {
        const a  = (i / leafN) * Math.PI * 2 + frnd() * 0.5;
        const d  = R * (0.55 + frnd() * 0.60);
        const lx = cx + Math.cos(a) * d;
        const ly = cy + Math.sin(a) * d * 0.85;
        const lr = R * (0.15 + frnd() * 0.10);
        content.push(
          `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="${(lr * 2.1).toFixed(1)}" ry="${lr.toFixed(1)}" ` +
          `transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${lx.toFixed(1)} ${ly.toFixed(1)})" ` +
          `fill="${i % 2 === 0 ? LEAF : LEAF_D}"/>`,
        );
      }
      const bloomN = 5 + Math.floor(frnd() * 4);
      for (let i = 0; i < bloomN; i++) {
        const a   = frnd() * Math.PI * 2;
        const d   = R * frnd() * 0.62;
        const bx  = cx + Math.cos(a) * d;
        const by  = cy + Math.sin(a) * d * 0.85;
        const br  = R * (0.20 + frnd() * 0.16);
        const hex = BLOOMS[Math.floor(frnd() * BLOOMS.length)];
        // Six petals round a centre. A single pale circle here read as a small
        // balloon, which is the one thing a flower marker must not look like.
        for (let p = 0; p < 6; p++) {
          const pa = (p / 6) * Math.PI * 2;
          content.push(
            `<circle cx="${(bx + Math.cos(pa) * br * 0.62).toFixed(1)}" cy="${(by + Math.sin(pa) * br * 0.62).toFixed(1)}" ` +
            `r="${(br * 0.52).toFixed(1)}" fill="${hex}" stroke="rgba(150,140,130,0.40)" stroke-width="0.8"/>`,
          );
        }
        content.push(
          `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${(br * 0.30).toFixed(1)}" fill="#E8C86A"/>`,
        );
      }
    };

    // Split the balloons into their separate garlands by looking for a wide
    // horizontal gap — on Double Arch that separates the two legs cleanly, and
    // on a single garland it simply yields one group.
    const byX = [...balloons].sort((a, b) => a.x - b.x);
    const groups: { x: number; y: number; r: number }[][] = [];
    if (byX.length > 0) {
      let cur = [byX[0]];
      for (let i = 1; i < byX.length; i++) {
        if (byX[i].x - byX[i - 1].x > W * 0.07) { groups.push(cur); cur = []; }
        cur.push(byX[i]);
      }
      groups.push(cur);
    }

    for (const g of groups) {
      if (g.length < 6) continue;
      const radii  = [...g].map((b) => b.r).sort((a, b) => a - b);
      const medianR = radii[Math.floor(radii.length / 2)];
      const byY    = [...g].sort((a, b) => a.y - b.y);
      const topY   = byY[0].y;
      const botY   = byY[byY.length - 1].y;

      // 2026-09-09: ONE size of cluster, and it is the SMALL one. The first
      // version had a big cluster at the foot and small ones up the climb, and
      // the customer circled the ones they wanted kept — which turned out to be
      // the SMALL markers, not the big ones. Enlarging everything to match the
      // big ones was tried first and made it worse: every cluster came back as
      // the flat schematic rosette. Same rule as everywhere else on this
      // pipeline — a big literal marker gets copied literally, a smaller one
      // gets elaborated, and elaborated is what a loose rose-and-eucalyptus
      // bunch needs.
      const foot = byY[byY.length - 1];
      floralCluster(foot.x, foot.y + medianR * 0.25, medianR * 0.95);

      // Three more of the same, spaced up the climb — the topmost sits on the
      // shoulder, which is where the customer's marked ones were.
      for (const frac of [0.05, 0.38, 0.68]) {
        const targetY = topY + (botY - topY) * frac;
        let best = byY[0];
        let bestD = Infinity;
        for (const b of byY) {
          const dd = Math.abs(b.y - targetY);
          if (dd < bestD) { bestD = dd; best = b; }
        }
        const a = frnd() * Math.PI * 2;
        floralCluster(
          best.x + Math.cos(a) * best.r * 0.7,
          best.y + Math.sin(a) * best.r * 0.7,
          Math.max(medianR * 0.72, best.r * 0.85),
        );
      }
    }
  }

  // ── Neon LED sign ────────────────────────────────────────────────────────
  // Script lettering with a glow, on the panel face — or in the middle of a
  // balloon ring, which is the setup it was asked for. Drawn with a strong
  // stroke for the same reason the marquee number is: a faint marker on the
  // white ground gets dropped from the render.
  const neonWords = String(extras?.neonSign?.text ?? "").replace(/[<>&]/g, "").trim().slice(0, 40);
  if (extras?.neonSign?.enabled && neonWords.length > 0 && layout.panels.length > 0) {
    // 2026-10-22: on the panel the customer chose — it was always the first
    // panel, which on Arch + Shimmer put the sign on the arch.
    const wantIdx = Number.isInteger(extras?.neonSign?.panelIndex) ? Number(extras?.neonSign?.panelIndex) : 0;
    const np = layout.panels.find((p) => p.idx === wantIdx) ?? layout.panels[0];
    const isRing = (backdropItems[np.idx]?.type ?? "") === "balloon_ring";
    const panelH = np.floorY - np.apexY;
    const cxN = np.cx;
    // 2026-09-05: back to dead centre of the ring. It was raised because the
    // plinth stood in the middle of the hoop; the plinth is forward of the decor
    // now, so the middle of the opening is free.
    const ringR2 = (Math.max(1, backdropItems[np.idx]?.widthCm ?? 200) / 2)
      * (ringScenePxPerCm ?? (panelH / Math.max(1, backdropItems[np.idx]?.heightCm ?? 200)));
    // 2026-10-22: on the ring, above the middle — at the centre it sat right
    // on top of the 90cm plinth and rendered as a cake topper standing on it.
    const cyN = isRing ? np.floorY - ringR2 * 1.30 : np.apexY + panelH * 0.34;
    const words = neonWords.split(" ").filter(Boolean);
    // 2026-10-22: two words go on two lines, as in the customer's shimmer
    // references. Drawn on one line, the render broke it in two itself and
    // spelled "Happy Happthday".
    const lines = words.length >= 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [neonWords];
    const widest = Math.max(...lines.map((l) => l.length));
    // 2026-09-05: sized from the REAL product, not from a fraction of the panel.
    // The sign is 16.5 x 12 inches — about 42cm wide — and the guide was drawing
    // it at up to 62% of a 200cm board, i.e. roughly three times life size.
    // Panel width in px over panel width in cm gives px-per-cm; 42cm of that is
    // the sign, and the font follows from how many characters share the widest
    // line. Capped so a long phrase on one line still fits the board.
    const SIGN_W_CM = 42;
    const pxPerCm = np.pw / Math.max(1, backdropItems[np.idx]?.widthCm ?? 200);
    // 2026-10-22: on a shimmer wall the sign is the size the customer's
    // shimmer references show — about 40% of the wall across.
    const onShimmer = (backdropItems[np.idx]?.type ?? "") === "shimmer_wall";
    const signW = onShimmer ? np.pw * 0.40 : isRing ? ringR2 * 0.72 : Math.min(np.pw * 0.62, SIGN_W_CM * pxPerCm);
    const fontSize = Math.max(9, Math.min(signW / Math.max(1, widest) / 0.46, signW * 0.42));
    const lineGap = fontSize * 1.22;
    const firstY = cyN - ((lines.length - 1) * lineGap) / 2;
    // 2026-10-22: on the lone ring the sign is NOT drawn into the guide; it
    // is laid over the finished render instead (neonOverlaySvg). Left to the
    // model it came back as a flat yellow or white cut-out standing on the
    // pedestal, or not at all ("bu isik gibi durmuyor"); drawn here it is a
    // lit sign with its glow, spelled exactly, every time.
    const target = isRing ? neonOverlayLayer : content;
    if (isRing) {
      neonOverlayLayer.push(`<defs><filter id="nGlowWide" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="${(fontSize * 0.42).toFixed(1)}"/></filter>` +
        `<filter id="nGlow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${(fontSize * 0.10).toFixed(1)}"/></filter></defs>`);
    }
    lines.forEach((ln, i) => {
      const y = firstY + i * lineGap;
      // A path from the embedded script font, not <text>: the rasteriser on
      // Vercel has no fonts and drew empty boxes (2026-10-20).
      const d = textPathD(ln, "script", cxN, y, fontSize);
      // Halo first, then the tube — reads as a glowing sign rather than as text.
      // 2026-10-22: a soft blurred warm-white glow, not a solid yellow band —
      // the solid band rendered as a yellow cardboard sign ("bu isik gibi
      // durmuyor").
      if (isRing) {
        // Light spill on the wall, the tube's own halo, then the white-hot tube.
        target.push(`<path d="${d}" fill="none" stroke="#FFD9A0" stroke-width="${(fontSize * 0.55).toFixed(1)}" stroke-linejoin="round" opacity="0.55" filter="url(#nGlowWide)"/>`);
        target.push(`<path d="${d}" fill="#FFE7BD" stroke="#FFE7BD" stroke-width="${(fontSize * 0.16).toFixed(1)}" stroke-linejoin="round" opacity="0.95" filter="url(#nGlow)"/>`);
        target.push(`<path d="${d}" fill="#FFFDF7" stroke="#FFFDF7" stroke-width="${(fontSize * 0.035).toFixed(1)}" stroke-linejoin="round"/>`);
        return;
      }
      if (i === 0) content.push(`<defs><filter id="neonGlow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${(fontSize * 0.12).toFixed(1)}"/></filter></defs>`);
      content.push(`<path d="${d}" fill="none" stroke="#FFF1D2" stroke-width="${(fontSize * 0.30).toFixed(1)}" stroke-linejoin="round" opacity="0.95" filter="url(#neonGlow)"/>`);
      // 2026-09-05: the tube used to be stroked in gold-brown, which is what the
      // guide showed and, on the shimmer setups, what the render picked up. The
      // sign is warm WHITE, so the marker is too — a pale warm outline, not gold.
      content.push(`<path d="${d}" fill="#FFFFFF" stroke="#FFFDF6" stroke-width="${Math.max(2, fontSize * 0.06).toFixed(1)}" stroke-linejoin="round"/>`);
    });
  }

  // ── Light-up marquee number ──────────────────────────────────────────────
  // A block digit with bulbs set into its face, standing on the floor beside the
  // decor.
  const numDigits = String(extras?.numberLight?.value ?? "").replace(/[^0-9]/g, "").slice(0, 2);
  if (extras?.numberLight?.enabled && numDigits.length > 0 && layout.panels.length > 0) {
    const tallest = layout.panels.reduce((a, b) => (b.floorY - b.apexY > a.floorY - a.apexY ? b : a));
    const panelH = tallest.floorY - tallest.apexY;
    // 2026-09-05: sized from real centimetres rather than a fraction of the
    // panel. The unit is 90cm tall, so against a 220cm arch it is 41% of the
    // panel and against a 200cm ring 45% — the old flat 0.45 was drawing it
    // over-tall on the taller boards.
    const NUMBER_H_CM = 90;
    const pxPerCmN = ringScenePxPerCm ?? (panelH / Math.max(1, backdropItems[tallest.idx]?.heightCm ?? 200));
    const digitH = NUMBER_H_CM * pxPerCmN;
    const digitW = digitH * 0.60;
    const gap = digitW * 0.14;
    const groupW = digitW * numDigits.length + gap * (numDigits.length - 1);
    // Where it stands. Rewritten 2026-09-09 after the number kept landing on a
    // plinth: the old code compared the digit's whole BOX against the plinth,
    // and the box is far wider than the glyph inside it (a "1" in Arial Black
    // fills under half of it). On a portrait Single Arch frame that made a
    // perfectly good slot look impossible, so the digit got squeezed against a
    // column instead. The test now uses the glyph's own width, and the number is
    // centred in whichever floor span is actually free.
    // 2026-09-09 (later): the number goes on the OPPOSITE side from the
    // character — "number bir tarafta cutout bir tarafta olmali". Standees are
    // always composited on the left, so a cutout in the scene sends the number
    // right, on every layout. The ring already did this; now they all do.
    const hasStandees = (cutoutGuideItems ?? []).length > 0;
    const numberGoesRight = hasStandees;
    const glyphW  = digitH * 0.46 * numDigits.length + gap * (numDigits.length - 1);
    const margin  = digitH * 0.10;
    const leftBound  = standeeBandRightPx !== null ? standeeBandRightPx + margin : margin;
    const plinthL = plinthDrawnLeftPx  ?? null;
    const plinthR = plinthDrawnRightPx ?? null;
    // Free floor spans either side of the plinth row.
    const spanLeft  = { from: leftBound, to: plinthL !== null ? plinthL - margin : tallest.cx };
    const spanRight = { from: plinthR !== null ? plinthR + margin : tallest.cx, to: W - margin };
    const fits = (sp: { from: number; to: number }) => sp.to - sp.from >= glyphW;
    const preferRight = numberGoesRight;
    let span = preferRight
      // With a character in the scene the side is not negotiable: the number
      // stays right even if that span is the tighter of the two, because
      // sharing the left with the standee is what went wrong.
      ? spanRight
      : (fits(spanLeft) ? spanLeft : spanRight);
    if (!preferRight && !fits(spanLeft) && !fits(spanRight)) {
      // Neither side can take it — use the wider one and let it sit as clear as
      // the frame allows.
      span = (spanLeft.to - spanLeft.from) >= (spanRight.to - spanRight.from) ? spanLeft : spanRight;
    }
    const spanCx = (span.from + span.to) / 2;
    // Lone round with a character: mirrored opposite it (loneRoundNumberRect).
    // The centre of the free span used before put the digit across the middle
    // of the right-hand balloon cluster, and the render dropped it.
    const startX = loneRoundNumberRect
      ? loneRoundNumberRect.x
      : Math.max(
          margin,
          Math.min(spanCx - groupW / 2, W - groupW - margin),
        );
    // Stepped FORWARD of the backdrop's own floor line, the way the plinth is —
    // otherwise the digit is drawn inside the garland's floor cluster and the
    // render cannot tell the two apart. On the lone round it stands at the
    // plinth's own depth, 50cm out, level with the character's feet: the
    // round's floor balloons now reach forward almost that far.
    const baseY = loneRoundNumberRect
      ? loneRoundNumberRect.baseY
      : tallest.floorY + (tallest.floorY - tallest.apexY) * 0.05;
    for (let d = 0; d < numDigits.length; d++) {
      const x = startX + d * (digitW + gap);
      const y = baseY - digitH;
      // 2026-09-05: the surrounding rounded rect is gone. Drawn as a rect with a
      // digit inside and bulbs around its border, the render sometimes copied it
      // literally — a rectangular light-box plaque with a number cut out of it,
      // instead of a free-standing digit. Without the rect there is nothing to
      // read as a plaque. The bulbs go in the prompt, which describes them as
      // recessed into the digit's own face.
      // 2026-09-09: pushed into plinthLayer, not content. content is drawn
      // FIRST and the plinth layer last, so a digit standing next to a solid
      // plinth marker was being painted over by it — which is one more reason
      // the render kept fusing the two.
      //
      // 2026-09-09, two corrections:
      //
      // HEIGHT. font-size is the EM box, not the glyph. A digit's cap height in
      // Arial Black is about 0.72 em, so setting font-size to the 90cm height
      // drew a numeral roughly 65cm tall — it has never actually been 90cm
      // against the plinth beside it. The font is now scaled so the CAP HEIGHT
      // is the 90cm figure.
      //
      // SHAPE. A "1" set in a typeface is a thin stroke with a small flag, and
      // the render kept turning it into something curved and shapeless. A real
      // marquee 1 is a wide vertical body, an angled head and a flat base bar
      // it stands on, so that one is drawn as an explicit path with its bulbs
      // in it. Every other digit stays type, which renders correctly.
      const glyph = numDigits[d];
      if (singleRound) {
        plinthLayer.push(marqueeBlockDigit(glyph, x, y, digitW, digitH, d === 0, marqueeBulbsLayout));
        continue;
      }
      if (glyph === "1") {
        const bw = digitW;
        const px = (fr: number) => x + bw * fr;
        const py = (fr: number) => y + digitH * fr;
        const d1 = [
          `M ${px(0.62).toFixed(1)},${py(0).toFixed(1)}`,
          `L ${px(0.62).toFixed(1)},${py(0.86).toFixed(1)}`,
          `L ${px(0.98).toFixed(1)},${py(0.86).toFixed(1)}`,
          `L ${px(0.98).toFixed(1)},${py(1).toFixed(1)}`,
          `L ${px(0.02).toFixed(1)},${py(1).toFixed(1)}`,
          `L ${px(0.02).toFixed(1)},${py(0.86).toFixed(1)}`,
          `L ${px(0.38).toFixed(1)},${py(0.86).toFixed(1)}`,
          `L ${px(0.38).toFixed(1)},${py(0.26).toFixed(1)}`,
          `L ${px(0.08).toFixed(1)},${py(0.40).toFixed(1)}`,
          `L ${px(0.08).toFixed(1)},${py(0.16).toFixed(1)}`,
          "Z",
        ].join(" ");
        // 2026-10-20: on the lone round the marker is drawn soft. That
        // scene renders on flux-2/edit, which — unlike flash on the arches —
        // copied the bold black outline and flat bulb dots literally: the
        // customer got a black-and-white line drawing of a 1 with black spots
        // ("isik neden bu sekilde geldi?"). A pale body with a thin grey edge
        // renders as a solid white numeral, and bulbs drawn as glowing points
        // (white core, warm halo) come back lit instead of as brown dots.
        plinthLayer.push(singleRound
          ? `<path d="${d1}" fill="#F6F4F0" stroke="rgba(150,150,150,0.75)" stroke-width="2" stroke-linejoin="round"/>`
          : `<path d="${d1}" fill="#FFFFFF" stroke="rgba(45,45,45,0.92)" stroke-width="4" stroke-linejoin="round"/>`,
        );
        // Warm bulbs set into the face: down the body, then along the base bar.
        const bulbR = digitW * 0.055;
        if (singleRound) {
          plinthLayer.push(
            `<defs><radialGradient id="marqueeBulbGlow">` +
            `<stop offset="0%" stop-color="#FFFFFF"/><stop offset="30%" stop-color="#FFF6D8"/>` +
            `<stop offset="55%" stop-color="#FFD978" stop-opacity="0.85"/>` +
            `<stop offset="100%" stop-color="#FFC24A" stop-opacity="0"/></radialGradient></defs>`,
          );
        }
        const bulbAttrs = singleRound
          ? `r="${(bulbR * 2).toFixed(1)}" fill="url(#marqueeBulbGlow)"`
          : `r="${bulbR.toFixed(1)}" fill="#FFF3D6" stroke="rgba(120,110,90,0.55)" stroke-width="1"`;
        for (let b = 0; b < 7; b++) {
          plinthLayer.push(
            `<circle cx="${px(0.50).toFixed(1)}" cy="${py(0.09 + b * 0.115).toFixed(1)}" ` +
            `${bulbAttrs}/>`,
          );
        }
        for (const fr of [0.18, 0.50, 0.82]) {
          plinthLayer.push(
            `<circle cx="${px(fr).toFixed(1)}" cy="${py(0.93).toFixed(1)}" ` +
            `${bulbAttrs}/>`,
          );
        }
      } else {
        // 0.72 em is the cap height of Arial Black; dividing by it makes the
        // painted numeral the height we actually mean.
        const fontPx = digitH / 0.72;
        // A path from the embedded block font (Archivo Black, the same 0.72em
        // cap height), not <text>: on Vercel there are no fonts to draw it.
        plinthLayer.push(
          `<path d="${textPathD(glyph, "block", x + digitW / 2, y + digitH, fontPx)}" ` +
          (singleRound
            ? `fill="#F6F4F0" stroke="rgba(150,150,150,0.75)" stroke-width="2" stroke-linejoin="round"/>`
            : `fill="#FFFFFF" stroke="rgba(45,45,45,0.92)" stroke-width="4" stroke-linejoin="round"/>`),
        );
      }
    }
  }

  // Assemble SVG: full-canvas background + scaled content group
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `  ${bgLines.join("\n  ")}`,
    `  <g transform="translate(${marginX},${marginY}) scale(${SCALE})">`,
    // The plinth layer is drawn last: it stands in FRONT of the decor, so it
    // occludes what is behind it. On a ring that only works because its base is
    // pushed forward above — drawn last at the ring's own floor line it cut
    // across the hoop instead.
    `    ${content.concat(plinthLayer).join("\n    ")}`,
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
    textZones,
    bannerPrintInGuide: bannerPrintInGuide as boolean,
    bannerPrintMaskSvg: (bannerPrintLayout as { x: number; y: number; w: number; h: number } | null)
      ? (() => {
          const b = bannerPrintLayout as unknown as { x: number; y: number; w: number; h: number };
          // Everything in the plinth layer (plinth, number, bulbs) is turned
          // solid black whatever its own colours, by keeping only its alpha.
          return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
            `<defs><filter id="blk"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter></defs>` +
            `<rect width="${W}" height="${H}" fill="#000000"/>` +
            `<g transform="translate(${marginX},${marginY}) scale(${SCALE})">` +
            `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" fill="#FFFFFF"/>` +
            bannerPrintHoles.join("") +
            `<g filter="url(#blk)">${plinthLayer.join("")}</g>` +
            `</g></svg>`;
        })()
      : "",
    // Assigned inside the panel loop, which TypeScript cannot see into.
    bannerPrintRect: (bannerPrintLayout as { x: number; y: number; w: number; h: number } | null)
      ? {
          xFrac: (marginX + (bannerPrintLayout as { x: number; y: number; w: number; h: number } | null)!.x * SCALE) / W,
          yFrac: (marginY + (bannerPrintLayout as { x: number; y: number; w: number; h: number } | null)!.y * SCALE) / H,
          wFrac: ((bannerPrintLayout as { x: number; y: number; w: number; h: number } | null)!.w * SCALE) / W,
          hFrac: ((bannerPrintLayout as { x: number; y: number; w: number; h: number } | null)!.h * SCALE) / H,
        }
      : null,
    textMetalTint,
    neonOverlaySvg: neonOverlayLayer.length > 0
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
        `<g transform="translate(${marginX},${marginY}) scale(${SCALE})">${neonOverlayLayer.join("")}</g></svg>`
      : "",
    silverTextMaskSvg: silverInkLayer.length > 0
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
        `<rect width="${W}" height="${H}" fill="#000000"/>` +
        `<g transform="translate(${marginX},${marginY}) scale(${SCALE})">${silverInkLayer.join("")}</g></svg>`
      : "",
    marqueeBulbs: marqueeBulbsLayout.map(([bx, by, br]) => ({
      xFrac: (marginX + bx * SCALE) / W,
      yFrac: (marginY + by * SCALE) / H,
      rFrac: (br * SCALE) / W,
    })),
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
): { leftFrac: number; rightFrac: number; floorYFrac: number; frontFloorYFrac: number; apexYFrac: number; refHeightCm: number } | null {
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

  // Where the plinth's base is drawn — 50cm in front of the boards, with
  // the same foreshortening the guide itself applies (see plinthForwardPx
  // in generateStructureSilhouette; the two must stay identical).
  const isRingScene    = backdropItems[0]?.type === "balloon_ring";
  const pxPerCmForGap  = refPanel.heightCm > 0 ? (refPanel.floorY - refPanel.apexY) / refPanel.heightCm : 0;
  const plinthForwardPx = isRingScene
    ? (layout.floorY - groupApex) * 0.10
    : 50 * pxPerCmForGap * 0.35;

  return {
    leftFrac:   (marginX + groupLeft  * SCALE) / W,
    rightFrac:  (marginX + groupRight * SCALE) / W,
    floorYFrac: (marginY + layout.floorY * SCALE) / H,
    frontFloorYFrac: (marginY + (layout.floorY + plinthForwardPx) * SCALE) / H,
    apexYFrac:  (marginY + groupApex   * SCALE) / H,
    refHeightCm: refItem?.heightCm ?? 200,
  };
}
