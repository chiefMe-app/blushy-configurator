import type { SempertexSelectionItem } from "./types";
import { renderSafeBalloonLabel, getPositiveLabel } from "./colorLabels";

export function buildStrictCorrectionPrompt(
  effectiveSempertexSelection: SempertexSelectionItem[] | undefined,
  opts: {
    isRound: boolean;
    hasPlinth: boolean;
    roundDiameterCm?: number | null;
  }
): string {
  const selectedCorrectionColors = (effectiveSempertexSelection ?? []).slice(0, 5);

  // Use positive-only labels in the palette string — avoids placing bias words
  // (gold, yellow, rose-gold, orange, copper, bronze) in the positive correction prompt.
  const palette = selectedCorrectionColors
    .map((c) => {
      const code = String(c.code ?? "");
      const hex  = String((c as typeof c & { hex?: string }).hex ?? "");
      return `${code}: ${hex} - ${getPositiveLabel(c)}`;
    })
    .join("; ");

  const paletteLabels = selectedCorrectionColors.map((c) => getPositiveLabel(c)).join(", ");
  const colorLockClauses =
    palette.length > 0
      ? [
          // Positive color lock — clean palette names only, no forbidden color tokens
          `Recolor every balloon using ONLY the following selected Sempertex palette: ${palette}.`,
          "These are the ONLY allowed balloon colors.",
          "Remove and replace any balloon that appears in an unselected color.",
          `Use exactly ${selectedCorrectionColors.length} balloon colors only: ${paletteLabels}. Do not introduce any additional balloon color.`,
          "Overall balloon finish must be mostly matte pastel. The blush pearl pink accent balloons (#FECDD3) may have only a very soft satin sheen.",
          // Correction ban clauses — forbidden color/finish words live here
          "Inspect every balloon. Any balloon that appears teal, turquoise, blue, orange, coral, copper, bronze, dark gold, lavender, lilac, violet, purple, rainbow, saturated red, or any other non-selected hue must be recolored to the nearest selected palette color. Preserve the balloon shapes and layout, only correct colors.",
          "Inspect every balloon one by one. Any balloon that appears outside the selected palette must be recolored to the nearest allowed selected palette color. Do not preserve incorrect colors.",
          "Forbidden balloon colors: orange, coral, peach, terracotta, yellow-gold, warm gold, bronze, copper, beige, cream-beige, blush-beige, red, teal, turquoise, lavender, lilac, violet, purple, rainbow, and any other non-selected tone.",
          "Forbidden balloon finishes: glossy, chrome-like, reflective, mirror metallic, strongly metallic. Correct any such balloon to the soft matte or subtle satin finish of the selected palette.",
          "For silver selections, use cool silver-gray only, never gold, bronze, copper, or champagne.",
          "For oyster/off-white selections, use cool pearl white or cool off-white only, never beige, ivory, cream-gold, warm cream, or champagne.",
          "Correct any global warm tint or creamy cast on the entire scene. Keep the scene neutral and color-accurate. Do not add haze, matte wash, sepia warmth, beige cast, or editorial filtering. Keep whites neutral white, not ivory or creamy. Preserve true pastel color separation.",
        ]
      : [];

  const roundClause = opts.isRound
    ? `The backdrop must remain a single large thin vertical circular event backdrop panel, ${opts.roundDiameterCm ?? 200} x ${opts.roundDiameterCm ?? 200} cm. The visible front bottom edge must touch the floor directly. It has hidden rear support only, invisible from the front. Remove any stage, platform, riser, support disc, pedestal, base block, rectangular box, circular base, oval base, second plinth, extra cylinder, or furniture-like support under it. The round panel must remain visually large and dominant, not shrunken, not miniaturized, not converted into an arch, and not surrounded by a full 360-degree balloon ring.`
    : "";

  const plinthClause = opts.hasPlinth
    ? `Preserve the single selected white cylindrical plinth at the front-left of the backdrop. Keep exactly one plinth visible. Do not remove it. Do not replace it with a platform, stage, riser, or block. Do not hide it behind balloons. Do not add any extra plinth, block, podium, stage piece, rectangular box, oval base, circular riser, support cylinder, or secondary display column.`
    : `Do not introduce any plinth, podium, pedestal, cylinder, stage, or base object.`;

  const preserveClause = opts.isRound
    ? "Preserve the camera angle, room, floor, lighting, and overall style, but correct the geometry mistakes. It is allowed and required to remove any extra stage, platform, riser, base block, support disc, second plinth, extra cylinder, or visible stand. Restore the setup to one large thin vertical round backdrop panel touching the floor directly with hidden rear support only."
    : "Preserve the exact camera angle, room, floor, lighting, backdrop position, backdrop shape, backdrop scale, balloon arrangement, and overall composition.";

  return [
    "Edit the existing render ONLY.",
    preserveClause,
    "Do NOT redesign or rearrange the setup.",
    ...colorLockClauses,
    roundClause,
    plinthClause,
    "Keep the balloons attached to the backdrop contour. Do not add floor scatter unrelated to the garland base.",
    "Do not add any new object that was not in the original layout reference.",
  ]
    .filter(Boolean)
    .join(" ");
}
