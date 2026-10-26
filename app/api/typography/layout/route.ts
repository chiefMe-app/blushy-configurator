// Typography demo API (used by /typography-demo; not by the Builder). Lays out
// a board's Heading and Name with the real lettering engine (lib/typography)
// and returns the preview SVG.
//
// Public on the live site, so it is kept cheap and safe:
// - every field is validated against the registry; text only ever becomes
//   glyph outlines, never SVG text; texts are capped at MAX_TEXT;
// - request bodies over 4 KB are refused;
// - each client IP gets at most RATE_LIMIT layouts per window (per instance);
// - identical requests are answered from a small in-memory cache;
// - the production SVG / cut file downloads (?format=) are off on the
//   production deployment (heavier, and not part of the demo).
import { NextRequest, NextResponse } from "next/server";
import { layoutLettering, type LetteringElementInput } from "@/lib/typography/layout";
import { previewSvg, productionSvg } from "@/lib/typography/svg";
import { cutSvg } from "@/lib/typography/cutReady";
import { fontById } from "@/lib/typography/registry";
import { presetById } from "@/lib/typography/presets";
import { DEMO_BOX, DEMO_NAME_CAP_MM, MAX_TEXT } from "@/lib/typography/demo";

export const runtime = "nodejs";

const SIZES = ["small", "medium", "large"] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_BODY_BYTES = 4096;
const RATE_LIMIT = 60; // layouts per IP per window
const RATE_WINDOW_MS = 60_000;
const CACHE_ENTRIES = 300;

const hits = new Map<string, { count: number; resetAt: number }>();
const cache = new Map<string, string>();

/** True when this IP may have another layout now (fixed window, per instance). */
function allow(ip: string, now = Date.now()): boolean {
  const h = hits.get(ip);
  if (!h || now >= h.resetAt) {
    if (hits.size > 5000) hits.clear(); // bound the table
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  h.count++;
  return h.count <= RATE_LIMIT;
}

type Parsed = { ok: true; el?: LetteringElementInput } | { ok: false; error: string };

function parseElement(raw: unknown, role: string): Parsed {
  if (raw === undefined || raw === null) return { ok: true };
  if (typeof raw !== "object") return { ok: false, error: `${role}: not an object` };
  const r = raw as Record<string, unknown>;
  const text = typeof r.text === "string" ? r.text.replace(/[\r\n\t]+/g, " ") : "";
  if (text.length > MAX_TEXT) return { ok: false, error: `${role}: text longer than ${MAX_TEXT}` };
  const font = typeof r.fontId === "string" ? fontById(r.fontId) : undefined;
  if (!font || font.legacyOnly) return { ok: false, error: `${role}: unknown font` };
  const weight = Number(r.weight);
  if (!font.weights.some((w) => w.weight === weight)) return { ok: false, error: `${role}: weight not available` };
  const optical = r.optical === undefined || r.optical === "" ? undefined : String(r.optical);
  if (optical !== undefined && !font.optical?.some((o) => o.id === optical)) return { ok: false, error: `${role}: optical version not available` };
  const size = r.size === undefined ? undefined : SIZES.find((s) => s === r.size);
  if (r.size !== undefined && !size) return { ok: false, error: `${role}: bad size` };
  const color = r.color === undefined ? undefined : String(r.color);
  if (color !== undefined && !HEX.test(color)) return { ok: false, error: `${role}: bad colour` };
  const off = r.offset as { x?: unknown; y?: unknown } | undefined;
  const clamp = (v: unknown) => Math.max(-0.45, Math.min(0.45, Number.isFinite(Number(v)) ? Number(v) : 0));
  return { ok: true, el: { text, fontId: font.id, weight, optical, size, color, offset: off ? { x: clamp(off.x), y: clamp(off.y) } : undefined } };
}

export async function POST(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format");
  const download = format === "production" || format === "cut";
  if (download && process.env.VERCEL_ENV === "production") return new NextResponse("Not found", { status: 404 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (!allow(ip)) return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429, headers: { "retry-after": "60" } });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const heading = parseElement(body.heading, "heading");
  const name = parseElement(body.name, "name");
  for (const p of [heading, name]) if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const ratio = typeof body.presetId === "string" ? presetById(body.presetId)?.headingRatio : undefined;
  const input = {
    heading: (heading as { el?: LetteringElementInput }).el,
    name: (name as { el?: LetteringElementInput }).el,
    headingRatio: ratio,
    box: DEMO_BOX,
    nameCapMm: DEMO_NAME_CAP_MM,
  };

  if (download) {
    const layout = layoutLettering(input);
    const svg = format === "production" ? productionSvg(layout) : cutSvg(layout);
    return new NextResponse(svg, {
      headers: { "content-type": "image/svg+xml; charset=utf-8", "content-disposition": `attachment; filename="lettering-${format}-${layout.hash.slice(0, 8)}.svg"` },
    });
  }

  const key = JSON.stringify(input);
  let json = cache.get(key);
  if (json) {
    cache.delete(key); // keep the most recent at the end
  } else {
    const layout = layoutLettering(input);
    json = JSON.stringify({
      box: DEMO_BOX,
      hash: layout.hash,
      svg: previewSvg(layout, 1),
      elements: layout.elements.map((e) => ({ role: e.role, missing: e.missing })),
    });
    if (cache.size >= CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  }
  cache.set(key, json);
  return new NextResponse(json, { headers: { "content-type": "application/json" } });
}
