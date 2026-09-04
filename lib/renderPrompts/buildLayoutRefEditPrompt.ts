import { type SceneModel } from "@/lib/buildSceneModel";
import type { SempertexSelectionItem } from "./types";
import { getVisualLabel, renderSafeBalloonLabel, getPositiveLabel } from "./colorLabels";
import { THEME_CATALOG } from "@/lib/themeCatalog";
import { getSetupLayoutTemplate, inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import { describeTextColor } from "@/lib/config";

// A raw hex means nothing to the edit model, and "#FFFFFF" used to collapse into
// the same "cream-white" as an unset panel — so choosing white for one arch read
// as no change at all (2026-09-01). Known product colours now get a plain-English
// name, and anything unrecognised is described as a hex swatch rather than shown bare.
const BACKDROP_COLOR_NAMES: Record<string, string> = {
  "#ffffff": "pure bright white",
  "#e8f4fd": "very pale ice blue",
  "#bae6fd": "soft arctic blue",
  "#ede9fe": "pale cool lavender",
  "#e5e7eb": "light cool grey",
  "#fdf2f8": "soft blush pink",
  "#fce7f3": "pale rose pink",
  "#f5f5f4": "warm off-white",
};

function backdropColorLabel(color: string): string {
  const c = (color || "").toLowerCase().trim();
  if (!c) return "cream-white";
  return BACKDROP_COLOR_NAMES[c] ?? `the exact colour ${c.toUpperCase()}`;
}

// Human-readable label for a shimmer color id, e.g. "gold" -> "Gold".
function shimmerColorLabel(id: string): string {
  return id.length > 0 ? id.charAt(0).toUpperCase() + id.slice(1) : id;
}

// ═══════════════════════════════════════════════════════════════════════════
// GOLDEN SHIMMER METHOD — do not modify without re-verifying Arch + Shimmer
// and Single Shimmer render quality end-to-end. Shared verbatim by both
// layouts (see the shimmer_wall branches below and shimmerNegs further down).
//
// KEEP the core sentence: "dense regular grid of small flat square reflective
// sequin discs, each disc catching light individually with metallic sparkle,
// ... a real event-rental sequin shimmer wall". KEEP this soft one-line color
// mention only — no repeated/forceful negation.
// DO NOT add forceful color-lock wording (e.g. "SHIMMER COLOR LOCK — IMPORTANT:
// must be predominantly X, not silver", "Do NOT render... unless explicitly
// selected") — it changes how the model interprets the guide geometry.
// DO NOT reintroduce "large visible paillettes" / "PAILLETTE SCALE" wording.
//
// Soft color-mention clause reused by both single_shimmer and arch_shimmer.
// v3 ("forceful" + a large-paillette scale clause below it) over-corrected: the
// heavy repeated color negation combined with big-tile guide geometry made the
// edit model copy the guide literally as visible square patchwork/mosaic blocks,
// degrading the previously-good Arch + Shimmer look — even with color=silver,
// where the forceful wording still fired. Reverted to a single gentle mention;
// shimmer color selection is de-prioritized for now in favor of restoring quality.
// ═══════════════════════════════════════════════════════════════════════════
function shimmerColorLockClause(colorId: string): string {
  const label = shimmerColorLabel(colorId);
  return `The sequin discs are ${label.toLowerCase()} colored. `;
}

function panelTypeLabel(type: string): string {
  switch (type) {
    case "arch":            return "rounded arch";
    case "rect":            return "rectangular flat";
    case "shimmer_wall":    return "rectangular shimmer-wall";
    case "round":           return "round circular";
    case "open_arch_frame": return "thick open arch decor prop";
    case "wavy":            return "wavy-top";
    default:                return type;
  }
}

export function buildLayoutRefEditPrompt(
  sceneModel: SceneModel,
  effectiveSempertexSelection?: SempertexSelectionItem[]
): string {
  const panelCount = sceneModel.panels.length;
  const isMulti = panelCount > 1;
  const theme = String(sceneModel.theme ?? "").toLowerCase();
  const isUnicornTheme = theme.includes("unicorn");

  const hasRoundPanelInPrompt = sceneModel.panels.some((p) => p.type === "round");
  // Same definition used by generateStructureSilhouette.ts's guide drawing —
  // exactly two arch panels, nothing else. Used to fix a set of Double Arch
  // fidelity issues (2026-07-12): missing plinth, near-identical arch sizes,
  // and merged/touching arch bases — see the doubleArch*Clause definitions below.
  const isDoubleArchScene = panelCount === 2 && sceneModel.panels.every((p) => p.type === "arch");

  const roundGeometryClause = hasRoundPanelInPrompt
    ? ` ROUND BACKDROP HARD LOCK: The setup contains exactly one large freestanding round event backdrop panel, 200 x 200 cm. ` +
      `The round panel must be visually large, dominant, and vertically upright. ` +
      `The bottom edge of the round panel must sit directly on the floor plane. ` +
      `Do not raise it above the floor. ` +
      `Do not place it on a platform, riser, stage, block, box, pedestal, support disc, display base, circular base, oval base, rectangular base, or extra cylinder. ` +
      `Do not show visible front supports, thin stand legs, acrylic feet, metal rods, braces, or any visible support structure under the panel. ` +
      `Any required support must be completely hidden behind the panel and invisible from the camera view. ` +
      `The garland must remain a half garland attached primarily along the right side and upper-right curve only. ` +
      `It must not become a full ring, complete balloon circle, wreath, tunnel, or near-complete circle around the panel.`
    : "";

  // ── Backdrop description ──────────────────────────────────────────────────
  // NOTE: single-shimmer used to short-circuit here with its own hand-written
  // scene description, bypassing setupTemplateClause, sempertex color-lock
  // handling, and the shared negative-prompt reinforcement that arch_shimmer
  // gets — that legacy split is exactly why single_shimmer rendered worse.
  // It's removed: single_shimmer now flows through the same shared pipeline
  // as every other layout (including arch_shimmer), just via the `!isMulti`
  // shimmer_wall branch below, so both use one shimmer-wall creation method.
  let backdropDesc: string;

  // The round-panel description compares the panel against the plinth in real
  // cm. Those figures used to be written out as "75 cm" and "40 cm", which
  // stopped being true on 2026-09-03 when the three plinths became L 60x33,
  // XL 75x36 and XXL 90x40 — a scene with an L plinth was then described with
  // another size's numbers. Read them off the selected plinth instead.
  const firstPlinth   = sceneModel.plinths[0];
  const plinthHeightCm   = firstPlinth?.heightCm   ?? 75;
  const plinthDiameterCm = firstPlinth?.diameterCm ?? 40;

  if (!isMulti) {
    const p = sceneModel.panels[0];
    if (p.type === "shimmer_wall") {
      // GOLDEN SHIMMER METHOD wording — keep in sync with the arch_shimmer
      // panel description below. See the guardrail comment above
      // shimmerColorLockClause().
      const sc = sceneModel.shimmerColor ?? "silver";
      backdropDesc =
        `one freestanding square shimmer wall, ${p.widthCm}cm wide x ${p.heightCm}cm tall, ` +
        `a real event-rental sequin shimmer wall: dense regular grid of small flat square reflective sequin discs, ` +
        `each disc catching light individually with metallic sparkle, flat rectangular panel, ` +
        `NOT a mirror slab, NOT a chrome wall, NOT a glitter print, ` +
        `NOT a matte board, NOT a cream backdrop, NOT crumpled foil. ` +
        shimmerColorLockClause(sc);
    } else if (p.type === "round") {
      backdropDesc =
        `a thin circular backdrop panel, ${backdropColorLabel(p.color)} colored, exactly ${p.widthCm}cm x ${p.heightCm}cm — not a furniture object, ` +
        `not a platform, not a stage piece, not mounted on a display base. ` +
        `The bottom edge of the panel sits directly on the floor, with at most 0-2cm visual gap between the ` +
        `panel's lower edge and the floor surface. ` +
        `Clearly freestanding in front of the wall, with visible separation between the panel and the wall behind it. ` +
        `Not wall-mounted, not attached to the wall, not painted on the wall. ` +
        `NO visible stand. NO visible feet. NO visible wheels. NO visible frame. NO visible support bar. ` +
        `NO extra base of any kind beneath or around the panel. ` +
        `If the panel is structurally supported, that support must be fully hidden directly behind the thin panel ` +
        `and completely invisible in the photograph — the panel must read as a clean thin circular surface with ` +
        `absolutely nothing visible beneath, around, or supporting it. ` +
        `The ONLY cylinder allowed anywhere in this scene is the single selected vertical plinth — ` +
        `do not add any other cylinder, disc, or rounded object near the panel. ` +
        `Round backdrop is exactly 200 cm diameter. It must visually appear about ` +
        `${(200 / plinthHeightCm).toFixed(1)} times taller than the ${plinthHeightCm} cm plinth and about ` +
        `${Math.round(200 / plinthDiameterCm)} times wider than the ${plinthDiameterCm} cm plinth diameter. The round panel should dominate ` +
        `the setup and fill most of the background composition. ` +
        `Do not shrink the round panel. Do not render it as a small decorative circle. ` +
        `It must read as a full-size 2 meter event backdrop, thin and flat like a sign board, never like a piece ` +
        `of furniture or a display fixture. ` +
        `Only one visible prop is allowed in the entire scene: the single selected vertical cylindrical plinth. ` +
        `The round backdrop itself has no visible base, no stage, no platform, no pedestal, no riser, ` +
        `no support block, no support disc, no display base, no furniture base, no stand, no feet, ` +
        `and no second plinth. Do not invent any extra white cylinder, oval base, round base, or low platform ` +
        `under or beside the round panel — the floor beneath and around the panel must be completely bare ` +
        `except for the one selected plinth and the balloon garland.`;
    } else if (p.type === "arch") {
      backdropDesc =
        `single rounded arch backdrop, ${p.widthCm}cm wide by ${p.heightCm}cm tall — ` +
        `a solid filled freestanding arch backdrop panel with a fully opaque surface. ` +
        `The entire arch face is one continuous solid board, seamless matte ${backdropColorLabel(p.color)} surface, ` +
        `no cut-out opening, no hollow doorway, no empty arch frame — the full solid panel face must be visible. ` +
        `This is a solid event backdrop board shaped like an arch, not a doorway or passage you can see or walk through.`;
    } else {
      backdropDesc =
        `single ${panelTypeLabel(p.type)} ${backdropColorLabel(p.color)} backdrop board, ` +
        `${p.widthCm}cm wide by ${p.heightCm}cm tall, solid freestanding board, seamless matte surface`;
    }
  } else if (isDoubleArchScene) {
    // Double Arch gets Single Arch's own arch wording, stated once for the
    // pair, instead of the generic multi-panel block below.
    //
    // 2026-09-03, found by reproducing the render locally with the exact
    // guide/prompt/model/seed and bisecting the prompt: the generic block
    // ("exactly 2 separate freestanding backdrop pieces ... Panel 1 (left):
    // ... not compressed, not narrow, not a tower, correctly proportioned"
    // twice) is what was making the plinth disappear. With it in place the
    // plinth was absent in every Double Arch render; with this compact
    // description — and no other change — the same seed painted the plinth.
    // The catalog's double_arch panelInstruction was trimmed for the same
    // reason (its "Do not create a third panel. No open frame ..." tail had
    // the same effect on its own).
    const [l, r] = sceneModel.panels;
    const lColor = backdropColorLabel(l.color);
    const rColor = backdropColorLabel(r.color);
    const surface = lColor === rColor
      ? `seamless matte ${lColor} surface`
      : `seamless matte surface — the left panel ${lColor}, the right panel ${rColor}`;
    backdropDesc =
      `two rounded arch backdrops side by side — the left panel ${l.widthCm}cm wide by ${l.heightCm}cm tall, ` +
      `the right panel ${r.widthCm}cm wide by ${r.heightCm}cm tall — ` +
      `each a solid filled freestanding arch backdrop panel with a fully opaque surface. ` +
      `Each arch face is one continuous solid board, ${surface}, ` +
      `no cut-out opening, no hollow doorway, no empty arch frame — the full solid panel face must be visible. ` +
      `These are solid event backdrop boards shaped like arches, not doorways or passages you can see or walk through.`;
  } else {
    const positions = ["left", "center", "right"];
    const posLabels = panelCount === 2
      ? ["left", "right"]
      : panelCount === 3
        ? ["left", "center", "right"]
        : sceneModel.panels.map((_, i) => positions[i] ?? `panel ${i + 1}`);

    const hasOpenFrame = sceneModel.panels.some((p) => p.type === "open_arch_frame");
    const panelDescs = sceneModel.panels.map((p, i) => {
      const wRatio = (p.widthCm / p.heightCm).toFixed(2);
      const isShimmer   = p.type === "shimmer_wall";
      const isArch      = p.type === "arch";
      const isOpenFrame = p.type === "open_arch_frame";
      const shimmerC  = sceneModel.shimmerColor ?? "silver";
      const pColor = backdropColorLabel(p.color);
      const surfaceDesc = isShimmer
        // GOLDEN SHIMMER METHOD wording — keep in sync with the single_shimmer
        // description above. See the guardrail comment above
        // shimmerColorLockClause().
        ? `freestanding square event shimmer wall (200cm x 200cm) — a real event-rental sequin shimmer wall: ` +
          `dense regular grid of small flat square reflective sequin discs, ` +
          `each disc catching light individually with metallic sparkle, flat rectangular panel, ` +
          `NOT a mirror slab, NOT a chrome wall, NOT a glitter print, ` +
          `NOT crumpled foil, NOT a matte board, NOT a cream panel. ` +
          shimmerColorLockClause(shimmerC)
        : isOpenFrame
          ? `freestanding open arch decor prop — a premium event-styling arch cutout with a bold, thick, ` +
            `substantial frame border roughly 25-35cm wide, front-facing and flat like a large painted or ` +
            `upholstered arch panel, with real visual weight and material presence — matching the same premium ` +
            `finish and color family as the solid arch beside it so the two read as one coordinated decor set. ` +
            `A clean hollow arch-shaped opening is cut straight through the center, with no solid fill inside it — ` +
            `you can see straight through the opening to the room behind it. ` +
            `NOT a thin doorway frame, NOT a skinny architectural portal, NOT a wire or metal outline, ` +
            `NOT tubular, NOT inflatable, NOT a balloon arch, NOT a deep 3D tunnel or hallway, ` +
            `NOT a second solid backdrop panel, NOT a doorway with a door`
          : isArch
            ? `solid filled freestanding arch backdrop panel, fully opaque surface, seamless matte ${pColor} surface, ` +
              `no cut-out opening, no hollow doorway, full solid panel face visible`
            : `full-width solid opaque ${pColor} freestanding backdrop board with broad visible surface`;
      return (
        `Panel ${i + 1} (${posLabels[i]}): ${panelTypeLabel(p.type)}${isOpenFrame ? "" : " backdrop board"}, ` +
        `${p.widthCm}cm wide by ${p.heightCm}cm tall (width-to-height ratio ${wRatio}), ` +
        `${surfaceDesc}, not compressed, not narrow, not a tower, correctly proportioned`
      );
    });
    backdropDesc =
      `exactly ${panelCount} separate freestanding backdrop pieces arranged side by side, ` +
      (hasOpenFrame
        ? `one solid backdrop piece and one thick open arch decor prop with a bold substantial frame border, each rendered at its correct width. `
        : `each fully solid, opaque, and rendered at its correct width. `) +
      `Both pieces are full-size physical event structures with correct width-to-height proportions. ` +
      `The total setup should feel wide and substantial, not skinny or compressed. ` +
      panelDescs.join(". ") + ".";
  }

  // ── Double Arch size + separation reinforcement (2026-07-12) ──────────────
  // Each panel already carries its own real widthCm/heightCm in backdropDesc
  // above, but a real render showed the edit model still normalizes the two
  // arches toward a visually matching pair unless explicitly told the sizes
  // must read as different, and separately lets the two bases drift into
  // touching/merging at the floor. Both are additive reinforcement — they
  // don't change what backdropDesc already says, just add an explicit
  // comparison the model can't average away.
  //
  // Deliberately qualitative only, no cm figures repeated here — an earlier
  // version restated "Panel 1 (left) is 120cm wide by 220cm tall..." a
  // second time (backdropDesc above already states it once) and a real
  // render then baked visible dimension-line/measurement-label annotations
  // onto the image, which is explicitly forbidden elsewhere in this prompt.
  // Comparative wording alone ("visibly larger" / "visibly smaller") gets
  // the same result without giving the model a second number to echo.
  // 2026-09-03: both locks retired. In a local reproduction of the render
  // (same guide, model and seed) the two arches kept their different sizes
  // and their gap in every one of ~20 variants without these clauses — the
  // layout guide already fixes both — while the clauses were part of the
  // verbose block that suppressed the plinth. Left as "" so the assembly
  // below is unchanged.
  const doubleArchSizeLockClause = "";
  const doubleArchSizeLockClauseRetired = isDoubleArchScene
    ? ` DOUBLE ARCH SIZE LOCK: the two arch panels are DIFFERENT SIZES and must look clearly, ` +
      `obviously different in scale at a glance — the left arch is visibly larger, both taller and wider, ` +
      `than the right arch. ` +
      `Do NOT render the two arches as the same size. Do NOT render them as a matching identical pair. ` +
      `Do NOT normalize, average, or equalize their sizes toward each other — preserve each arch's own ` +
      `configured width and height exactly as already described above, relative to the other arch. ` +
      `Do not render any dimension lines, measurement arrows, or size labels on the image.`
    : "";

  const doubleArchSeparationClause = "";
  const doubleArchSeparationClauseRetired = isDoubleArchScene
    ? ` DOUBLE ARCH SEPARATION LOCK: the two arch panels are two separate freestanding physical event props, ` +
      `each with its own independent floor footprint and base contact point. ` +
      `Maintain a small but clearly visible gap between the two arch bases at all times — ` +
      `the bases must never touch, merge, overlap, or blend into a single connected shape. ` +
      `The floor in this gap stays completely bare — the plinth stands in front of a panel, not in the gap. ` +
      `Each arch must read as a distinct standalone board, not fused, joined, or leaning into the other.`
    : "";
  void doubleArchSizeLockClauseRetired;
  void doubleArchSeparationClauseRetired;

  // ── Double Arch mirrored garland (2026-07-18 restoration) ─────────────────
  // Replaces the old bespoke double-arch garland wording: real renders under
  // that approach came out unreliable (bead-chain/sparse in places). Instead
  // this reuses the exact proven Single Arch garland description
  // (archGarlandExtra above, excluded for double-arch scenes) applied twice,
  // once per arch, mirrored onto each arch's own outer edge — "two mirrored
  // Single Arch designs" per product direction. Matches the guide-drawing
  // change in generateStructureSilhouette.ts (thick-organic-mass guide)
  // and the catalog's double_arch garlandInstruction.
  // 2026-09-02: this clause used to be ~45 lines of stacked, shouty negation
  // (ALL-CAPS rule names plus eleven consecutive "NOT a ..." items). Four
  // render attempts fixing wording, guide shading and balloon counts all
  // failed to stop Double Arch's garlands coming back as flat overlapping
  // discs, while Single Arch — whose garland clause is a single short,
  // positive paragraph — kept rendering correctly from the SAME guide
  // function. That matches a failure mode this codebase has already
  // documented three times (see the shimmer notes at the top of this file
  // and in buildStrictCorrectionPrompt): heavy repeated negation makes the
  // edit model stop elaborating the 2-D guide and start copying it
  // literally, and a literal copy of a garland guide is exactly a stack of
  // flat overlapping circles. Double Arch is the only layout carrying this
  // much negation (it also has SIZE LOCK, SEPARATION LOCK, PLINTH HARD LOCK
  // and the multi-panel negatives), so it was the only one that broke.
  // Rewritten as the proven Single Arch paragraph, mirrored onto both
  // arches, and kept positive. The structural locks are left alone — they
  // guard separately-confirmed bugs — but the garland is described, not
  // forbidden.
  // 2026-09-03: retired. Double Arch now uses Single Arch's archGarlandExtra
  // (with only the outer-edge phrase adapted) rather than its own bespoke
  // garland paragraph, per product request to copy Single Arch exactly. Only
  // the one genuinely backdrop-specific fact is kept: the centre gap is not
  // a place for balloons.
  const doubleArchMirroredGarlandClause = isDoubleArchScene
    ? ` The inner side of each arch and the centre gap between the two arches stay clear of balloons. `
    : "";

  // ── Plinth description ────────────────────────────────────────────────────
  // Double Arch plinth history: 8 real-render attempts (2026-07-12) under the
  // OLD prompt pipeline failed (glass/omitted), so the plinth was suppressed
  // from the AI and composited deterministically. RE-ATTEMPTED 2026-07-19 by
  // product request ("plinth same as single arch"): the prompt has since been
  // rewritten (mirrored-single-arch garlands, no contradictory bare-gap
  // wording), so Double Arch now asks the AI for the plinth exactly like
  // Single Arch does — same clause, gap-centered placement.
  const plinth       = sceneModel.plinths[0];
  const hasRoundPanelInScene = sceneModel.panels.some((p) => p.type === "round");

  // Double Arch plinth hard lock (2026-07-19): even with the plinth in the
  // prompt AND a filled cylinder marker in the guide, flash/edit still omitted
  // it twice in verification renders — the many "gap stays clean" constraints
  // dominate. This clause explicitly names the guide-marker cylinder as a
  // mandatory scene object, in the same authoritative HARD LOCK style that
  // fixed the round-panel and arch-size fidelity issues.
  // 2026-09-03: retired. Single Arch gets its plinth painted in the primary
  // pass from plinthDesc alone, with no hard lock and no second pass, and
  // Single Arch is the layout the customer is happy with — so Double Arch now
  // asks the same way. This shouty clause also ran counter to what the rest of
  // this file has learned about heavy negation degrading the render.
  const doubleArchPlinthHardLockClause = "";
  // Character standees are composited on the viewer's LEFT in front of the
  // backdrop, so a front-left plinth ends up hidden behind them (2026-07-20
  // bug: "the plinth disappears when a character is added"). With standees in
  // the scene the plinth is asked for on the right of centre instead — the
  // same side the layout guide now marks it on.
  const hasStandeesInScene =
    (sceneModel.cutouts?.items ?? []).some((i) => (i?.quantity ?? 0) > 0);

  // How wide the plinth is next to the board it stands in front of. The model
  // can see that board, so a comparison against it lands where a measurement in
  // centimetres does not (see plinthDesc below).
  const plinthBoardWidthCm = Math.max(
    ...sceneModel.panels.map((p) => p.widthCm ?? 0), plinth?.diameterCm ?? 1,
  );
  const plinthWidthFraction = (() => {
    if (!plinth) return "";
    const n = Math.round(plinthBoardWidthCm / plinth.diameterCm);
    const words: Record<number, string> = { 2: "half", 3: "a third", 4: "a quarter", 5: "a fifth", 6: "a sixth" };
    return words[n] ?? `1/${n}`;
  })();

  // The word "plinth" is what was making these render as squat drums. Measured
  // 2026-09-03 across seven controlled renders on one fixed scene and seed: the
  // guide marker's proportions do NOT control the rendered plinth at all —
  // marker aspects of 1.4, 2.0, 2.3 and 4.6, drawn faint and drawn in strong
  // contrast, every one of them came back at roughly 1:1, and the SLIMMEST
  // marker produced the FATTEST plinth. Stating the ratio in centimetres did
  // not move it either; that wording was already in this prompt. What did move
  // it, with the guide and seed held identical, was calling the object a
  // "pedestal column" instead of a "plinth" and comparing its width to the
  // board behind it — the model has a squat-drum prior attached to the word
  // "plinth", and the fix is to stop using it rather than to fight it. Height
  // was always roughly right; only the diameter was wrong, so the comparison
  // is what carries the correction.
  const plinthDesc   = plinth
    // 2026-09-04: the model kept painting a wide flat plate under the column
    // and standing it on that. Naming the shape was not enough on its own —
    // this clause already forbade a "platform, riser, plate, step or second
    // disc" and the plate was drawn anyway. Two things changed and the plate
    // went away, verified on the customer's own Single Arch scene at a fixed
    // seed: the word "base" stopped being used for the plinth itself (it said
    // "on a 36cm diameter circular base" and "on its own flat circular base",
    // which reads as a part the column stands on), and the width is now pinned
    // top-to-bottom, because a plate is simply the bottom being wider.
    ? `Keep exactly one visible white cylindrical pedestal column, ${plinth.heightCm}cm tall and ${plinth.diameterCm}cm wide. ` +
      `It is a slim upright column: about ${(plinth.heightCm / plinth.diameterCm).toFixed(1)} times taller than it is wide, ` +
      `and its width is roughly ${plinthWidthFraction} of the width of the backdrop board behind it. ` +
      `It is one seamless tube of the SAME width from the floor all the way up to its flat top — the bottom is ` +
      `exactly as wide as the top, never wider. ` +
      `It is NOT a wide squat drum, NOT a round coffee table, NOT a low cake stand. ` +
      `This is a separate display pedestal, not a support base for the backdrop. ` +
      `Nothing sits underneath it: no wider foot, no base plate, no base ring, no skirt, no platform, no riser, ` +
      `no step, no tray, no podium and no second disc — the cylinder meets the bare floor directly. ` +
      // 2026-09-03: Double Arch no longer asks for the gap. It uses Single
      // Arch's own placement — in front of a backdrop panel — because that is
      // the placement the model actually paints; see the note in
      // generateStructureSilhouette where the guide marker moved to match.
      (hasStandeesInScene
        ? `Place it to the RIGHT of centre, standing on the floor directly in front of the backdrop panel. ` +
          `Keep the left-hand floor area in front of the backdrop completely clear and empty — a character standee is added there afterwards. `
        : `Place it front-left of the backdrop. `) +
      // balloonStyle is declared further down; read the style off the scene
      // model here so this clause can be built where the plinth is described.
      (sceneModel.balloons.style !== "none"
        ? `It stands fully visible from base to rounded top, in front of the backdrop and clear of the balloons. `
        : `It stands fully visible from base to rounded top, in front of the backdrop. `) +
      // The glass/acrylic guard stays — it fixed a real, repeated failure.
      // The three "Do not hide / merge / convert" sentences that followed are
      // gone: they were part of the negation pile that was competing with the
      // request to paint this object at all.
      `It is a solid opaque matte white column — NOT glass, NOT transparent, NOT clear acrylic. ` +
      (hasRoundPanelInScene
        ? `Stand it close to the round backdrop panel, not set too far forward into the room.`
        : hasStandeesInScene
          ? `Stand it close to the backdrop panel, right of centre, fully visible.`
          : `Place it on the open side near the arch backdrop.`)
    : "";
  const noPlinthDesc = plinth
    ? ""
    : isDoubleArchScene
      ? `No plinths, pedestals, podiums, or display columns of any kind. The floor area between the two arches stays completely bare and empty — no object of any kind stands there. `
      : "No plinths. ";

  // ── Balloon garland description ───────────────────────────────────────────
  const balloonStyle = sceneModel.balloons.style;

  const selectedSempertexColors = (effectiveSempertexSelection ?? []).slice(0, 5);

  const hasSempertexLock =
    balloonStyle !== "none" && selectedSempertexColors.length > 0;

  const selectedColorList = selectedSempertexColors
    .map((c) => renderSafeBalloonLabel(c))
    .join("; ");

  // Allowed palette block — code + hex + positive-only label (no bias words like gold/yellow/rose-gold)
  const allowedPaletteBlock = hasSempertexLock
    ? `ALLOWED BALLOON PALETTE: ` +
      selectedSempertexColors.map((c) => {
        const hex = String((c as SempertexSelectionItem & { hex?: string }).hex ?? "");
        return `${c.code} ${hex} ${getPositiveLabel(c)}`;
      }).join("; ")
    : "";

  // Positive-only appearance labels via hex lookup — avoids bias words (gold, yellow,
  // rose-gold, orange, copper, bronze, teal, blue) in the positive prompt wording.
  const targetAppearanceParts = hasSempertexLock
    ? selectedSempertexColors.map((c) => getPositiveLabel(c))
    : [];
  const targetAppearanceSentence = targetAppearanceParts.length > 0
    ? `Target balloon appearance: ${targetAppearanceParts.join(", ")} only. Overall material should look soft, low-saturation, diffuse, and mostly matte pastel. The blush pearl pink accent balloons may have only a very soft satin sheen. `
    : "";

  const exactColorCountSentence = hasSempertexLock && targetAppearanceParts.length > 0
    ? `Use exactly ${targetAppearanceParts.length} balloon colors only: ${targetAppearanceParts.join(", ")}. Do not introduce any additional balloon color. `
    : "";

  const paletteEnforcementSentences = hasSempertexLock
    ? `Every visible balloon must match one of the selected palette colors above. ` +
      `Ignore the theme name for balloon colors. The selected Sempertex palette is the only color source. ` +
      `Do not infer colors from the theme name. ` +
      `If a color is not in the selected palette, replace it with the nearest selected pastel.`
    : "";

  // Dynamic yellow/green exclusion — only forbid if NOT in the selected palette
  const hasYellowInPalette = selectedSempertexColors.some((c) => {
    const code = String(c.code ?? "");
    return code === "620" || String(c.colorName ?? "").toLowerCase().includes("yellow");
  });
  const hasGreenInPalette = selectedSempertexColors.some((c) => {
    const code = String(c.code ?? "");
    const name = String(c.colorName ?? "").toLowerCase();
    return code === "630" || name.includes("green") || name.includes("mint");
  });
  // Blue must not be blanket-forbidden when the selected palette itself
  // contains a blue (e.g. Frozen's 839 Arctic Blue / 640 Blue) — the same
  // conflict-avoidance treatment yellow and green already get above. The
  // negative wording said "when not selected", but a literal "No blue
  // balloons" phrase still biases the model against the palette's own blues.
  const hasBlueInPalette = selectedSempertexColors.some((c) => {
    const name   = String(c.colorName ?? "").toLowerCase();
    const family = String((c as SempertexSelectionItem & { family?: string }).family ?? "").toLowerCase();
    return name.includes("blue") || family === "blue";
  });

  // When a Sempertex palette is selected it fully overrides the theme palette.
  // Use a short "selected-palette soft pastel" phrase in the garland sentence so
  // verbose code labels don't push theme-word associations into the positive prompt.
  const balloonColors = hasSempertexLock
    ? "selected-palette soft pastel"
    : sceneModel.balloons.colors.length > 0
      ? sceneModel.balloons.colors.slice(0, 4).join(", ")
      : "icy blue, white, silver";

  const hasArchPanelInPrompt = sceneModel.panels.some((p) => p.type === "arch");

  const roundGarlandExtra = hasRoundPanelInPrompt
    ? ` For a round backdrop, the balloon garland must attach only to the OUTER RIGHT PERIMETER of the circular panel. ` +
      `It should follow the circle edge from about the 1 o'clock area down through the 3 o'clock area and down to about the 5 o'clock area, right outer arc only. ` +
      `It must NOT wrap around the entire circle. It must NOT form a full circular balloon ring, wreath, tunnel, or 360-degree balloon frame. ` +
      `The left side, lower-left side, and central face of the round backdrop must remain clean, visible, and unobstructed. ` +
      `The bottom front area of the round panel must remain clean: no stage, no riser, no platform, no support block, no second plinth, no rectangular base, no oval base, no circular base. ` +
      `The round panel is a freestanding event backdrop with hidden rear support that is invisible from the front. ` +
      `The visible front bottom edge of the round panel touches the floor directly.`
    : "";

  // Reverted to a single unconditional treatment for any arch scene, including
  // arch_shimmer — a "SINGLE GARLAND LOCK" special case was tried and removed
  // (see git history) after a real render comparison showed it produced a
  // more awkward, over-engineered composition than this default text
  // combined with the catalog's own bridge-garland description
  // (setupTemplateClause) had already been producing. Restoring the older,
  // visually-successful default for all arch scenes.
  //
  // 2026-09-03 — Double Arch now uses this clause too, per product request to
  // copy Single Arch feature-for-feature and let only the backdrop differ.
  // The one adaptation is the side phrase: a two-arch scene has an outer edge
  // per arch, so naming "the right outer edge" alone would be wrong for the
  // left one. Everything else is Single Arch's proven wording verbatim, and
  // the long bespoke doubleArchMirroredGarlandClause it replaces is gone.
  const outerEdgePhrase = isDoubleArchScene
    ? `each arch's own OUTER side edge — the left arch's left edge and the right arch's right edge`
    : `the right outer edge`;

  const archGarlandExtra = hasArchPanelInPrompt
    ? ` Premium organic balloon garland with large, medium, and small balloons nested together ` +
      `in lush clustered bunches, attached ONLY to ONE OUTER SIDE of the arch — ${outerEdgePhrase} — ` +
      `and nowhere else on the structure. ` +
      `The garland flows naturally and continuously starting at the top outer corner of the arch, ` +
      `following the outer side edge downward, ending in a connected floor-level cluster at the outer ` +
      `bottom corner/side — a single smooth top-to-bottom flow down the outer edge, never reversed, ` +
      `never starting from the bottom, never doubling back, never feeling awkward or disconnected. ` +
      `If there is a floor or base balloon cluster, it must stay directly connected to the garland at the ` +
      `outer bottom side/corner only — never placed in front of the panel, never centered, never spread ` +
      `across the base. ` +
      `Not a thin single-file chain. ` +
      `The arch front face, the open center opening, and the readable surface of the arch must stay ` +
      `completely clean, unobstructed, and fully visible at all times — absolutely no balloons crossing ` +
      `in front of the arch panel, no balloons covering the open center, no balloons blocking the arch face, ` +
      `and no balloon pile or floor buildup directly in front of the arch face. ` +
      `The plinth and the front floor area in front of the arch must remain completely clean and ` +
      `unobstructed — no balloons in front of the plinth, no balloons crossing into the front floor area. ` +
      // 2026-09-03: this used to continue "Do not add any extra plinth,
      // pedestal, platform, stage, support block, base, riser, second
      // cylinder, secondary display column, or additional prop." Printing the
      // assembled prompt showed 16 separate sentences forbidding
      // column-shaped objects, in a prompt that is simultaneously asking for
      // exactly one column to be painted. Double Arch has dropped the plinth
      // in every render; the simplest reading is that the ban wins. Reduced to
      // the positive count, which is the part that was actually needed.
      `Exactly one plinth stands in the scene.`
    : "";

  // 2026-09-03: Single Arch's size paragraph is now used for both layouts.
  // Double Arch had its own per-garland variant; per product request to copy
  // Single Arch feature-for-feature, the wording no longer forks. It reads
  // singular ("the garland"), which each of the two garlands applies to
  // itself — the same way archGarlandExtra above now does.
  const balloonSizeDesc =
    ` Use exactly three balloon size families: several large 36 inch statement balloons, many 12 inch ` +
      `standard balloons, and a FEW small 5 inch accent balloons. Include at least 6 visible 36 inch statement ` +
      `balloons distributed through the garland at the top, side, and base. 36 inch balloons must be clearly ` +
      `larger than all others. Use 5 inch balloons sparingly — only a few tiny accents tucked between big ` +
      `balloons, never a group of them. ` +
      `FULLNESS RULE: the garland is plump and densely packed along its ENTIRE length — no thin, sparse or ` +
      `gappy stretches, no section that narrows to a single file of balloons, no visible backdrop showing ` +
      `through the middle of the garland band. ` +
      `Any balloons resting on the floor must be part of the garland's base cluster, visually connected to ` +
      `and touching the main garland — never scattered, detached, or floating separately on the floor.`;

  const sempertexClause = hasSempertexLock
    ? ` BALLOON COLOR SOURCE OVERRIDE: The theme name is not a balloon color instruction. Balloon colors must be copied from the selected Sempertex palette and from the colored layout reference guide only. ` +
      `BALLOON COLOR LOCK — ${allowedPaletteBlock}. ` +
      `Use ONLY these exact visual balloon colors for every balloon in the garland. ` +
      `These are the ONLY allowed balloon colors in the scene. ${paletteEnforcementSentences} ` +
      targetAppearanceSentence +
      exactColorCountSentence +
      `Ignore theme color associations completely. The theme name must not influence balloon color generation. Use only the selected Sempertex palette above. Every visible balloon must visually match one of the selected palette entries. If a balloon appears outside the selected palette, reinterpret it as an error and recolor it to the nearest allowed selected color. ` +
      `If any balloon would otherwise appear in a non-selected color, recolor it to the nearest color from the selected list above.`
    : "";

  const garlandOpeningSentence = hasRoundPanelInPrompt
    ? `organic half balloon garland attached to the outer right arc of the round panel, ` +
      `following the circular edge from about 1 o'clock to 5 o'clock, right outer arc only, dense and premium, ` +
      `individual ${balloonColors} latex balloons`
    : isDoubleArchScene
      ? `two mirrored organic half balloon garlands, one on each arch's own outer side, dense and premium, ` +
        `individual ${balloonColors} latex balloons cascading from each arch's own top outer corner to the floor`
      : `organic half balloon garland on the right side, dense and premium, ` +
        `individual ${balloonColors} latex balloons cascading from the top corner to the floor`;

  const garlandDesc =
    balloonStyle === "none"
      // 2026-09-03: "No balloon garland." on its own did not work — a real
      // render of a no-balloons Double Arch came back with two full balloon
      // bouquets. Printing the assembled prompt showed why: it still carried
      // thirteen sentences mentioning balloons, including the scene opener
      // ("icy light blue and white balloon tones") and, at the very end,
      // "No garland without 36 inch balloons", which asserts a garland exists
      // and demands large balloons in it. Those are gated on the garland now;
      // this clause states the empty scene positively instead of relying on a
      // single bare negation.
      ? `This setup has no balloons at all. The backdrop panels stand on their own, ` +
        `and the floor and wall around them stay completely bare and clean — ` +
        `no balloon garland, no balloon clusters, no balloon bouquets, no loose balloons anywhere. `
      : garlandOpeningSentence + "." +
        balloonSizeDesc +
        ` The balloon garland must be attached directly to the backdrop edge with no visible gap. ` +
        `Balloons must closely follow the backdrop contour and look professionally installed onto the structure.` +
        archGarlandExtra +
        doubleArchMirroredGarlandClause +
        roundGarlandExtra +
        roundGeometryClause +
        sempertexClause;

  // ── Shimmer negatives ──────────────────────────────────────────────────────
  // Applies whenever ANY shimmer wall is in the scene — single or multi-panel
  // — so single_shimmer gets the identical reinforcement arch_shimmer already
  // relied on. This used to be nested inside the isMulti-only block, which
  // meant single_shimmer got no reinforcement against the model drifting into
  // a flat matte board or wrong color.
  //
  // Restored to the pre-"forceful_v2" wording — the stacked color negation
  // ("No silver shimmer wall... No generic reflective silver wall...") combined
  // with the large-paillette guide caused the edit model to render visible
  // square patchwork blocks instead of a sequin texture, even for color=silver.
  // Shimmer color adherence is de-prioritized for now in favor of restoring
  // the previously-good Arch + Shimmer quality.
  //
  // GOLDEN SHIMMER METHOD negatives — keep exactly: no mirror slab, no chrome
  // wall, no glitter print, no crumpled/flat foil, no matte board, no bathroom
  // tile look. Do not remove these or replace with the stronger v3-era
  // negatives (see shimmerColorLockClause guardrail comment above).
  const hasShimmerInScene = sceneModel.panels.some((p) => p.type === "shimmer_wall");
  const shimmerNegs = hasShimmerInScene
    ? `The shimmer wall must remain a tiled metallic sequin wall — ` +
      `do not turn it into a plain matte board or cream panel. ` +
      `No missing tile texture on shimmer wall. No flat off-white panel instead of shimmer. ` +
      `No bathroom tile look, no mirror slab, no glitter print, no flat foil sheet. ` +
      `No smooth cream board for shimmer wall. `
    : "";

  // ── Multi-panel negatives ─────────────────────────────────────────────────
  // Double Arch is excluded (2026-09-03): these seventeen "No ..." sentences
  // were in every render where the plinth went missing and in none where it
  // was painted; the guide already fixes the panel count and widths.
  const multiPanelNegs = isMulti && !isDoubleArchScene
    ? `Do not merge panels into one. Do not omit any panel. No extra panels beyond ${panelCount}. ` +
      `No outline-only arch. No wire-frame backdrop. No thin frame backdrop. ` +
      `No transparent backdrop board. No decorative line structure. ` +
      `Every selected panel must appear as a full solid opaque backdrop board. ` +
      `No skinny panels. No narrow tower-like panels. No compressed backdrop boards. ` +
      `No thin vertical strips. No overly narrow arch. No overly narrow rectangular board. ` +
      `Do not shrink panel widths. Do not turn panels into slim columns. `
    : "";

  // Which panel is which, in the same words backdropDesc uses above, so a
  // per-panel instruction can name its panel unambiguously.
  const panelPositionLabel = (i: number): string => {
    if (panelCount === 1) return "backdrop panel";
    const names = panelCount === 2 ? ["LEFT", "RIGHT"] : ["LEFT", "CENTER", "RIGHT"];
    return names[i] ? `${names[i]} backdrop panel` : `backdrop panel ${i + 1}`;
  };

  // Theme graphic clause — printed illustration, per panel.
  //
  // 2026-09-03: this clause used to say "The backdrop has a printed theme
  // illustration" with no panel named, and read the preset off the FIRST
  // panel that had one. Enabling the graphic on a single panel of a Double
  // Arch therefore printed it on both, because nothing in the prompt said
  // which board it belonged to. It now names the panels that carry it and
  // states that the others stay plain.
  const panelsWithGraphic = sceneModel.panels.filter(p => p.graphic.enabled);
  const themeEntry = THEME_CATALOG.find(t => t.id === String(sceneModel.theme ?? "").toLowerCase());
  const graphicPanelIdx = sceneModel.panels
    .map((p, i) => (p.graphic.enabled ? i : -1))
    .filter((i) => i >= 0);
  const graphicPresetDescFor = (assetId: string | undefined): string | null => {
    const preset = themeEntry?.graphicPresets.find(p => p.assetId === assetId);
    return (preset as { promptDescription?: string } | undefined)?.promptDescription
      ?? preset?.desc ?? null;
  };
  // Stated positively and once. An earlier version of this clause added four
  // "No floating sticker / No separate poster / ..." sentences plus a
  // "no illustration, no pattern, no print, no artwork" list for the plain
  // panel; that pile of negation cost the scene its plinth in a verification
  // render, the same failure this file has now hit several times. The print
  // is described instead, and the plain board is described as plain.
  const graphicSentences = graphicPanelIdx.map((i) => {
    const p = sceneModel.panels[i];
    const desc = graphicPresetDescFor(p.graphic.assetId);
    return `The ${panelPositionLabel(i)} has a theme illustration printed into its board surface, ` +
      `following that panel's own perspective and lighting${desc ? `, depicting: ${desc}` : ""}. `;
  }).join("");
  const plainPanelIdx = sceneModel.panels
    .map((p, i) => (p.graphic.enabled ? -1 : i))
    .filter((i) => i >= 0);
  const plainPanelSentence =
    graphicPanelIdx.length > 0 && plainPanelIdx.length > 0
      ? `The ${plainPanelIdx.map(panelPositionLabel).join(" and the ")} ${plainPanelIdx.length > 1 ? "keep" : "keeps"} a plain empty board face. `
      : "";
  const themeGraphicClause = graphicPanelIdx.length > 0
    ? graphicSentences + plainPanelSentence
    : "";

  // Customized text — baked directly into the backdrop surface, never an overlay/sticker
  const panelsWithText = sceneModel.panels.filter(
    (p) => p.text.enabled && p.text.value.trim().length > 0,
  );
  // Colour is named, not listed as a hex — describeTextColor picks the nearest
  // plain-English name, so a customer-picked hex reaches the model as words it
  // can act on. The four presets keep the names they always had.
  const TEXT_FONT_LABEL: Record<string, string> = {
    script: "flowing script", block: "bold block", elegant: "elegant serif",
  };
  // 2026-09-03: this described panelsWithText[0] only, so on a Double Arch
  // with a different word typed on each board the second word was never in
  // the prompt at all and never appeared in the render. Every panel's text is
  // described now, each naming its own panel.
  const textPanelIdx = sceneModel.panels
    .map((p, i) => (p.text.enabled && p.text.value.trim().length > 0 ? i : -1))
    .filter((i) => i >= 0);
  // One short line per board, with the shared "how it is printed" wording
  // stated once. The first per-panel version repeated a six-sentence block for
  // every board; the second board's word was still dropped from the render,
  // and the bulk pushed the plinth out. Reading as a list of what each board
  // says is both shorter and closer to how the guide shows it.
  const customTextClause = textPanelIdx.length > 0
    ? `Lettering is printed into the board finish itself, following each panel's surface angle and ` +
      `scene lighting — part of the board, not a sign standing in front of it. ` +
      textPanelIdx.map((i) => {
        const p = sceneModel.panels[i];
        const v = p.text.value.trim();
        const place = p.graphic.enabled
          ? "across the top of that board, above the printed illustration"
          : "across the upper-middle of that board";
        const colourName = describeTextColor(p.text.color);
        return `The ${panelPositionLabel(i)} reads exactly "${v}", ${place}, in ` +
          `${TEXT_FONT_LABEL[p.text.fontStyle] ?? p.text.fontStyle} lettering, spelled exactly as "${v}" and clearly readable. ` +
          // The colour is stated on its own and repeated, because the round-
          // backdrop path (fal-ai/flux-2/edit) was quietly recolouring the
          // lettering to match the balloons: black was reported coming back
          // pale blue whatever the customer picked (2026-09-03).
          `Those letters are ${colourName} — solid ${colourName} lettering, the exact colour shown in the reference image. ` +
          `Do not recolour the lettering to match the balloons, the backdrop, or the room. ` +
          // 2026-09-04: a three-word message came back as "Happy Birthday /
          // Arya / Arya" — the model echoed the last line. It may wrap the
          // words onto as many lines as it likes, but each word appears once.
          `Those words appear exactly once on that board: do not repeat, echo or duplicate any word or line. `;
      }).join("") +
      (textPanelIdx.length > 1
        ? `Each board shows only its own words: "${textPanelIdx.map((i) => sceneModel.panels[i].text.value.trim()).join('" and "')}" are different words on different boards. `
        : "") +
      (textPanelIdx.length < panelCount
        ? `The other ${panelCount - textPanelIdx.length > 1 ? "boards stay" : "board stays"} blank. `
        : "")
    : "";

  const isRoundScene = hasRoundPanelInScene && !isMulti;
  // When Sempertex palette is locked, use neutral product photography style cues so the
  // model renders color-accurately instead of applying a warm tinted global style.
  const neutralStyleClause = hasSempertexLock
    ? `Use neutral daylight product photography with accurate white balance. ` +
      `Keep whites clean neutral white. ` +
      `Preserve true soft pastel color separation and natural diffuse balloon material. ` +
      // 2026-07-20 product feedback: window daylight was visibly tinting the
      // balloons away from their selected Sempertex tones.
      `The window daylight must NOT tint the balloons: no blue, golden, or warm color cast from the ` +
      `window light on any balloon surface — every balloon keeps its exact specified color on both its ` +
      `window-lit side and its shadow side, with only neutral highlights and neutral gray shading. `
    : "";
  const photographyOpening = isRoundScene
    ? `Bright, sharp, premium studio photography with clean natural daylight from the left, ` +
      `gray textured plaster or concrete studio wall, polished light concrete or stone floor, ` +
      `crisp clean whites, natural accurate color, normal punchy contrast, well-lit and clear — ` +
      `NOT hazy, NOT desaturated, NOT grey-filtered, NOT washed out, NOT low-energy, NOT distant. ` +
      (hasSempertexLock
        ? `Color-accurate neutral rendering, accurate white balance. `
        : `fresh modern editorial event styling. `)
    : `Cool neutral daylight studio photography with soft natural light from the left, ` +
      `gray textured plaster or concrete studio wall, polished light concrete or stone floor, ` +
      (hasSempertexLock
        ? `crisp clean whites, neutral white balance, color-accurate rendering. `
        : balloonStyle === "none"
          ? `crisp clean whites, neutral white balance, fresh modern editorial event styling. `
          : `crisp clean whites, icy light blue and white balloon tones, neutral white balance, fresh modern editorial event styling. `);
  const eventSetupLabel = (hasSempertexLock && isUnicornTheme)
    ? "soft pastel birthday backdrop setup"
    : "children's birthday event setup";
  const framingClause = isRoundScene
    ? `Transform this clean layout reference into a premium photorealistic indoor ${eventSetupLabel}. ` +
      `Medium-close full-body event photography — the round backdrop, balloon garland and pedestal fill the frame, ` +
      `the setup reaching close to the top and bottom edges of the image with only a narrow margin of floor and wall ` +
      `around it. Keep the whole setup visible and nothing cropped, but do not leave large empty areas of floor or ` +
      `wall — the setup is the subject and should dominate the frame. `
    : panelCount === 1
      // 2026-09-03: a single arch was rendering far too zoomed out — "wide" plus
      // "breathing room" left the backdrop as a small object in a large empty
      // room. One panel does not fill a frame the way two side-by-side panels
      // do, so it gets the closer framing the round backdrop already uses.
      // Multi-panel scenes keep the wide framing, which suits them.
      // 2026-09-04: the first attempt at this ("medium-close ... only a small
      // margin") still left a single arch sitting small in a large grey room.
      // Naming what should touch the edges — the top balloon, and how much
      // floor is allowed — moved it where the general wording did not.
      ? `Transform this clean layout reference into a premium photorealistic indoor ${eventSetupLabel}. ` +
        `Tight medium-close full-body event photography. The setup is the subject and must DOMINATE the frame: ` +
        `the highest balloon of the garland sits just below the top edge of the image, and the floor occupies no ` +
        `more than the bottom eighth of the frame. Leave only a narrow margin of wall on either side. ` +
        `Keep the whole setup visible and nothing cropped, but do not render the setup small in a large empty room. `
      : `Transform this clean layout reference into a premium photorealistic indoor ${eventSetupLabel}. ` +
        `Wide full-body event photography — entire setup fully visible with breathing room, nothing cropped. `;
    
const cutouts = sceneModel.cutouts;
const cutoutItems = cutouts?.items?.filter((item) => item.quantity > 0) ?? [];
const cutoutTotal = cutoutItems.reduce((sum, item) => sum + item.quantity, 0);
const cutoutPromptApplied = cutoutTotal > 0;

// Character standees are NOT generated by the AI — they are composited deterministically
// after the render. This clause suppresses any AI-invented cutout art.
const cutoutClause = cutouts?.mode === "standees" && cutoutTotal > 0
  ? `Do not generate character cutouts, character standees, foam-board figures, or themed printed characters in this render. ` +
    `Character standees will be composited separately after rendering. ` +
    `Keep the floor clear of any character figures or themed standee objects. `
  : "";

// Controlled setup layout template — locks panel arrangement and keeps the
// garland organic and connected, especially for 2-backdrop scenes.
const setupTemplateId = inferSetupLayoutTemplateIdFromBackdropItems(sceneModel.panels);
const setupTemplate   = setupTemplateId ? getSetupLayoutTemplate(setupTemplateId) : undefined;
const hasGarland      = sceneModel.balloons.style !== "none";
const setupTemplateClause = setupTemplate
  ? `Use the selected setup layout: ${setupTemplate.name}. ${setupTemplate.panelInstruction} ` +
    (hasGarland
      ? `${setupTemplate.garlandInstruction} ` +
        `The garland must be a lush organic balloon garland with varied balloon sizes, layered clusters, ` +
        `natural asymmetry, dense premium event styling. `
      : "") +
    (hasGarland && sceneModel.panels.length >= 2 && !isDoubleArchScene
      ? `Preserve the organic garland following the selected setup layout path. ` +
        `Do not replace it with loose balloon bouquets, simple balloon clusters, or floating balloons. `
      : "")
    // Double Arch's plinthInstruction (catalog text) is intentionally never
    // included here anymore — the plinth is suppressed from the AI-facing
    // prompt entirely and composited deterministically instead. See the
    // plinthDesc/noPlinthDesc block above.
  : "";

  // ── Scene inventory ───────────────────────────────────────────────────────
  // The edit model paints a limited number of "extras" and silently drops the
  // rest. Measured on 2026-09-03 with one scene and a fixed seed: with no text
  // and no printed illustration the plinth was painted; adding either one made
  // the plinth disappear, and neither moving the plinth wording to the end of
  // the prompt nor drawing a bolder plinth marker in the guide brought it
  // back. Listing the scene's contents once, up front, did — and when that
  // first list named only the boards, garlands and plinth, the model dropped
  // the lettering instead, which is what identified the mechanism. The list
  // therefore has to name every element that was asked for.
  const inventoryItems: string[] = [];
  inventoryItems.push(
    panelCount === 1
      ? `the arch backdrop board`
      : `the ${panelCount} backdrop boards`,
  );
  if (sceneModel.balloons.style !== "none") {
    inventoryItems.push(panelCount === 1 ? `the balloon garland` : `a balloon garland on each board`);
  }
  if (plinth) {
    // "pedestal column", not "plinth", here too — the inventory is the first
    // line the model reads, and the squat-drum prior rides on that one word.
    inventoryItems.push(`one slim white cylindrical pedestal column standing on the floor in front of the boards`);
  }
  for (const i of textPanelIdx) {
    inventoryItems.push(`the words "${sceneModel.panels[i].text.value.trim()}" printed on the ${panelPositionLabel(i)}`);
  }
  for (const i of graphicPanelIdx) {
    const desc = graphicPresetDescFor(sceneModel.panels[i].graphic.assetId);
    inventoryItems.push(
      `the printed ${desc ? `${desc} ` : ""}illustration on the ${panelPositionLabel(i)}`,
    );
  }
  const sceneInventoryClause = inventoryItems.length > 1
    ? `Everything listed here appears in the finished photograph: ${inventoryItems.join("; ")}. ` +
      `Every one of these is visible. `
    : "";

  return (
    photographyOpening +
    sceneInventoryClause +
    framingClause +
    `${backdropDesc}. ` +
    doubleArchSizeLockClause +
    doubleArchSeparationClause +
    doubleArchPlinthHardLockClause +
    (sceneModel.panels.some((p) => p.type === "open_arch_frame")
      ? `The open arch frame's CENTER is completely hollow: no backdrop panel behind the frame, no solid surface filling ` +
        `the opening, no hidden second backdrop, no curtain or board filling the arch. The area inside and behind the ` +
        `opening shows only the room. The frame's own border, however, must be thick, bold, and visually substantial — ` +
        `a real premium decor prop with genuine material presence, not a thin wire outline or skinny doorway trim. ` +
        `It stays flat-fronted and freestanding — not a tube-shaped balloon arch, not inflatable, not a deep 3D tunnel. ` +
        `Balloons must never fill, cross, or block the hollow opening — the opening stays fully clear. ` +
        `Exactly the listed pieces — do not add any extra panel. `
      : "") +
    setupTemplateClause +
    themeGraphicClause +
    customTextClause +
    cutoutClause+
    (plinthDesc ? `${plinthDesc}. ` : noPlinthDesc) +
    `${garlandDesc}. ` +
    // 2026-09-01: user kept reporting flat-disc balloons across renders even
    // after the correction-pass shading fix, because the FIRST-generate pass
    // (this prompt) never told the model each balloon should be a shaded
    // sphere — only that the garland mass has "layered 3D depth". A model can
    // satisfy that by overlapping flat circles. State the per-balloon shape
    // explicitly, matching the gradient sphere shading baked into the SVG
    // layout guide in generateStructureSilhouette.ts.
    (hasGarland
      ? `Every individual balloon in the garland renders as a real inflated latex sphere: fully round, ` +
        `with a soft directional highlight on its lit side and gentle shadow gradient toward its rim, giving it ` +
        `visible three-dimensional volume. Do not render any balloon as a flat coin, flat disc, flat circle, ` +
        `paper cutout, or sticker shape — every balloon must look physically round and inflated, matching a ` +
        `real photograph of a balloon garland. `
      : "") +
    multiPanelNegs +
    shimmerNegs +
    neutralStyleClause +
    (hasSempertexLock
      ? `Neutral color-accurate event photography, neutral white balance. `
      : `Premium modern editorial event photography, neutral white balance, clean fresh color grading, `) +
    `crisp white arch surface, no visible outline or border on the arch. ` +
    (panelsWithText.length === 0
      ? `No text on backdrop. `
      : `No extra text beyond the specified custom text. No misspelled or duplicated lettering. `) +
    `No people. No cake. No table. ` +
    // 2026-09-03: these seven bans on podium/platform/riser/box shapes are
    // only emitted when the scene has NO plinth. When one IS wanted they were
    // fighting the request — the prompt asked for a white cylinder to be
    // painted while separately banning podiums, platforms, risers, box
    // plinths and low round podiums. Double Arch dropped its plinth in every
    // render. The shape guidance survives positively in plinthDesc, which
    // already specifies a solid opaque matte white cylinder, not glass or
    // acrylic; what is removed is only the blanket ban.
    (plinth
      ? ``
      : `No stage. No podium. No base platform. No floor riser. ` +
        `No rectangular box plinth. No low round podium. No flat platform under plinth. `) +
    `No extra side panel. No extra wall or slab. ` +
    `No warm yellow lighting. No golden ambient light. No beige hotel interior. No yellow color cast. ` +
    `No ornate luxury room. No cream or brown walls. No orange or yellow white balance. ` +
    `No overly warm shadows. No dark moody room. ` +
    `No plants. No furniture. No chairs. No mirrors. No doors. No visible support legs. No black stands. ` +
    (hasArchPanelInPrompt
      // The balloon placement negatives are skipped for a no-balloons scene:
      // naming balloons seven times is what a scene with none must not do.
      ? (balloonStyle !== "none"
          ? `No balloons across the front face. No balloons blocking the arch face. ` +
            `No balloons covering the open center. No floor balloon pile in front of panel. ` +
            `No garland crossing inward over the panel face. No disconnected floor balloon pile. ` +
            `No balloons in front of plinth. `
          : "") +
        `No hollow arch. No open doorway arch. No arch frame. No cut-out center. ` +
        `No empty opening. No see-through arch. No doorway frame. `
      : "") +
    (hasRoundPanelInScene
      ? `No small round backdrop. No undersized circle. No decorative wall circle. ` +
        `No round panel smaller than plinth scale. No distant tiny round panel. ` +
        `No extra plinth. No second plinth. No duplicate plinth. No low white platform. No oval base. ` +
        `No round base. No stage. No podium. No riser. No pedestal. No support block. No support disc. ` +
        `No base cylinder. No round backdrop base. No display base. No furniture base. No extra cylinder. ` +
        `No floating support. No visible stand. No visible feet. No visible wheels. No visible frame. ` +
        `No visible support bar. No round backdrop on furniture. No round backdrop mounted on a stand. ` +
        `No full balloon ring. No 360-degree balloon wreath. No circular balloon frame. No balloon halo. ` +
        `No balloons wrapping all the way around the circle. No balloons on the left side of the round panel. `
      : "") +
    (sempertexClause
      ? `No wrong balloon colors. No unrelated balloon colors. No theme-default balloon colors. ` +
        `No unselected balloon colors. No extra balloon colors. No substitute colors. No approximate palette. ` +
        `No ignoring selected palette. No changing backdrop size when color changes. ` +
        `No orange balloons when not selected. ` +
        (!hasYellowInPalette ? `No yellow balloons when not selected. ` : "") +
        (!hasGreenInPalette  ? `No green balloons when not selected. `  : "") +
        (!hasBlueInPalette   ? `No blue balloons when not selected. `   : "") +
        `No teal balloons. No turquoise balloons. ` +
        `No unrelated metallic balloons. No unselected gold balloons. No unselected rose gold balloons. ` +
        `No peach balloons. No coral balloons. No terracotta balloons. ` +
        `No beige balloons. No cream balloons. No bronze balloons. No copper balloons. ` +
        `No gold balloons unless selected. ` +
        `No lavender balloons. No lilac balloons. No violet balloons. No purple balloons. No rainbow balloons. ` +
        `No glossy balloons. No chrome balloons. No mirror metallic balloons. No reflective balloons unless selected. ` +
        `No warm cast. No creamy tint. No hazy filter. No editorial global filter. No warm amber overlay. No film-like tint. No ivory whites. No beige whites. `
      : "") +
    (balloonStyle !== "none"
      ? `No balloons all the same size. No mostly small balloons. No garland without 36 inch balloons. ` +
        `No tiny-only garland. No micro-balloon chain.`
      : "")
  );
}
