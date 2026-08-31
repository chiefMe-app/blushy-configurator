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
 * doubleArchMirroredGarlandClause in buildLayoutRefEditPrompt.ts. Since
 * 2026-07-19 the plinth is AI-rendered exactly like Single Arch's (guide
 * marker centered in the gap + the shared plinthDesc prompt clause), so it
 * appears with real scene lighting in the Double Arch preview.
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

// Shared zone presets.
//
// 2026-07-20 product direction: a standee belongs on the VIEWER'S LEFT and
// directly in front of the backdrop — not pushed out to the far right edge,
// which read as a separate object floating beside the setup and also buried
// the garland. The first (and for most orders only) standee therefore anchors
// just left of the backdrop's centre and overlaps the panel, standing on the
// same floor line. The plinth moves to the right of centre for these scenes
// (see generateStructureSilhouette + plinthDesc), so the two never collide.
// Extra standees step further left, staying clear of the plinth.
const ZONES_STANDARD = {
  // 2026-07-20 (second pass): the first left-anchored zone was still too big
  // and too far in — the standee covered the backdrop and read as standing in
  // front of the whole setup. It now stands BESIDE the panel on the far left,
  // scaled down so the backdrop and garland stay fully readable.
  large:  [{ x: 0.02, bottomY: 0.95, maxHeightFraction: 0.62, maxWidthFraction: 0.36, preferredSide: "left" as const },
           { x: 0.99, bottomY: 0.94, maxHeightFraction: 0.62, maxWidthFraction: 0.36, preferredSide: "right" as const }],
  medium: [{ x: 0.03, bottomY: 0.95, maxHeightFraction: 0.46, maxWidthFraction: 0.28, preferredSide: "left" as const },
           { x: 0.99, bottomY: 0.94, maxHeightFraction: 0.46, maxWidthFraction: 0.28, preferredSide: "right" as const }],
  small:  [{ x: 0.04, bottomY: 0.96, maxHeightFraction: 0.30, maxWidthFraction: 0.20, preferredSide: "left" as const },
           { x: 0.96, bottomY: 0.96, maxHeightFraction: 0.30, maxWidthFraction: 0.20, preferredSide: "right" as const }],
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
      "Each garland is physically installed on its arch board: the balloons touch and slightly overlap " +
      "the arch panel's outer edge along the garland's whole length, never floating in the empty wall " +
      "space beside the arch and never standing apart as a separate column. " +
      "Each garland is bottom-heavy: its largest, densest mass is a fat floor-level mound of big " +
      "balloons at the arch's outer base corner, from which it rises in a lush organic flow that " +
      "gradually tapers — narrower band, smaller balloons — up the outer edge, finishing as a lighter " +
      "crown/shoulder curl over the top. " +
      "The LEFT arch's garland does this on its outer-left side; the RIGHT arch's garland mirrors it " +
      "exactly on its outer-right side. " +
      "Dense organic garlands with a large/medium/small balloon mix, heavy overlap, real visual " +
      "thickness, premium event-decorator style — not an evenly spaced side border or trim, not the " +
      "same thickness from bottom to top, not tiny beads, not a sparse dotted border, not a " +
      "detached vertical balloon column, not a pearl-necklace string, not random floating balloons. " +
      "The inner sides of both arches (facing each other) and the entire center gap between the two " +
      "arches stay completely clean and balloon-free — no bead chain, no thin single-file row, " +
      "no horizontal balloon bridge across both arches.",
    plinthInstruction:
      "Double Arch's plinth is AI-rendered (2026-07-19), exactly like Single Arch's — guide " +
      "plinthEdge marker + plinthDesc prompt clause, centered in the clean gap between the two " +
      "arches. This instruction text is documentation only and is intentionally never injected " +
      "into the prompt (plinth wording lives in buildLayoutRefEditPrompt.ts).",
    standeeZones: {
      // 1 standee → left outer, beside the arches; 2 standees → left + right
      // (matches the Single Arch direction set on 2026-07-20).
      large:  [{ x: 0.02, bottomY: 0.94, maxHeightFraction: 0.60, maxWidthFraction: 0.34, preferredSide: "left" },
               { x: 0.99, bottomY: 0.94, maxHeightFraction: 0.60, maxWidthFraction: 0.34, preferredSide: "right" }],
      medium: [{ x: 0.03, bottomY: 0.95, maxHeightFraction: 0.44, maxWidthFraction: 0.26, preferredSide: "left" },
               { x: 0.99, bottomY: 0.94, maxHeightFraction: 0.44, maxWidthFraction: 0.26, preferredSide: "right" }],
      small:  [{ x: 0.04, bottomY: 0.96, maxHeightFraction: 0.28, maxWidthFraction: 0.19, preferredSide: "left" },
               { x: 0.96, bottomY: 0.96, maxHeightFraction: 0.28, maxWidthFraction: 0.19, preferredSide: "right" }],
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
