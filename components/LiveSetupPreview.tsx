"use client";

import { useEffect, useRef } from "react";
import {
  themeById,
  resolveBackdropText,
  type BuilderConfig,
  type BackdropShapeId,
  type BalloonStyleId,
  type PlinthSize,
} from "@/lib/config";
import { calculateExactLayout, debugLayout } from "@/lib/calculateExactLayout";

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
      debugLayout(calculateExactLayout(config.decor.backdropItems, config.decor.plinthSizes, W, H));
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
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#FBF8F6");
  bg.addColorStop(1, "#F1E9E4");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const floorY = H * 0.9;
  const floor = ctx.createLinearGradient(0, floorY, 0, H);
  floor.addColorStop(0, "#EAded6");
  floor.addColorStop(1, "#E0D2C8");
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, W, H - floorY);

  // --- layout backdrops across the width -----------------------------------
  const items = config.decor.backdropItems;
  const count = Math.max(1, Math.min(3, items.length));
  const slotW = W / count;

  // Compute max height for relative apex scaling
  const maxHeightCm = Math.max(...items.map((it) => it.heightCm ?? 200));

  for (let i = 0; i < count; i++) {
    const cx = slotW * (i + 0.5);
    const item = items[i] ?? items[0];
    const shape = (item?.type ?? "arch") as BackdropShapeId;

    // Per-panel color — falls back to global backdrop color
    const panelColor = item?.color || backdropColor;
    const panelDark  = isColorDark(panelColor);

    // Apex based on relative height (taller panels reach higher up the canvas)
    const heightRatio  = (item?.heightCm ?? 200) / maxHeightCm;
    const apexFactor   = 0.05 + 0.12 * (1 - heightRatio);   // tallest → 0.05, shortest → 0.17
    const customApexY  = H * apexFactor;
    const panelHeightPx = floorY - customApexY;

    // Use the true widthCm/heightCm ratio so each panel renders at its correct
    // proportion. AI render is visual only — production dimensions come from
    // backdropItems.widthCm / backdropItems.heightCm.
    const wCm  = item?.widthCm  ?? 100;
    const hCm  = item?.heightCm ?? 200;
    const trueAspect = wCm / hCm;
    const intrinsicPw = panelHeightPx * trueAspect;

    // Clamp so panels fit their slot without overlapping neighbours
    const maxPw = slotW * 0.80;
    const minPw = slotW * 0.22;
    const pw = Math.max(minPw, Math.min(maxPw, intrinsicPw));

    drawBackdrop(ctx, cx, pw, floorY, H, shape, panelColor, panelDark, customApexY);

    const outline = backdropOutline(cx, pw, floorY, H, shape, customApexY);
    drawGarland(ctx, outline, floorY, pw, palette, config.decor.balloonStyle, i * 97 + 13);
  }

  // --- backdrop text: draw per-panel text, fall back to global setting ----
  const hasPanelText = config.decor.backdropItems.some((it) => it.text.enabled && it.text.value.trim());
  if (hasPanelText) {
    config.decor.backdropItems.forEach((it, i) => {
      if (!it.text.enabled || !it.text.value.trim()) return;
      const panelCx = slotW * (i + 0.5);
      drawBackdropText(ctx, panelCx, H * 0.5, config, accent);
    });
  } else if (config.decor.backdropText.enabled) {
    drawBackdropText(ctx, W / 2, H * 0.5, config, accent);
  }

  // --- props in front ------------------------------------------------------
  drawPlinths(ctx, W, floorY, config.decor.plinthSizes, accent);
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
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(outline[0].x, outline[0].y);
  for (const p of outline) ctx.lineTo(p.x, p.y);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, H * 0.14, 0, floorY);
  g.addColorStop(0, lighten(color, isDark ? 0.12 : 0.06));
  g.addColorStop(1, darken(color, 0.06));
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.shadowColor = "transparent";

  // soft inner edge
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = darken(color, 0.1);
  ctx.stroke();

  // Space theme: scatter a few stars on the panel.
  if (isDark) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const seed = mulberry32(42);
    for (let i = 0; i < 18; i++) {
      const x = cx - pw / 2 + seed() * pw;
      const y = H * 0.16 + seed() * (floorY - H * 0.16) * 0.8;
      const s = 0.6 + seed() * 1.4;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
    case "half":
      return { rows: 2, baseR: pw * 0.05, coverage: 0.55, spacing: 0.95, floorPool: 0 };
    case "full":
      return { rows: 3, baseR: pw * 0.055, coverage: 1, spacing: 0.85, floorPool: 4 };
    case "premium":
      return { rows: 4, baseR: pw * 0.062, coverage: 1, spacing: 0.78, floorPool: 8 };
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
      const off = (row - (sp.rows - 1) / 2) * sp.baseR * 0.9;
      const jx = (rng() - 0.5) * sp.baseR * 0.6;
      const jy = (rng() - 0.5) * sp.baseR * 0.6;
      const r = sp.baseR * (0.72 + rng() * 0.5);
      balls.push({
        x: st.x + nx * off + jx,
        y: st.y + ny * off + jy,
        r,
        color: palette[Math.floor(rng() * palette.length)],
      });
    }
  }

  // Floor pooling at both ends (grounds the garland).
  const ends = [stations[0], stations[stations.length - 1]].filter(Boolean);
  for (const end of ends) {
    if (Math.abs(end.y - floorY) > sp.baseR * 3) continue; // only ends actually at the floor
    for (let i = 0; i < sp.floorPool; i++) {
      const r = sp.baseR * (0.8 + rng() * 0.5);
      balls.push({
        x: end.x + (rng() - 0.5) * sp.baseR * 5,
        y: floorY - r * 0.5 - rng() * sp.baseR * 2,
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
  const rx = r * 0.86;
  const ry = r;

  // knot at the bottom
  ctx.beginPath();
  ctx.moveTo(x - r * 0.16, y + ry * 0.96);
  ctx.lineTo(x + r * 0.16, y + ry * 0.96);
  ctx.lineTo(x, y + ry * 1.22);
  ctx.closePath();
  ctx.fillStyle = darken(color, 0.22);
  ctx.fill();

  // body with radial highlight (light top-left → darker bottom)
  const g = ctx.createRadialGradient(
    x - rx * 0.35,
    y - ry * 0.4,
    r * 0.1,
    x,
    y,
    r * 1.15
  );
  g.addColorStop(0, lighten(color, 0.5));
  g.addColorStop(0.45, color);
  g.addColorStop(1, darken(color, 0.26));

  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // tiny specular dot
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.32, y - ry * 0.38, rx * 0.16, ry * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
}

// --- props -----------------------------------------------------------------

const PLINTH_HEIGHT: Record<PlinthSize, number> = {
  small: 0.1,
  medium: 0.14,
  large: 0.18,
};

function drawPlinths(
  ctx: CanvasRenderingContext2D,
  W: number,
  floorY: number,
  sizes: PlinthSize[],
  accent: string
) {
  const n = Math.min(3, sizes.length);
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    const cx = W * (0.3 + (i * 0.4) / Math.max(1, n - 1 || 1));
    const w = W * 0.06;
    const h = PLINTH_HEIGHT[sizes[i]] * floorY;
    const x = cx - w / 2;
    const y = floorY - h;
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, lighten(accent, 0.5));
    g.addColorStop(1, lighten(accent, 0.3));
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(x, y, w, 4);
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
