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

function lightenColor(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#FFFFFF";
  const n = parseInt(h, 16);
  const r = Math.min(255, ((n >> 16) & 255) + 48);
  const g = Math.min(255, ((n >> 8)  & 255) + 48);
  const b = Math.min(255, ( n        & 255) + 48);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
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

  // --- balloon guide — organic clusters in configured theme/balloon colors ---
  // Kontext reads these as "where balloons go and what color", not marker dots.
  const decor        = config.decor as { balloonStyle?: BalloonStyleId; balloonColors?: string[] };
  const balloonStyle = decor.balloonStyle ?? "none";

  if (balloonStyle !== "none" && layout.panels.length > 0) {
    // Use configured balloon colors; fallback to warm neutrals if none set
    const configuredColors: string[] = (decor.balloonColors && decor.balloonColors.length > 0)
      ? decor.balloonColors.slice(0, 5)
      : ["#D8EAF5", "#F0F4F8", "#B8D4E8"];

    const groupLeft  = Math.min(...layout.panels.map((p) => p.cx - p.pw / 2));
    const groupRight = Math.max(...layout.panels.map((p) => p.cx + p.pw / 2));
    const groupTop   = Math.min(...layout.panels.map((p) => p.apexY));
    const floorY     = layout.floorY;

    // Draw a single organic balloon with natural-looking gradient and highlight
    const drawBalloon = (bx: number, by: number, r: number, colorIdx: number) => {
      const fill = configuredColors[colorIdx % configuredColors.length];
      // Subtle radial gradient for balloon depth
      const grad = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.05, bx, by, r);
      grad.addColorStop(0, lightenColor(fill));
      grad.addColorStop(1, fill);
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    };

    // Draw a dense organic cluster node: multiple overlapping circles at one position
    const drawClusterNode = (cx: number, cy: number, baseR: number, colorOffset: number, jitterSeed: number) => {
      // 3–4 overlapping balloons per node to simulate organic volume
      const offsets: [number, number, number][] = [
        [0,                              0,                          baseR],
        [((jitterSeed * 7)  % 22) - 11, ((jitterSeed * 13) % 18) - 9,  baseR * 0.82],
        [((jitterSeed * 11) % 18) - 9,  ((jitterSeed * 5)  % 22) - 11, baseR * 0.9],
        [((jitterSeed * 17) % 26) - 13, ((jitterSeed * 3)  % 14) - 7,  baseR * 0.75],
      ];
      offsets.forEach(([dx, dy, r], k) => {
        drawBalloon(cx + dx, cy + dy, r, colorOffset + k);
      });
    };

    if (balloonStyle === "half") {
      // Half garland: dense cluster at top corner, continuous organic side column,
      // connected floor cluster — all in configured balloon colors.
      const anchorX = groupRight + 16;

      // Dense top-corner burst
      const topY = groupTop + 10;
      drawClusterNode(anchorX,      topY,      24, 0, 1);
      drawClusterNode(anchorX - 18, topY + 14, 18, 2, 3);
      drawClusterNode(anchorX + 10, topY + 22, 16, 1, 5);

      // Side column: 8 nodes from top to floor — organically offset, not perfectly aligned
      const sideNodes = 8;
      for (let i = 1; i <= sideNodes; i++) {
        const t        = i / sideNodes;
        const nodeX    = anchorX + Math.sin(t * Math.PI * 0.5) * 16;
        const nodeY    = topY + 30 + t * (floorY - topY - 45);
        const baseR    = 15 + ((i * 3) % 6);   // 15–20 px, varied
        drawClusterNode(nodeX, nodeY, baseR, i, i * 4);
      }

      // Connected floor cluster — spreads horizontally to indicate floor-reach
      const floorCx = anchorX + 10;
      const floorCy = floorY - 16;
      drawClusterNode(floorCx,      floorCy,      20, 0, 9);
      drawClusterNode(floorCx - 24, floorCy + 4,  17, 2, 11);
      drawClusterNode(floorCx + 20, floorCy + 6,  15, 1, 13);

    } else if (balloonStyle === "full" || balloonStyle === "premium") {
      const nodes    = balloonStyle === "premium" ? 9 : 7;
      const baseR    = balloonStyle === "premium" ? 17 : 14;

      const drawSide = (edgeX: number, direction: 1 | -1, colorOff: number) => {
        for (let i = 0; i <= nodes; i++) {
          const t  = i / nodes;
          const cx = edgeX + direction * (8 + ((i * 5) % 12));
          const cy = groupTop + t * (floorY - groupTop);
          drawClusterNode(cx, cy, baseR + ((i * 3) % 5), colorOff + i, i * 6);
        }
      };
      drawSide(groupRight, 1, 0);
      drawSide(groupLeft, -1, 2);
      // Top arc
      for (let i = 0; i <= nodes; i++) {
        const t  = i / nodes;
        const cx = groupLeft + t * (groupRight - groupLeft);
        const cy = groupTop - 14 - ((i * 4) % 10);
        drawClusterNode(cx, cy, baseR + ((i * 2) % 5), i, i * 3);
      }
    }
  }

  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}
