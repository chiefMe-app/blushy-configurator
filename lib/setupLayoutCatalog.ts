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
 *
 * Removed layouts (open-frame prop unreliable, pulled from product):
 * arch_open_frame, shimmer_open_frame.
 *
 * Removed layouts (product decision — shimmer wall pipeline too unreliable,
 * focus shifted to arch-based designs): single_shimmer, arch_shimmer.
 *
 * Double Arch (2026-07-13 removal, 2026-07-18 restoration): pulled from the
 * product on 2026-07-13 because render quality wasn't production-ready
 * (unreliable garlands, no working plinth). Restored 2026-07-18 with the
 * balloon behavior deliberately simplified: instead of the old dense/mirror
 * garland algorithm, each arch now reuses the exact same proven Single Arch
 * half-garland treatment, mirrored — see garlandInstruction below and the
 * doubleArchMirroredGarlandClause in buildLayoutRefEditPrompt.ts. Plinth
 * stays suppressed from the AI render entirely (still selectable/priced,
 * just hidden from the Double Arch preview) — no realistic asset-based
 * overlay exists yet.
 *
 * All removed-layout ids remap to single-panel equivalents via
 * LEGACY_TEMPLATE_ID_REMAP / getSetupLayoutTemplate and
 * inferSetupLayoutTemplateIdFromBackdropItems so old references never crash.
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
    id: "double_arch",
    name: "Double Arch",
    description: "Two arches, side by side",
    backdropTypes: ["arch", "arch"],
    maxBackdrops: 2,
    badge: "Popular",
    miniPreview: ["arch_large", "arch_small"],
    panelInstruction:
      "Use exactly two solid arch backdrop panels side-by-side, bases aligned on the same floor line, " +
      "with a small clean gap between them. The left arch and the right arch are each independent " +
      "freestanding solid backdrop panels rendered at their own configured size. " +
      "Do not overlap them front/back. Do not merge them into one shape. Do not create a third panel. " +
      "No shimmer wall. No open frame. No perspective tunnel — a curated flat pair of arches.",
    // Simplified 2026-07-18: reuses the exact proven Single Arch half-garland
    // description twice, mirrored, instead of the old bespoke dense/mirror
    // garland algorithm that produced unreliable-looking results. See the
    // matching doubleArchMirroredGarlandClause in buildLayoutRefEditPrompt.ts
    // and the guide-drawing change in generateStructureSilhouette.ts.
    garlandInstruction:
      "Balloon design: each arch gets its own single-arch-style half-garland on its OUTER side — " +
      "the exact same proven Single Arch look, mirrored between the two arches. " +
      "The LEFT arch's garland is anchored by a dense cluster of large balloons at its top-left crown, " +
      "cascading down its left outer edge with gradually smaller balloons, ending in a loose trailing " +
      "cluster of small balloons pooling on the floor at its base. " +
      "The RIGHT arch's garland mirrors this exactly at its top-right crown, cascading down its right " +
      "outer edge, ending in a floor cluster at its base. " +
      "Dense organic garlands with a large/medium/small balloon mix, premium event-decorator style — " +
      "not tiny beads, not a sparse dotted border, not random floating balloons. " +
      "The inner sides of both arches (facing each other) and the entire center gap between the two " +
      "arches stay completely clean and balloon-free — no bead chain, no thin single-file row, " +
      "no horizontal balloon bridge across both arches.",
    plinthInstruction:
      "Plinth preview is currently hidden for Double Arch's final AI render — no realistic asset-based " +
      "overlay exists yet. Plinths remain selectable and priced.",
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
];

/**
 * Legacy template ids removed from the product (open-frame prop was
 * unreliable). Any stale reference — a saved selection, a cached diagnostic,
 * a direct getSetupLayoutTemplate() call — resolves safely to the surviving
 * single-panel layout instead of returning undefined.
 *
 * single_shimmer / arch_shimmer are also removed (shimmer pipeline pulled
 * from product) and remap to single_arch for the same reason — an old saved
 * config referencing either must never crash, it just lands on an arch.
 *
 * double_arch is NOT in this table — it was restored to the product on
 * 2026-07-18 and is a real, selectable template again (see
 * SETUP_LAYOUT_TEMPLATES above). Only genuinely removed ids map here.
 */
export const LEGACY_TEMPLATE_ID_REMAP: Record<string, string> = {
  arch_open_frame: "single_arch",
  shimmer_open_frame: "single_arch",
  single_shimmer: "single_arch",
  arch_shimmer: "single_arch",
};

export function getSetupLayoutTemplate(id: string): SetupLayoutTemplate | undefined {
  const resolvedId = LEGACY_TEMPLATE_ID_REMAP[id] ?? id;
  return SETUP_LAYOUT_TEMPLATES.find((t) => t.id === resolvedId);
}

/**
 * Infer the curated template from currently selected backdrop items.
 * Count-aware: two arches infer double_arch. Returns null when the
 * combination doesn't match a curated set (e.g. rect panels) — callers
 * fall back to generic behavior.
 *
 * open_arch_frame and shimmer_wall are no longer selectable layout pieces;
 * a stray leftover panel of either type (from an old session) resolves to
 * the surviving single-arch layout rather than a dead template id.
 */
export function inferSetupLayoutTemplateIdFromBackdropItems(
  items: { type: string }[],
): string | null {
  const types = items.map((i) => i.type).sort();
  const key = types.join("+");
  if (key === "arch") return "single_arch";
  if (key === "round") return "single_round";
  if (key === "shimmer_wall") return "single_arch";
  if (key === "arch+arch") return "double_arch";
  if (key === "arch+shimmer_wall") return "single_arch";
  if (key === "arch+open_arch_frame") return "single_arch";
  if (key === "open_arch_frame+shimmer_wall") return "single_arch";
  return null;
}
