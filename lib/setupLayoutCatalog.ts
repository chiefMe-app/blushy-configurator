/**
 * Curated setup layout templates.
 *
 * Free-form backdrop combinations degrade garland quality and make standee
 * placement unpredictable. Each template locks:
 *   - which backdrop panels compose the set (max 2)
 *   - how the garland should read in the prompt
 *   - where plinths belong
 *   - normalized floor zones for deterministic standee overlay placement
 *
 * All zone coordinates are normalized (0..1) against the final render image —
 * never hardcoded pixels — so they work at any fal image size.
 *
 * Removed layouts (kept out intentionally): arch_round, round_shimmer.
 * Round is single-only as a product decision.
 */

export interface LayoutZone {
  /**
   * Normalized horizontal anchor (0..1 of image width) of the standee's OUTER
   * edge. With preferredSide "right" the asset extends leftward from x; with
   * "left" it extends rightward from x.
   */
  x: number;
  /** Normalized floor anchor (0..1 of image height) for the asset bottom. */
  bottomY: number;
  /** Max asset height as fraction of image height. */
  maxHeightFraction: number;
  /** Max asset width as fraction of image width. */
  maxWidthFraction: number;
  preferredSide?: "left" | "right";
}

/** Shape tokens for the playful mini preview illustration on setup cards. */
export type MiniPreviewShape =
  | "arch" | "arch_large" | "arch_small"
  | "round" | "shimmer" | "open_frame" | "balloons";

export interface SetupLayoutTemplate {
  id: string;
  name: string;
  description: string;
  /** Backdrop panel types composing this set, in left-to-right scene order. */
  backdropTypes: string[];
  maxBackdrops: number;
  /** Optional playful badge shown on the card, e.g. "Popular", "Glam". */
  badge?: string;
  /** Shapes drawn in the card's mini preview illustration. */
  miniPreview: MiniPreviewShape[];
  garlandInstruction: string;
  panelInstruction: string;
  plinthInstruction: string;
  standeeZones: {
    large: LayoutZone[];
    medium: LayoutZone[];
    small: LayoutZone[];
  };
}

// Shared zone presets — outer edges, clear of the central backdrop opening.
const ZONES_STANDARD = {
  large:  [{ x: 0.99, bottomY: 0.92, maxHeightFraction: 0.56, maxWidthFraction: 0.42, preferredSide: "right" as const },
           { x: 0.01, bottomY: 0.92, maxHeightFraction: 0.56, maxWidthFraction: 0.42, preferredSide: "left" as const }],
  medium: [{ x: 0.03, bottomY: 0.94, maxHeightFraction: 0.40, maxWidthFraction: 0.34, preferredSide: "left" as const },
           { x: 0.99, bottomY: 0.94, maxHeightFraction: 0.40, maxWidthFraction: 0.34, preferredSide: "right" as const }],
  small:  [{ x: 0.96, bottomY: 0.96, maxHeightFraction: 0.25, maxWidthFraction: 0.26, preferredSide: "right" as const }],
};

// Tighter zones for 2-piece sets — keep standees off both panel faces.
const ZONES_TWO_PIECE = {
  large:  [{ x: 0.99, bottomY: 0.92, maxHeightFraction: 0.54, maxWidthFraction: 0.38, preferredSide: "right" as const }],
  medium: [{ x: 0.02, bottomY: 0.94, maxHeightFraction: 0.38, maxWidthFraction: 0.32, preferredSide: "left" as const }],
  small:  [{ x: 0.96, bottomY: 0.96, maxHeightFraction: 0.24, maxWidthFraction: 0.24, preferredSide: "right" as const }],
};

export const SETUP_LAYOUT_TEMPLATES: SetupLayoutTemplate[] = [
  {
    id: "single_arch",
    name: "Single Arch",
    description: "Classic arch with flowing garland",
    backdropTypes: ["arch"],
    maxBackdrops: 1,
    badge: "Popular",
    miniPreview: ["arch", "balloons"],
    panelInstruction: "A single freestanding solid arch backdrop panel centered in the scene.",
    garlandInstruction: "Balloon design: one statement half-garland anchored by a dense cluster of large balloons at the top-right crown of the arch, cascading down the right edge with gradually smaller balloons, ending in a loose trailing cluster of small balloons pooling on the floor at the arch base. The left side of the arch stays completely clean and balloon-free.",
    plinthInstruction: "Place cylinder plinths on the left/front side of the arch, clear of the garland.",
    standeeZones: ZONES_STANDARD,
  },
  {
    id: "single_round",
    name: "Single Round",
    description: "Statement circle backdrop",
    backdropTypes: ["round"],
    maxBackdrops: 1,
    miniPreview: ["round", "balloons"],
    panelInstruction: "A single freestanding circular round backdrop panel centered in the scene. No second backdrop of any kind.",
    garlandInstruction: "Preserve one organic balloon garland arcing along the upper-right perimeter of the round backdrop only — a partial arc, never a full ring.",
    plinthInstruction: "Place cylinder plinths on the left/front side of the round panel, away from the right-side garland.",
    standeeZones: ZONES_STANDARD,
  },
  {
    id: "single_shimmer",
    name: "Single Shimmer",
    description: "Sparkling sequin wall",
    backdropTypes: ["shimmer_wall"],
    maxBackdrops: 1,
    badge: "Glam",
    miniPreview: ["shimmer", "balloons"],
    panelInstruction: "A single freestanding square shimmer sequin wall centered in the scene.",
    garlandInstruction: "Balloon design: one corner-mounted garland hugging the top-right corner of the shimmer wall — a dense cluster of large balloons at the corner itself, spilling a short arm along the top edge and a longer arm about two-thirds of the way down the right edge. Balloons sit tight against the wall edge so the sequin surface stays almost fully visible.",
    plinthInstruction: "Place cylinder plinths front-left or centered in front of the shimmer wall.",
    standeeZones: ZONES_STANDARD,
  },
  {
    id: "arch_shimmer",
    name: "Arch + Shimmer",
    description: "Arch with a sparkle sidekick",
    backdropTypes: ["arch", "shimmer_wall"],
    maxBackdrops: 2,
    badge: "Glam",
    miniPreview: ["arch", "shimmer"],
    panelInstruction: "Two backdrop pieces: the solid arch panel on the left and the square shimmer sequin wall on the right, standing side by side as separate physical boards.",
    garlandInstruction: "Balloon design: one continuous bridge garland — it starts as a dense cluster of large balloons on the upper-left shoulder of the arch, sweeps over the arch crown, dips slightly in the gap between the two pieces, and lands on the top-left corner of the shimmer wall with a medium cluster. One single connected garland spanning both pieces; the shimmer wall's right edge and the arch's left edge stay clean.",
    plinthInstruction: "Place cylinder plinths in front of the arch, clear of both panels.",
    standeeZones: ZONES_TWO_PIECE,
  },
  {
    id: "double_arch",
    name: "Double Arch",
    description: "Two arches, side by side",
    backdropTypes: ["arch", "arch"],
    maxBackdrops: 2,
    badge: "Popular",
    miniPreview: ["arch_large", "arch_small"],
    panelInstruction:
      "Use exactly two solid arch backdrop panels side-by-side, bases aligned on the same floor line. " +
      "The larger arch is on the left and the smaller arch is on the right, both front-facing, " +
      "with a small clean gap or slight edge touch between them. " +
      "Do not overlap them front/back. Do not create a third panel. Do not place any panel behind another. " +
      "No perspective tunnel — a curated flat pair of arches.",
    garlandInstruction:
      "Balloon design: mirrored organic garlands. The left garland starts at floor level at the left arch's outer base, " +
      "climbs up the left outer edge, and ends at the crown of the left arch. " +
      "The right garland mirrors it exactly: starting at floor level at the right arch's outer base, " +
      "climbing the right outer edge, ending at the right arch's crown. " +
      "No horizontal balloon bridge across both arches, no disconnected balloon columns, no floating balloon strings, no bouquets. " +
      "Keep the center area between the arches clean.",
    plinthInstruction:
      "If there is one cake plinth, place it at the horizontal center of the full double-arch setup, " +
      "in front of the gap between the two arches. Keep the center area clean for it.",
    standeeZones: {
      // 1 standee → right outer; 2 standees → left + right outer (mirrored)
      large:  [{ x: 0.99, bottomY: 0.92, maxHeightFraction: 0.54, maxWidthFraction: 0.38, preferredSide: "right" },
               { x: 0.01, bottomY: 0.92, maxHeightFraction: 0.54, maxWidthFraction: 0.38, preferredSide: "left" }],
      medium: [{ x: 0.01, bottomY: 0.94, maxHeightFraction: 0.38, maxWidthFraction: 0.32, preferredSide: "left" },
               { x: 0.99, bottomY: 0.94, maxHeightFraction: 0.38, maxWidthFraction: 0.32, preferredSide: "right" }],
      small:  [{ x: 0.97, bottomY: 0.96, maxHeightFraction: 0.24, maxWidthFraction: 0.24, preferredSide: "right" },
               { x: 0.03, bottomY: 0.96, maxHeightFraction: 0.24, maxWidthFraction: 0.24, preferredSide: "left" }],
    },
  },
  {
    id: "arch_open_frame",
    name: "Arch + Open Frame",
    description: "Solid arch with a hollow frame friend",
    backdropTypes: ["arch", "open_arch_frame"],
    maxBackdrops: 2,
    miniPreview: ["arch", "open_frame"],
    panelInstruction: "Two pieces: a solid filled arch backdrop panel plus a freestanding hollow open arch frame beside it — the open arch frame is a pastel painted foam/wood arch outline with a completely empty center opening, no solid backdrop surface inside it, and NO extra backdrop panel behind it — the room wall is visible straight through the frame opening.",
    garlandInstruction: "Balloon design: the solid arch is the main piece and the open frame is a secondary accent. One restrained accent cluster sits only on the open frame's top-right shoulder — a compact group of large balloons tapering to a few small ones, hugging the frame band. Most of the frame outline stays bare and the hollow opening stays completely clear — balloons never cross, fill, or block the opening. Do not wrap the whole frame; do not encircle it; do not create a separate disconnected balloon column; the solid arch carries no garland of its own.",
    plinthInstruction: "Place cylinder plinths at the front-left, clear of both the solid arch and the open frame.",
    standeeZones: ZONES_TWO_PIECE,
  },
  {
    id: "shimmer_open_frame",
    name: "Shimmer + Open Frame",
    description: "Sparkle wall behind a hollow arch",
    backdropTypes: ["shimmer_wall", "open_arch_frame"],
    maxBackdrops: 2,
    miniPreview: ["shimmer", "open_frame"],
    panelInstruction: "Two pieces: a square shimmer sequin wall with a freestanding hollow open arch frame placed to its front/side — the open arch frame is a pastel painted foam/wood arch outline with a completely empty center opening, so the shimmer sequin sparkle is visible straight through the frame opening. The shimmer wall is the ONLY panel; do not add any other backdrop behind or inside the frame.",
    garlandInstruction: "Balloon design: exactly two pieces in this scene — the flat rectangular shimmer wall and the hollow open arch frame; never add a third backdrop or hidden backing piece. One accent cluster sits only on the open frame's top-left shoulder, flowing partway down the frame's left leg with smaller balloons. Most of the frame outline and the entire shimmer wall stay clean, and the frame's hollow opening stays completely clear — balloons never cross or block it. Do not wrap the whole frame; do not put balloons on the shimmer wall itself; no disconnected balloon column.",
    plinthInstruction: "Place cylinder plinths at the front-left, clear of the frame opening.",
    standeeZones: ZONES_TWO_PIECE,
  },
];

export function getSetupLayoutTemplate(id: string): SetupLayoutTemplate | undefined {
  return SETUP_LAYOUT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Infer the curated template from currently selected backdrop items.
 * Count-aware: two arches infer double_arch. Returns null when the
 * combination doesn't match a curated set (e.g. rect panels) — callers
 * fall back to generic behavior.
 */
export function inferSetupLayoutTemplateIdFromBackdropItems(
  items: { type: string }[],
): string | null {
  const types = items.map((i) => i.type).sort();
  const key = types.join("+");
  if (key === "arch") return "single_arch";
  if (key === "round") return "single_round";
  if (key === "shimmer_wall") return "single_shimmer";
  if (key === "arch+arch") return "double_arch";
  if (key === "arch+shimmer_wall") return "arch_shimmer";
  if (key === "arch+open_arch_frame") return "arch_open_frame";
  if (key === "open_arch_frame+shimmer_wall") return "shimmer_open_frame";
  return null;
}
