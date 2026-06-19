"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BuilderConfig,
  PlinthSize,
  FontStyle,
  TextColor,
  CutoutSize,
  CutoutPosition,
} from "@/lib/config";
import { resolveBackdropText, THEMES } from "@/lib/config";
import type { ChangeType } from "@/lib/generatePrompt";
import LiveSetupPreview from "./LiveSetupPreview";

// Keep in sync with app/api/generate/route.ts PLINTH_MODE.
// "ai" = plinths sent to AI prompt, SVG overlay hidden.
// "svg" = plinths rendered as CSS overlay, not in AI prompt.
const PLINTH_MODE: "ai" | "svg" = "ai";

export type PreviewStatus = "idle" | "loading" | "done" | "error";

/** Derive the prompt's extra ids from the current decor selections. */
export function deriveExtras(config: BuilderConfig): string[] {
  const e: string[] = [];
  if (config.decor.cakeTable) e.push("dessert_table");
  return e;
}

/** Height of each plinth as % of the image container height. */
const PLINTH_HEIGHT_PCT: Record<PlinthSize, number> = {
  small: 22,
  medium: 25,
  large: 28,
};

/** Horizontal center positions (% from left) for 1, 2, or 3 plinths. */
const PLINTH_X_PCT: Record<number, number[]> = {
  1: [50],
  2: [35, 65],
  3: [25, 50, 75],
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
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: "5%",
              left: `${left}%`,
              transform: "translateX(-50%)",
              width: "6%",
              height: `${h}%`,
              background: "#FFFFFF",
              borderRadius: "4px",
              boxShadow:
                "2px 2px 8px rgba(0,0,0,0.25), inset -2px 0 4px rgba(0,0,0,0.08)",
            }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text overlay — updates instantly, no AI call.
// ---------------------------------------------------------------------------

const FONT_FAMILY: Record<FontStyle, string> = {
  script:  '"Brush Script MT", "Segoe Script", cursive',
  block:   '"Arial Black", Impact, sans-serif',
  elegant: 'Georgia, "Times New Roman", serif',
};

const FONT_WEIGHT: Record<FontStyle, number> = {
  script:  400,
  block:   900,
  elegant: 400,
};

function resolveTextColor(color: TextColor, themeAccent: string): string {
  if (color === "white")  return "#FFFFFF";
  if (color === "gold")   return "#D4AF37";
  if (color === "black")  return "#222222";
  return themeAccent;
}

function TextOverlay({
  text,
  fontStyle,
  color,
  themeAccent,
  verticalPct = 32,
}: {
  text: string;
  fontStyle: FontStyle;
  color: TextColor;
  themeAccent: string;
  /** Vertical position as % from top of the preview container. */
  verticalPct?: number;
}) {
  const resolvedColor = resolveTextColor(color, themeAccent);
  const textShadow =
    color === "black"
      ? "0 1px 3px rgba(255,255,255,0.5)"
      : "0 1px 5px rgba(0,0,0,0.65), 0 0 16px rgba(0,0,0,0.25)";

  // Split on literal \n OR actual newlines so custom text can span lines.
  const lines = text.split(/\\n|\n/);

  return (
    <div
      className="pointer-events-none absolute inset-x-0"
      style={{ top: `${verticalPct}%` }}
    >
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            fontFamily:    FONT_FAMILY[fontStyle],
            fontWeight:    FONT_WEIGHT[fontStyle],
            fontStyle:     fontStyle === "script" ? "italic" : "normal",
            color:         resolvedColor,
            textShadow,
            fontSize:      "clamp(0.95rem, 4vw, 2.2rem)",
            letterSpacing: fontStyle === "elegant" ? "0.1em" : fontStyle === "block" ? "0.04em" : "0.02em",
            textAlign:     "center",
            padding:       "0 10%",
            lineHeight:    1.35,
            margin:        0,
            userSelect:    "none",
          }}
        >
          {line || " "}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cutout overlay — shows correct cutout count without AI regeneration.
// Small = 2, Medium = 4, Premium = 6 + 1 large feature piece.
// ---------------------------------------------------------------------------

const CUTOUT_COUNT: Record<Exclude<CutoutSize, "none">, number> = {
  small:   2,
  medium:  4,
  premium: 6,
};

// Horizontal positions (% from left) keyed by cutout count.
const CUTOUT_X: Record<number, number[]> = {
  2: [22, 78],
  4: [16, 35, 65, 84],
  6: [10, 24, 38, 62, 76, 90],
};

function CutoutBoard({
  left,
  bottom,
  width,
  height,
}: {
  left: number;
  bottom: number;
  width: number;
  height: number;
}) {
  return (
    <div
      style={{
        position:     "absolute",
        bottom:       `${bottom}%`,
        left:         `${left}%`,
        transform:    "translateX(-50%)",
        width:        `${width}%`,
        height:       `${height}%`,
        background:   "rgba(255,255,255,0.12)",
        border:       "1.5px solid rgba(255,255,255,0.38)",
        // Rounded top suggests a head / character silhouette.
        borderRadius: "50% 50% 4px 4px / 22% 22% 4px 4px",
        boxShadow:    "0 2px 12px rgba(0,0,0,0.22)",
      }}
    />
  );
}

function CutoutOverlay({
  size,
  position,
}: {
  size: CutoutSize;
  position: CutoutPosition;
}) {
  if (size === "none") return null;

  const count      = CUTOUT_COUNT[size];
  const xPositions = CUTOUT_X[count] ?? [50];
  const bottomPct  = position === "floor" ? 5 : 30;
  const isPremium  = size === "premium";

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Premium large feature piece — centered, slightly bigger */}
      {isPremium && (
        <CutoutBoard
          left={50}
          bottom={bottomPct}
          width={9}
          height={50}
        />
      )}
      {xPositions.map((left, i) => (
        <CutoutBoard
          key={i}
          left={left}
          bottom={bottomPct}
          width={6}
          height={40}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generation hook
// ---------------------------------------------------------------------------

/** Snapshot of config values relevant to change detection. */
type Snap = {
  theme: string;
  pkg: string;
  nonce: number;
  shapes: string;
  color: string;
  balloonStyle: string;
  balloonColors: string;
  backdropPrint: string;
  plinthSizes: string;
  extras: string;
};

/**
 * Structural changes → full regeneration.
 * Text / font / color / cutout changes → overlay only, no AI call.
 */
function detectChangeType(curr: Snap, base: Snap): ChangeType {
  if (curr.nonce !== base.nonce)        return "full";
  if (curr.theme !== base.theme)        return "full";
  if (curr.pkg !== base.pkg)            return "full";
  if (curr.shapes !== base.shapes)      return "full";
  if (curr.balloonStyle !== base.balloonStyle) return "full";
  if (curr.backdropPrint !== base.backdropPrint) return "full";
  if (curr.plinthSizes !== base.plinthSizes || curr.extras !== base.extras) return "full";
  if (curr.color !== base.color || curr.balloonColors !== base.balloonColors) return "colors";
  return "full";
}

export function useSetupPreview(config: BuilderConfig) {
  const [status, setStatus]           = useState<PreviewStatus>("idle");
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  const [isIncremental, setIsIncremental] = useState(false);
  const reqId   = useRef(0);
  const [nonce, setNonce] = useState(0);

  const baseSnap        = useRef<Snap | null>(null);
  const baseImageUrlRef = useRef<string | null>(null);

  const extras = deriveExtras(config);
  const d      = config.decor;

  // Excluded from sig: backdropText (text/font/color) and cutouts.
  // Both are handled as overlays and must NOT trigger AI regeneration.
  const sig = JSON.stringify({
    t:      config.theme,
    p:      config.package,
    et:     config.eventType,
    shapes: d.backdropShapes,
    b:      d.balloonStyle,
    bc:     d.backdropColor,
    blc:    d.balloonColors,
    bp:     d.backdropPrint,
    pl:     PLINTH_MODE === "ai" ? d.plinthSizes : undefined,
    e:      extras,
    n:      nonce,
  });

  useEffect(() => {
    const id = ++reqId.current;

    const curr: Snap = {
      theme:         config.theme,
      pkg:           config.package,
      nonce,
      shapes:        JSON.stringify(d.backdropShapes),
      color:         d.backdropColor ?? "",
      balloonStyle:  d.balloonStyle,
      balloonColors: JSON.stringify(d.balloonColors),
      backdropPrint: JSON.stringify(d.backdropPrint),
      plinthSizes:   JSON.stringify(PLINTH_MODE === "ai" ? d.plinthSizes : []),
      extras:        JSON.stringify(extras),
    };

    const base       = baseSnap.current;
    const changeType: ChangeType =
      base && baseImageUrlRef.current ? detectChangeType(curr, base) : "full";

    const incremental = changeType !== "full" && changeType !== "theme";

    if (!incremental) {
      baseImageUrlRef.current = null;
    }

    setIsIncremental(incremental);
    setStatus("loading");

    const capturedBaseUrl = baseImageUrlRef.current;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/generate", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme:         config.theme,
            package:       config.package,
            eventType:     config.eventType,
            backdropShapes: d.backdropShapes,
            backdropColor:  d.backdropColor,
            balloonStyle:   d.balloonStyle,
            balloonColors:  d.balloonColors,
            backdropText:   d.backdropText,
            backdropPrint:  d.backdropPrint,
            cutouts:        d.cutouts,
            plinthSizes:    PLINTH_MODE === "ai" ? d.plinthSizes : undefined,
            extras,
            baseImageUrl:   incremental ? capturedBaseUrl : undefined,
            changeType,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (!res.ok || !data.imageUrl) {
          setStatus("error");
          return;
        }
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

  return {
    status,
    imageUrl,
    isIncremental,
    regenerate: () => setNonce((n) => n + 1),
  };
}

// ---------------------------------------------------------------------------
// Preview component
// ---------------------------------------------------------------------------

export default function SetupPreview({
  config,
  status,
  imageUrl,
  isIncremental = false,
  onRegenerate,
  showControls = true,
}: {
  config:        BuilderConfig;
  status:        PreviewStatus;
  imageUrl:      string | null;
  isIncremental?: boolean;
  onRegenerate:  () => void;
  showControls?:  boolean;
}) {
  const themeAccent = THEMES.find((t) => t.id === config.theme)?.accent ?? "#C77DD6";
  const overlayText = resolveBackdropText(config.decor.backdropText);

  const [shownUrl, setShownUrl]   = useState<string | null>(null);
  const shownUrlRef               = useRef<string | null>(null);
  const [imgOpacity, setImgOpacity] = useState(1);
  const [imgKey, setImgKey]       = useState(0);

  useEffect(() => {
    if (!imageUrl || imageUrl === shownUrlRef.current) return;
    const img = new window.Image();
    img.onload = () => {
      shownUrlRef.current = imageUrl;
      setImgOpacity(0);
      setShownUrl(imageUrl);
      setImgKey((k) => k + 1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setImgOpacity(1));
      });
    };
    img.src = imageUrl;
  }, [imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasShownImage     = !!shownUrl;
  const isLoadingWithImage = status === "loading" && hasShownImage;
  const isFirstLoad        = status === "loading" && !hasShownImage;

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-inner">

        {/* Base image — stays visible during all loading states */}
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

        {/* Plinth overlay — SVG mode only */}
        {hasShownImage && PLINTH_MODE === "svg" && (
          <PlinthOverlay sizes={config.decor.plinthSizes} />
        )}

        {/* Cutout overlay — updates instantly, no AI regeneration */}
        {hasShownImage && config.decor.cutouts.size !== "none" && (
          <CutoutOverlay
            size={config.decor.cutouts.size}
            position={config.decor.cutouts.position}
          />
        )}

        {/* Text overlay — updates instantly, no AI regeneration */}
        {hasShownImage && config.decor.backdropText.enabled && overlayText && (
          <TextOverlay
            text={overlayText}
            fontStyle={config.decor.backdropText.fontStyle}
            color={config.decor.backdropText.color}
            themeAccent={themeAccent}
          />
        )}

        {/* First-time skeleton */}
        {isFirstLoad && (
          <div className="shimmer absolute inset-0 flex flex-col items-center justify-center gap-3 bg-accent-soft/80 backdrop-blur-sm">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-accent/25 border-t-accent" />
            <span className="text-sm font-medium text-accent">Creating your preview…</span>
          </div>
        )}

        {/* Loading overlay on top of existing image */}
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

        {/* Regenerate button */}
        {showControls && hasShownImage && status !== "loading" && (
          <button
            type="button"
            onClick={onRegenerate}
            className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur transition hover:bg-black/70"
          >
            <span className="text-sm leading-none">↻</span> Regenerate
          </button>
        )}

        {/* Error fallback */}
        {status === "error" && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/45 px-3 py-1.5 backdrop-blur">
            <span className="text-[11px] text-white">
              AI preview unavailable — showing sketch
            </span>
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
