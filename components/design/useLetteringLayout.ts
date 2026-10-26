// The live sketch's lettering: the real engine's paths for a board's Heading
// and Name, from /api/typography/layout (the same layout the render guide
// draws). Requests wait for a pause in typing, repeat answers come from a
// small cache, and the last drawing stays up while the next one loads.
import { useEffect, useRef, useState } from "react";
import type { BoardLettering } from "@/lib/config";

export interface LetteringDrawing {
  box: { widthMm: number; heightMm: number };
  hash: string;
  paths: { role: "heading" | "name"; fontId: string; d: string; fontSizeMm: number }[];
}

const cache = new Map<string, LetteringDrawing>();
const DELAY_MS = 220;

function payloadOf(l: BoardLettering): string {
  const line = (x: BoardLettering["heading"]) => ({ text: x.text, fontId: x.fontId, weight: x.weight, size: x.size });
  return JSON.stringify({ presetId: l.presetId ?? l.basedOn, heading: line(l.heading), name: line(l.name) });
}

export function useLetteringLayout(lettering: BoardLettering | undefined): LetteringDrawing | null {
  const key = lettering && (lettering.heading.text.trim() || lettering.name.text.trim()) ? payloadOf(lettering) : null;
  const [drawing, setDrawing] = useState<LetteringDrawing | null>(() => (key ? cache.get(key) ?? null : null));
  const seq = useRef(0);

  useEffect(() => {
    if (!key) { setDrawing(null); return; }
    const hit = cache.get(key);
    if (hit) { setDrawing(hit); return; }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/typography/layout", { method: "POST", headers: { "content-type": "application/json" }, body: key });
        if (!res.ok) return; // keep the last drawing
        const json = (await res.json()) as LetteringDrawing;
        if (cache.size > 200) cache.clear();
        cache.set(key, json);
        if (id === seq.current) setDrawing(json);
      } catch { /* offline: keep the last drawing */ }
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [key]);

  return drawing;
}
