"use client";
// A part's render looked at closely (2026-11-03, the owner: "render'a zoom in yapılıp detaylar incelenebilir mi?"):
// a tap opens it over the page; a tap on it there zooms in where she tapped (and out again); zoomed in, it is
// dragged or scrolled round (on a phone also pinched, as any page).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** How much closer a tap goes, from the picture fitted on the screen. */
const ZOOM = 2.6;

export default function ZoomPhoto({ src, alt, testId, className = "bz-tb-photo" }: { src: string; alt: string; testId?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  // Zoomed in: the picture's width then, and where to look first (its fraction across and down).
  const [zoom, setZoom] = useState<{ w: number; fx: number; fy: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const close = () => { setOpen(false); setZoom(null); };
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  // Zoomed in: the place she tapped brought to the middle.
  useEffect(() => {
    const b = box.current;
    if (!zoom || !b) return;
    b.scrollLeft = zoom.fx * b.scrollWidth - b.clientWidth / 2;
    b.scrollTop = zoom.fy * b.scrollHeight - b.clientHeight / 2;
  }, [zoom]);
  const tap = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    if (drag.current?.moved) return;
    if (zoom) { setZoom(null); return; }
    // Its width in its own CSS pixels (offsetWidth: on a wide screen the page is zoomed, html { zoom: .75 }); where she
    // tapped as a fraction of it.
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ w: e.currentTarget.offsetWidth * ZOOM, fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height });
  };
  return (
    <span className="bz-zoom-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={className} data-testid={testId} src={src} alt={alt} style={{ cursor: "zoom-in" }} onClick={() => setOpen(true)} />
      <button type="button" className="bz-zoom-open" aria-label="Look closer" data-testid={testId && `${testId}-zoom`} onClick={() => setOpen(true)}>⤢ Look closer</button>
      {open && createPortal(
        <div className="bz-zoom" role="dialog" aria-modal="true" aria-label={alt} data-testid="render-zoom"
          // Its taps are its own, not the preview's it was opened from (a portal's events still reach it).
          onClick={(e) => { e.stopPropagation(); close(); }} onPointerDown={(e) => e.stopPropagation()}>
          <div ref={box} className={`bz-zoom-box${zoom ? " in" : ""}`}
            onPointerDown={(e) => { if (zoom && e.pointerType === "mouse") drag.current = { x: e.clientX, y: e.clientY, left: box.current!.scrollLeft, top: box.current!.scrollTop, moved: false }; }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || !box.current) return;
              if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
              box.current.scrollLeft = d.left - (e.clientX - d.x);
              box.current.scrollTop = d.top - (e.clientY - d.y);
            }}
            onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} draggable={false} onClick={tap} style={zoom ? { width: zoom.w, maxWidth: "none", maxHeight: "none", cursor: "zoom-out" } : undefined} />
          </div>
          <button type="button" className="bz-zoom-close" aria-label="Close" onClick={close}>×</button>
          <p className="bz-zoom-hint">{zoom ? "Tap to zoom out · drag to look around" : "Tap where you want to look closer"}</p>
        </div>,
        document.body,
      )}
    </span>
  );
}
