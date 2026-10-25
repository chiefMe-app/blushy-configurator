// T1 report: thinnest stroke in mm at reference sizes, per finish, from the
// qualify measurements and the PROVISIONAL limits. Reference sizes only — the
// layout engine (T2) decides real sizes per board.
//   npx tsx scripts/typography/report.mts   -> test-results/typography/t1-report.md
import fs from "node:fs";
import path from "node:path";
import * as reg from "../../lib/typography/registry.ts";
import * as prod from "../../lib/typography/production.ts";
import * as presetsMod from "../../lib/typography/presets.ts";

// tsx loads these as CommonJS (the package is not "type": "module").
const cjs = <T,>(m: T) => ((m as unknown as { default?: T }).default ?? m);
const { FONTS } = cjs(reg), { FINISHES } = cjs(prod), { PRESETS } = cjs(presetsMod);
const ROOT = path.resolve(import.meta.dirname, "../..");
const gen = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/typography/fonts.generated.json"), "utf8")).fonts;

const NAME_CAP_MM = { S: 50, M: 70, L: 90 };
const HEADING_RATIO = 0.42;
const cut = FINISHES.filter((f) => f.minStrokeMm !== null);
const mark = (thin: number) => cut.map((f) => (thin >= (f.minStrokeMm as number) ? "✓" : "⚠")).join(" ");

const lines: string[] = [];
lines.push(`# T1 — font measurements (preliminary, provisional limits)`, "");
lines.push(`Limits: ${cut.map((f) => `${f.label} ≥ ${f.minStrokeMm} mm`).join(" · ")} — all provisional, producer to confirm.`);
lines.push(`Columns S/M/L = thinnest stroke in mm when the element's cap height is the reference size; marks = ${cut.map((f) => f.label).join(" / ")}.`, "");
for (const role of ["name", "heading"] as const) {
  const caps = Object.fromEntries(Object.entries(NAME_CAP_MM).map(([k, v]) => [k, role === "name" ? v : +(v * HEADING_RATIO).toFixed(1)]));
  lines.push(`## As ${role} (cap height S ${caps.S} · M ${caps.M} · L ${caps.L} mm)`, "");
  lines.push(`| Font | Weight | Monoline | Neon | S mm | M mm | L mm | M: ${cut.map((f) => f.label.replace(" Lettering", "")).join(" / ")} |`, `|---|---|---|---|---|---|---|---|`);
  for (const f of FONTS.filter((x) => !x.legacyOnly && x.bestFor.includes(role))) for (const w of f.weights) {
    const m = gen[f.id].weights[String(w.weight)];
    const t = (cap: number) => +(m.stroke.thinOfCap * cap).toFixed(1);
    lines.push(`| ${f.family} | ${w.weight} | ${m.stroke.monoline} | ${m.stroke.monoline >= 0.65 ? "recommended" : "—"} | ${t(caps.S)} | ${t(caps.M)} | ${t(caps.L)} | ${mark(t(caps.M))} |`);
  }
  lines.push("");
}
lines.push(`## Presets (name M ${NAME_CAP_MM.M} mm, heading ${+(NAME_CAP_MM.M * HEADING_RATIO).toFixed(1)} mm)`, "", `| # | Preset | Heading | thin mm | Name | thin mm |`, `|---|---|---|---|---|---|`);
for (const p of PRESETS) {
  const t = (id: string, wt: number, cap: number) => +(gen[id].weights[String(wt)].stroke.thinOfCap * cap).toFixed(1);
  lines.push(`| ${p.number} | ${p.name} | ${p.headingFont.fontId} ${p.headingFont.weight} | ${t(p.headingFont.fontId, p.headingFont.weight, NAME_CAP_MM.M * HEADING_RATIO)} | ${p.nameFont.fontId} ${p.nameFont.weight} | ${t(p.nameFont.fontId, p.nameFont.weight, NAME_CAP_MM.M)} |`);
}
fs.mkdirSync(path.join(ROOT, "test-results/typography"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "test-results/typography/t1-report.md"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
