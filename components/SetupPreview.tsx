"use client";

import { useEffect, useRef, useState } from "react";
import type { BuilderConfig } from "@/lib/config";
import LiveSetupPreview from "./LiveSetupPreview";

export type PreviewStatus = "idle" | "loading" | "done" | "error";

/** Derive the prompt's extra ids from the current decor selections. */
export function deriveExtras(config: BuilderConfig): string[] {
  const e: string[] = [];
  if (config.decor.cakeTable) e.push("dessert_table");
  return e;
}

/**
 * Debounced auto-generation of the photorealistic preview. Fires 1.5s after the
 * last change to theme / package / backdrop shape / balloon style / extras.
 * Stale responses are discarded via a request-id guard.
 */
export function useSetupPreview(config: BuilderConfig) {
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const reqId = useRef(0);
  const [nonce, setNonce] = useState(0); // bumped by regenerate()

  const extras = deriveExtras(config);
  const d = config.decor;
  // Regenerate when ANY of these change: theme, backdropColor, balloonColors,
  // backdropShape, backdropCount, balloonStyle, backdropText (+ cutouts/plinths).
  const sig = JSON.stringify({
    t: config.theme,
    p: config.package,
    cnt: d.backdropCount,
    s: d.backdropShape,
    b: d.balloonStyle,
    bc: d.backdropColor,
    blc: d.balloonColors,
    txt: d.backdropText,
    bp: d.backdropPrint,
    cut: d.cutouts,
    pl: d.plinthSizes,
    e: extras,
    n: nonce,
  });

  useEffect(() => {
    const id = ++reqId.current;
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: config.theme,
            package: config.package,
            backdropCount: d.backdropCount,
            backdropShape: d.backdropShape,
            backdropColor: d.backdropColor,
            balloonStyle: d.balloonStyle,
            balloonColors: d.balloonColors,
            backdropText: d.backdropText,
            backdropPrint: d.backdropPrint,
            cutouts: d.cutouts,
            plinthSizes: d.plinthSizes,
            extras,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (id !== reqId.current) return; // superseded by a newer request
        if (!res.ok || !data.imageUrl) {
          setStatus("error");
          return;
        }
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
    regenerate: () => setNonce((n) => n + 1),
  };
}

export default function SetupPreview({
  config,
  status,
  imageUrl,
  onRegenerate,
  showControls = true,
}: {
  config: BuilderConfig;
  status: PreviewStatus;
  imageUrl: string | null;
  onRegenerate: () => void;
  showControls?: boolean;
}) {
  const hasImage = status === "done" && !!imageUrl;

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-inner">
        {/* AI image when ready, otherwise the canvas sketch as fallback */}
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl!}
            alt="AI-generated party setup preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <LiveSetupPreview config={config} />
        )}

        {/* Loading skeleton with shimmer */}
        {status === "loading" && (
          <div className="shimmer absolute inset-0 flex flex-col items-center justify-center gap-3 bg-accent-soft/80 backdrop-blur-sm">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-accent/25 border-t-accent" />
            <span className="text-sm font-medium text-accent">Creating your preview…</span>
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
