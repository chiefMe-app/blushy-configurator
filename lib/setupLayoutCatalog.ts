/**
 * Controlled setup layout templates.
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

export interface SetupLayoutTemplate {
  id: string;
  name: string;
  description: string;
  /** Backdrop panel types composing this set, in left-to-right scene order. */
  backdropTypes: string[];
  maxBackdrops: number;
  garlandInstruction: string;
  panelInstruction: string;
  plinthInstruction: string;
  standeeZones: {
    large: LayoutZone[];
    medium: LayoutZone[];
    small: LayoutZone[];
  };
}

export const SETUP_LAYOUT_TEMPLATES: SetupLayoutTemplate[] = [
  {
    id: "single_arch",
    name: "Single Arch",
    description: "One arch backdrop with organic half garland",
    backdropTypes: ["arch"],
    maxBackdrops: 1,
    panelInstruction: "A single freestanding arch backdrop panel centered in the scene.",
    garlandInstruction: "Preserve one lush organic balloon garland flowing over the top and down the right side of the arch, reaching toward the floor.",
    plinthInstruction: "Place cylinder plinths on the left/front side of the arch, clear of the garland.",
    standeeZones: {
      large:  [{ x: 0.99, bottomY: 0.92, maxHeightFraction: 0.60, maxWidthFraction: 0.48, preferredSide: "right" }],
      medium: [{ x: 0.03, bottomY: 0.93, maxHeightFraction: 0.42, maxWidthFraction: 0.38, preferredSide: "left" },
               { x: 0.99, bottomY: 0.93, maxHeightFraction: 0.42, maxWidthFraction: 0.38, preferredSide: "right" }],
      small:  [{ x: 0.97, bottomY: 0.96, maxHeightFraction: 0.26, maxWidthFraction: 0.28, preferredSide: "right" }],
    },
  },
  {
    id: "single_round",
    name: "Single Round",
    description: "One round backdrop with upper-right half garland",
    backdropTypes: ["round"],
    maxBackdrops: 1,
    panelInstruction: "A single freestanding circular round backdrop panel centered in the scene.",
    garlandInstruction: "Preserve one organic balloon garland arcing along the upper-right perimeter of the round backdrop only — a partial arc, never a full ring.",
    plinthInstruction: "Place cylinder plinths on the left/front side of the round panel, away from the right-side garland.",
    standeeZones: {
      large:  [{ x: 0.99, bottomY: 0.92, maxHeightFraction: 0.60, maxWidthFraction: 0.48, preferredSide: "right" },
               { x: 0.01, bottomY: 0.92, maxHeightFraction: 0.60, maxWidthFraction: 0.48, preferredSide: "left" }],
      medium: [{ x: 0.05, bottomY: 0.94, maxHeightFraction: 0.42, maxWidthFraction: 0.38, preferredSide: "left" }],
      small:  [{ x: 0.95, bottomY: 0.96, maxHeightFraction: 0.26, maxWidthFraction: 0.28, preferredSide: "right" }],
    },
  },
  {
    id: "arch_shimmer",
    name: "Arch + Shimmer",
    description: "Arch on the left, shimmer wall on the right",
    backdropTypes: ["arch", "shimmer_wall"],
    maxBackdrops: 2,
    panelInstruction: "Two backdrop pieces: the arch panel on the left and the square shimmer sequin wall on the right, standing side by side as separate physical boards.",
    garlandInstruction: "Preserve one continuous organic balloon garland flowing from the top of the arch toward the upper edge of the shimmer wall — a connected lush garland, not separate balloon bouquets.",
    plinthInstruction: "Place cylinder plinths in front of the arch, clear of both panels.",
    standeeZones: {
      large:  [{ x: 0.99, bottomY: 0.92, maxHeightFraction: 0.56, maxWidthFraction: 0.42, preferredSide: "right" }],
      medium: [{ x: 0.02, bottomY: 0.94, maxHeightFraction: 0.40, maxWidthFraction: 0.34, preferredSide: "left" }],
      small:  [{ x: 0.96, bottomY: 0.96, maxHeightFraction: 0.25, maxWidthFraction: 0.26, preferredSide: "right" }],
    },
  },
  {
    id: "arch_round",
    name: "Arch + Round",
    description: "Arch beside a round backdrop",
    backdropTypes: ["arch", "round"],
    maxBackdrops: 2,
    panelInstruction: "Two backdrop pieces: the arch panel and the circular round panel standing side by side as separate physical boards.",
    garlandInstruction: "Preserve one organic balloon garland primarily following the arch top and its right edge — a connected flowing garland, not chaotic scattered balloons or bouquets.",
    plinthInstruction: "Place cylinder plinths at the front-left of the set, clear of both panels.",
    standeeZones: {
      large:  [{ x: 0.99, bottomY: 0.92, maxHeightFraction: 0.56, maxWidthFraction: 0.42, preferredSide: "right" },
               { x: 0.01, bottomY: 0.92, maxHeightFraction: 0.56, maxWidthFraction: 0.42, preferredSide: "left" }],
      medium: [{ x: 0.03, bottomY: 0.94, maxHeightFraction: 0.40, maxWidthFraction: 0.34, preferredSide: "left" }],
      small:  [{ x: 0.96, bottomY: 0.96, maxHeightFraction: 0.25, maxWidthFraction: 0.26, preferredSide: "right" }],
    },
  },
  {
    id: "round_shimmer",
    name: "Round + Shimmer",
    description: "Round backdrop beside a shimmer wall",
    backdropTypes: ["round", "shimmer_wall"],
    maxBackdrops: 2,
    panelInstruction: "Two backdrop pieces: the circular round panel and the square shimmer sequin wall standing side by side as separate physical boards.",
    garlandInstruction: "Preserve one organic balloon garland arcing along the upper-right of the round panel with a subtle accent reaching toward the shimmer wall edge — a connected garland, never a full ring and never loose bouquets.",
    plinthInstruction: "Place cylinder plinths at the front-left of the set, clear of both panels.",
    standeeZones: {
      large:  [{ x: 0.99, bottomY: 0.92, maxHeightFraction: 0.56, maxWidthFraction: 0.42, preferredSide: "right" }],
      medium: [{ x: 0.02, bottomY: 0.94, maxHeightFraction: 0.40, maxWidthFraction: 0.34, preferredSide: "left" }],
      small:  [{ x: 0.96, bottomY: 0.96, maxHeightFraction: 0.25, maxWidthFraction: 0.26, preferredSide: "right" }],
    },
  },
];

export function getSetupLayoutTemplate(id: string): SetupLayoutTemplate | undefined {
  return SETUP_LAYOUT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Infer the controlled template from currently selected backdrop items.
 * Returns null when the combination doesn't match a curated set (e.g. rect
 * panels or legacy 3-panel selections) — callers fall back to generic behavior.
 */
export function inferSetupLayoutTemplateIdFromBackdropItems(
  items: { type: string }[],
): string | null {
  const types = Array.from(new Set(items.map((i) => i.type))).sort();
  const key = types.join("+");
  if (key === "arch") return "single_arch";
  if (key === "round") return "single_round";
  if (key === "arch+shimmer_wall") return "arch_shimmer";
  if (key === "arch+round") return "arch_round";
  if (key === "round+shimmer_wall") return "round_shimmer";
  return null;
}
