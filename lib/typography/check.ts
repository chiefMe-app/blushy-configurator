// Preliminary production check for one lettering element (Typography System).
// Each production method — Printed, Vinyl, Acrylic, Mirror Acrylic, LED Neon —
// is assessed on its own from the qualify measurements (fonts.generated.json)
// and the PROVISIONAL limits in production.ts.
//
// It only informs. Nothing here changes a choice: where a method has a concern
// it lists OPTIONS within the same font (a heavier weight, a sturdier optical
// version, a minimum size, another method) — those that meet the limit, and
// those that make the thinnest stroke clearly (>= 25%) thicker, flagged with
// meetsLimit. Each option needs the customer to
// see it in the preview and confirm it (`confirm: "preview"`). Every result is
// provisional until the producer confirms the limits.
import generated from "./fonts.generated.json";
import { FINISHES, finishById, type FinishId } from "./production";
import { fontById, fontVariants, variantKey } from "./registry";

interface Measured {
  coverage: { ok: boolean; missing: string };
  capHeightEm: number;
  stroke: { thinOfCap: number; thin10OfCap: number; medianOfCap: number; monoline: number };
  pieces: Record<string, number>;
}

const MONOLINE_FOR_NEON = 0.65;

export interface ElementSpec {
  fontId: string;
  weight: number;
  /** Optical version id; empty = the font's default. */
  optical?: string;
  capHeightMm: number;
  text?: string;
}

export type CheckNote =
  | { kind: "thin_strokes"; thinMm: number; minMm: number }
  | { kind: "not_monoline"; monoline: number }
  | { kind: "separate_letters"; word: string; pieces: number }
  | { kind: "missing_letters"; letters: string };

export type Alternative = { confirm: "preview" } & (
  | { kind: "weight"; weight: number; thinMm: number; meetsLimit: boolean }
  | { kind: "optical"; optical: string; label: string; thinMm: number; meetsLimit: boolean }
  | { kind: "size"; minCapHeightMm: number }
  | { kind: "finish"; finish: FinishId }
);

export interface FinishAssessment {
  finish: FinishId;
  status: "ok" | "check";
  thinMm: number;
  notes: CheckNote[];
  alternatives: Alternative[];
  provisional: boolean;
}

export function measured(fontId: string, weight: number, optical?: string): Measured | undefined {
  const f = (generated.fonts as Record<string, { weights: Record<string, Measured> }>)[fontId];
  return f?.weights[variantKey(weight, optical, fontById(fontId))];
}

/** Letters of `text` the font is known not to draw (from the qualify character set). */
export function missingLetters(fontId: string, weight: number, text: string, optical?: string): string {
  const m = measured(fontId, weight, optical);
  if (!m) return "";
  const missing = new Set(Array.from(m.coverage.missing));
  return Array.from(new Set(Array.from(text).filter((ch) => missing.has(ch)))).join("");
}

export function neonFriendly(fontId: string, weight: number, optical?: string): boolean {
  return (measured(fontId, weight, optical)?.stroke.monoline ?? 0) >= MONOLINE_FOR_NEON;
}

const mm = (v: number) => +v.toFixed(2);
/** An option is listed when it meets the limit, or makes the thinnest stroke at least this much thicker. */
const HELPS = 1.25;

export function assessFinish(spec: ElementSpec, finish: FinishId): FinishAssessment {
  const font = fontById(spec.fontId);
  const m = measured(spec.fontId, spec.weight, spec.optical);
  if (!font || !m) throw new Error(`unknown font ${spec.fontId}@${spec.weight}${spec.optical ? `/${spec.optical}` : ""}`);
  const limits = finishById(finish);
  const thinMm = mm(m.stroke.thinOfCap * spec.capHeightMm);
  const notes: CheckNote[] = [];
  const alternatives: Alternative[] = [];
  // Options change one thing at a time: another weight in the same optical
  // cut, or another optical cut at the same weight.
  const currentOptical = spec.optical ?? font.optical?.find((o) => o.default)?.id;
  const others = fontVariants(font).filter((v) => {
    const sameWeight = v.weight.weight === spec.weight, sameOptical = (v.optical?.id ?? undefined) === currentOptical;
    return sameWeight !== sameOptical; // exactly one of the two differs
  });

  if (limits.minStrokeMm !== null && thinMm < limits.minStrokeMm) {
    notes.push({ kind: "thin_strokes", thinMm, minMm: limits.minStrokeMm });
    for (const v of others) {
      const vm = measured(font.id, v.weight.weight, v.optical?.id)!;
      const t = mm(vm.stroke.thinOfCap * spec.capHeightMm);
      const meetsLimit = t >= limits.minStrokeMm;
      if (!meetsLimit && t < thinMm * HELPS) continue;
      if (v.weight.weight !== spec.weight) alternatives.push({ kind: "weight", weight: v.weight.weight, thinMm: t, meetsLimit, confirm: "preview" });
      else if (v.optical) alternatives.push({ kind: "optical", optical: v.optical.id, label: v.optical.label, thinMm: t, meetsLimit, confirm: "preview" });
    }
    alternatives.push({ kind: "size", minCapHeightMm: Math.ceil(limits.minStrokeMm / m.stroke.thinOfCap), confirm: "preview" });
    for (const f of FINISHES) if (f.id !== finish && f.id !== "neon" && (f.minStrokeMm === null || thinMm >= f.minStrokeMm)) alternatives.push({ kind: "finish", finish: f.id, confirm: "preview" });
  }
  if (limits.prefersMonoline && m.stroke.monoline < MONOLINE_FOR_NEON) {
    notes.push({ kind: "not_monoline", monoline: m.stroke.monoline });
    for (const v of others) {
      const vm = measured(font.id, v.weight.weight, v.optical?.id)!;
      if (vm.stroke.monoline < MONOLINE_FOR_NEON) continue;
      const t = mm(vm.stroke.thinOfCap * spec.capHeightMm);
      if (v.weight.weight !== spec.weight) alternatives.push({ kind: "weight", weight: v.weight.weight, thinMm: t, meetsLimit: true, confirm: "preview" });
      else if (v.optical) alternatives.push({ kind: "optical", optical: v.optical.id, label: v.optical.label, thinMm: t, meetsLimit: true, confirm: "preview" });
    }
  }
  if (limits.prefersConnectedScript && font.category === "signature") {
    for (const [word, pieces] of Object.entries(m.pieces)) if (pieces > 1) { notes.push({ kind: "separate_letters", word, pieces }); break; }
  }
  const letters = spec.text ? missingLetters(spec.fontId, spec.weight, spec.text, spec.optical) : "";
  if (letters) notes.push({ kind: "missing_letters", letters });
  return { finish, status: notes.length ? "check" : "ok", thinMm, notes, alternatives, provisional: limits.provisional };
}

/** All production methods, each judged on its own. */
export function assessAllFinishes(spec: ElementSpec): Record<FinishId, FinishAssessment> {
  return Object.fromEntries(FINISHES.map((f) => [f.id, assessFinish(spec, f.id)])) as Record<FinishId, FinishAssessment>;
}

/** Back-compatible single check (T1 API). */
export function preliminaryCheck(fontId: string, weight: number, capHeightMm: number, finish: FinishId, text = "") {
  const a = assessFinish({ fontId, weight, capHeightMm, text }, finish);
  return { status: a.status, thinMm: a.thinMm, notes: a.notes, provisional: a.provisional };
}
