/**
 * Renders a clean, high-contrast control image from the exact scene layout.
 * Used as structure guidance for the AI Final Design Render.
 *
 * Production Layout Preview and future export package use scene state as source
 * of truth. AI render is a visual preview, not the production measurement source.
 *
 * Client-side only — uses HTMLCanvasElement.
 */

import type { BuilderConfig, BackdropShapeId, BalloonStyleId } from "./config";
import { calculateExactLayout } from "./calculateExactLayout";

interface Pt { x: number; y: number }

function controlOutline(
  cx: number, pw: number, apexY: number, floorY: number,
  shape: BackdropShapeId,
): Pt[] {
  const r = pw / 2;
  const leftX = cx - r;
  const rightX = cx + r;
  const pts: Pt[] = [];

  if (shape === "round") {
    const centerY = apexY + r;
    for (let k = 0; k <= 40; k++) {
      const a = Math.PI * 2 * (k / 40);
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
    const waves = 2.5, amp = r * 0.14;
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      pts.push({ x: leftX + t * pw, y: topY - amp * Math.sin(t * Math.PI * waves) });
    }
    pts.push({ x: rightX, y: floorY });
    return pts;
  }

  // arch / default
  const springY = apexY + r;
  pts.push({ x: leftX, y: floorY }, { x: leftX, y: springY });
  for (let k = 0; k <= 26; k++) {
    const a = Math.PI * (1 - k / 26);
    pts.push({ x: cx + r * Math.cos(a), y: springY - r * Math.sin(a) });
  }
  pts.push({ x: rightX, y: springY }, { x: rightX, y: floorY });
  return pts;
}

function fillOutline(ctx: CanvasRenderingContext2D, pts: Pt[], color: string) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/**
 * Render a simplified, high-contrast layout control image.
 * Returns base64-encoded PNG (without the data URI prefix).
 */
export function renderLayoutControlImage(
  config: BuilderConfig,
  width  = 800,
  height = 600,
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const layout = calculateExactLayout(
    config.decor.backdropItems,
    config.decor.plinthSizes,
    width,
    height,
  );

  // --- background ---
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#F2EFEB");
  bg.addColorStop(1, "#EAE6E0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // --- floor ---
  ctx.fillStyle = "#D8D2C8";
  ctx.fillRect(0, layout.floorY, width, height - layout.floorY);
  ctx.strokeStyle = "#B8B4AE";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, layout.floorY);
  ctx.lineTo(width, layout.floorY);
  ctx.stroke();

  // --- backdrop panels (sorted tallest-first so tallest is behind) ---
  const sorted = [...layout.panels].sort((a, b) => a.zOrder - b.zOrder);
  for (const panel of sorted) {
    const item = config.decor.backdropItems[panel.idx];
    // Use per-panel color or global backdrop color — slightly desaturated for control image
    const rawColor = item?.color || config.decor.backdropColor || "#D0B8B8";
    const pts = controlOutline(panel.cx, panel.pw, panel.apexY, panel.floorY, item?.type as BackdropShapeId ?? "arch");

    // Subtle drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur  = 14;
    ctx.shadowOffsetY = 8;
    fillOutline(ctx, pts, rawColor);
    ctx.restore();

    // Panel stroke (no shadow)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(0,0,0,0.20)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // --- plinths ---
  for (const plinth of layout.plinths) {
    const rx = plinth.diameterPx / 2;
    const topY = plinth.bottomY - plinth.heightPx;

    // Body
    const g = ctx.createLinearGradient(plinth.cx - rx, 0, plinth.cx + rx, 0);
    g.addColorStop(0,    "#C0BCBA");
    g.addColorStop(0.38, "#FFFFFF");
    g.addColorStop(0.70, "#ECEAE7");
    g.addColorStop(1,    "#C0BCBA");
    ctx.fillStyle = g;
    ctx.fillRect(plinth.cx - rx, topY, plinth.diameterPx, plinth.heightPx);

    // Top cap ellipse
    ctx.beginPath();
    ctx.ellipse(plinth.cx, topY, rx, rx * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Floor shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(plinth.cx, plinth.bottomY + 3, rx * 0.8, rx * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.filter = "blur(3px)";
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();
  }

  // --- balloon path indicator ---
  // Draw a simplified garland path so the AI can follow exact placement and flow.
  // Uses distinct lavender color so AI distinguishes balloons from panels.
  const balloonStyle = (config.decor as { balloonStyle?: BalloonStyleId }).balloonStyle ?? "none";

  if (balloonStyle !== "none" && layout.panels.length > 0) {
    const BALLOON_FILL   = "#C4A8D4";
    const BALLOON_STROKE = "#A882C0";

    const groupLeft  = Math.min(...layout.panels.map((p) => p.cx - p.pw / 2));
    const groupRight = Math.max(...layout.panels.map((p) => p.cx + p.pw / 2));
    const groupTop   = Math.min(...layout.panels.map((p) => p.apexY));
    const floorY     = layout.floorY;

    const drawBalloonCluster = (bx: number, by: number, r: number) => {
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = BALLOON_FILL;
      ctx.fill();
      ctx.strokeStyle = BALLOON_STROKE;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    if (balloonStyle === "half") {
      // Continuous half garland: top-right corner → down right side → floor cluster
      // Slight inward curve so it hugs the panel edge naturally
      const startX = groupRight + 18;
      const steps  = 9;
      for (let i = 0; i <= steps; i++) {
        const t  = i / steps;
        const bx = startX + Math.sin(t * Math.PI * 0.35) * 24; // gentle inward bow
        const by = groupTop + 10 + t * (floorY - groupTop - 10);
        const r  = i === 0 ? 26 : i === steps ? 20 : 14 + (1 - t) * 8;
        drawBalloonCluster(bx, by, r);
      }
      // Explicit floor cluster to indicate garland reaches the floor
      for (let j = -1; j <= 1; j++) {
        drawBalloonCluster(startX + 14 + j * 20, floorY - 14, 12 + Math.abs(j) * 3);
      }
    } else if (balloonStyle === "full" || balloonStyle === "premium") {
      const density = balloonStyle === "premium" ? 8 : 6;
      const r       = balloonStyle === "premium" ? 16 : 14;

      // Right side: top → floor
      for (let i = 0; i <= density; i++) {
        const t = i / density;
        drawBalloonCluster(groupRight + 18, groupTop + t * (floorY - groupTop), r);
      }
      // Top: left edge → right edge
      for (let i = 0; i <= density; i++) {
        const t = i / density;
        drawBalloonCluster(groupLeft + t * (groupRight - groupLeft), groupTop - 16, r);
      }
      // Left side: top → floor
      for (let i = 0; i <= density; i++) {
        const t = i / density;
        drawBalloonCluster(groupLeft - 18, groupTop + t * (floorY - groupTop), r);
      }
    }
  }

  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}
