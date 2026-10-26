// T2 review sheet: preset lettering laid out on the Single Round's clear area,
// drawn three ways from the same engine output — preview (px), production SVG
// (mm) and cut file (merged outlines) — plus each element's per-method
// assessment. Writes test-results/typography/t2-*.{png,md}; it checks that the
// three drawings agree pixel for pixel.
import fs from "fs";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import { describe, expect, it } from "vitest";
import { layoutLettering, layoutNeon, type LayoutInput } from "@/lib/typography/layout";
import { previewSvg, productionSvg } from "@/lib/typography/svg";
import { cutSvg } from "@/lib/typography/cutReady";
import { presetById } from "@/lib/typography/presets";
import { FINISHES } from "@/lib/typography/production";
import type { Alternative } from "@/lib/typography/check";

const OUT = path.resolve(__dirname, "../../test-results/typography");
const BOX = { widthMm: 691, heightMm: 420 };
const PX = 1.4;

const cases: { title: string; input: LayoutInput }[] = [
  { title: "#5 Soft Signature — Bellefair / Italianno", input: preset("soft-signature", "Happy 1st Birthday", "Layla") },
  { title: "#9 Modern Editorial — Cormorant 600 / Bodoni Moda 700 (display, default)", input: preset("modern-editorial", "Happy 2nd Birthday", "Malek") },
  { title: "#9 with the Bodoni sturdy cut (option, customer confirms)", input: (() => { const i = preset("modern-editorial", "Happy 2nd Birthday", "Malek"); return { ...i, name: { ...i.name!, optical: "text" } }; })() },
  { title: "#5 · Turkish · heading Large, name Small, own colours", input: (() => { const i = preset("soft-signature", "İyi ki doğdun", "Ayşe Gül"); return { ...i, heading: { ...i.heading!, size: "large", color: "#B08D57" }, name: { ...i.name!, size: "small", color: "#C2185B" } }; })() },
];
function preset(id: string, h: string, n: string): LayoutInput {
  const p = presetById(id)!;
  return { heading: { text: h, ...p.headingFont }, name: { text: n, ...p.nameFont }, headingRatio: p.headingRatio, box: BOX };
}

const raster = (svg: string, w: number, h: number) => sharp(Buffer.from(svg.replace(/width="[^"]+" height="[^"]+"/, `width="${w}" height="${h}"`))).flatten({ background: "#fff" }).png().toBuffer();
const label = (w: number, text: string) => Buffer.from(`<svg width="${w}" height="34"><rect width="100%" height="100%" fill="#15182E"/><text x="12" y="23" font-family="Arial" font-size="17" fill="#fff">${text.replace(/&/g, "&amp;")}</text></svg>`);
const altText = (a: Alternative) => a.kind === "weight" ? `weight ${a.weight} (${a.thinMm} mm${a.meetsLimit ? " ✓" : ""})` : a.kind === "optical" ? `${a.label} (${a.thinMm} mm${a.meetsLimit ? " ✓" : ""})` : a.kind === "size" ? `cap ≥ ${a.minCapHeightMm} mm` : `${a.finish}`;

describe("T2 review sheet", () => {
  it("preview, production SVG and cut file agree for every case", async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const W = Math.round(BOX.widthMm * PX), H = Math.round(BOX.heightMm * PX);
    const parts: OverlayOptions[] = [];
    const md: string[] = ["# T2 — per-method assessment (preliminary, provisional limits)", ""];
    let y = 0;
    for (const c of cases) {
      const l = layoutLettering(c.input);
      const pv = await raster(previewSvg(l, PX), W, H);
      const pr = await raster(productionSvg(l), W, H);
      const cut = await raster(cutSvg(l).replace(/<path /g, '<path fill="#15182E" '), W, H);
      // The three drawings of the same layout must match.
      const px = async (b: Buffer) => (await sharp(b).greyscale().raw().toBuffer());
      const [a, b2, c2] = await Promise.all([pv, pr, cut].map(px));
      // Compare where ink is, not its colour (cases may use their own colours).
      const ink = (v: number) => v < 235;
      const diff = (p: Buffer, q: Buffer) => p.reduce((n, v, i) => n + (ink(v) !== ink(q[i]) ? 1 : 0), 0) / p.length;
      // Same paths (unit-tested byte for byte); only edge anti-aliasing of two fill colours may differ.
      expect(diff(a, b2), `${c.title}: preview vs production`).toBeLessThan(0.0005);
      expect(diff(a, c2), `${c.title}: preview vs cut`).toBeLessThan(0.002);
      parts.push({ input: label(W * 3 + 20, c.title), left: 0, top: y });
      [pv, pr, cut].forEach((buf, i) => parts.push({ input: buf, left: i * (W + 10), top: y + 34 }));
      y += 34 + H + 10;
      md.push(`## ${c.title}`, "", `| Element | Font | Cap mm | ${FINISHES.map((f) => f.label).join(" | ")} |`, `|---|---|---|${FINISHES.map(() => "---").join("|")}|`);
      for (const e of l.elements) {
        const cells = FINISHES.map((f) => { const a = e.finishes[f.id]; return a.status === "ok" ? "ok" : `check: ${a.notes.map((n) => n.kind === "thin_strokes" ? `thin ${n.thinMm}<${n.minMm} mm` : n.kind).join(", ")}${a.alternatives.length ? ` — options: ${a.alternatives.map(altText).join("; ")}` : ""}`; });
        md.push(`| ${e.role} "${e.input.text}" | ${e.input.fontId} ${e.input.weight}${e.input.optical ? `/${e.input.optical}` : ""} | ${e.capHeightMm.toFixed(1)} | ${cells.join(" | ")} |`);
      }
      md.push("");
    }
    // Neon, its own font: the board's script vs a monoline face.
    md.push("## LED neon (own font)", "", "| Font | Neon |", "|---|---|");
    for (const fontId of ["italianno", "sacramento", "windsong"]) {
      const n = layoutNeon({ text: "Let's Party", fontId, weight: fontId === "windsong" ? 500 : 400 }, { widthMm: 420, heightMm: 300 }).elements[0].finishes.neon;
      md.push(`| ${fontId} | ${n.status === "ok" ? "ok (monoline)" : n.notes.map((x) => x.kind).join(", ")} |`);
    }
    await sharp({ create: { width: W * 3 + 20, height: y, channels: 3, background: "#e5e5e5" } }).composite(parts).png().toFile(path.join(OUT, "t2-sheet.png"));
    fs.writeFileSync(path.join(OUT, "t2-assessments.md"), md.join("\n") + "\n");
  }, 120_000);
});
