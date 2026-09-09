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
    case "open_arch_frame": return "arch backdrop board";
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
  // A Banner sits with Round rather than with Single Arch on both front-loaded
  // lines: it is a graphic-carrying panel that is not a single arch, so it needs
  // the palette line and the "nothing underneath it" line for the same reasons.
  const hasBannerPanelInPrompt = sceneModel.panels.some((p) => p.type === "banner");
  const hasRingPanelInPrompt = sceneModel.panels.some((p) => p.type === "balloon_ring");
  const hasOpenFramePanelInPrompt = sceneModel.panels.some((p) => p.type === "open_arch_frame");
  // 2026-09-05: the front-loaded lines used to be allowed only on multi-panel,
  // round and banner scenes. That list was built one setup at a time and it left
  // a lone Shimmer Wall out — its render dropped the lavender from the palette
  // entirely, which is what "secili balon renkleri calismiyor mor yok" was. The
  // gate is inverted now: every layout gets them EXCEPT the one they are known
  // to break, a single plain arch, where first position displaces the structural
  // wording and the panel comes back rectangular with a horseshoe garland.
  const isLonePlainArch = panelCount === 1 && sceneModel.panels[0]?.type === "arch";
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
        // 2026-09-04: every sentence in this block that mentions the plinth is
        // now conditional on one actually being selected. It used to name "the
        // single selected vertical plinth" three times and scale the backdrop
        // against a 75cm/40cm default even for a scene with no plinth at all,
        // which is why a round setup rendered a pedestal the customer never
        // added. With no plinth the same sentences say the opposite.
        (firstPlinth
          ? `The ONLY cylinder allowed anywhere in this scene is the single selected vertical plinth — ` +
            `do not add any other cylinder, disc, or rounded object near the panel. `
          : `NO cylinder of any kind is allowed anywhere in this scene — no plinth, no pedestal, no column, ` +
            `no podium, no riser and no drum. The floor in front of the panel is bare. `) +
        `Round backdrop is exactly 200 cm diameter. ` +
        (firstPlinth
          ? `It must visually appear about ` +
            `${(200 / plinthHeightCm).toFixed(1)} times taller than the ${plinthHeightCm} cm plinth and about ` +
            `${Math.round(200 / plinthDiameterCm)} times wider than the ${plinthDiameterCm} cm plinth diameter. `
          : `It stands roughly as tall as an adult and reads as a full-size two-metre event backdrop. `) +
        `The round panel should dominate the setup and fill most of the background composition. ` +
        `Do not shrink the round panel. Do not render it as a small decorative circle. ` +
        `It must read as a full-size 2 meter event backdrop, thin and flat like a sign board, never like a piece ` +
        `of furniture or a display fixture. ` +
        (firstPlinth
          ? `Only one visible prop is allowed in the entire scene: the single selected vertical cylindrical plinth. `
          : `No prop of any kind stands in this scene — only the round panel and its balloon garland. `) +
        `The round backdrop itself has no visible base, no stage, no platform, no pedestal, no riser, ` +
        `no support block, no support disc, no display base, no furniture base, no stand, no feet, ` +
        `and no plinth. Do not invent any extra white cylinder, oval base, round base, or low platform ` +
        `under or beside the round panel — the floor beneath and around the panel must be completely bare ` +
        (firstPlinth ? `except for the one selected plinth and the balloon garland.` : `except for the balloon garland.`);
    } else if (p.type === "balloon_ring") {
      // No board at all — the ring IS the backdrop, and its open centre is the
      // point of the setup, so the wording spends most of its words defending it.
      // 2026-09-09: two dressings now. "half" is the customer's own Instagram
      // style — a bare gold metal hoop with the garland on one side of it.
      backdropDesc = sceneModel.balloonRingStyle === "none"
        ? `one freestanding circular hoop about ${p.widthCm}cm across, standing upright on the floor: a slim ` +
          `round GOLD METAL FRAME on a small flat base, bare polished tube all the way round with NO BALLOONS ` +
          `on it anywhere. The CENTRE OF THE RING IS COMPLETELY OPEN and empty — the grey studio wall shows ` +
          `straight through it. No backdrop board, no panel, no disc and no balloons of any kind, on the hoop ` +
          `or anywhere else in the scene.`
        : sceneModel.balloonRingStyle === "half"
        ? `one freestanding circular hoop about ${p.widthCm}cm across, standing upright on the floor: a slim ` +
          `round GOLD METAL FRAME, its bare polished tube clearly visible along the lower-left of the circle, ` +
          `with a dense organic balloon garland wrapped around the rest of it — up the left shoulder, over ` +
          `the top, down the right side and spilling into a pile of balloons on the floor at the bottom ` +
          `right. Roughly half the hoop is bare metal and half is covered in balloons. ` +
          `The CENTRE OF THE RING IS COMPLETELY OPEN and empty — the grey studio wall shows straight through ` +
          `it. No backdrop board, no panel, no disc and no balloons of any kind inside the opening.`
        : `one freestanding circular balloon ring about ${p.widthCm}cm across, standing upright on the floor: ` +
          `a thick hoop built entirely from balloons, packed shoulder to shoulder all the way round. ` +
          `The CENTRE OF THE RING IS COMPLETELY OPEN and empty — the grey studio wall shows straight through it. ` +
          `No backdrop board, no panel, no disc, no fabric and no balloons of any kind inside the opening. ` +
          `There is no board behind the ring. ` +
          `The hoop itself is dense and organic, mixing large and small balloons, thickest where it meets the floor.`;
    } else if (p.type === "banner") {
      // 2026-09-05, rewritten. The first version described this as "a taut
      // printed fabric banner stretched on a slim freestanding frame", and that
      // is exactly what came back: a big white cloth hanging on a black stand
      // with a small print floating in the middle of it. "Banner" and "frame"
      // pull a trade-show pull-up stand, not a party backdrop.
      //
      // It is now described the way the round backdrop is — a thin solid panel
      // standing on the floor with the artwork printed across its whole face —
      // only square. That description already renders cleanly (the round + theme
      // graphic scene), which is the point: this setup is the round one with a
      // square board.
      backdropDesc =
        `a thin square backdrop panel, ${backdropColorLabel(p.color)} colored, exactly ${p.widthCm}cm x ${p.heightCm}cm — ` +
        `a perfect square with straight vertical sides, a straight horizontal top edge and clean 90-degree ` +
        `corners. Not a furniture object, not a platform, not a stage piece, not mounted on a display base. ` +
        `The bottom edge of the panel sits directly on the floor, with at most 0-2cm visual gap between the ` +
        `panel's lower edge and the floor surface. ` +
        `Clearly freestanding in front of the wall, with visible separation between the panel and the wall behind it. ` +
        `Not wall-mounted, not attached to the wall, not painted on the wall. ` +
        `NO visible stand. NO visible feet. NO visible frame. NO visible poles. NO visible support bar. ` +
        `NO hanging cloth, NO fabric folds, NO sagging, NO creases, NO curtain, NOT a pull-up banner stand. ` +
        `It is a flat rigid printed board, smooth and taut edge to edge. ` +
        `NOT an arch, NOT a rounded top, NOT a circle. ` +
        `NO extra base of any kind beneath or around the panel — the floor beneath and around it is completely ` +
        `bare except for the balloon garland.`;
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
      const isHalfArch  = p.type === "half_arch";
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
          ? `plain flat arch backdrop board, front-facing, with a COMPLETELY FLAT MATTE face — smooth, evenly ` +
            `lit, non-reflective, the same finish and colour family as the solid arch beside it so the two ` +
            `read as one coordinated set. ` +
            `A dense organic balloon cluster is mounted on its face, covering the middle of the board from the ` +
            `crown down to the floor and leaving a narrow margin of bare board round the edge. ` +
            `NOT chrome, NOT mirrored, NOT polished metal, NOT stainless steel, NOT glossy, ` +
            `NOT moulded, NOT stepped, NOT ridged, NOT bevelled, NOT a picture-frame profile, ` +
            `NOT a doorway frame, NOT an architectural portal, NOT a wire or metal outline, ` +
            `NOT tubular or pipe-like, NOT inflatable, NOT a niche, alcove, tunnel or hallway`
          : isHalfArch
            ? `solid flat matte ${pColor} HALF arch board — a full arch sliced straight down its middle, so ` +
              `ONE top corner is a quarter-circle curve and the other side is a plain vertical edge running ` +
              `full height. The curved corner faces OUTWARD, away from the centre board; the straight edge ` +
              `is butted flat against the centre board with no gap. It is NOT a full arch, NOT symmetrical, ` +
              `NOT rounded on both top corners`
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
        ? `two flat arch backdrop boards, one bare and one carrying a dense balloon cluster on its face, each rendered at its correct width. `
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
      // 2026-09-04: a round scene with no plinth selected rendered one anyway,
      // every time. "No plinths." on its own was never the problem — the round
      // panel description above it spent five sentences talking about "the
      // single selected vertical plinth" and sized the backdrop against a
      // 75cm one, regardless of whether the customer had added a plinth. Those
      // sentences are now conditional, and this one names the object the way
      // the plinth-present branch does so it is refused as specifically as it
      // was previously requested.
      : `No plinth, pedestal, podium, display column, cylinder, riser, stand or platform of any kind stands anywhere in this scene. ` +
        (sceneModel.balloons.style === "none"
          ? `The floor in front of the backdrop is completely bare and empty. `
          : `The floor in front of the backdrop is completely bare and empty apart from the balloon garland. `);

  // ── Balloon garland description ───────────────────────────────────────────
  const balloonStyle = sceneModel.balloons.style;

  const selectedSempertexColors = (effectiveSempertexSelection ?? []).slice(0, 5);

  const hasSempertexLock =
    balloonStyle !== "none" && selectedSempertexColors.length > 0;

  const selectedColorList = selectedSempertexColors
    .map((c) => renderSafeBalloonLabel(c))
    .join("; ");

  // Allowed palette block — code + hex + positive-only label (no bias words like gold/yellow/rose-gold)
  // 2026-09-09: the product code and the hex string are GONE from this block.
  // Building the sample thumbnails turned up a Single Arch render, at the
  // production seed and again at another, with words and numbers PRINTED ON THE
  // BALLOONS. This line was the source: "005 #FFFFFF pure white; 640 #BAE6FD
  // ..." sits immediately before "for every balloon in the garland", and the
  // model obligingly wrote the tokens onto them. The codes never carried any
  // visual meaning for an image model — the colour description is what locks
  // the palette, and it is what the front-loaded palette line already uses.
  const allowedPaletteBlock = hasSempertexLock
    ? `ALLOWED BALLOON PALETTE: ` +
      selectedSempertexColors.map((c) => getPositiveLabel(c)).join("; ")
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

  // 2026-09-04: the hue and finish bans further down were fighting the
  // customer's own selection. "No lavender balloons. No lilac balloons. No
  // violet balloons. No purple balloons." and "No chrome balloons. No mirror
  // metallic balloons." were emitted for EVERY scene — including a Double Arch
  // whose selected palette was white + lilac + silver metallic. The model was
  // handed the palette and, in the same breath, told not to paint two of its
  // colours; what came back had gold/champagne balloons scattered through the
  // garland, because forbidden lilac and forbidden chrome leave the nearest
  // warm metallic as the only thing left to paint. Every hue/finish ban is now
  // conditional on that hue or finish being absent from the selection — the
  // treatment yellow, green and blue already had.
  const paletteHas = (
    test: (name: string, family: string, finish: string) => boolean,
  ): boolean => selectedSempertexColors.some((c) => test(
    String(c.colorName ?? "").toLowerCase(),
    String((c as SempertexSelectionItem & { family?: string }).family ?? "").toLowerCase(),
    String(c.finish ?? "").toLowerCase(),
  ));
  const hasPurpleInPalette   = paletteHas((n, f) => f === "purple" || /purple|violet|lilac|lavender|amethyst|mauve/.test(n));
  const hasGoldInPalette     = paletteHas((n, f) => f === "gold"   || /gold|champagne/.test(n));
  const hasPinkInPalette     = paletteHas((n, f) => f === "pink"   || f === "peach" || /pink|blush|rose|coral|peach/.test(n));
  const hasCreamInPalette    = paletteHas((n, f) => f === "neutral" || /cream|beige|ivory|sand|nude|oyster/.test(n));
  const hasOrangeInPalette   = paletteHas((n, f) => f === "orange" || /orange|terracotta|copper|bronze/.test(n));
  // Silver, gold and every Reflex/Metallic finish are shiny by definition, so a
  // blanket "no chrome / no reflective balloons" contradicts them outright.
  const hasMetallicInPalette = paletteHas((n, f, fin) =>
    fin === "metallic" || fin === "reflex" || f === "silver" || f === "gold" || /chrome|metallic|silver/.test(n));

  // 2026-09-05. Front-loaded palette line.
  //
  // The BALLOON COLOR LOCK block further down is ~500 characters deep inside an
  // ~11,000 character prompt, and on arch scenes it was not doing the work: a
  // Double Arch on white + lilac + silver kept painting gold, copper and
  // champagne balloons through both garlands. Wording added down there had no
  // effect at all — a "cool stainless steel, never gold" clause was removed and
  // re-added at a fixed seed and the render came back PIXEL-IDENTICAL, mean
  // absolute difference 0.000 over 2.36M bytes.
  //
  // The model is not ignoring the prompt: prepending "every balloon is bright
  // red" turned the whole garland red. Position and bluntness are what matter.
  // A short palette sentence at the very front, measured on the same scene at
  // two seeds: warm pixels 1.16% -> 0.01% / 0.00%, pink 0.82% -> 0.00% / 0.00%,
  // and the silver renders as true mirror silver rather than drifting warm.
  //
  // This also replaced a guide-side fix that tinted the silver cool. That
  // worked at one geometry and stopped working when the garland changed (warm
  // back to 1.16%), and it falsified the colour — silver came out slate blue.
  // The sentence holds at both seeds with the guide left at the true hex.
  // Scoped to MULTI-PANEL ARCH scenes, which is where the failure is and the
  // only place this is safe. Measured, same palette, fixed seeds:
  //   Double Arch, no line          warm 1.16%, pink 0.82% — gold through both garlands
  //   Double Arch, line at the front warm 0.01% / 0.00% at two seeds, pink 0.00%
  //   Single Arch, no line          warm 0.00% — it does not have this problem
  //   Single Arch, line at the front the arch panel renders RECTANGULAR with a
  //     horseshoe garland down both sides, at both seeds. The line is first, so
  //     it displaces the structural wording, and one panel has less structural
  //     signal to spare than two.
  // Two other placements were tried and are worse than doing nothing:
  //   same sentence at the END of the prompt   warm 2.24% (vs 1.16% with none)
  //   only the ban half, at the front          warm 11.70%, lilac 0.00% — naming
  //     gold without naming what the balloons ARE summons it.
  // 2026-09-05: extended to ROUND scenes as well. Round had the same buried-lock
  // failure — the customer reported its balloon colours were simply wrong, and
  // the reproduction showed why: silver and lavender barely appeared, and at one
  // seed 2.98% of pixels came back warm cream/beige, which is what they were
  // looking at. With the line, both seeds: warm 0.00%, pink 0.00%, and lilac up
  // from 0.97%/0.87% to 2.94%/3.52% with the silver rendering as real silver.
  // Round tolerates this even though it did NOT tolerate a changed photography
  // opening, so the two are not interchangeable and this was tested on its own.
  //
  // Single-panel arch remains the one exclusion: it does not have the problem
  // and the line breaks its structure. See the measurements below.
  // 2026-09-05: adding a theme graphic to a Round backdrop shrank the panel and
  // stood it on a low white podium disc. Isolated at a fixed seed: the guide's
  // graphic-zone rect alone renders correctly; the graphic SENTENCE alone
  // reproduces the bug. Describing the board as carrying a printed illustration
  // makes it read as an art print, and an art print stands on a podium.
  //
  // Restating the structure next to that sentence did NOT work — same podium,
  // same shrunken panel. Restating it at the FRONT does, which is the same
  // positional effect the palette line depends on. Scoped like the palette line:
  // single-panel arch is excluded, because first position displaces its own
  // structural wording and breaks it.

  // A Banner also states its SHAPE here. The guide draws a true 716.8 x 716.8
  // square and the description says "exactly 200cm x 200cm, a perfect square",
  // but that sits mid-prompt and the render kept coming back portrait — the
  // customer asked outright whether it was really 2m x 2m. Front position is
  // what binds on this pipeline, so the aspect is stated here too. It fires for
  // a banner whether or not it carries a graphic, because the shape is wrong
  // either way.
  const frontStructureLine =
    (sceneModel.panels.some((p) => p.graphic.enabled) || hasBannerPanelInPrompt)
    && (!isLonePlainArch)
      ? `The backdrop ${panelCount > 1 ? "panels are full-size freestanding party backdrops standing" : "panel is a full-size freestanding party backdrop standing"} ` +
        `directly on the bare floor. Nothing is underneath: no podium, no disc, no platform, no base. `
      : "";

  // The banner's aspect goes in FIRST, ahead of even the palette line. Second
  // position was not enough: the board still rendered noticeably taller than
  // wide. Moved to first it renders 1:1, and the palette lock it displaces is
  // unaffected — measured on the same scene, warm 0.02% -> 0.01%, pink 0.01%
  // -> 0.01%, lilac 3.06% -> 3.29%.
  // 2026-09-08: the open arch rendered as a polished chrome pipe. The clause
  // further down already said flat, not tubular, not metal — mid-prompt, so it
  // did nothing. Front-loaded and short.
  // 2026-09-08 (later), three tries on the same day, each one recorded because
  // each failed differently:
  //   "one flat slab ... no moulding"          -> matte, but a stepped
  //                                               picture-frame profile.
  //   "a flat sheet of matte MDF, 4cm thick,
  //    standing on edge"                       -> a WOODEN box on a plinth.
  //   "the SAME kind of board as the solid
  //    arch beside it, with a hole cut
  //    through"                                -> chrome again, AND the hole
  //                                               bled onto the SOLID arch.
  // What is left names each piece by its side, so the "hole" cannot migrate,
  // and never uses the word "frame" — that noun is what pulls the model toward
  // metal in the first place.
  const openFrameIdx = sceneModel.panels.findIndex((p) => p.type === "open_arch_frame");
  const openFrameSide = openFrameIdx < 0 ? "" : openFrameIdx === 0 ? "left" : "right";
  const solidSide     = openFrameSide === "left" ? "right" : "left";
  const hasOpenFramePair = openFrameIdx >= 0 && sceneModel.panels.length === 2;
  // 2026-09-08, sixth wording. The four that failed are recorded here so nobody
  // spends another render on them:
  //   "one flat slab, no moulding"          -> matte, stepped picture-frame edge
  //   "flat sheet of MDF, standing on edge" -> a WOODEN box on a plinth
  //   "same board as the arch beside it"    -> chrome, and the hole bled onto
  //                                            the SOLID arch
  //   "stretch fabric over a thin tube
  //    frame, small metal feet"             -> a square pull-up banner stand
  //                                            with a CHROME TUBE arch inside
  // The words "hole", "opening" and "cut through" are all gone. The guide no
  // longer draws a ring either (see generateStructureSilhouette): the opening is
  // packed with balloons in every render anyway, so what the hole was really
  // contributing was a crisp concentric arch line for the model to turn into a
  // moulded reveal. Described as a plain arch backdrop board carrying a balloon
  // cluster, there is nothing left to mould.
  // 2026-09-09: Triple Arch. Short and front-loaded, because the side boards
  // kept rendering as full symmetrical arches.
  const halfArchCount = sceneModel.panels.filter((p) => p.type === "half_arch").length;
  // 2026-09-09: the bare gold hoop needs a front-loaded mention like every
  // other object on this pipeline — the mid-prompt description alone leaves
  // the render wrapping the whole circle in balloons.
  const frontRingHalfLine = !hasRingPanelInPrompt ? ""
    : sceneModel.balloonRingStyle === "none"
      ? `The hoop is a bare slim GOLD METAL frame with NO balloons on it at all. `
      : sceneModel.balloonRingStyle === "half"
        ? `The hoop is a slim GOLD METAL frame, bare and clearly visible along its lower-left, with balloons ` +
          `wrapped around only the other half of it. `
        : "";

  const frontTripleArchLine = halfArchCount === 2
    ? `Exactly THREE boards, touching: a tall arch in the middle, and either side a HALF arch — one ` +
      `curved top corner facing outward, the other edge straight and vertical against the middle board. `
    : "";

  const frontOpenFrameLine = hasOpenFramePair
    ? `The ${openFrameSide}-hand backdrop is a plain FLAT arch board, exactly like the ${solidSide}-hand one — ` +
      `one smooth matte surface, no border, no rim, no moulding and no trim anywhere on it. `
    : "";
  const openFrameDetailLine = hasOpenFramePair
    ? `A dense arch-shaped balloon cluster is mounted on the face of the ${openFrameSide}-hand backdrop, ` +
      `covering its middle from the crown right down to the floor and leaving only a narrow margin of bare ` +
      `board showing round the edge. That margin is flat painted board — not a frame, not a moulding, not ` +
      `metal, not chrome, not glossy, not wooden. ` +
      (sceneModel.panels.some((p) => p.text.enabled || p.graphic.enabled)
        ? `No lettering and no artwork on the ${openFrameSide}-hand backdrop — any text or illustration ` +
          `belongs on the ${solidSide}-hand one only. `
        : `No lettering and no artwork on the ${openFrameSide}-hand backdrop. `)
    : "";

  // 2026-09-08: the detailed florals clause is mid-prompt, so like every other
  // mid-prompt addition on this pipeline it did nothing — the customer turned
  // the option on and got no flowers at all. Front-loaded and short, paired
  // with proper filled flower clusters in the guide.
  const frontFloralsLine = sceneModel.garlandFlorals && sceneModel.balloons.style !== "none"
    ? `Real flowers are part of this garland: a full floral cluster mounded at the foot of each garland ` +
      `and smaller bunches tucked between the balloons up the climb, drawn exactly where the layout ` +
      `reference shows them. Cream, white and blush blooms with sage eucalyptus foliage. `
    : "";

  const frontBannerAspectLine = hasBannerPanelInPrompt && !isMulti
    ? `The backdrop is a SQUARE board, as wide as it is tall — 2 metres by 2 metres, a 1:1 square, ` +
      `not taller than it is wide. `
    : "";

  // The light-up number needs a front-loaded mention as well as its guide marker.
  // Neither alone was enough: the detailed clause further down did nothing (the
  // render came back without any number at all), and a high-contrast marquee
  // marker in the guide was still dropped. Both together put it in the picture —
  // the same combination the plinth needs, a filled guide marker plus an actual
  // request near the front of the prompt.
  // Like the light-up number, the neon needs a short front-loaded request as
  // well as its guide marker; the detailed clause on its own does nothing.
  // The sequin colour is in the guide (the tiles are drawn in it) and in the
  // body wording, and the render still came back silver whatever was picked.
  // Same fix as everything else on this pipeline: say it at the front.
  // 2026-09-05: naming the colour was not enough on its own. With Light Amethyst
  // in the balloon palette a PINK wall came back lilac — the model split the
  // difference. Each colour now says what it is not, against its nearest
  // neighbours in this palette.
  const SHIMMER_NOT: Record<string, string> = {
    pink:       "a warm rose pink, NOT purple, NOT lilac, NOT lavender and NOT silver",
    purple:     "purple",
    gold:       "a warm gold, NOT silver and NOT bronze",
    silver:     "a cool silver, NOT gold, NOT pink and NOT lilac",
    black:      "a true black, NOT grey and NOT charcoal",
    blue:       "a clear blue, NOT lilac and NOT silver",
    red:        "a deep red, NOT pink and NOT orange",
    iridescent: "a pale iridescent pearl that shifts colour, NOT flat white",
  };
  // 2026-09-05: the panel has to be NAMED here. Said as a bare "the sequin
  // shimmer wall is pink" at the very front of an Arch + Shimmer prompt, the
  // model made BOTH boards pink sequin — the arch included. The panel
  // descriptions further down do distinguish them, and are ignored, as the
  // middle of this prompt always is.
  const shimmerIdx = sceneModel.panels.findIndex((p) => p.type === "shimmer_wall");
  const otherIdx = sceneModel.panels.findIndex((p) => p.type !== "shimmer_wall");
  const sideWord = (i: number) => (panelCount > 1 ? (i === 0 ? "LEFT" : "RIGHT") : "");
  const frontShimmerLine = sceneModel.shimmerColor && shimmerIdx >= 0
    ? (panelCount > 1
        ? `The ${sideWord(shimmerIdx)} backdrop is a sequin shimmer wall, ` +
          `${SHIMMER_NOT[sceneModel.shimmerColor] ?? shimmerColorLabel(sceneModel.shimmerColor).toLowerCase()}. ` +
          // 2026-09-05: on the pair it rendered as a draped fabric curtain with
          // folds. Rigidity has to be stated where the panel is named; the panel
          // description further down calls it a board and is ignored.
          `It is a RIGID FLAT PANEL of small square sequin tiles on a stiff frame, standing bolt upright with ` +
          `a straight top edge and straight sides — NOT a curtain, NOT hanging fabric, NOT draped, ` +
          `no folds, no ripples, no gathers. ` +
          `The ${sideWord(otherIdx)} backdrop is a plain smooth matte board — NOT sequin, NOT shimmer, ` +
          `no sequins on it at all. `
        : `The sequin shimmer wall is ${shimmerColorLabel(sceneModel.shimmerColor).toLowerCase()} — ` +
          `${SHIMMER_NOT[sceneModel.shimmerColor] ?? shimmerColorLabel(sceneModel.shimmerColor).toLowerCase()}. `)
    : "";

  const frontNeonPanelIdx = Math.max(0, Math.min(panelCount - 1,
    Number.isInteger(sceneModel.neonSign?.panelIndex) ? Number(sceneModel.neonSign?.panelIndex) : 0));
  const frontNeonText = String(sceneModel.neonSign?.text ?? "")
    .replace(/[^A-Za-z0-9 \x27!?&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  const frontNeonLine = sceneModel.neonSign?.enabled && frontNeonText.length > 0
    ? (hasRingPanelInPrompt
        // The customer asked for it in the middle of the ring; left to the body
        // clause alone the render hung it above the hoop instead.
        ? `A warm white glowing neon sign reading "${frontNeonText}" hangs in the DEAD CENTRE of the balloon ring's open middle, centred both horizontally and vertically in the opening. `
        : panelCount > 1
          // Named at the front for the same reason the shimmer colour is: left to
          // the body clause the sign appeared on BOTH boards.
          ? `A warm white glowing neon sign reading "${frontNeonText}" is mounted on the ` +
            `${frontNeonPanelIdx === 0 ? "LEFT" : "RIGHT"} backdrop only — the other backdrop has no sign. `
          : `A warm white glowing neon sign reading "${frontNeonText}" is part of this setup. `)
    : "";

  // 2026-09-05: the "do not generate character cutouts" clause has been in this
  // prompt all along, mid-document, and does nothing — the render painted its
  // own character in the standee's reserved footprint and the real cutout was
  // then composited on top, leaving a second figure half-hidden behind the
  // first. Front-loaded it binds.
  // 2026-09-09: front-loaded, because the mid-prompt ban did not stop it — the
  // Single Arch sample came back with a word printed on nearly every balloon.
  // Kept to one short clause. The 16-word version did stop the printing but
  // also pushed Single Arch into a both-sides garland — length displaces
  // structural wording here, exactly as it does for frontPaletteLine.
  const frontNoBalloonTextLine = sceneModel.balloons.style !== "none"
    ? `The balloons are plain — no writing on any balloon. `
    : "";

  const frontNoCharactersLine = sceneModel.cutouts?.mode === "standees"
    ? `Do NOT draw any person, character, figure, doll or cutout in this image — characters are added ` +
      `afterwards. The floor stays empty where one would stand. `
    : "";

  const frontNumDigits = String(sceneModel.numberLight?.value ?? "").replace(/[^0-9]/g, "").slice(0, 2);
  const frontNumberLightLine =
    sceneModel.numberLight?.enabled && frontNumDigits.length > 0
      ? `A 90cm modern matte white marquee number ${frontNumDigits}, with warm white bulbs recessed into its ` +
        `flat face, stands on the floor in front of the backdrop, FACING THE CAMERA SQUARE-ON — its front ` +
        `face flat to the viewer, not turned, not angled, not in three-quarter view` +
        (hasStandeesInScene
          // 2026-09-08: on the LEFT beside the character on every setup —
          // "yenisini eskisinin oldugu tarafa koyalim" — EXCEPT the balloon
          // ring, where the customer wants them the other way round:
          // "balloon ringte, cutout solda number sagda olmali".
          ? (hasRingPanelInPrompt
              ? `, on the RIGHT side of the setup. The character standee stands on the LEFT — the two never ` +
                `overlap and BOTH are fully visible. `
              : `, on the LEFT side of the setup, standing beside the character with clear air between them — ` +
                `they never overlap and BOTH are fully visible. `)
          : `. `) +
        `There is EXACTLY ONE marquee number in the entire image — never a second number, never the same ` +
        `digit repeated elsewhere in the frame. ` +
        `No loose helium balloons on strings anywhere in the scene. `
      : "";

  const frontPaletteLine = (!isLonePlainArch)
    && hasSempertexLock && targetAppearanceParts.length > 0
    ? `Every balloon in this image is one of exactly ${targetAppearanceParts.length} colours: ` +
      `${targetAppearanceParts.join(", ")}. ` +
      `No balloon is ${[
        ...(hasGoldInPalette   ? [] : ["gold", "champagne", "copper", "bronze", "rose gold"]),
        ...(hasPinkInPalette   ? [] : ["pink", "peach", "coral"]),
        ...(hasCreamInPalette  ? [] : ["cream", "beige"]),
        ...(hasYellowInPalette ? [] : ["yellow"]),
        ...(hasGreenInPalette  ? [] : ["green"]),
        ...(hasBlueInPalette   ? [] : ["blue"]),
        ...(hasPurpleInPalette ? [] : ["purple"]),
        ...(hasOrangeInPalette ? [] : ["orange"]),
      ].join(", ")}. `
    : "";


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
      (hasOpenFramePanelInPrompt
        // 2026-09-08: on Arch + Open Frame the open arch is meant to be FULL
        // of balloons, so this clause must not also forbid it there. It still
        // protects the SOLID arch face, which is all it was ever for.
        ? `The SOLID arch panel front face and its readable surface must stay completely clean, ` +
          `unobstructed and fully visible — no balloons crossing in front of the solid arch panel, ` +
          `no balloon pile directly in front of its face. `
        : `The arch front face, the open center opening, and the readable surface of the arch must stay ` +
          `completely clean, unobstructed, and fully visible at all times — absolutely no balloons crossing ` +
          `in front of the arch panel, no balloons covering the open center, no balloons blocking the arch face, ` +
          `and no balloon pile or floor buildup directly in front of the arch face. `) +
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

  // Florals and greenery worked into the garland. Only meaningful when there IS
  // a garland, and deliberately described as tucked BETWEEN balloons rather than
  // as a separate arrangement, which is how a decorator actually adds them.
  // Neon LED sign. Customer text, so it is sanitised and capped — it reaches the
  // prompt as the words the sign spells, never as an instruction.
  const neonText = String(sceneModel.neonSign?.text ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[`"<>{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
  // Named locally rather than via panelPositionLabel, which is declared further
  // down this function.
  const neonPanelIdx = Math.max(0, Math.min(
    panelCount - 1,
    Number.isInteger(sceneModel.neonSign?.panelIndex) ? Number(sceneModel.neonSign?.panelIndex) : 0,
  ));
  const neonPanelLabel = (() => {
    const p = sceneModel.panels[neonPanelIdx];
    const what = p?.type === "shimmer_wall" ? "shimmer wall"
      : p?.type === "arch" ? "arch backdrop"
      : p?.type === "round" ? "round backdrop"
      : p?.type === "banner" ? "banner board"
      : "backdrop";
    const side = panelCount > 1 ? (neonPanelIdx === 0 ? "left " : "right ") : "";
    return `${side}${what}`;
  })();
  const hasNeon = sceneModel.neonSign?.enabled === true && neonText.length > 0;
  const neonClause = hasNeon
    ? `A neon LED sign reads exactly "${neonText}" — those words, spelled exactly as "${neonText}", ` +
      `and no other words anywhere. ` +
      // 2026-09-05: the acrylic backing is gone from the wording. Described, the
      // render drew it as a visible tan rectangle sitting under the letters
      // ("lets partynin altindaki yama gibi sey"). A real sign has one, but it
      // is invisible against the wall and does not need describing.
      // 2026-09-05: the real product is 16.5 x 12 inches. Without a size the
      // render drew it a metre wide across the board.
      `It is a small made-to-order neon sign, about 42cm wide and 30cm tall — roughly a third of the ` +
      `width of the board, a tabletop-sized sign, NOT a huge sign spanning the backdrop. ` +
      `Flowing script lettering in a continuous glowing tube, ` +
      `casting a soft halo of its own light. The tube glows WARM WHITE — never pink, never coloured, ` +
      `whatever colour the backdrop behind it is. No visible backing board, no plaque, no panel and no ` +
      `patch behind the letters. ` +
      (hasRingPanelInPrompt
        ? `It hangs in the OPEN CENTRE of the balloon ring, floating clear of the balloons. `
        // 2026-09-05: on a two-piece setup the customer chooses which board
        // carries it, so the panel is named rather than left to the model.
        : panelCount > 1
          ? `It is mounted on the ${neonPanelLabel} only, centred in the clear area above ` +
            `the middle of that board. The other board carries no sign. `
          : `It is mounted on the backdrop face, centred in the clear area above the middle. `) +
      `It is NOT printed on the board, NOT painted, NOT made of balloons and NOT a paper cut-out. `
    : "";

  const floralsClause = sceneModel.garlandFlorals && balloonStyle !== "none"
    ? `Fresh florals and greenery are worked into the balloon garland: sprigs of eucalyptus and soft dried ` +
      `grasses, with a few delicate blooms, tucked into the gaps BETWEEN the balloons along the whole ` +
      `garland — heaviest in the fuller clusters, sparse in the thin stretches. ` +
      `The foliage is muted sage green and the blooms are soft and pale, picking up the balloon colours. ` +
      `They sit among the balloons as part of the same garland, not as a separate bouquet, not in vases, ` +
      `and never covering the backdrop face. `
    : "";

  // Illuminated marquee number. Digits only and length-capped — it reaches the
  // prompt as content, never as an instruction.
  const numberLightDigits = String(sceneModel.numberLight?.value ?? "")
    .replace(/[^0-9]/g, "")
    .slice(0, 2);
  const numberLightClause = sceneModel.numberLight?.enabled && numberLightDigits.length > 0
    ? `One large illuminated marquee number stands on the floor in front of the backdrop, to the ` +
      `${hasStandeesInScene && hasRingPanelInPrompt ? "right" : "left"} of centre and clear of the balloon garland. ` +
      `It reads exactly "${numberLightDigits}" — ${numberLightDigits.length > 1 ? "two digits" : "a single digit"}, ` +
      `spelled exactly as "${numberLightDigits}" and nothing else. ` +
      // 2026-09-05: the render came back as a vintage carnival letter — gold
      // frame, exposed round bulbs, brass fittings. The product is a modern
      // mosaic-style number: a clean matte white shell with bulbs recessed into
      // the flat front face. Height corrected to the real 90cm.
      `It is a freestanding light-up marquee number exactly 90cm tall: a modern mosaic-style number, ` +
      `a clean smooth MATTE WHITE shell with flat faces and crisp straight edges, standing directly on ` +
      `the floor. Round warm white bulbs are recessed INTO its flat front face in an even row, flush with ` +
      `the surface and glowing softly. ` +
      `It is NOT vintage, NOT retro, NOT a carnival or fairground letter, NOT gold, NOT brass, NOT wooden, ` +
      `NOT weathered — no exposed bulb sockets, no metal frame, no visible wiring, no distressed paint. ` +
      `It is NOT a balloon number, NOT a foil number, NOT printed on the backdrop and NOT floating. `
    : "";

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
  // 2026-09-05: adding a theme graphic to a Round backdrop shrank the panel and
  // put a low white podium disc under it. Isolated with two renders at a fixed
  // seed — guide graphic-zone rect but no sentence: correct, full-size panel on
  // the floor; sentence but no rect: the bug, exactly as reported. So it is this
  // wording, not the guide. Describing the board as carrying a printed
  // illustration makes it read as an art print, and an art print in the model’s
  // prior stands on a podium, lifted off the floor.
  //
  // The round backdrop description already says the panel is full size and has
  // nothing under it, but it is far earlier in the prompt and loses. Stated here,
  // next to the sentence that causes the damage.
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
  // 2026-09-04. Round scenes get their own photography opening — "Bright ...
  // normal punchy contrast, well-lit and clear" — while every arch scene gets
  // "Cool neutral daylight ... soft natural light". The customer asked for one
  // look across all layouts, so this block was unified onto the arch wording.
  // That was reverted after testing it: the round path is fal-ai/flux-2/edit
  // driven by a guide that is only a thin arc of ~20 dots, and it is extremely
  // sensitive to any change here. On a white + Arctic Blue + Silver scene,
  // rendered at a fixed seed with everything else on this page already changed:
  //   round's own opening        -> correct white / icy blue / pearl garland
  //   arch opening + even-light  -> pastel RAINBOW (yellow, pink, peach)
  //   round's opening + even-light -> primary-colour rainbow, worse still
  // The wording is load-bearing for the round palette, so it stays. The
  // even-light sentence below — which is what actually removes the single
  // arch's sunbeam — is applied to arch layouts only, for the same reason.
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
          : `crisp clean whites, icy light blue and white balloon tones, neutral white balance, fresh modern editorial event styling. `) +
      // The single arch was coming back with a hard sunbeam across the wall and
      // a long diagonal cast shadow, which bleached the balloons on the lit side
      // and buried them in shadow on the other — the reason its colours read as
      // washed-out pastel next to the Double Arch's. "Soft natural light from the
      // left" never ruled that out; the tight portrait frame just made the model
      // reach for drama. Naming it is what removes it.
      `The light is soft, even and diffuse across the whole scene, like a large north-facing window ` +
      `far off to the left: no hard sunbeam, no sun patch or bright pool of light on the wall or floor, ` +
      `no sharp-edged cast shadow stretching across the room, no blown-out white highlights, no lens flare. ` +
      // 2026-09-05: "no dramatic contrast", added with the anti-sunbeam clause,
      // flattened the picture — the customer: "filtre var gibi cok soluk butun
      // renkler ... canli gozle nasil goreceksek oyle olsun renk". It is gone,
      // and the sentence now says the colours hold instead.
      //
      // Deliberately a short clause bolted onto an existing sentence. A fuller
      // paragraph was tried first — "Even light, but NOT flat: full natural
      // colour saturation ... NOT hazy, NOT desaturated, NOT grey-filtered, NOT
      // washed out ..." — and it wrecked the Single Arch exactly the way the
      // front-loaded palette line did: rectangular panel, horseshoe garland
      // down both sides, gibberish text printed on the balloons, and 2.99% warm
      // plus 2.47% pink pixels off-palette. Its mean chroma was HIGHER (8.49 vs
      // 4.81), which is a warning about the metric, not a result: the extra
      // colour was contamination. This shorter version measures lilac 2.70% (vs
      // 1.76% before), chroma 5.19, and zero warm and zero pink.
      // 2026-09-05: guarded. On a no-balloons scene these three sentences were
      // the reason a bare Shimmer Wall came back covered in balloons — they
      // talk about balloons as present, and two of them land BEFORE the "this
      // setup has no balloons at all" line further down.
      (balloonStyle === "none"
        ? `Every colour stays clearly readable, at full natural saturation — NOT hazy, NOT washed out, NOT faded. `
        : `Both sides of every balloon stay clearly readable in their own colour, at full natural saturation — ` +
          `NOT hazy, NOT washed out, NOT faded. `);
  const eventSetupLabel = (hasSempertexLock && isUnicornTheme)
    ? "soft pastel birthday backdrop setup"
    : "children's birthday event setup";
  // 2026-09-05: a Banner gets its own framing. It was falling into the
  // single-panel branch below, which is written for a tall portrait arch ("the
  // highest balloon sits just below the top edge, the floor no more than the
  // bottom eighth") — wording that does not bind on a square board in a square
  // frame, and the board came back small with wide margins of empty wall
  // ("simdide kucuk oldu"). This names the square itself as the thing that
  // fills the frame.
  // Arch + Shimmer needs its own framing. It was falling into the generic
  // multi-panel branch, which is written wide for two arches plus two outer
  // garlands, and this pair came back small in a large empty room
  // ("cok uzaklasiyor renderi. daha zoom in olsun").
  const isArchShimmer = panelCount === 2
    && sceneModel.panels.some((p) => p.type === "arch")
    && sceneModel.panels.some((p) => p.type === "shimmer_wall");
  const framingClause = isArchShimmer
    ? `Transform this clean layout reference into a premium photorealistic indoor ${eventSetupLabel}. ` +
      `Tight medium-close event photography. The two backdrop pieces stand SIDE BY SIDE AND TOUCHING, ` +
      `edge to edge with no gap between them, and together they must DOMINATE the frame: they fill almost ` +
      `the whole picture, close to the top and bottom edges, with only a narrow strip of wall to either ` +
      `side and a shallow strip of floor beneath. Keep both pieces and all the balloons visible and ` +
      `nothing cropped, but do not render the setup small in a large empty room. `
    : (hasBannerPanelInPrompt && !isMulti)
    ? `Transform this clean layout reference into a premium photorealistic indoor ${eventSetupLabel}. ` +
      `Tight medium-close event photography. The square banner board and the balloon garland framing it are ` +
      `ONE object and must DOMINATE the frame together: the board fills almost the whole picture, with only a ` +
      `narrow strip of wall to either side and a shallow strip of floor beneath it. ` +
      // 2026-09-05: the previous version said only that the BOARD fills the frame.
      // The model obeyed by enlarging the board and left the balloons at their
      // guide size, so the garland ended up floating inset inside the board with
      // bare board showing all around it ("gene tamfit olmuyor square e"). The
      // two have to be locked to each other, not sized independently.
      `The garland is fixed ALONG THE BOARD'S OWN OUTER EDGES: it runs up the left edge, across the top edge ` +
      `and down the right edge, sitting exactly on those edges with its outer balloons overhanging them and ` +
      `its inner balloons resting on the board face. It is exactly as tall and as wide as the board — it never ` +
      `shrinks inside the board leaving bare board around it, and never floats free of it. ` +
      `Keep the whole board and its balloons visible and nothing cropped, but do not render the ` +
      `board small in a large empty room and do not leave wide empty margins of wall around it. `
    : isRoundScene
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
        (balloonStyle === "none"
          ? `the top of the backdrop sits just below the top edge of the image, and the floor occupies no `
          : `the highest balloon of the garland sits just below the top edge of the image, and the floor occupies no `) +
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
// 2026-09-09: the Balloon Ring catalog entry says the hoop is "built entirely
// from balloons", which is true of the fully wrapped dressing and flatly wrong
// for the other two. Left in, it beat both the front-loaded gold-hoop line and
// the backdrop description: a "no balloons" ring still rendered as a fully
// wrapped one.
const setupPanelInstruction = setupTemplate
  ? (hasRingPanelInPrompt && sceneModel.balloonRingStyle === "none"
      ? `A single freestanding circular hoop standing on the floor — a slim bare gold metal frame with a ` +
        `completely open empty centre and no balloons on it.`
      : hasRingPanelInPrompt && sceneModel.balloonRingStyle === "half"
        ? `A single freestanding circular hoop standing on the floor — a slim gold metal frame, bare along ` +
          `its lower-left, with a balloon garland wrapped around the rest of it and a completely open empty centre.`
        : setupTemplate.panelInstruction)
  : "";

const setupTemplateClause = setupTemplate
  ? `Use the selected setup layout: ${setupTemplate.name}. ${setupPanelInstruction} ` +
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
    // 2026-09-09: and it says HOW MANY. The line was hard-coded to "one", so a
    // three-plinth scene came back with a single column no matter what the
    // guide drew — the customer's 3-plinth example render showed one.
    const nP = sceneModel.plinths.length;
    inventoryItems.push(
      nP >= 3
        ? `THREE slim white cylindrical pedestal columns of different heights standing side by side on the ` +
          `floor in front of the boards, the tallest one in the middle`
        : nP === 2
          ? `TWO slim white cylindrical pedestal columns of different heights standing side by side on the ` +
            `floor in front of the boards`
          : `one slim white cylindrical pedestal column standing on the floor in front of the boards`,
    );
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
    frontBannerAspectLine +
    frontTripleArchLine +
    frontRingHalfLine +
    frontOpenFrameLine +
    frontFloralsLine +
    frontShimmerLine +
    frontNoCharactersLine +
    frontNeonLine +
    frontNumberLightLine +
    frontPaletteLine +
    frontStructureLine +
    frontNoBalloonTextLine +
    openFrameDetailLine +
    photographyOpening +
    sceneInventoryClause +
    framingClause +
    `${backdropDesc}. ` +
    doubleArchSizeLockClause +
    doubleArchSeparationClause +
    doubleArchPlinthHardLockClause +
    (sceneModel.panels.some((p) => p.type === "open_arch_frame")
      ? `A dense organic balloon cluster is mounted on the face of that arch board — big statement balloons ` +
        `with mediums and smalls filling every gap, packed from the crown down to the floor, exactly as drawn ` +
        `in the layout reference — leaving only a narrow margin of bare board showing round the edge. ` +
        `Some of the balloons are arranged as BALLOON FLOWERS — five balloons of one colour ringing a ` +
      `smaller balloon of another, exactly as drawn in the layout reference. ` +
      `That margin is plain flat painted board, the same smooth matte surface as the rest of the panel: ` +
        `no border, no rim, no frame, no moulding, no step, no ridge, no bevel, no trim, no picture-frame ` +
        `profile and no recessed reveal anywhere around the cluster. ` +
        `It is NOT chrome, NOT mirrored, NOT polished metal, NOT stainless steel, NOT glossy, NOT a shiny ` +
        `tube, NOT rounded or pipe-like in section, not inflatable, not a niche, alcove or 3D tunnel. ` +
        `No lettering and no printed artwork anywhere on that board. ` +
        `Exactly the listed pieces — do not add any extra panel. `
      : "") +
    setupTemplateClause +
    themeGraphicClause +
    customTextClause +
    cutoutClause+
    (plinthDesc ? `${plinthDesc}. ` : noPlinthDesc) +
    `${garlandDesc}. ` +
    floralsClause +
    numberLightClause +
    neonClause +
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
    // 2026-09-09: the balloons themselves were coming back with words and
    // numbers printed on them (see allowedPaletteBlock). The old ban covered
    // the backdrop only.
    `The balloons are plain and unprinted: no writing, no letters, no numbers, no logos and no brand ` +
    `marks on any balloon. ` +
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
    // Matches the even-light sentence in photographyOpening — the single arch
    // kept rendering a sunbeam and a long hard shadow across the floor.
    `No sunbeam. No sun patch. No shaft of light. No harsh direct sunlight. No hard-edged cast shadow. ` +
    `No long diagonal shadow across the floor. No blown-out highlights. No lens flare. No high-contrast lighting. `+
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
        (plinth ? `No round panel smaller than plinth scale. ` : "") + `No distant tiny round panel. ` +
        // With no plinth selected, "no EXTRA plinth" still implies one belongs
        // in the picture. Say there is none.
        (plinth
          ? `No extra plinth. No second plinth. No duplicate plinth. `
          : `No plinth. No pedestal. No cylinder. No white column. No display column. `) +
        `No low white platform. No oval base. ` +
        // These bans are about the ROUND PANEL's own supports. Two of them —
        // "No pedestal" and "No extra cylinder" — used to be emitted even when
        // the customer had asked for a plinth, contradicting plinthDesc, which
        // requests exactly one white cylindrical pedestal column.
        `No round base. No stage. No podium. No riser. ` +
        (plinth ? "" : `No pedestal. `) +
        `No support block. No support disc. ` +
        `No base cylinder. No round backdrop base. No display base. No furniture base. ` +
        (plinth ? "" : `No extra cylinder. `) +
        `No floating support. No visible stand. No visible feet. No visible wheels. No visible frame. ` +
        `No visible support bar. No round backdrop on furniture. No round backdrop mounted on a stand. ` +
        `No full balloon ring. No 360-degree balloon wreath. No circular balloon frame. No balloon halo. ` +
        `No balloons wrapping all the way around the circle. No balloons on the left side of the round panel. `
      : "") +
    (sempertexClause
      ? `No wrong balloon colors. No unrelated balloon colors. No theme-default balloon colors. ` +
        `No unselected balloon colors. No extra balloon colors. No substitute colors. No approximate palette. ` +
        `No ignoring selected palette. No changing backdrop size when color changes. ` +
        (!hasOrangeInPalette ? `No orange balloons when not selected. ` : "") +
        (!hasYellowInPalette ? `No yellow balloons when not selected. ` : "") +
        (!hasGreenInPalette  ? `No green balloons when not selected. `  : "") +
        (!hasBlueInPalette   ? `No blue balloons when not selected. `   : "") +
        (!hasGreenInPalette && !hasBlueInPalette ? `No teal balloons. No turquoise balloons. ` : "") +
        (!hasGoldInPalette
          ? `No unrelated metallic balloons. No unselected gold balloons. No unselected rose gold balloons. ` +
            `No gold balloons unless selected. No champagne balloons. `
          : "") +
        (!hasPinkInPalette ? `No peach balloons. No coral balloons. ` : "") +
        (!hasOrangeInPalette ? `No terracotta balloons. No bronze balloons. No copper balloons. ` : "") +
        (!hasCreamInPalette ? `No beige balloons. No cream balloons. ` : "") +
        (!hasPurpleInPalette
          ? `No lavender balloons. No lilac balloons. No violet balloons. No purple balloons. `
          : "") +
        `No rainbow balloons. ` +
        (!hasMetallicInPalette
          ? `No glossy balloons. No chrome balloons. No mirror metallic balloons. No reflective balloons unless selected. `
          // A metallic IS in the palette, so shine is wanted — but only on the
          // balloons that asked for it, and never warmed into gold.
          : `The metallic balloons in the palette keep the exact metallic tone listed for them and are never warmed, ` +
            `tinted or shifted toward gold, champagne, bronze or copper. The matte and satin balloons in the palette ` +
            `stay matte — do not make every balloon shiny. `) +
        `No warm cast. No creamy tint. No hazy filter. No editorial global filter. No warm amber overlay. No film-like tint. No ivory whites. No beige whites. `
      : "") +
    (balloonStyle !== "none"
      ? `No balloons all the same size. No mostly small balloons. No garland without 36 inch balloons. ` +
        `No tiny-only garland. No micro-balloon chain.`
      : "")
  );
}
