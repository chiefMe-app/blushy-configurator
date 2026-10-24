/**
 * Measurement overlay for the preview ("Show sizes").
 *
 * All labels are app-generated from scene state — never from AI output.
 *
 * 2026-10-24: the overlay used to draw dimension lines on an 800x600 layout
 * that no longer matches the square render, so the board's own size was
 * nowhere to be read ("show sizes diyince backdropun size ini gostermiyor").
 * It now states each backdrop piece's size in a label above the backdrop,
 * and the plinths' heights along the floor.
 */
"use client";

import type { BuilderConfig, BackdropItem } from "@/lib/config";

const PLINTH_NAME: Record<string, string> = { large: "XXL", medium: "XL", small: "L" };
const PLINTH_CM: Record<string, number> = { large: 90, medium: 75, small: 60 };

/** 200 -> "2 m", 120 -> "1.2 m", 95 -> "95 cm". */
function metres(cm: number): string {
  if (cm < 100) return `${cm} cm`;
  return `${Math.round(cm) / 100} m`;
}

function pieceName(it: BackdropItem, i: number, items: BackdropItem[]): string {
  const arches = items.filter((x) => x.type === "arch").length;
  const hasHalf = items.some((x) => x.type === "half_arch");
  switch (it.type) {
    case "arch": {
      const n = items.filter((x, k) => x.type === "arch" && k <= i).length;
      return arches > 1 ? (n === 1 ? "Main arch" : "Second arch") : hasHalf ? "Centre arch" : "Arch backdrop";
    }
    case "half_arch":
      return items.filter((x, k) => x.type === "half_arch" && k < i).length === 0 ? "Left half arch" : "Right half arch";
    case "round": return "Round backdrop";
    case "rect": return "Rectangle backdrop";
    case "banner": return "Banner backdrop";
    case "shimmer_wall": return "Shimmer wall";
    case "balloon_ring": return "Balloon ring";
    case "open_arch_frame": return "Open arch frame";
    default: return "Backdrop";
  }
}

export default function MeasurementOverlay({ config }: { config: BuilderConfig }) {
  const items = config.decor.backdropItems;
  const plinths = config.decor.plinthSizes.slice(0, 3);
  if (items.length === 0) return null;
  return (
    <div className="bz-sizes" aria-label="Sizes">
      <div className="bz-sizes-top">
        {items.map((it, i) => (
          <span key={it.id} className="bz-size-pill">
            <b>{pieceName(it, i, items)}</b>
            {` · ${metres(it.widthCm)} × ${metres(it.heightCm)}`}
          </span>
        ))}
        <span className="bz-size-arrow" aria-hidden="true">↓</span>
      </div>
      {plinths.length > 0 && (
        <div className="bz-sizes-bottom">
          <span className="bz-size-pill">
            <b>{plinths.length === 1 ? "Plinth" : "Plinths"}</b>
            {" · "}{plinths.map((s) => `${PLINTH_NAME[s] ?? s} ${PLINTH_CM[s] ?? ""} cm`).join(" · ")}
          </span>
        </div>
      )}
    </div>
  );
}
