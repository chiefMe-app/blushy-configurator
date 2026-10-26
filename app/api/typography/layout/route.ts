// Typography demo API (isolated; not used by the Builder). Lays out a board's
// Heading and Name with the real lettering engine (lib/typography) and returns
// the preview SVG, the per-method assessments, or — with ?format=production|cut
// — the 1:1 mm production SVG / cut file. Text only ever becomes glyph
// outlines, never SVG text, and every field is validated against the registry.
// Not available on the production deployment.
import { NextRequest, NextResponse } from "next/server";
import { layoutLettering, type LetteringElementInput } from "@/lib/typography/layout";
import { previewSvg, productionSvg } from "@/lib/typography/svg";
import { cutSvg } from "@/lib/typography/cutReady";
import { fontById } from "@/lib/typography/registry";
import { presetById } from "@/lib/typography/presets";
import { DEMO_BOX, MAX_TEXT } from "@/lib/typography/demo";

export const runtime = "nodejs";

const SIZES = ["small", "medium", "large"] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

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
  if (process.env.VERCEL_ENV === "production") return new NextResponse("Not found", { status: 404 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const heading = parseElement(body.heading, "heading");
  const name = parseElement(body.name, "name");
  for (const p of [heading, name]) if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const ratio = typeof body.presetId === "string" ? presetById(body.presetId)?.headingRatio : undefined;

  const layout = layoutLettering({
    heading: (heading as { el?: LetteringElementInput }).el,
    name: (name as { el?: LetteringElementInput }).el,
    headingRatio: ratio,
    box: DEMO_BOX,
  });

  const format = req.nextUrl.searchParams.get("format");
  if (format === "production" || format === "cut") {
    const svg = format === "production" ? productionSvg(layout) : cutSvg(layout);
    return new NextResponse(svg, {
      headers: { "content-type": "image/svg+xml; charset=utf-8", "content-disposition": `attachment; filename="lettering-${format}-${layout.hash.slice(0, 8)}.svg"` },
    });
  }
  return NextResponse.json({
    box: DEMO_BOX,
    hash: layout.hash,
    svg: previewSvg(layout, 1),
    elements: layout.elements.map((e) => ({
      role: e.role, fontId: e.input.fontId, weight: e.input.weight, optical: e.input.optical ?? null,
      capHeightMm: e.capHeightMm, fontSizeMm: e.fontSizeMm, adjusted: e.adjusted, missing: e.missing, finishes: e.finishes,
    })),
  });
}
