"use client";

import { useEffect, useRef } from "react";
import {
  themeById,
  resolveBackdropText,
  type BuilderConfig,
  type BackdropItem,
  type BackdropShapeId,
  type BalloonStyleId,
  type PlinthSize,
  type GraphicStyle,
} from "@/lib/config";
import { calculateExactLayout, debugLayout } from "@/lib/calculateExactLayout";
import { getPlinthDimensions } from "@/lib/layoutDimensions";

/**
 * Customer Approval Preview — deterministic canvas rendering of the exact setup.
 * This is the source of truth for production. AI render is optional mood-only.
 *
 * Accepts overlay children (text layers, cutout overlays) rendered inside the
 * same relative container so they stay perfectly aligned with the canvas.
 */
export default function LiveSetupPreview({
  config,
  children,
}: {
  config: BuilderConfig;
  children?: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Signature of everything that affects the drawing — redraw when it changes.
  const sig = JSON.stringify({
    t: config.theme,
    items: config.decor.backdropItems,
    b: config.decor.balloonStyle,
    bc: config.decor.backdropColor,
    blc: config.decor.balloonColors,
    p: config.decor.plinthSizes,
    cu: config.decor.cutouts,
    txt: config.decor.backdropText,
    ck: config.decor.cakeTable,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, Math.round(rect.width));
      const H = Math.max(1, Math.round(rect.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderScene(ctx, W, H, config);
      // Log exact layout in development for each panel and plinth
      debugLayout(calculateExactLayout(config.decor.backdropItems, config.decor.plinthSizes, W, H), config.decor.backdropItems);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-inner"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {children}
    </div>
  );
}

// ===========================================================================
// Rendering
// ===========================================================================

interface Pt {
  x: number;
  y: number;
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  config: BuilderConfig
) {
  const theme = themeById(config.theme)!;
  // User-overridable colors (Change 4) fall back to the theme suggestions.
  const backdropColor = config.decor.backdropColor || theme.backdropColors[0];
  const palette =
    config.decor.balloonColors.length > 0 ? config.decor.balloonColors : theme.balloonColors;
  const accent = theme.accent;
  const isDark = isColorDark(backdropColor);

  // --- background + floor --------------------------------------------------
  // Premium neutral wall: warm ivory, subtly lighter in the center
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   "#EDEAE6");
  bg.addColorStop(0.5, "#F5F2EE");
  bg.addColorStop(1,   "#EBE6E0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft centre-bright radial — mimics a studio key light from above
  const keyLight = ctx.createRadialGradient(W * 0.5, H * 0.25, 0, W * 0.5, H * 0.25, W * 0.75);
  keyLight.addColorStop(0, "rgba(255,255,255,0.18)");
  keyLight.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = keyLight;
  ctx.fillRect(0, 0, W, H);

  // Subtle corner vignette for depth
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.9);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.09)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const floorY = H * 0.88;

  // Floor: slightly warmer, subtle sheen
  const floor = ctx.createLinearGradient(0, floorY, 0, H);
  floor.addColorStop(0,   "#DDD5CC");
  floor.addColorStop(0.4, "#E8E0D6");
  floor.addColorStop(1,   "#D8D0C8");
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, W, H - floorY);

  // Floor-wall junction: soft cast shadow from the wall meeting the floor
  const jShadow = ctx.createLinearGradient(0, floorY - 10, 0, floorY + 18);
  jShadow.addColorStop(0, "rgba(0,0,0,0)");
  jShadow.addColorStop(0.55, "rgba(0,0,0,0.11)");
  jShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = jShadow;
  ctx.fillRect(0, floorY - 10, W, 28);

  // --- layout backdrops — tight grouped arrangement ------------------------
  const items = config.decor.backdropItems;
  const count = Math.max(1, Math.min(3, items.length));

  // Compute max height for relative apex scaling
  const maxHeightCm = Math.max(...items.map((it) => it.heightCm ?? 200));

  // Per-panel max width caps by count so the group fits the canvas
  const maxPwByCount = count === 1 ? W * 0.70 : count === 2 ? W * 0.42 : W * 0.30;

  // Pass 1 — compute intrinsic sizes for every panel
  interface PanelRenderData {
    i: number; item: BackdropItem; shape: BackdropShapeId;
    color: string; dark: boolean;
    cx: number; pw: number; apexY: number; zOrder: number;
  }

  const rawPanels: Omit<PanelRenderData, "cx">[] = items.slice(0, count).map((item, i) => {
    const hCm = item?.heightCm ?? 200;
    const wCm = item?.widthCm  ?? 100;
    const heightRatio = hCm / maxHeightCm;
    const apexFactor  = 0.05 + 0.12 * (1 - heightRatio);
    const apexY       = H * apexFactor;
    const panelH      = floorY - apexY;
    const aspect      = wCm / hCm;
    const pw = Math.max(W * 0.08, Math.min(maxPwByCount, panelH * aspect));
    const panelColor  = item?.color || backdropColor;
    return {
      i, item,
      shape:   (item?.type ?? "arch") as BackdropShapeId,
      color:   panelColor,
      dark:    isColorDark(panelColor),
      pw, apexY,
      // z-order: tallest → 0 (drawn first = behind), shortest → count-1 (in front)
      zOrder:  (() => {
        const sorted = [...items.slice(0, count)]
          .map((it, idx) => ({ idx, h: it?.heightCm ?? 200 }))
          .sort((a, b) => b.h - a.h);
        return sorted.findIndex(s => s.idx === i);
      })(),
    };
  });

  // Gap between panels — tight, event-like
  const gap = count === 1 ? 0 : Math.max(6, W * 0.008);

  // Total group width; scale down if it overflows the canvas
  let totalGroupW = rawPanels.reduce((s, p) => s + p.pw, 0) + (count - 1) * gap;
  const maxGroupW = W * 0.90;
  const groupScale = totalGroupW > maxGroupW ? maxGroupW / totalGroupW : 1;
  totalGroupW *= groupScale;

  // Pass 2 — assign x positions (selection order = left-to-right)
  let xCursor = (W - totalGroupW) / 2;
  const panels: PanelRenderData[] = rawPanels.map(p => {
    const pw = p.pw * groupScale;
    const cx = xCursor + pw / 2;
    xCursor += pw + gap;
    return { ...p, pw, cx };
  });

  // Pass 3 — render in z-order (tallest first = behind)
  const byZ = [...panels].sort((a, b) => a.zOrder - b.zOrder);
  for (const { cx, pw, apexY, shape, color, dark, i, item } of byZ) {
    drawBackdrop(ctx, cx, pw, floorY, H, shape, color, dark, apexY);

    // Per-panel theme graphic — clips to panel shape, updates immediately
    if (item?.graphic?.enabled && item.graphic.style) {
      drawPanelGraphic(
        ctx, cx, pw, apexY, floorY, H,
        shape, config.theme, item.graphic.style as GraphicStyle,
        accent, color, i * 137 + 7,
      );
    }

    // Garland: outer panels get full coverage, middle panels get reduced coverage
    // so the garland reads as one connected frame around the group.
    const isOuterLeft  = i === 0;
    const isOuterRight = i === count - 1;
    const isSingleOrOuter = count === 1 || isOuterLeft || isOuterRight;
    const outline = backdropOutline(cx, pw, floorY, H, shape, apexY);
    const garlandStyle: BalloonStyleId =
      isSingleOrOuter ? config.decor.balloonStyle
        : config.decor.balloonStyle === "none" ? "none"
        : config.decor.balloonStyle === "half"  ? "none"   // centre panels: top-only
        : "half";                                            // centre: lighter density
    drawGarland(ctx, outline, floorY, pw, palette, garlandStyle, i * 97 + 13);
  }

  // --- backdrop text: draw per-panel text, fall back to global setting ----
  const hasPanelText = config.decor.backdropItems.some((it) => it.text.enabled && it.text.value.trim());
  if (hasPanelText) {
    panels.forEach((p) => {
      const it = p.item;
      if (!it.text.enabled || !it.text.value.trim()) return;
      drawBackdropText(ctx, p.cx, H * 0.5, config, accent);
    });
  } else if (config.decor.backdropText.enabled) {
    drawBackdropText(ctx, W / 2, H * 0.5, config, accent);
  }

  // --- props in front ------------------------------------------------------
  // px-per-cm scale: anchored to the tallest panel's rendered height
  const refApexY   = H * 0.05;               // apex y for tallest panel (heightRatio = 1)
  const pxPerCm    = (floorY - refApexY) / maxHeightCm;
  drawPlinths(ctx, W, floorY, config.decor.plinthSizes, pxPerCm);
  if (config.decor.cutouts.size !== "none")
    drawCutouts(ctx, W, floorY, config.decor.cutouts.size, palette);
  if (config.decor.cakeTable) drawCakeTable(ctx, W, floorY, accent);
}

// --- backdrop geometry -----------------------------------------------------

/**
 * Returns the outer perimeter of a backdrop from floor-left, up and over the
 * top, down to floor-right. The garland is placed along this polyline.
 */
function backdropOutline(
  cx: number,
  pw: number,
  floorY: number,
  H: number,
  shape: BackdropShapeId,
  apexYOverride?: number
): Pt[] {
  const r = pw / 2;
  const leftX = cx - r;
  const rightX = cx + r;
  const apexY = apexYOverride ?? H * 0.14;
  const pts: Pt[] = [];

  const arcSamples = 26;

  if (shape === "wavy") {
    const topY = apexY + r * 0.35;
    pts.push({ x: leftX, y: floorY });
    pts.push({ x: leftX, y: topY });
    const waves = 2.5;
    const amp = r * 0.16;
    for (let k = 0; k <= arcSamples * 2; k++) {
      const t = k / (arcSamples * 2);
      const x = leftX + t * pw;
      const y = topY - amp * Math.sin(t * Math.PI * waves);
      pts.push({ x, y });
    }
    pts.push({ x: rightX, y: floorY });
    return pts;
  }

  if (shape === "rect" || shape === "shimmer_wall") {
    // Flat rectangular — straight top edge
    const topY = apexY + r * 0.1;
    pts.push({ x: leftX, y: floorY });
    pts.push({ x: leftX, y: topY });
    pts.push({ x: rightX, y: topY });
    pts.push({ x: rightX, y: floorY });
    return pts;
  }

  if (shape === "round") {
    // Full circle — center mid-height
    const centerY = apexY + r;
    for (let k = 0; k <= arcSamples * 2; k++) {
      const a = Math.PI * 2 * (k / (arcSamples * 2));
      pts.push({ x: cx + r * Math.cos(a), y: centerY - r * Math.sin(a) });
    }
    return pts;
  }

  // arch / fallback: standard semicircular arch
  const ry = r;
  const springY = apexY + ry;
  pts.push({ x: leftX, y: floorY });
  pts.push({ x: leftX, y: springY });
  for (let k = 0; k <= arcSamples; k++) {
    const a = Math.PI * (1 - k / arcSamples);
    pts.push({ x: cx + r * Math.cos(a), y: springY - ry * Math.sin(a) });
  }
  pts.push({ x: rightX, y: springY });
  pts.push({ x: rightX, y: floorY });
  return pts;
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  cx: number,
  pw: number,
  floorY: number,
  H: number,
  shape: BackdropShapeId,
  color: string,
  isDark: boolean,
  apexYOverride?: number
) {
  const outline = backdropOutline(cx, pw, floorY, H, shape, apexYOverride);
  const apexY = apexYOverride ?? H * 0.14;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(outline[0].x, outline[0].y);
  for (const p of outline) ctx.lineTo(p.x, p.y);
  ctx.closePath();

  // --- 1. Deep cast shadow on the floor below the panel ---
  ctx.shadowColor = "rgba(0,0,0,0.30)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = "rgba(0,0,0,0)";  // paint transparent first to stamp shadow
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // --- 2. Panel fill: vertical gradient for subtle material depth ---
  const g = ctx.createLinearGradient(0, apexY, 0, floorY);
  g.addColorStop(0,    lighten(color, isDark ? 0.18 : 0.10));
  g.addColorStop(0.45, color);
  g.addColorStop(1,    darken(color, 0.08));
  ctx.fillStyle = g;
  ctx.fill();

  // --- 3. Rim highlight on the left edge (ambient fill light) ---
  const rimW = pw * 0.12;
  const rimGrad = ctx.createLinearGradient(cx - pw / 2, 0, cx - pw / 2 + rimW, 0);
  rimGrad.addColorStop(0, "rgba(255,255,255,0.20)");
  rimGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = rimGrad;
  ctx.fill();

  // --- 4. Clean edge stroke ---
  ctx.lineWidth = 1;
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.12)" : darken(color, 0.12);
  ctx.stroke();

  // --- 5. Space theme: star field ---
  if (isDark) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const seed = mulberry32(42);
    for (let i = 0; i < 22; i++) {
      const x = cx - pw / 2 + seed() * pw;
      const y = apexY + seed() * (floorY - apexY) * 0.88;
      const s = 0.5 + seed() * 1.6;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// --- panel graphic overlay -------------------------------------------------

// Motif functions prefixed with `m` to avoid collision with existing drawStar etc.
type MotifFn = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, c1: string, c2: string) => void;

const mStar: MotifFn = (ctx, x, y, size, c1) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.42;
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = c1; ctx.fill();
};

const mHeart: MotifFn = (ctx, x, y, size, c1) => {
  const s = size * 0.7;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y - s * 0.5, x - s * 0.8, y - s * 0.5, x - s * 0.8, y);
  ctx.bezierCurveTo(x - s * 0.8, y + s * 0.5, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.8, y + s * 0.5, x + s * 0.8, y);
  ctx.bezierCurveTo(x + s * 0.8, y - s * 0.5, x, y - s * 0.5, x, y + s * 0.3);
  ctx.fillStyle = c1; ctx.fill();
};

const mSnowflake: MotifFn = (ctx, x, y, size, c1) => {
  ctx.save();
  ctx.strokeStyle = c1; ctx.lineWidth = size * 0.11; ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const ex = x + Math.cos(a) * size, ey = y + Math.sin(a) * size;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    const mx = x + Math.cos(a) * size * 0.5, my = y + Math.sin(a) * size * 0.5;
    for (const da of [Math.PI / 3, -Math.PI / 3]) {
      ctx.beginPath(); ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a + da) * size * 0.28, my + Math.sin(a + da) * size * 0.28);
      ctx.stroke();
    }
  }
  ctx.restore();
};

const mCrown: MotifFn = (ctx, x, y, size, c1) => {
  ctx.beginPath();
  ctx.moveTo(x - size, y + size * 0.4); ctx.lineTo(x - size, y - size * 0.15);
  ctx.lineTo(x - size * 0.45, y + size * 0.1); ctx.lineTo(x, y - size * 0.6);
  ctx.lineTo(x + size * 0.45, y + size * 0.1); ctx.lineTo(x + size, y - size * 0.15);
  ctx.lineTo(x + size, y + size * 0.4); ctx.closePath();
  ctx.fillStyle = c1; ctx.fill();
};

const mDiamond: MotifFn = (ctx, x, y, size, c1) => {
  ctx.beginPath();
  ctx.moveTo(x, y - size); ctx.lineTo(x + size * 0.55, y);
  ctx.lineTo(x, y + size); ctx.lineTo(x - size * 0.55, y);
  ctx.closePath(); ctx.fillStyle = c1; ctx.fill();
};

const mFlower: MotifFn = (ctx, x, y, size, c1, c2) => {
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * size * 0.5, y + Math.sin(a) * size * 0.5, size * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = c1; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x, y, size * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = c2; ctx.fill();
};

const mSparkle: MotifFn = (ctx, x, y, size, c1) => {
  ctx.save(); ctx.strokeStyle = c1; ctx.lineWidth = size * 0.1; ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * size * 0.2, y + Math.sin(a) * size * 0.2);
    ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
    ctx.moveTo(x - Math.cos(a) * size * 0.2, y - Math.sin(a) * size * 0.2);
    ctx.lineTo(x - Math.cos(a) * size, y - Math.sin(a) * size);
    ctx.stroke();
  }
  ctx.restore();
};

const mRocket: MotifFn = (ctx, x, y, size, c1) => {
  ctx.beginPath(); ctx.moveTo(x - size * 0.28, y - size * 0.4);
  ctx.lineTo(x + size * 0.28, y - size * 0.4); ctx.lineTo(x, y - size);
  ctx.closePath(); ctx.fillStyle = c1; ctx.fill();
  ctx.fillRect(x - size * 0.28, y - size * 0.4, size * 0.56, size * 0.9);
  ctx.beginPath(); ctx.moveTo(x - size * 0.18, y + size * 0.5);
  ctx.lineTo(x - size * 0.28, y + size * 0.8); ctx.lineTo(x, y + size * 0.55);
  ctx.lineTo(x + size * 0.28, y + size * 0.8); ctx.lineTo(x + size * 0.18, y + size * 0.5);
  ctx.fillStyle = darken(c1, 0.15); ctx.fill();
};

const mLeaf: MotifFn = (ctx, x, y, size, c1) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 4);
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.32, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = c1; ctx.fill(); ctx.restore();
};

const mPawPrint: MotifFn = (ctx, x, y, size, c1) => {
  ctx.beginPath(); ctx.ellipse(x, y + size * 0.2, size * 0.38, size * 0.32, 0, 0, Math.PI * 2);
  ctx.fillStyle = c1; ctx.fill();
  [[-0.35, -0.35], [0, -0.45], [0.35, -0.35]].forEach(([dx, dy]) => {
    ctx.beginPath(); ctx.arc(x + dx * size, y + dy * size, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
  });
};

const mStarfish: MotifFn = (ctx, x, y, size, c1) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.48;
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = c1; ctx.fill();
};

// Theme motif arrays (m-prefixed functions only)
const THEME_MOTIFS: Partial<Record<string, MotifFn[]>> = {
  frozen:             [mSnowflake, mStar, mDiamond, mSnowflake, mSparkle],
  unicorn:            [mStar, mHeart, mSparkle, mDiamond, mFlower],
  princess:           [mCrown, mStar, mHeart, mDiamond, mSparkle],
  barbie:             [mCrown, mStar, mHeart, mSparkle, mDiamond, mHeart],
  dinosaur:           [mLeaf, mStar, mLeaf, mHeart, mStar],
  safari:             [mPawPrint, mLeaf, mStar, mPawPrint, mLeaf],
  mermaid:            [mStarfish, mStar, mHeart, mDiamond, mStarfish],
  space:              [mStar, mRocket, mDiamond, mStar, mSparkle],
  superhero:          [mStar, mDiamond, mSparkle, mStar, mHeart],
  lego:               [mDiamond, mStar, mHeart, mSparkle, mStar],
  kpop:               [mStar, mSparkle, mHeart, mStar, mDiamond],
  encanto:            [mFlower, mStar, mLeaf, mFlower, mHeart],
  teddy_bear:         [mHeart, mStar, mFlower, mHeart, mSparkle],
  blush_garden:       [mFlower, mHeart, mLeaf, mFlower, mSparkle],
  luxury_neutral:     [mDiamond, mStar, mSparkle, mHeart, mDiamond],
  pineapple_tropical: [mStar, mLeaf, mFlower, mStar, mHeart],
  cocomelon:          [mStar, mHeart, mFlower, mStar, mSparkle],
  bluey:              [mPawPrint, mStar, mHeart, mPawPrint, mSparkle],
  stitch:             [mStar, mFlower, mLeaf, mHeart, mStar],
  football:           [mStar, mDiamond, mHeart, mStar, mSparkle],
};
const GENERIC_MOTIFS: MotifFn[] = [mStar, mHeart, mSparkle, mDiamond, mFlower];

interface GraphicStyleConfig { count: number; sizeF: number; }
const GRAPHIC_STYLE_CFG: Record<GraphicStyle, GraphicStyleConfig> = {
  minimal:    { count: 3,  sizeF: 0.20 },
  illustrated:{ count: 8,  sizeF: 0.14 },
  pattern:    { count: 20, sizeF: 0.07 },
  full_scene: { count: 13, sizeF: 0.12 },
  realistic:  { count: 8,  sizeF: 0.13 },
};

/**
 * Draw a deterministic themed graphic overlay clipped to the panel shape.
 * Updates immediately when panel.graphic.enabled or graphic.style changes.
 */
function drawPanelGraphic(
  ctx: CanvasRenderingContext2D,
  cx: number, pw: number, apexY: number, floorY: number, H: number,
  shape: BackdropShapeId, themeId: string, style: GraphicStyle,
  themeAccent: string, panelColor: string, seedBase: number,
) {
  const outline = backdropOutline(cx, pw, floorY, H, shape, apexY);
  const cfg     = GRAPHIC_STYLE_CFG[style] ?? GRAPHIC_STYLE_CFG.illustrated;
  const motifs  = THEME_MOTIFS[themeId] ?? GENERIC_MOTIFS;
  const rng     = mulberry32(seedBase + 5000);

  // Motif colors: use theme accent at 85% opacity + a lighter variant
  const c1 = themeAccent + "D9";         // accent at ~85% opacity
  const c2 = lighten(themeAccent, 0.35) + "CC";  // lighter tint

  ctx.save();

  // Clip to panel shape
  ctx.beginPath();
  ctx.moveTo(outline[0].x, outline[0].y);
  for (const p of outline) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.clip();

  const panelH = floorY - apexY;
  const left   = cx - pw / 2;
  const margin = cfg.sizeF * pw;

  // For pattern style: grid layout; other styles: scatter
  if (style === "pattern") {
    const cols = Math.max(2, Math.round(pw / (margin * 2.2)));
    const rows = Math.max(2, Math.round(panelH / (margin * 2.2)));
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = left   + margin + c * (pw - margin * 2) / Math.max(1, cols - 1);
        const y = apexY  + margin + r * (panelH - margin * 2) / Math.max(1, rows - 1);
        const jx = (rng() - 0.5) * margin * 0.4;
        const jy = (rng() - 0.5) * margin * 0.4;
        const s  = margin * (0.7 + rng() * 0.4);
        motifs[idx % motifs.length](ctx, x + jx, y + jy, s, c1, c2);
        idx++;
      }
    }
  } else {
    // Scatter placement — for minimal, use fixed relative positions
    const positions =
      style === "minimal"
        ? [
            [0.50, 0.28], [0.28, 0.60], [0.72, 0.60],
          ].map(([xf, yf]) => ({ x: left + xf * pw, y: apexY + yf * panelH }))
        : Array.from({ length: cfg.count }, () => ({
            x: left   + margin + rng() * (pw     - margin * 2),
            y: apexY  + margin + rng() * (panelH - margin * 2),
          }));

    positions.forEach(({ x, y }, idx) => {
      const s = margin * (0.7 + rng() * 0.55);
      motifs[idx % motifs.length](ctx, x, y, s, c1, c2);
    });
  }

  // Overlay tint to blend graphic into panel (avoids harsh floating icons)
  ctx.fillStyle = `${panelColor}22`;
  ctx.fillRect(left, apexY, pw, panelH);

  ctx.restore();
}

// --- garland ---------------------------------------------------------------

interface StyleParams {
  rows: number;
  baseR: number; // factor of pw
  coverage: number; // how far down the sides (0..1)
  spacing: number; // along-path step as factor of balloon radius
  floorPool: number; // extra balloons pooled at floor ends
}

function styleParams(style: BalloonStyleId, pw: number): StyleParams | null {
  switch (style) {
    case "none":
      return null;
    // Larger radii, tighter spacing, and richer floor pools for premium look.
    case "half":
      return { rows: 3, baseR: pw * 0.068, coverage: 0.50, spacing: 0.80, floorPool: 5 };
    case "full":
      return { rows: 4, baseR: pw * 0.072, coverage: 1.00, spacing: 0.74, floorPool: 9 };
    case "premium":
      return { rows: 5, baseR: pw * 0.082, coverage: 1.00, spacing: 0.65, floorPool: 16 };
  }
}

function drawGarland(
  ctx: CanvasRenderingContext2D,
  outline: Pt[],
  floorY: number,
  pw: number,
  palette: string[],
  style: BalloonStyleId,
  seedBase: number
) {
  const sp = styleParams(style, pw);
  if (!sp) return;

  const rng = mulberry32(seedBase + 1000);

  // Trim the outline to the requested coverage measured from each floor end.
  const pts = trimCoverage(outline, floorY, sp.coverage);

  // Build evenly-spaced stations along the trimmed polyline.
  const step = sp.baseR * sp.spacing;
  const stations = resample(pts, step);

  type Ball = { x: number; y: number; r: number; color: string };
  const balls: Ball[] = [];

  for (let s = 0; s < stations.length; s++) {
    const st = stations[s];
    // outward normal (points away from backdrop interior)
    const prev = stations[Math.max(0, s - 1)];
    const next = stations[Math.min(stations.length - 1, s + 1)];
    let nx = -(next.y - prev.y);
    let ny = next.x - prev.x;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    // ensure normal points outward (away from horizontal center of the strand)
    // (purely cosmetic; bulge the cluster outward and a bit upward)

    for (let row = 0; row < sp.rows; row++) {
      // Wider offset spread — rows fan out further from the strand path
      const off = (row - (sp.rows - 1) / 2) * sp.baseR * 1.15;
      // More jitter for organic, overlapping clusters
      const jx = (rng() - 0.5) * sp.baseR * 1.0;
      const jy = (rng() - 0.5) * sp.baseR * 1.0;
      // Wider size range: 60% – 135% of baseR
      const r = sp.baseR * (0.60 + rng() * 0.75);
      balls.push({
        x: st.x + nx * off + jx,
        y: st.y + ny * off + jy,
        r,
        color: palette[Math.floor(rng() * palette.length)],
      });
    }
  }

  // Floor pooling — wider spread and taller mound for a premium grounded look
  const ends = [stations[0], stations[stations.length - 1]].filter(Boolean);
  for (const end of ends) {
    if (Math.abs(end.y - floorY) > sp.baseR * 3) continue;
    for (let i = 0; i < sp.floorPool; i++) {
      const r = sp.baseR * (0.75 + rng() * 0.70);
      balls.push({
        x: end.x + (rng() - 0.5) * sp.baseR * 8,
        y: floorY - r * 0.5 - rng() * sp.baseR * 3.5,
        r,
        color: palette[Math.floor(rng() * palette.length)],
      });
    }
  }

  // Paint back-to-front (sorted by y) so nearer balloons overlap farther ones.
  balls.sort((a, b) => a.y - b.y);
  for (const b of balls) drawBalloon(ctx, b.x, b.y, b.r, b.color);
}

/** Keep the top arc but cut each side strand to `coverage` of its length. */
function trimCoverage(outline: Pt[], floorY: number, coverage: number): Pt[] {
  if (coverage >= 1) return outline;
  // outline starts at left-floor and ends at right-floor. Find the highest
  // point (apex) index; trim from both floor ends toward it.
  let apexIdx = 0;
  let minY = Infinity;
  outline.forEach((p, i) => {
    if (p.y < minY) {
      minY = p.y;
      apexIdx = i;
    }
  });
  const span = floorY - minY;
  const keepFromFloor = span * coverage;
  const yCut = floorY - keepFromFloor;
  return outline.filter((p) => p.y <= yCut + 0.5);
}

/** Resample a polyline into points spaced ~`step` apart. */
function resample(pts: Pt[], step: number): Pt[] {
  if (pts.length < 2) return pts;
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let ax = pts[i - 1].x;
    let ay = pts[i - 1].y;
    const bx = pts[i].x;
    const by = pts[i].y;
    let segLen = Math.hypot(bx - ax, by - ay);
    while (acc + segLen >= step) {
      const t = (step - acc) / segLen;
      ax = ax + (bx - ax) * t;
      ay = ay + (by - ay) * t;
      out.push({ x: ax, y: ay });
      segLen = Math.hypot(bx - ax, by - ay);
      acc = 0;
    }
    acc += segLen;
  }
  return out;
}

function drawBalloon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
) {
  const rx = r * 0.88;
  const ry = r;

  // --- 1. Soft cast shadow beneath balloon ---
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.08, y + ry * 1.05, rx * 0.72, ry * 0.20, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.filter = "blur(2px)";
  ctx.fill();
  ctx.filter = "none";
  ctx.restore();

  // --- 2. Knot at bottom ---
  ctx.beginPath();
  ctx.moveTo(x - r * 0.14, y + ry * 0.94);
  ctx.lineTo(x + r * 0.14, y + ry * 0.94);
  ctx.lineTo(x, y + ry * 1.20);
  ctx.closePath();
  ctx.fillStyle = darken(color, 0.28);
  ctx.fill();

  // --- 3. Body: radial gradient — bright top-left, rich mid, deep bottom ---
  const g = ctx.createRadialGradient(
    x - rx * 0.30, y - ry * 0.38, r * 0.08,
    x + rx * 0.05, y + ry * 0.05, r * 1.20
  );
  g.addColorStop(0,    lighten(color, 0.60));
  g.addColorStop(0.30, lighten(color, 0.18));
  g.addColorStop(0.65, color);
  g.addColorStop(1,    darken(color, 0.30));

  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // --- 4. Primary specular highlight ---
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.30, y - ry * 0.36, rx * 0.22, ry * 0.16, -0.45, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fill();

  // --- 5. Tiny secondary specular (depth) ---
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.12, y - ry * 0.16, rx * 0.08, ry * 0.06, -0.45, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
}

// --- props -----------------------------------------------------------------

/** Plinth X-center positions as fraction of W for 1/2/3 plinths. */
const PLINTH_X: Record<number, number[]> = {
  1: [0.50],
  2: [0.33, 0.67],
  3: [0.22, 0.50, 0.78],
};

/**
 * Draws polished cylindrical display columns using exact production dimensions
 * from layoutDimensions.ts. Rendering: floor shadow → body → bottom cap →
 * top cap. All plinths are 40 cm diameter; height varies by selected size.
 */
function drawPlinths(
  ctx: CanvasRenderingContext2D,
  W: number,
  floorY: number,
  sizes: PlinthSize[],
  pxPerCm: number
) {
  const n = Math.min(3, sizes.length);
  if (n <= 0) return;
  const xFracs = PLINTH_X[n] ?? [0.5];

  for (let i = 0; i < n; i++) {
    const cx   = W * (xFracs[i] ?? 0.5);
    const dims = getPlinthDimensions(sizes[i]);
    const diam = dims.diameterCm * pxPerCm;
    const h    = dims.heightCm   * pxPerCm;
    const rx   = diam / 2;
    // Foreshortened ellipse for top/bottom — looks correct at typical 2.5D angle
    const ry   = diam * 0.155;
    const x    = cx - rx;
    const topY = floorY - h;

    // --- 1. Blurred floor shadow ---
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, floorY + 5, rx * 0.80, rx * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.filter = "blur(4px)";
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();

    // --- 2. Cylinder body — horizontal gradient simulates curvature ---
    const bodyGrad = ctx.createLinearGradient(x, 0, x + diam, 0);
    bodyGrad.addColorStop(0,    "#BEBAB6");   // deep shadow on left rim
    bodyGrad.addColorStop(0.16, "#E8E4E0");   // penumbra
    bodyGrad.addColorStop(0.38, "#FFFFFF");   // key-light centre
    bodyGrad.addColorStop(0.60, "#F2EFEC");   // gentle falloff
    bodyGrad.addColorStop(0.84, "#DEDBD7");   // penumbra
    bodyGrad.addColorStop(1,    "#BDBAB6");   // deep shadow on right rim
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x, topY + ry, diam, h - ry);   // body stops at the top cap centre

    // --- 3. Bottom cap ellipse (slightly darker, partially occluded) ---
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, floorY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#B8B4B0";
    ctx.fill();
    ctx.restore();

    // --- 4. Top cap ellipse — bright white, creates full 3D illusion ---
    ctx.save();
    const topGrad = ctx.createRadialGradient(
      cx - rx * 0.28, topY - ry * 0.15, 0,
      cx, topY, rx * 1.05
    );
    topGrad.addColorStop(0,   "#FFFFFF");
    topGrad.addColorStop(0.5, "#F8F5F3");
    topGrad.addColorStop(1,   "#DEDAD6");
    ctx.beginPath();
    ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = topGrad;
    ctx.fill();
    // Rim stroke for crisp edge
    ctx.strokeStyle = "rgba(0,0,0,0.09)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // --- 5. Specular highlight strip on body (left of centre) ---
    const hiGrad = ctx.createLinearGradient(x + rx * 0.55, 0, x + rx * 0.82, 0);
    hiGrad.addColorStop(0, "rgba(255,255,255,0)");
    hiGrad.addColorStop(0.5, "rgba(255,255,255,0.20)");
    hiGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.fillStyle = hiGrad;
    ctx.fillRect(x + rx * 0.55, topY + ry * 2, rx * 0.27, h - ry * 3);
    ctx.restore();
  }
}

const TEXT_HEX: Record<string, string> = {
  white: "#FFFFFF",
  gold: "#D4AF37",
  black: "#222222",
};

function drawBackdropText(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  config: BuilderConfig,
  accent: string
) {
  const t = config.decor.backdropText;
  const text = (resolveBackdropText(t) || "Happy Birthday").slice(0, 24);
  const color = t.color === "accent" ? accent : TEXT_HEX[t.color] ?? accent;
  const fontFamily =
    t.fontStyle === "block"
      ? '700 %SIZE%px Inter, system-ui, sans-serif'
      : t.fontStyle === "elegant"
        ? 'italic 600 %SIZE%px Georgia, "Times New Roman", serif'
        : 'italic 600 %SIZE%px "Brush Script MT", "Segoe Script", cursive';
  const size = Math.round(ctx.canvas.clientWidth * 0.04);
  ctx.save();
  ctx.font = fontFamily.replace("%SIZE%", String(size));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // subtle shadow so light text stays legible on light backdrops
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = color;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

function drawCutouts(
  ctx: CanvasRenderingContext2D,
  W: number,
  floorY: number,
  level: string,
  palette: string[]
) {
  const counts: Record<string, number> = { small: 2, medium: 4, premium: 6 };
  const n = counts[level] ?? 0;
  for (let i = 0; i < n; i++) {
    const x = W * (0.1 + (i / Math.max(1, n)) * 0.8);
    const size = W * 0.035;
    drawStar(ctx, x, floorY - size * 1.4, size, palette[i % palette.length]);
  }
}

function drawCakeTable(
  ctx: CanvasRenderingContext2D,
  W: number,
  floorY: number,
  accent: string
) {
  const accentHex = accent;
  const w = W * 0.16;
  const h = W * 0.09;
  const x = W * 0.5 - w / 2;
  const y = floorY - h;
  // table
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y + h * 0.45, w, h * 0.55, 3);
  ctx.fill();
  ctx.strokeStyle = darken(accentHex, 0.05);
  ctx.lineWidth = 1;
  ctx.stroke();
  // cake
  ctx.fillStyle = lighten(accentHex, 0.45);
  roundRect(ctx, x + w * 0.34, y, w * 0.32, h * 0.5, 3);
  ctx.fill();
  // candle
  ctx.strokeStyle = accentHex;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.5, y - h * 0.25);
  ctx.stroke();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- color helpers ---------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.round(c * (1 - amt));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function isColorDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 110;
}

// Deterministic PRNG so the garland is stable across re-renders.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
