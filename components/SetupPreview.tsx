"use client";

import { useEffect, useRef, useState } from "react";
import type { BuilderConfig, PlinthSize } from "@/lib/config";
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

/** Snapshot of config values relevant to change detection. */
type Snap = {
  theme: string;
  pkg: string;
  nonce: number;
  shape: string;
  color: string;
  balloonStyle: string;
  balloonColors: string;
  backdropPrint: string;
  plinthSizes: string;
  extras: string;
};

/** Compare current snapshot to the snapshot when the last image was generated. */
function detectChangeType(curr: Snap, base: Snap): ChangeType {
  if (curr.nonce !== base.nonce) return "full";
  if (curr.theme !== base.theme) return "theme";
  if (curr.pkg !== base.pkg) return "full";
  if (curr.shape !== base.shape) return "shape";
  if (curr.color !== base.color || curr.balloonColors !== base.balloonColors) return "colors";
  if (curr.balloonStyle !== base.balloonStyle) return "balloons";
  if (curr.backdropPrint !== base.backdropPrint) return "print";
  if (curr.plinthSizes !== base.plinthSizes || curr.extras !== base.extras) return "extras";
  return "full";
}

/**
 * Debounced preview hook with incremental img2img support.
 *
 * - First generation: full text-to-image (flux-2-pro).
 * - Subsequent focused changes: img2img via fal-ai/flux-pro/kontext, keeping
 *   overall composition stable and only updating what changed.
 * - Theme changes and manual Regenerate clicks always trigger full t2i.
 */
export function useSetupPreview(config: BuilderConfig) {
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isIncremental, setIsIncremental] = useState(false);
  const reqId = useRef(0);
  const [nonce, setNonce] = useState(0);

  // Snapshot of the config at the time of the last successful generation.
  // Change detection compares current config to this — not to the previous render.
  const baseSnap = useRef<Snap | null>(null);
  // URL of the last successfully generated image (sent as reference for img2img).
  const baseImageUrlRef = useRef<string | null>(null);

  const extras = deriveExtras(config);
  const d = config.decor;

  const sig = JSON.stringify({
    t: config.theme,
    p: config.package,
    et: config.eventType,
    cnt: d.backdropCount,
    s: d.backdropShape,
    b: d.balloonStyle,
    bc: d.backdropColor,
    blc: d.balloonColors,
    txt: d.backdropText,
    bp: d.backdropPrint,
    cut: d.cutouts,
    pl: PLINTH_MODE === "ai" ? d.plinthSizes : undefined,
    e: extras,
    n: nonce,
  });

  useEffect(() => {
    const id = ++reqId.current;

    const curr: Snap = {
      theme: config.theme,
      pkg: config.package,
      nonce,
      shape: d.backdropShape ?? "",
      color: d.backdropColor ?? "",
      balloonStyle: d.balloonStyle,
      balloonColors: JSON.stringify(d.balloonColors),
      backdropPrint: JSON.stringify(d.backdropPrint),
      plinthSizes: JSON.stringify(PLINTH_MODE === "ai" ? d.plinthSizes : []),
      extras: JSON.stringify(extras),
    };

    // Determine what changed relative to the last generated image.
    const base = baseSnap.current;
    const changeType: ChangeType =
      base && baseImageUrlRef.current ? detectChangeType(curr, base) : "full";

    const incremental = changeType !== "full" && changeType !== "theme";
    setIsIncremental(incremental);
    setStatus("loading");

    const capturedBaseUrl = baseImageUrlRef.current;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: config.theme,
            package: config.package,
            eventType: config.eventType,
            backdropCount: d.backdropCount,
            backdropShape: d.backdropShape,
            backdropColor: d.backdropColor,
            balloonStyle: d.balloonStyle,
            balloonColors: d.balloonColors,
            backdropText: d.backdropText,
            backdropPrint: d.backdropPrint,
            cutouts: d.cutouts,
            plinthSizes: PLINTH_MODE === "ai" ? d.plinthSizes : undefined,
            extras,
            baseImageUrl: incremental ? capturedBaseUrl : undefined,
            changeType,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (!res.ok || !data.imageUrl) {
          setStatus("error");
          return;
        }
        // Update the base snapshot and image URL for the next change detection.
        baseSnap.current = curr;
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

export default function SetupPreview({
  config,
  status,
  imageUrl,
  isIncremental = false,
  onRegenerate,
  showControls = true,
}: {
  config: BuilderConfig;
  status: PreviewStatus;
  imageUrl: string | null;
  isIncremental?: boolean;
  onRegenerate: () => void;
  showControls?: boolean;
}) {
  const hasImage = status === "done" && !!imageUrl;
  const isUpdating = status === "loading" && isIncremental && hasImage;

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-inner">
        {/* AI image when ready, otherwise the canvas sketch as fallback */}
        {hasImage || isUpdating ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl!}
            alt="AI-generated party setup preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <LiveSetupPreview config={config} />
        )}

        {/* Plinth overlay — SVG mode only; AI mode renders plinths in the image */}
        {(hasImage || isUpdating) && PLINTH_MODE === "svg" && (
          <PlinthOverlay sizes={config.decor.plinthSizes} />
        )}

        {/* Full skeleton for first-time / theme generation */}
        {status === "loading" && !isIncremental && (
          <div className="shimmer absolute inset-0 flex flex-col items-center justify-center gap-3 bg-accent-soft/80 backdrop-blur-sm">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-accent/25 border-t-accent" />
            <span className="text-sm font-medium text-accent">Creating your preview…</span>
          </div>
        )}

        {/* Subtle pill for incremental img2img updates — image stays visible */}
        {isUpdating && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 backdrop-blur">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span className="text-[11px] font-medium text-white">Updating preview…</span>
          </div>
        )}

        {/* Regenerate button (corner) */}
        {showControls && hasImage && (
          <button
            type="button"
            onClick={onRegenerate}
            className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur transition hover:bg-black/70"
          >
            <span className="text-sm leading-none">↻</span> Regenerate
          </button>
        )}

        {/* Fallback note when generation failed */}
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
