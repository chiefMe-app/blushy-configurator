import { generateNegativePrompt, type PromptInput } from "@/lib/generatePrompt";
import { type SceneModel } from "@/lib/buildSceneModel";
import type { SempertexSelectionItem } from "./types";

export function buildNegativePrompt(
  items:        SceneModel["panels"],
  hasText:      boolean,
  hasGraphic:   boolean,
  promptInput?: PromptInput,
  sceneModel?:  SceneModel,
  effectiveSempertexSelection?: SempertexSelectionItem[],
): string {
  const baseItems = items.map((p) => ({
    type: p.type, widthCm: p.widthCm, heightCm: p.heightCm,
    text:    { enabled: p.text.enabled, value: p.text.value, fontStyle: p.text.fontStyle as "script" | "block" | "elegant", color: p.text.color },
    graphic: { enabled: p.graphic.enabled, style: p.graphic.style, theme: "" },
    sizeId: p.sizeId, id: p.id, color: p.color, order: p.order,
    backdropColor: "", balloonStyle: "none" as const,
  }));

  const sceneNeg = generateNegativePrompt(
    baseItems as Parameters<typeof generateNegativePrompt>[0],
  );

  const styleNeg =
    "flat mockup, vector preview, engineering diagram, layout drawing, " +
    "cartoon style, sticker render, 3D toy render, plain catalog image, " +
    "sterile product mockup, CG render, plastic looking, unrealistic, " +
    // Measurement text must NEVER appear in AI render — app overlay adds exact labels from scene state
    "measurement text, dimension labels, ruler lines, size annotations, numbers on floor, " +
    "technical labels, measurement arrows, dimension lines, centimeter labels, cm text, " +
    "100cm, 200cm, width labels, height labels, floor measurements";

  const hasArchPanel = items.some((p) => p.type === "arch");
  const archPropNeg  = hasArchPanel
    ? ", wide arch wall, oversized arch panel, 150 cm wide arch, 180 cm wide arch, " +
      "2 meter wide arch, wall-sized backdrop, architectural wall arch, permanent arch wall, " +
      "extra-wide panel, panel width similar to height, arch wider than 120 cm, " +
      "wide rounded wall, giant arch, oversized event wall, backdrop wider than configured size, " +
      "hollow arch, open doorway arch, arch frame, cut-out center, empty opening, see-through arch, doorway frame"
    : "";

  // Double Arch fidelity negatives (2026-07-12) — reinforces the size-lock
  // and separation-lock positive clauses in buildLayoutRefEditPrompt.ts.
  // Same isDoubleArchScene definition used there and in
  // generateStructureSilhouette.ts's guide drawing: exactly two arch panels.
  const isDoubleArchScene = items.length === 2 && items.every((p) => p.type === "arch");
  // Plinth-specific negatives for Double Arch live in plinthNeg below (via
  // aiFacingHasPlinths) now that the plinth is suppressed from the AI
  // entirely and composited deterministically instead — kept this clause
  // scoped to pure arch geometry (size, base separation).
  const doubleArchNeg = isDoubleArchScene
    ? ", two equal-sized arches, matching pair of arches, identical arch sizes, same-height arches, " +
      "same-width arches, symmetric twin arches, uniform arch pair, mirrored size arches, " +
      "merged arch bases, touching arch bases, overlapping arch floor footprints, " +
      "connected arch bases, arches sharing one base, arches touching at the bottom, " +
      "no gap between arch bases, single fused backdrop shape, blended arch silhouette, " +
      "arches leaning into each other"
    : "";

  const hasRoundPanel = items.some((p) => p.type === "round");
  const roundPropNeg = hasRoundPanel
    ? ", visible stand, wheels, metal frame, support hardware, support legs, " +
      "wall-mounted circle, flat painted circle on wall, circle attached to wall, no gap from wall, " +
      "undersized round backdrop, tiny round backdrop, wrong scale round backdrop, not 200cm round backdrop, " +
      "plinth set too far forward, plinth far from backdrop, " +
      "detached loose floor balloons, random isolated balloons on the floor, " +
      "hazy, washed out, desaturated, grey filter, gray color cast, dull lighting, low contrast, " +
      "flat lighting, foggy look, distant camera, far away shot, small in frame, low energy, lifeless, " +
      "small round backdrop, undersized circle, decorative wall circle, round panel smaller than plinth scale, " +
      "distant tiny round panel, " +
      "extra plinth, second plinth, duplicate plinth, low white platform, oval base, round base, stage, podium, " +
      "riser, pedestal, support block, support disc, base cylinder, round backdrop base, display base, " +
      "furniture base, extra cylinder, floating support, visible support bar, round backdrop on furniture, " +
      "round backdrop mounted on stand"
    : "";

  const structureNeg =
    "wrong number of panels, extra backdrop panel, missing backdrop panel, " +
    "changed panel silhouette, wrong panel proportions, oversized backdrop wall" +
    archPropNeg + roundPropNeg + doubleArchNeg;

  const archBalloonNeg = hasArchPanel
    ? ", tiny balloons only, same-size balloons, sparse garland, thin garland, stringy garland, " +
      "thin single-file balloon chain, evenly spaced small balloons, weak floor volume, " +
      "balloons across the front of the arch, balloons covering the arch face, balloons in front of arch face, " +
      "balloons crossing the arch opening, balloon pile in front of arch, floor buildup in front of arch face, " +
      "balloons on left side of arch, garland on both sides of arch, " +
      "balloons across the front face, balloons blocking the arch face, balloons covering the open center, " +
      "floor balloon pile in front of panel, garland crossing inward over the panel face, " +
      "disconnected floor balloon pile, balloons in front of plinth"
    : "";

  const balloonNeg = "bead-like balloons, uniform balloon sizes, fake balloons, " +
    "gap between balloons and backdrop, detached garland, floating balloon cluster, separated balloons, " +
    "detached floor balloons, floating loose balloons, scattered floor balloons, " +
    "broken-looking loose balloons, floor balloons disconnected from garland, floating gap" +
    archBalloonNeg;

  // Balloon color fidelity — active when a palette is configured.
  // Yellow and green are only forbidden if they are NOT in the selected Sempertex palette
  // (e.g. unicorn theme has 620=yellow and 630=green, which must never be blocked).
  const hasBalloonColors = (sceneModel?.balloons?.colors?.length ?? 0) > 0;
  const hasSempertexColorLock = (effectiveSempertexSelection ?? []).length > 0 &&
    (sceneModel?.balloons?.style ?? "none") !== "none";
  const negYellowInPalette = (effectiveSempertexSelection ?? []).some((c) => {
    const code = String(c.code ?? "");
    return code === "620" || String(c.colorName ?? "").toLowerCase().includes("yellow");
  });
  const negGreenInPalette = (effectiveSempertexSelection ?? []).some((c) => {
    const code = String(c.code ?? "");
    const name = String(c.colorName ?? "").toLowerCase();
    return code === "630" || name.includes("green") || name.includes("mint");
  });
  const balloonColorNeg = hasBalloonColors
    ? ", mostly white balloons, all-white garland, desaturated balloons, " +
      "colorless balloon garland, washed-out balloon colors, faded balloon palette, " +
      "wrong balloon colors, unrelated balloon colors, theme-default balloon colors, unselected balloon colors, " +
      "extra balloon colors, substitute colors, approximate palette, " +
      "ignoring selected palette, changing backdrop size when color changes, " +
      (hasSempertexColorLock
        ? "rainbow balloons, multicolor balloons, saturated rainbow hues, " +
          "red balloons when not selected, "
        : "") +
      "orange balloons when not selected, " +
      (!negYellowInPalette ? "yellow balloons when not selected, " : "") +
      (!negGreenInPalette  ? "green balloons when not selected, "  : "") +
      "blue balloons when not selected, teal balloons, turquoise balloons, " +
      "peach balloons, coral balloons, terracotta balloons, beige balloons, cream balloons, " +
      "bronze balloons, copper balloons, gold balloons unless selected"
    : "";

  const balloonSizeStructureNeg =
    ", all balloons same size, mostly small balloons, no 36 inch balloons, " +
    "tiny-only garland, micro-balloon chain";

  const promptProbeForTheme = promptInput ? JSON.stringify(promptInput).toLowerCase() : "";
  const balloonColorProbe = (sceneModel?.balloons?.colors ?? []).join(" ").toLowerCase();
  const isFrozenTheme =
    promptProbeForTheme.includes("frozen") ||
    promptProbeForTheme.includes("icy blues") ||
    promptProbeForTheme.includes("snowflake") ||
    (balloonColorProbe.includes("blue") && balloonColorProbe.includes("silver"));

  const frozenPaletteNeg = isFrozenTheme
    ? ", warm balloons, creamy balloons, beige balloons, ivory-dominant balloons, " +
      "champagne-dominant balloons, yellowish balloons, warm pastel drift, " +
      "gold-dominant balloons, cream balloon garland, beige balloon garland"
    : "";

  // Declared early so it gates both plinthNeg/plinthGeometryNeg below and plinthOmissionNeg later.
  const hasPlinths = (sceneModel?.plinths?.length ?? 0) > 0;

  // Double Arch (2026-07-12): the plinth is composited deterministically
  // after the AI render now (route.ts), not requested from the AI at all —
  // see the matching suppression in buildLayoutRefEditPrompt.ts's
  // plinthDesc/noPlinthDesc. The negative prompt needs to match: with real
  // hasPlinths, plinthOmissionNeg below would tell the model "don't omit
  // the plinth" while the positive prompt now says there is none — the
  // same kind of contradiction that caused the plinth-conflict bug fixed
  // earlier. aiFacingHasPlinths treats Double Arch as plinth-less for every
  // plinth-related negative below, which flips plinthNeg/plinthGeometryNeg
  // to their "forbid ANY plinth-like shape" form — helpful, since it also
  // discourages the faint glass/ghost plinth the AI sometimes still drew on
  // its own even without a prompt asking for one.
  const aiFacingHasPlinths = isDoubleArchScene ? false : hasPlinths;

  // Broad shape negatives ("no cylinder", "no podium") confuse the model into removing the
  // selected plinth. Only fire them when NO plinth is configured in the scene.
  const plinthGeometryNeg = !aiFacingHasPlinths
    ? "short podium, low podium, cake stand, squat cylinder, short cylinder, wide cylinder, " +
      "flat cylinder, disk plinth, low round platform, short round stand, wide display stand"
    : "";

  // When a plinth IS selected: only forbid extra/wrong additions, not the plinth itself.
  const plinthNeg = aiFacingHasPlinths
    ? "extra plinth, second plinth, additional pedestal, extra podium, support base, " +
      "circular stage, rectangular base block, riser, platform under backdrop"
    : "wrong plinth shape, wide platform, stage, podium, square pedestal, wide base, " +
      "short round podium, cake stand, low display stand, short cylinder, low podium, " +
      "squat cylinder, wide cylinder, flat cylinder, disk plinth, drum table, round stool, " +
      "short round stand, wide display stand" +
      (isDoubleArchScene
        ? ", glass plinth, clear plinth, transparent plinth, clear acrylic plinth, crystal plinth, " +
          "see-through plinth, glass cylinder, acrylic cylinder, any cylinder in the gap between the arches"
        : "");

  // Shimmer wall negatives — fire when a shimmer wall is in the scene
  const hasShimmerWall = (sceneModel?.panels ?? []).some((p) => p.type === "shimmer_wall");
  const shimmerNeg = hasShimmerWall
    ? ", no crumpled aluminum foil, no wrinkled foil, no embossed metal sheet, " +
      "no hammered metal texture, no irregular crinkled texture, no chaotic foil surface, " +
      "no plain matte shimmer wall, no smooth cream panel for shimmer wall, " +
      "no solid backdrop board for shimmer wall, no missing square tile grid, " +
      "no flat off-white panel instead of shimmer, no wrong shimmer color, " +
      "no untextured shimmer wall, shimmer wall must not become a cream board, " +
      "no merged shimmer panel"
    : "";


  // Unselected-prop negatives — block everything not in the scene config
  const extrasList   = promptInput?.extras ?? [];
  const selCutouts   = sceneModel?.cutouts?.size !== "none";
  const selFlorals   = extrasList.includes("florals");
  const selCakeTable = extrasList.includes("dessert_table");

  const propNeg = [
    !selFlorals    && "extra flowers, floral arrangements, foliage, greenery, plant decorations, botanical props",
    !selCakeTable  && "side table, cake stand, dessert stand, dessert table, cake table, coffee table",
    !selCutouts    && "character cutouts, themed standees, figure props, cartoon props",
    "unselected props, extra decor items, random decorative objects, cluttered scene",
    "extra styling objects, themed toys, dinosaur toy, barbie accessory, safari prop",
    "gift box, candle, lamp, shelf, tray, basket, stool, chair, rug, cushion",
  ].filter(Boolean).join(", ");

  // Text is always an overlay — AI must never bake text into the image.
  // Active when hasText=false (= renderTextInAi=false), which is always the case for AI renders.
  const textNeg = !hasText
    ? ", text, lettering, typography, words, printed words, calligraphy, handwriting, " +
      "birthday sign, name sign, backdrop text, vinyl text, decals, logo, " +
      "text overlay, words on backdrop, birthday message, name signage, " +
      "any written characters, any readable text on backdrop surface"
    : "";

  const printNeg = !hasGraphic
    ? ", printed illustration on backdrop, graphic design on panel, pattern on backdrop, " +
      "artwork on panel surface"
    : "";

  // Environment consistency negatives — prevent random room/furniture/window changes
  const envNeg =
    ", visible window, window frame, curtains, chandelier, sofa, chair, side column, pillar, " +
    "plant, vase, extra furniture, decorative props, busy background, " +
    "different room, new room, changed camera angle, different lighting direction, " +
    "extra event structures";

  // Garland/plinth drift negatives — always active when balloons are present.
  const hasBalloonsDrift = (sceneModel?.balloons?.style ?? "none") !== "none";
  const textDriftNeg = hasBalloonsDrift
    ? ", shifted garland, sparse garland, reduced balloon volume, thinner garland, " +
      "simplified garland, altered balloon layout, changed balloon silhouette, missing floor balloons, " +
      "thick plinth, wide plinth, distorted plinth, enlarged plinth, shortened plinth, " +
      "duplicate plinth, extra plinth, repositioned plinth"
    : "";

  // Conditional half-garland fidelity — only fires when half garland is configured.
  const isHalfGarland = (sceneModel?.balloons?.style ?? "none") === "half";
  const halfGarlandNeg = isHalfGarland
    ? ", full garland when half garland is configured, full balloon frame, " +
      "balloons wrapping both sides, symmetrical balloon installation, " +
      "oversized balloon installation, extra balloon clusters, " +
      "over-decorated setup, embellished setup, balloon arch, full arch garland, " +
      "garland stopping halfway, incomplete side garland, truncated garland, shortened garland, " +
      "cut-off lower garland, upper-only garland, broken garland flow, " +
      "disconnected floor balloons, separate floor balloon pile, floating balloon cluster, " +
      "missing lower balloons, weak lower section, gap between garland and floor cluster, " +
      "balloons across the floor, horizontal floor balloon trail, floor-spreading balloons, " +
      "balloon spillover, balloon carpet, balloons across front, balloons on open side, " +
      "full floor balloon garland, overextended floor cluster, balloons on both sides, " +
      "balloons surrounding the plinth, balloons covering plinth, balloons hiding plinth, " +
      "balloons behind plinth, plinth obscured by balloons, " +
      "balloons touching plinth, balloons overlapping plinth, balloons blocking plinth, " +
      "balloons in front of plinth, balloon garland covering plinth, balloon cluster replacing plinth"
    : "";

  const textVisibilityNeg = "";

  const garlandContinuityNeg = hasBalloonsDrift
    ? ", partial garland, broken garland continuity, garland stopping above floor, " +
      "detached floor balloon cluster, disconnected balloon pile, sparse lower garland, " +
      "missing lower balloons, balloon garland moved to opposite side"
    : "";

  const plinthOmissionNeg = aiFacingHasPlinths
    ? ", missing plinth, omitted plinth, invisible plinth, plinth disappeared, plinth hidden, " +
      "plinth blended into backdrop, plinth merged with backdrop, cropped plinth, " +
      "removed plinth, absent foreground plinth, no plinth, " +
      "plinth replaced by platform, plinth as stage, flattened plinth, widened plinth, " +
      "short cylinder, squat cylinder, wide cylinder, horizontal cylinder, " +
      "low round platform, short round platform, flat circular stage, circular floor platform, " +
      "round stage, low podium, podium disk, floor disk, circular base platform, " +
      "balloons covering plinth, balloons hiding plinth, balloons obscuring plinth, " +
      "balloons around plinth, balloons behind plinth, plinth buried in balloons, " +
      "plinth not visible, plinth covered by decor, " +
      "partially visible plinth, plinth behind balloons, plinth merged into backdrop, " +
      "plinth replaced by decor, plinth removed from scene, plinth sacrificed for balloons, " +
      "plinth hidden by balloon garland"
    : "";

  const hasBackdrop = items.length > 0;
  const platformBaseNeg = (hasBackdrop || hasPlinths)
    ? ", stage, podium base, semicircle platform, oval platform, raised platform, " +
      "pedestal base attached to backdrop, backdrop base extension, " +
      "platform under backdrop, fake base platform, stage base, platform base, " +
      "low disk, disk on floor, round floor platform, flat round base"
    : "";

  const strip = (s: string) => s.replace(/^,\s*/, "").trim();

  return [
    sceneNeg,
    styleNeg,
    structureNeg,
    balloonNeg,
    balloonColorNeg,
    balloonSizeStructureNeg,
    frozenPaletteNeg,
    plinthNeg,
    plinthGeometryNeg,
    propNeg,
    textNeg,
    printNeg,
    envNeg,
    textDriftNeg,
    textVisibilityNeg,
    garlandContinuityNeg,
    halfGarlandNeg,
    plinthOmissionNeg,
    platformBaseNeg,
    shimmerNeg,
  ].map(strip).filter(Boolean).join(", ");
}
