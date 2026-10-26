// Production methods for lettering and their PROVISIONAL limits (Typography
// System, T1). These are the plan's starting assumptions, not supplier figures:
// every check built on them is a preliminary check that warns, never one that
// blocks or swaps a font, and never a production guarantee. Replace the values
// (and set provisional: false) only with a supplier's confirmed numbers.

export type FinishId = "printed" | "vinyl" | "acrylic" | "mirror_acrylic" | "neon";

export interface FinishLimits {
  id: FinishId;
  label: string;
  /** Thinnest stroke the method can produce, in mm. null = no stroke limit. */
  minStrokeMm: number | null;
  /** Script letters should join into one piece per word (cut lettering). */
  prefersConnectedScript: boolean;
  /** A single even-width tube reads as neon; strong thick-thin contrast does not. */
  prefersMonoline: boolean;
  provisional: boolean;
  note: string;
}

export const FINISHES: FinishLimits[] = [
  { id: "printed", label: "Printed", minStrokeMm: null, prefersConnectedScript: false, prefersMonoline: false, provisional: true, note: "Printed on the board surface; any approved font." },
  { id: "vinyl", label: "Vinyl Lettering", minStrokeMm: 1.2, prefersConnectedScript: false, prefersMonoline: false, provisional: true, note: "Plan assumption ~1.0–1.5 mm; producer to confirm." },
  { id: "acrylic", label: "Acrylic Lettering", minStrokeMm: 2.5, prefersConnectedScript: true, prefersMonoline: false, provisional: true, note: "Plan assumption ~2.5–3 mm for 3 mm acrylic; producer to confirm." },
  { id: "mirror_acrylic", label: "Mirror Acrylic Lettering", minStrokeMm: 2.5, prefersConnectedScript: true, prefersMonoline: false, provisional: true, note: "Plan assumption ~2.5–3 mm for 3 mm mirror acrylic; producer to confirm." },
  { id: "neon", label: "LED Neon", minStrokeMm: null, prefersConnectedScript: false, prefersMonoline: true, provisional: true, note: "Bent as an even tube, letter by letter or word by word on a backing; monoline faces read best. Producer to confirm minimum letter height." },
];

export const finishById = (id: FinishId) => FINISHES.find((f) => f.id === id)!;
