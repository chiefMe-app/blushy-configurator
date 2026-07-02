import { type SceneModel } from "@/lib/buildSceneModel";
import type { SempertexSelectionItem } from "./types";
import { getVisualLabel, renderSafeBalloonLabel, getPositiveLabel } from "./colorLabels";
import { THEME_CATALOG } from "@/lib/themeCatalog";
import { getSetupLayoutTemplate, inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";

function backdropColorLabel(color: string): string {
  const c = (color || "").toLowerCase().trim();
  if (!c || c === "#fff" || c === "#ffffff") return "cream-white";
  return color;
}

function panelTypeLabel(type: string): string {
  switch (type) {
    case "arch":         return "rounded arch";
    case "rect":         return "rectangular flat";
    case "shimmer_wall": return "rectangular shimmer-wall";
    case "round":        return "round circular";
    case "wavy":         return "wavy-top";
    default:             return type;
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
  let backdropDesc: string;

  const isSingleShimmerOnly = panelCount === 1 && sceneModel.panels[0]?.type === "shimmer_wall";

  if (isSingleShimmerOnly) {
    const sc    = sceneModel.shimmerColor ?? "silver";
    const p     = sceneModel.panels[0];

    const plinth    = sceneModel.plinths[0];
    const plinthStr = plinth
      ? `One slim freestanding white cylindrical plinth, ${plinth.heightCm}cm tall and ${plinth.diameterCm}cm diameter, ` +
        `fully visible from base to rounded top, centered horizontally in front of the shimmer wall, ` +
        `aligned to the horizontal center of the shimmer wall. ` +
        `Do not place the plinth on the left or right side. Do not omit the plinth.`
      : "";

    const bStyle    = sceneModel.balloons.style;
    const bColors   = sceneModel.balloons.colors.length > 0
      ? sceneModel.balloons.colors.slice(0, 4).join(", ")
      : sc === "silver" ? "silver chrome, white, pearl white"
      : sc === "gold"   ? "gold chrome, white, cream"
      : "the selected palette";
    const chromeBalloonNote =
      sc === "silver" ? `Include large chrome silver mirror balloons mixed with medium white and small pearl balloons. ` :
      sc === "gold"   ? `Include large chrome gold mirror balloons mixed with medium white and cream balloons. ` :
      "";
    const garlandStr = bStyle !== "none"
      ? `Full dense premium organic balloon half-garland starting at the top-right corner of the shimmer wall ` +
        `and cascading richly all the way down the right side to the floor. ` +
        `The garland must be lush, full volume, and layered — not sparse, thin, or flat. ` +
        `Mix large, medium, and small balloons for maximum organic depth and texture. ` +
        `The balloon garland must be attached directly to the backdrop edge with no visible gap. ` +
        `Balloons must closely follow the backdrop contour and look professionally installed onto the structure. ` +
        `Balloon palette: ${bColors}. ` +
        chromeBalloonNote +
        `Do not omit the balloon garland. Do not reduce the garland volume.`
      : "No balloon garland.";

    return (
      `Cool neutral daylight studio photography with soft natural light from the left, ` +
      `gray textured plaster or concrete studio wall, polished light concrete or stone floor, ` +
      `neutral white balance, fresh modern editorial event styling. ` +
      `Transform this layout reference into a premium photorealistic indoor event setup. ` +
      `The setup contains exactly ONE backdrop panel plus selected decorative items. ` +
      `Backdrop: a freestanding ${p.widthCm}cm × ${p.heightCm}cm square event shimmer wall. ` +
      `Clean straight outer edges, full square silhouette, no cutouts or openings. ` +
      `The entire surface is covered edge-to-edge with a regular grid of small uniform reflective ${sc} shimmer tiles ` +
      `arranged in neat rows and columns — a realistic event rental shimmer wall surface. ` +
      `Reflective ${sc} finish with clean sparkle. Clearly a shimmer sequin wall, not a matte board. ` +
      (plinthStr ? `${plinthStr} ` : "") +
      `${garlandStr} ` +
      `NOT an arch. NOT a rounded-top board. NOT a niche or frame. NOT a cutout. ` +
      `NOT a layered backdrop. No second backdrop panel. No panel behind another panel. ` +
      `No crumpled foil. No wrinkled aluminum. No hammered metal. No irregular mirror mosaic. ` +
      `No noisy abstract reflective texture. No chaotic crinkled surface. ` +
      `No matte board. No cream board. No missing tile grid. No wrong shimmer color.`
    );
  }

  if (!isMulti) {
    const p = sceneModel.panels[0];
    if (p.type === "shimmer_wall") {
      const sc = sceneModel.shimmerColor ?? "silver";
      backdropDesc =
        `one freestanding square shimmer wall, ${p.widthCm}cm wide x ${p.heightCm}cm tall, ` +
        `${sc} shimmer finish, regular neat grid of small flat square ${sc} sequin tiles, ` +
        `clean reflective sparkle, flat tiled sequin surface, ` +
        `NOT a matte board, NOT a cream backdrop, NOT crumpled foil`;
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
        `Round backdrop is exactly 200 cm diameter. It must visually appear about 2.6 times taller than the ` +
        `75 cm plinth and about 5 times wider than the 40 cm plinth diameter. The round panel should dominate ` +
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
  } else {
    const positions = ["left", "center", "right"];
    const posLabels = panelCount === 2
      ? ["left", "right"]
      : panelCount === 3
        ? ["left", "center", "right"]
        : sceneModel.panels.map((_, i) => positions[i] ?? `panel ${i + 1}`);

    const panelDescs = sceneModel.panels.map((p, i) => {
      const wRatio = (p.widthCm / p.heightCm).toFixed(2);
      const isShimmer = p.type === "shimmer_wall";
      const isArch    = p.type === "arch";
      const shimmerC  = sceneModel.shimmerColor ?? "silver";
      const pColor = backdropColorLabel(p.color);
      const surfaceDesc = isShimmer
        ? `freestanding square event shimmer wall (200cm x 200cm) — ` +
          `regular neat grid of small flat square ${shimmerC} sequin tiles, ` +
          `clean reflective sparkle, flat tiled surface, ${shimmerC} shimmer finish, ` +
          `NOT crumpled foil, NOT a matte board, NOT a cream panel`
        : isArch
          ? `solid filled freestanding arch backdrop panel, fully opaque surface, seamless matte ${pColor} surface, ` +
            `no cut-out opening, no hollow doorway, no empty arch frame, full solid panel face visible`
          : `full-width solid opaque ${pColor} freestanding backdrop board with broad visible surface`;
      return (
        `Panel ${i + 1} (${posLabels[i]}): ${panelTypeLabel(p.type)} backdrop board, ` +
        `${p.widthCm}cm wide by ${p.heightCm}cm tall (width-to-height ratio ${wRatio}), ` +
        `${surfaceDesc}, not compressed, not narrow, not a tower, correctly proportioned`
      );
    });
    backdropDesc =
      `exactly ${panelCount} separate freestanding backdrop boards arranged side by side, ` +
      `each fully solid, opaque, and rendered at its correct width. ` +
      `Both panels are full-size physical event backdrop boards with broad visible surfaces ` +
      `and correct width-to-height proportions. ` +
      `The total setup should feel wide and substantial, not skinny or compressed. ` +
      panelDescs.join(". ") + ".";
  }

  // ── Plinth description ────────────────────────────────────────────────────
  const plinth       = sceneModel.plinths[0];
  const hasRoundPanelInScene = sceneModel.panels.some((p) => p.type === "round");
  const plinthDesc   = plinth
    ? `Keep exactly one visible white cylindrical plinth, ${plinth.heightCm}cm tall and ${plinth.diameterCm}cm diameter. ` +
      `This is a separate display plinth, not a support base for the backdrop. ` +
      `Place it front-left of the backdrop. ` +
      `It must remain fully visible from base to rounded top. ` +
      `Do not hide it behind balloons. ` +
      `Do not merge it into the backdrop. ` +
      `Do not convert it into a base, podium, riser, or stage. ` +
      (hasRoundPanelInScene
        ? `Stand it close to the round backdrop panel, not set too far forward into the room.`
        : `Place it on the open side near the arch backdrop.`)
    : "";
  const noPlinthDesc = plinth ? "" : "No plinths. ";

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

  const archGarlandExtra = hasArchPanelInPrompt
    ? ` Premium organic balloon garland with large, medium, and small balloons nested together ` +
      `in lush clustered bunches, attached ONLY to ONE OUTER SIDE of the arch — the right outer edge — ` +
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
      `Only one plinth is allowed in the scene. Do not add any extra plinth, pedestal, platform, stage, ` +
      `support block, base, riser, second cylinder, secondary display column, or additional prop.`
    : "";

  const balloonSizeDesc =
    ` Use exactly three balloon size families: several large 36 inch statement balloons, many 12 inch ` +
    `standard balloons, and small 5 inch filler balloons. Include at least 5 visible 36 inch statement ` +
    `balloons distributed through the garland at the top, side, and base. 36 inch balloons must be clearly ` +
    `larger than all others. 5 inch balloons only appear as small filler clusters attached to larger balloons. ` +
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
    : `organic half balloon garland on the right side, dense and premium, ` +
      `individual ${balloonColors} latex balloons cascading from the top corner to the floor`;

  const garlandDesc =
    balloonStyle === "none"
      ? "No balloon garland. "
      : garlandOpeningSentence + "." +
        balloonSizeDesc +
        ` The balloon garland must be attached directly to the backdrop edge with no visible gap. ` +
        `Balloons must closely follow the backdrop contour and look professionally installed onto the structure.` +
        archGarlandExtra +
        roundGarlandExtra +
        roundGeometryClause +
        sempertexClause;

  // ── Multi-panel negatives ─────────────────────────────────────────────────
  const hasShimmerInMulti = isMulti && sceneModel.panels.some((p) => p.type === "shimmer_wall");
  const shimmerMultiNegs = hasShimmerInMulti
    ? `The shimmer wall must remain a tiled metallic sequin wall — ` +
      `do not turn it into a plain matte board or cream panel. ` +
      `No missing tile texture on shimmer wall. No flat off-white panel instead of shimmer. ` +
      `No wrong shimmer color. No smooth cream board for shimmer wall. `
    : "";

  const multiPanelNegs = isMulti
    ? `Do not merge panels into one. Do not omit any panel. No extra panels beyond ${panelCount}. ` +
      `No outline-only arch. No wire-frame backdrop. No thin frame backdrop. ` +
      `No transparent backdrop board. No decorative line structure. ` +
      `Every selected panel must appear as a full solid opaque backdrop board. ` +
      `No skinny panels. No narrow tower-like panels. No compressed backdrop boards. ` +
      `No thin vertical strips. No overly narrow arch. No overly narrow rectangular board. ` +
      `Do not shrink panel widths. Do not turn panels into slim columns. ` +
      shimmerMultiNegs
    : "";

  // Theme graphic clause — included when any panel has a printed graphic enabled
  const panelsWithGraphic = sceneModel.panels.filter(p => p.graphic.enabled);
  const firstGraphicPanel = panelsWithGraphic[0];
  const themeEntry = THEME_CATALOG.find(t => t.id === String(sceneModel.theme ?? "").toLowerCase());
  const selectedPreset = themeEntry?.graphicPresets.find(p => p.assetId === firstGraphicPanel?.graphic.assetId);
  const presetDesc = selectedPreset?.desc ?? null;
  const themeGraphicClause = panelsWithGraphic.length > 0
    ? `The backdrop has a printed theme illustration graphic on its surface — a large decorative illustrated print design centered on the backdrop board, rendered as a printed graphic applied to the backdrop surface.` +
      (presetDesc ? ` The graphic depicts: ${presetDesc}.` : "") + ` `
    : "";

  const isRoundScene = hasRoundPanelInScene && !isMulti;
  // When Sempertex palette is locked, use neutral product photography style cues so the
  // model renders color-accurately instead of applying a warm tinted global style.
  const neutralStyleClause = hasSempertexLock
    ? `Use neutral daylight product photography with accurate white balance. ` +
      `Keep whites clean neutral white. ` +
      `Preserve true soft pastel color separation and natural diffuse balloon material. `
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
        : `crisp clean whites, icy light blue and white balloon tones, neutral white balance, fresh modern editorial event styling. `);
  const eventSetupLabel = (hasSempertexLock && isUnicornTheme)
    ? "soft pastel birthday backdrop setup"
    : "children's birthday event setup";
  const framingClause = isRoundScene
    ? `Transform this clean layout reference into a premium photorealistic indoor ${eventSetupLabel}. ` +
      `Medium-close full-body event photography — the round backdrop, balloon garland, and plinth fill the frame ` +
      `with strong visual presence and prominence, similar closeness and scale to a close-up arch backdrop photograph, ` +
      `while still keeping the entire setup fully visible with minimal extra empty space around it. `
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
    (hasGarland ? `${setupTemplate.garlandInstruction} ` : "") +
    (hasGarland && sceneModel.panels.length >= 2
      ? `Preserve a lush organic balloon garland following the selected setup layout. Do not replace it with loose balloon bouquets or simple balloon clusters. `
      : "")
  : "";

  return (
    photographyOpening +
    framingClause +
    `${backdropDesc}. ` +
    setupTemplateClause +
    themeGraphicClause +
    cutoutClause+
    (plinthDesc ? `${plinthDesc}. ` : noPlinthDesc) +
    `${garlandDesc}. ` +
    multiPanelNegs +
    neutralStyleClause +
    (hasSempertexLock
      ? `Neutral color-accurate event photography, neutral white balance. `
      : `Premium modern editorial event photography, neutral white balance, clean fresh color grading, `) +
    `crisp white arch surface, no visible outline or border on the arch. ` +
    `No text on backdrop. No people. No cake. No table. ` +
    `No stage. No podium. No base platform. No floor riser. ` +
    `No rectangular box plinth. No low round podium. No flat platform under plinth. ` +
    `No extra side panel. No extra wall or slab. ` +
    `No warm yellow lighting. No golden ambient light. No beige hotel interior. No yellow color cast. ` +
    `No ornate luxury room. No cream or brown walls. No orange or yellow white balance. ` +
    `No overly warm shadows. No dark moody room. ` +
    `No plants. No furniture. No chairs. No mirrors. No doors. No visible support legs. No black stands. ` +
    (hasArchPanelInPrompt
      ? `No balloons across the front face. No balloons blocking the arch face. ` +
        `No balloons covering the open center. No floor balloon pile in front of panel. ` +
        `No garland crossing inward over the panel face. No disconnected floor balloon pile. ` +
        `No balloons in front of plinth. ` +
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
        `No blue balloons when not selected. No teal balloons. No turquoise balloons. ` +
        `No unrelated metallic balloons. No unselected gold balloons. No unselected rose gold balloons. ` +
        `No peach balloons. No coral balloons. No terracotta balloons. ` +
        `No beige balloons. No cream balloons. No bronze balloons. No copper balloons. ` +
        `No gold balloons unless selected. ` +
        `No lavender balloons. No lilac balloons. No violet balloons. No purple balloons. No rainbow balloons. ` +
        `No glossy balloons. No chrome balloons. No mirror metallic balloons. No reflective balloons unless selected. ` +
        `No warm cast. No creamy tint. No hazy filter. No editorial global filter. No warm amber overlay. No film-like tint. No ivory whites. No beige whites. `
      : "") +
    `No balloons all the same size. No mostly small balloons. No garland without 36 inch balloons. ` +
    `No tiny-only garland. No micro-balloon chain.`
  );
}
