"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BuilderConfig,
  PlinthSize,
  FontStyle,
  TextColor,
  TextAlign,
  CutoutSize,
  CutoutPosition,
  BackdropShapeId,
} from "@/lib/config";
import { resolveBackdropText, THEMES } from "@/lib/config";
import type { ChangeType } from "@/lib/generatePrompt";
import LiveSetupPreview from "./LiveSetupPreview";

const PLINTH_MODE: "ai" | "svg" = "ai";

export type PreviewStatus = "idle" | "loading" | "done" | "error";

export function deriveExtras(config: BuilderConfig): string[] {
  const e: string[] = [];
  if (config.decor.cakeTable) e.push("dessert_table");
  return e;
}

const PLINTH_HEIGHT_PCT: Record<PlinthSize, number> = {
  small: 22, medium: 25, large: 28,
};
const PLINTH_X_PCT: Record<number, number[]> = {
  1: [50], 2: [35, 65], 3: [25, 50, 75],
};

function PlinthOverlay({ sizes }: { sizes: PlinthSize[] }) {
  const n = Math.min(3, sizes.length);
  if (n === 0) return null;
  const xPositions = PLINTH_X_PCT[n] ?? [50];
  return (
    <div className="pointer-events-none absolute inset-0">
      {sizes.slice(0, 3).map((size, i) => {
        const left = xPositions[i] ?? 50;
        const h = PLINTH_HEIGHT_PCT[size] ?? 25;
        return (
          <div key={i} style={{
            position: "absolute", bottom: "5%", left: `${left}%`,
            transform: "translateX(-50%)", width: "6%", height: `${h}%`,
            background: "#FFFFFF", borderRadius: "4px",
            boxShadow: "2px 2px 8px rgba(0,0,0,0.25), inset -2px 0 4px rgba(0,0,0,0.08)",
          }}/>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text overlay — anchored to backdrop safe area, no AI regeneration.
// ---------------------------------------------------------------------------

const FONT_FAMILY: Record<FontStyle, string> = {
  script:  '"Brush Script MT", "Segoe Script", cursive',
  block:   '"Arial Black", Impact, sans-serif',
  elegant: 'Georgia, "Times New Roman", serif',
};
const FONT_WEIGHT: Record<FontStyle, number> = {
  script: 400, block: 900, elegant: 400,
};

/** Per-shape backdrop safe area (all values are % of container size). */
const BACKDROP_SAFE_AREA: Record<BackdropShapeId, { x: number; y: number; w: number; h: number }> = {
  arch:         { x: 22, y: 16, w: 56, h: 40 },
  half_arch:    { x: 10, y: 18, w: 45, h: 35 },
  round:        { x: 26, y: 22, w: 48, h: 32 },
  rect:         { x: 20, y: 15, w: 60, h: 44 },
  shimmer_wall: { x: 16, y: 14, w: 68, h: 46 },
  wavy:         { x: 18, y: 16, w: 64, h: 40 },
};

function resolveTextColor(color: TextColor, accent: string): string {
  if (color === "white") return "#FFFFFF";
  if (color === "gold")  return "#D4AF37";
  if (color === "black") return "#222222";
  return accent;
}

function TextOverlay({
  text, fontStyle, color, themeAccent,
  fontSize = 4, lineHeight = 140,
  verticalOffset = 30, horizontalOffset = 50,
  align = "center", shape = "arch",
}: {
  text: string;
  fontStyle: FontStyle;
  color: TextColor;
  themeAccent: string;
  fontSize?: number;
  lineHeight?: number;
  verticalOffset?: number;
  horizontalOffset?: number;
  align?: TextAlign;
  shape?: BackdropShapeId;
}) {
  const safe = BACKDROP_SAFE_AREA[shape] ?? BACKDROP_SAFE_AREA.arch;
  const resolvedColor = resolveTextColor(color, themeAccent);
  const textShadow = color === "black"
    ? "0 1px 3px rgba(255,255,255,0.5)"
    : "0 1px 5px rgba(0,0,0,0.65), 0 0 14px rgba(0,0,0,0.25)";

  // horizontalOffset 50 = centered, 0 = left-most, 100 = right-most within safe area.
  const blockCenterX = safe.x + safe.w * (horizontalOffset / 100);
  const leftPct      = blockCenterX - safe.w / 2;
  const topPct       = safe.y + safe.h * (verticalOffset / 100);
  const fontSizeRem  = (fontSize * 0.25 + 0.75).toFixed(2);
  const lineHeightVal = (lineHeight / 100).toFixed(2);

  const lines = text.split(/\\n|\n/);

  return (
    <div
      className="pointer-events-none absolute"
      style={{ top: `${topPct}%`, left: `${leftPct}%`, width: `${safe.w}%` }}
    >
      {lines.map((line, i) => (
        <p key={i} style={{
          fontFamily:    FONT_FAMILY[fontStyle],
          fontWeight:    FONT_WEIGHT[fontStyle],
          fontStyle:     fontStyle === "script" ? "italic" : "normal",
          color:         resolvedColor,
          textShadow,
          fontSize:      `${fontSizeRem}rem`,
          letterSpacing: fontStyle === "elegant" ? "0.1em" : fontStyle === "block" ? "0.04em" : "0.02em",
          textAlign:     align,
          lineHeight:    lineHeightVal,
          margin:        0,
          padding:       "0 4px",
          userSelect:    "none",
          whiteSpace:    "pre-wrap",
        }}>
          {line || " "}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cutout overlay — SVG character silhouettes, exact count, no AI call.
// Small=2  Medium=4  Premium=6+1 feature piece
// ---------------------------------------------------------------------------

const CUTOUT_COUNT: Record<Exclude<CutoutSize, "none">, number> = {
  small: 2, medium: 4, premium: 6,
};

// Horizontal anchor positions (% from left) for floor placement.
const FLOOR_X: Record<number, number[]> = {
  2: [18, 82],
  4: [12, 32, 68, 88],
  6: [8, 22, 37, 63, 78, 92],
};
// Anchor positions for backdrop-mounted placement.
const MOUNTED_X: Record<number, number[]> = {
  2: [30, 70],
  4: [24, 40, 60, 76],
  6: [18, 30, 43, 57, 70, 82],
};

function CharacterSVG({ accentColor, isFeature }: { accentColor: string; isFeature?: boolean }) {
  const skin = "#FFCC99";
  const hair = "#7B4F2E";
  const w = isFeature ? 90 : 80;
  return (
    <svg
      viewBox={`0 0 ${w} 220`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      {/* Ground shadow */}
      <ellipse cx={w / 2} cy="217" rx={w * 0.32} ry="3" fill="rgba(0,0,0,0.18)" />
      {/* Legs */}
      <rect x={w * 0.22} y="148" width={w * 0.2} height="64" rx="9" fill={accentColor} />
      <rect x={w * 0.58} y="148" width={w * 0.2} height="64" rx="9" fill={accentColor} />
      {/* Body */}
      <rect x={w * 0.08} y="72" width={w * 0.84} height="82" rx="14" fill={accentColor} />
      {/* Arms */}
      <rect x={w * -0.02} y="76" width={w * 0.13} height="58" rx="8" fill={accentColor} opacity="0.88" />
      <rect x={w * 0.89} y="76" width={w * 0.13} height="58" rx="8" fill={accentColor} opacity="0.88" />
      {/* Neck */}
      <rect x={w * 0.38} y="58" width={w * 0.24} height="17" rx="5" fill={skin} />
      {/* Head */}
      <ellipse cx={w / 2} cy="36" rx={w * 0.35} ry="33" fill={skin} />
      {/* Hair */}
      <ellipse cx={w / 2} cy="8" rx={w * 0.33} ry="14" fill={hair} />
      {/* Eyes */}
      <circle cx={w * 0.36} cy="32" r="5" fill="#333" />
      <circle cx={w * 0.64} cy="32" r="5" fill="#333" />
      <circle cx={w * 0.37} cy="30" r="2" fill="white" />
      <circle cx={w * 0.65} cy="30" r="2" fill="white" />
      {/* Smile */}
      <path
        d={`M ${w * 0.32} 46 Q ${w / 2} 56 ${w * 0.68} 46`}
        stroke="#555" strokeWidth="2.2" fill="none" strokeLinecap="round"
      />
      {/* Feature star crown */}
      {isFeature && (
        <text
          x={w / 2} y="2" textAnchor="middle"
          fontSize="16" fill="#FFD700" dominantBaseline="hanging"
        >
          ★
        </text>
      )}
    </svg>
  );
}

function CutoutPiece({
  left, bottom, widthPct, heightPct, accentColor, isFeature,
}: {
  left: number; bottom: number; widthPct: number; heightPct: number;
  accentColor: string; isFeature?: boolean;
}) {
  return (
    <div style={{
      position: "absolute",
      bottom: `${bottom}%`,
      left: `${left}%`,
      transform: "translateX(-50%)",
      width: `${widthPct}%`,
      height: `${heightPct}%`,
      filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.28))",
    }}>
      <CharacterSVG accentColor={accentColor} isFeature={isFeature} />
    </div>
  );
}

function CutoutOverlay({
  size, position, themeAccent,
}: {
  size: CutoutSize; position: CutoutPosition; themeAccent: string;
}) {
  if (size === "none") return null;

  const count      = CUTOUT_COUNT[size];
  const isFloor    = position === "floor";
  const isPremium  = size === "premium";
  const xArr       = isFloor ? (FLOOR_X[count] ?? [50]) : (MOUNTED_X[count] ?? [50]);
  const bottomPct  = isFloor ? 5 : 18;
  const pieceH     = isFloor ? 40 : 36;
  const pieceW     = 6.5;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Premium large feature piece behind the regular cutouts */}
      {isPremium && (
        <CutoutPiece
          left={50} bottom={bottomPct}
          widthPct={9} heightPct={50}
          accentColor={themeAccent} isFeature
        />
      )}
      {xArr.map((left, i) => (
        <CutoutPiece
          key={i}
          left={left} bottom={bottomPct}
          widthPct={pieceW} heightPct={pieceH}
          accentColor={themeAccent}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generation hook — text + cutout excluded from sig.
// ---------------------------------------------------------------------------

type Snap = {
  theme: string; pkg: string; nonce: number;
  shapes: string; color: string; balloonStyle: string;
  balloonColors: string; backdropPrint: string;
  plinthSizes: string; extras: string;
};

function detectChangeType(curr: Snap, base: Snap): ChangeType {
  if (curr.nonce !== base.nonce)           return "full";
  if (curr.theme !== base.theme)           return "full";
  if (curr.pkg !== base.pkg)               return "full";
  if (curr.shapes !== base.shapes)         return "full";
  if (curr.balloonStyle !== base.balloonStyle) return "full";
  if (curr.backdropPrint !== base.backdropPrint) return "full";
  if (curr.plinthSizes !== base.plinthSizes || curr.extras !== base.extras) return "full";
  if (curr.color !== base.color || curr.balloonColors !== base.balloonColors) return "colors";
  return "full";
}

export function useSetupPreview(config: BuilderConfig) {
  const [status, setStatus]             = useState<PreviewStatus>("idle");
  const [imageUrl, setImageUrl]         = useState<string | null>(null);
  const [isIncremental, setIsIncremental] = useState(false);
  const reqId   = useRef(0);
  const [nonce, setNonce] = useState(0);
  const baseSnap        = useRef<Snap | null>(null);
  const baseImageUrlRef = useRef<string | null>(null);
  const extras = deriveExtras(config);
  const d = config.decor;

  // backdropText and cutouts are overlay-only — excluded from the AI sig.
  const sig = JSON.stringify({
    t: config.theme, p: config.package, et: config.eventType,
    shapes: d.backdropShapes, b: d.balloonStyle,
    bc: d.backdropColor, blc: d.balloonColors,
    bp: d.backdropPrint,
    pl: PLINTH_MODE === "ai" ? d.plinthSizes : undefined,
    e: extras, n: nonce,
  });

  useEffect(() => {
    const id = ++reqId.current;
    const curr: Snap = {
      theme: config.theme, pkg: config.package, nonce,
      shapes: JSON.stringify(d.backdropShapes),
      color: d.backdropColor ?? "",
      balloonStyle: d.balloonStyle,
      balloonColors: JSON.stringify(d.balloonColors),
      backdropPrint: JSON.stringify(d.backdropPrint),
      plinthSizes: JSON.stringify(PLINTH_MODE === "ai" ? d.plinthSizes : []),
      extras: JSON.stringify(extras),
    };
    const base = baseSnap.current;
    const changeType: ChangeType =
      base && baseImageUrlRef.current ? detectChangeType(curr, base) : "full";
    const incremental = changeType !== "full" && changeType !== "theme";
    if (!incremental) baseImageUrlRef.current = null;
    setIsIncremental(incremental);
    setStatus("loading");
    const capturedBaseUrl = baseImageUrlRef.current;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: config.theme, package: config.package, eventType: config.eventType,
            backdropShapes: d.backdropShapes, backdropColor: d.backdropColor,
            balloonStyle: d.balloonStyle, balloonColors: d.balloonColors,
            backdropText: d.backdropText, backdropPrint: d.backdropPrint,
            cutouts: d.cutouts,
            plinthSizes: PLINTH_MODE === "ai" ? d.plinthSizes : undefined,
            extras, baseImageUrl: incremental ? capturedBaseUrl : undefined, changeType,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (!res.ok || !data.imageUrl) { setStatus("error"); return; }
        baseSnap.current        = curr;
        baseImageUrlRef.current = data.imageUrl;
        setImageUrl(data.imageUrl);
        setStatus("done");
      } catch {
        if (id === reqId.current) setStatus("error");
      }
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return { status, imageUrl, isIncremental, regenerate: () => setNonce((n) => n + 1) };
}

// ---------------------------------------------------------------------------
// Preview component
// ---------------------------------------------------------------------------

export default function SetupPreview({
  config, status, imageUrl, isIncremental = false, onRegenerate, showControls = true,
}: {
  config: BuilderConfig; status: PreviewStatus; imageUrl: string | null;
  isIncremental?: boolean; onRegenerate: () => void; showControls?: boolean;
}) {
  const themeAccent = THEMES.find((t) => t.id === config.theme)?.accent ?? "#C77DD6";
  const overlayText = resolveBackdropText(config.decor.backdropText);
  const primaryShape: BackdropShapeId = config.decor.backdropShapes[0] ?? "arch";

  const [shownUrl, setShownUrl]       = useState<string | null>(null);
  const shownUrlRef                   = useRef<string | null>(null);
  const [imgOpacity, setImgOpacity]   = useState(1);
  const [imgKey, setImgKey]           = useState(0);

  useEffect(() => {
    if (!imageUrl || imageUrl === shownUrlRef.current) return;
    const img = new window.Image();
    img.onload = () => {
      shownUrlRef.current = imageUrl;
      setImgOpacity(0);
      setShownUrl(imageUrl);
      setImgKey((k) => k + 1);
      requestAnimationFrame(() => requestAnimationFrame(() => setImgOpacity(1)));
    };
    img.src = imageUrl;
  }, [imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasShownImage      = !!shownUrl;
  const isLoadingWithImage = status === "loading" && hasShownImage;
  const isFirstLoad        = status === "loading" && !hasShownImage;

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-inner">

        {hasShownImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={imgKey}
            src={shownUrl!}
            alt="AI-generated party setup preview"
            style={{ opacity: imgOpacity, transition: "opacity 0.4s ease" }}
            className="h-full w-full object-cover"
          />
        ) : (
          <LiveSetupPreview config={config} />
        )}

        {hasShownImage && PLINTH_MODE === "svg" && (
          <PlinthOverlay sizes={config.decor.plinthSizes} />
        )}

        {/* Cutout overlay — exact count, SVG characters, no AI call */}
        {hasShownImage && config.decor.cutouts.size !== "none" && (
          <CutoutOverlay
            size={config.decor.cutouts.size}
            position={config.decor.cutouts.position}
            themeAccent={themeAccent}
          />
        )}

        {/* Text overlay — anchored to backdrop safe area, no AI call */}
        {hasShownImage && config.decor.backdropText.enabled && overlayText && (
          <TextOverlay
            text={overlayText}
            fontStyle={config.decor.backdropText.fontStyle}
            color={config.decor.backdropText.color}
            themeAccent={themeAccent}
            fontSize={config.decor.backdropText.fontSize}
            lineHeight={config.decor.backdropText.lineHeight}
            verticalOffset={config.decor.backdropText.verticalOffset}
            horizontalOffset={config.decor.backdropText.horizontalOffset}
            align={config.decor.backdropText.align}
            shape={primaryShape}
          />
        )}

        {isFirstLoad && (
          <div className="shimmer absolute inset-0 flex flex-col items-center justify-center gap-3 bg-accent-soft/80 backdrop-blur-sm">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-accent/25 border-t-accent" />
            <span className="text-sm font-medium text-accent">Creating your preview…</span>
          </div>
        )}

        {isLoadingWithImage && (
          <>
            <div className="absolute inset-0 animate-pulse bg-white/10 pointer-events-none" />
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 backdrop-blur">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span className="text-[11px] font-medium text-white">
                {isIncremental ? "Refining preview…" : "Generating…"}
              </span>
            </div>
          </>
        )}

        {showControls && hasShownImage && status !== "loading" && (
          <button
            type="button"
            onClick={onRegenerate}
            className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur transition hover:bg-black/70"
          >
            <span className="text-sm leading-none">↻</span> Regenerate
          </button>
        )}

        {status === "error" && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/45 px-3 py-1.5 backdrop-blur">
            <span className="text-[11px] text-white">AI preview unavailable — showing sketch</span>
            {showControls && (
              <button
                type="button"
                onClick={onRegenerate}
                className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 text-center text-[11px] text-black/45">
        AI preview — actual setup may vary slightly
      </p>
    </div>
  );
}
