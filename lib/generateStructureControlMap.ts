/**
 * Hidden structure control map — edge/outline guide for AI structure reference.
 *
 * Visible Production Layout Preview is NOT used as visual style reference for AI.
 * AI receives this hidden structure control map only (edge outlines, no color/style).
 *
 * The control map contains only:
 * - Black outline silhouettes of backdrop panels
 * - Gray floor line
 * - Simple outlined plinth rectangles
 * - No fills, no gradients, no shadows, no balloons, no decorative styling
 *
 * Suitable for ControlNet / Canny edge guidance when a structure-aware model is used.
 * Client-side only — uses HTMLCanvasElement.
 */

import type { BuilderConfig, BackdropShapeId } from "./config";
import { calculateExactLayout } from "./calculateExactLayout";

interface Pt { x: number; y: number }

function edgeOutline(
  cx: number, pw: number, apexY: number, floorY: number,
  shape: BackdropShapeId,
): Pt[] {
  const r = pw / 2;
  const leftX = cx - r;
  const rightX = cx + r;
  const pts: Pt[] = [];

  if (shape === "round") {
    const centerY = apexY + r;
    for (let k = 0; k <= 48; k++) {
      const a = Math.PI * 2 * (k / 48);
      pts.push({ x: cx + r * Math.cos(a), y: centerY - r * Math.sin(a) });
    }
    return pts;
  }

  if (shape === "rect" || shape === "shimmer_wall") {
    return [
      { x: leftX, y: floorY },
      { x: leftX, y: apexY },
      { x: rightX, y: apexY },
      { x: rightX, y: floorY },
    ];
  }

  if (shape === "wavy") {
    const topY = apexY + r * 0.3;
    pts.push({ x: leftX, y: floorY }, { x: leftX, y: topY });
    const amp = r * 0.14;
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      pts.push({ x: leftX + t * pw, y: topY - amp * Math.sin(t * Math.PI * 2.5) });
    }
    pts.push({ x: rightX, y: floorY });
    return pts;
  }

  // arch / default
  const springY = apexY + r;
  pts.push({ x: leftX, y: floorY }, { x: leftX, y: springY });
  for (let k = 0; k <= 32; k++) {
    const a = Math.PI * (1 - k / 32);
    pts.push({ x: cx + r * Math.cos(a), y: springY - r * Math.sin(a) });
  }
  pts.push({ x: rightX, y: springY }, { x: rightX, y: floorY });
  return pts;
}

function strokeOutline(ctx: CanvasRenderingContext2D, pts: Pt[], color = "#1A1A1A", lw = 2) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.stroke();
}

/**
 * Generate a minimal black-and-white edge/outline control map.
 * Used as hidden structure reference for AI — not shown to the customer.
 * Returns base64 PNG (no data URI prefix).
 */
export function generateStructureControlMap(
  config: BuilderConfig,
  width  = 800,
  height = 600,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Pure white background — no styling
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  const layout = calculateExactLayout(
    config.decor.backdropItems,
    config.decor.plinthSizes,
    width,
    height,
  );

  // Floor line only — thin gray
  ctx.strokeStyle = "#999999";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, layout.floorY);
  ctx.lineTo(width, layout.floorY);
  ctx.stroke();

  // Backdrop panel outlines — tallest first (z-order)
  const sorted = [...layout.panels].sort((a, b) => a.zOrder - b.zOrder);
  for (const panel of sorted) {
    const item  = config.decor.backdropItems[panel.idx];
    const shape = (item?.type ?? "arch") as BackdropShapeId;
    const pts   = edgeOutline(panel.cx, panel.pw, panel.apexY, panel.floorY, shape);
    // Very light fill so overlapping panels are distinguishable
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fillStyle = "rgba(180,180,180,0.18)";
    ctx.fill();
    // Bold outline
    strokeOutline(ctx, pts, "#1A1A1A", 2.5);
  }

  // Plinth outlines — simple narrow rectangle + top ellipse
  for (const plinth of layout.plinths) {
    const rx   = plinth.diameterPx / 2;
    const topY = plinth.bottomY - plinth.heightPx;
    ctx.strokeStyle = "#333333";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(plinth.cx - rx, topY, plinth.diameterPx, plinth.heightPx);
    // Top cap ellipse
    ctx.beginPath();
    ctx.ellipse(plinth.cx, topY, rx, rx * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}
