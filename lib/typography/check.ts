// Preliminary production check for one lettering element (Typography System,
// T1). Combines the qualify measurements (fonts.generated.json) with the
// provisional limits in production.ts. It only informs: nothing here blocks a
// choice or swaps a font, and every result says it is provisional until the
// producer confirms the limits.
import generated from "./fonts.generated.json";
import { finishById, type FinishId } from "./production";
import { fontById } from "./registry";

interface Measured {
  coverage: { ok: boolean; missing: string };
  capHeightEm: number;
  stroke: { thinOfCap: number; thin10OfCap: number; medianOfCap: number; monoline: number };
  pieces: Record<string, number>;
}

const MONOLINE_FOR_NEON = 0.65;

export type CheckNote =
  | { kind: "thin_strokes"; thinMm: number; minMm: number }
  | { kind: "not_monoline"; monoline: number }
  | { kind: "separate_letters"; word: string; pieces: number }
  | { kind: "missing_letters"; letters: string };

export interface CheckResult {
  status: "ok" | "check";
  thinMm: number;
  notes: CheckNote[];
  provisional: boolean;
}

export function measured(fontId: string, weight: number): Measured | undefined {
  const f = (generated.fonts as Record<string, { weights: Record<string, Measured> }>)[fontId];
  return f?.weights[String(weight)];
}

/** Letters of `text` the font cannot draw (empty when all are covered). */
export function missingLetters(fontId: string, weight: number, text: string): string {
  const m = measured(fontId, weight);
  if (!m) return "";
  const missing = new Set(m.coverage.missing);
  return Array.from(new Set(Array.from(text).filter((ch) => missing.has(ch)))).join("");
}

export function preliminaryCheck(fontId: string, weight: number, capHeightMm: number, finish: FinishId, text = ""): CheckResult {
  const m = measured(fontId, weight);
  const limits = finishById(finish);
  if (!m || !fontById(fontId)) throw new Error(`unknown font ${fontId}@${weight}`);
  const thinMm = +(m.stroke.thinOfCap * capHeightMm).toFixed(2);
  const notes: CheckNote[] = [];
  if (limits.minStrokeMm !== null && thinMm < limits.minStrokeMm) notes.push({ kind: "thin_strokes", thinMm, minMm: limits.minStrokeMm });
  if (limits.prefersMonoline && m.stroke.monoline < MONOLINE_FOR_NEON) notes.push({ kind: "not_monoline", monoline: m.stroke.monoline });
  if (limits.prefersConnectedScript && fontById(fontId)!.category === "signature") {
    for (const [word, pieces] of Object.entries(m.pieces)) if (pieces > 1) { notes.push({ kind: "separate_letters", word, pieces }); break; }
  }
  const letters = missingLetters(fontId, weight, text);
  if (letters) notes.push({ kind: "missing_letters", letters });
  return { status: notes.length ? "check" : "ok", thinMm, notes, provisional: limits.provisional };
}

/** Faces that read as one even neon tube (a recommendation, never a requirement). */
export function neonFriendly(fontId: string, weight: number): boolean {
  return (measured(fontId, weight)?.stroke.monoline ?? 0) >= MONOLINE_FOR_NEON;
}
