// The Design Pack's specification (Phase 1.3): everything a producer needs,
// read from the design itself — never from the AI render, which is a visual
// reference only. Sizes are in millimetres. Lettering is laid out by the same
// engine and placed where the render guide puts it (generateStructureSilhouette's
// letteringPlacements), scaled to the real board.
//
// Materials and production limits are not confirmed by a producer yet: every
// value that depends on them is marked TO CONFIRM, and nothing here claims to
// be production-ready (the Design Pack is a Beta).
import { BALLOON_STYLES, PLINTH_SIZES, TEXT_COLORS, describeTextColor, eventTypeById, foilColourFor, priceBreakdown, resolveTextColorHex, themeById, type BuilderConfig } from "@/lib/config";
import { buildSceneModel } from "@/lib/buildSceneModel";
import { generateStructureSilhouette } from "@/lib/generateStructureSilhouette";
import { SETUP_LAYOUT_TEMPLATES, inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import { layoutBoardLettering } from "@/lib/typography/boardLayout";
import { cleanLettering, letteringFromLegacy } from "@/lib/typography/lettering";
import { fontById } from "@/lib/typography/registry";
import { assessFinish } from "@/lib/typography/check";
import type { FinishId } from "@/lib/typography/production";
import type { LetteringLayout } from "@/lib/typography/layout";

export const TO_CONFIRM = "TO CONFIRM";

/** What a board is made of, and whether it gets a cut file. */
const BOARD_KINDS: Record<string, { label: string; cut: boolean; material: string }> = {
  arch: { label: "Arch board", cut: true, material: `Rigid board (e.g. 5 mm foam board or 3 mm acrylic) — ${TO_CONFIRM}` },
  round: { label: "Round board", cut: true, material: `Rigid board (e.g. 5 mm foam board or 3 mm acrylic) — ${TO_CONFIRM}` },
  rect: { label: "Rectangular board", cut: true, material: `Rigid board (e.g. 5 mm foam board) — ${TO_CONFIRM}` },
  banner: { label: "Printed banner", cut: true, material: `Printed fabric or vinyl banner — ${TO_CONFIRM}` },
  shimmer_wall: { label: "Shimmer wall", cut: false, material: "Sequin shimmer panels on a stand (stock item)" },
  balloon_ring: { label: "Balloon ring", cut: false, material: "Round metal hoop on a stand (stock item)" },
  open_arch_frame: { label: "Open arch frame", cut: false, material: "Open metal arch frame (stock item)" },
};

export interface LetteringLineSpec {
  role: "heading" | "name";
  text: string;
  font: string;
  weight: number;
  capHeightMm: number;
  /** Thinnest stroke at this size, mm (from the font's measured strokes). */
  thinStrokeMm: number;
  /** The provisional limit for the finish, mm; null = none. */
  minStrokeMm: number | null;
  strokeOk: boolean;
  missingLetters: string;
}

export interface LetteringSpec {
  colour: string;
  colourHex: string;
  finish: FinishId;
  finishLabel: string;
  /** The lettering block on the real board. */
  widthMm: number;
  heightMm: number;
  centreXMm: number;
  centreYMm: number;
  /** Scale from the layout box (LETTERING_BOX mm) to the board, for the cut file. */
  scale: number;
  layout: LetteringLayout;
  lines: LetteringLineSpec[];
}

export interface BoardSpec {
  index: number;
  name: string;
  type: string;
  kind: string;
  widthMm: number;
  heightMm: number;
  colourHex: string;
  material: string;
  hasCutFile: boolean;
  lettering: LetteringSpec | null;
}

export interface PackSpec {
  title: string;
  theme: string;
  setup: string;
  eventType: string;
  boards: BoardSpec[];
  balloons: { style: string; colours: { code: string; name: string; finish: string; hex: string }[]; florals: boolean; ringStyle: string | null };
  plinths: { label: string; diameterMm: number; heightMm: number }[];
  standees: { label: string; large: number; medium: number; small: number }[];
  extras: string[];
  /** The design's estimated price lines (AED) — what the design includes. */
  items: { label: string; amount: number }[];
  estimatedTotal: number;
}

const METALLIC = new Set(["silver", "gold", "rose_gold"]);

function letteringSpec(config: BuilderConfig, index: number, placement: { widthMm: number; centreXMm: number; centreYMm: number } | undefined): LetteringSpec | null {
  const item = config.decor.backdropItems[index];
  if (!item?.text?.enabled || !placement) return null;
  const l = cleanLettering(item.text.lettering) ?? letteringFromLegacy(item.text);
  if (!(l.heading.text.trim() || l.name.text.trim())) return null;
  const layout = layoutBoardLettering({ heading: l.heading, name: l.name, presetId: l.presetId ?? l.basedOn });
  const scale = placement.widthMm / layout.box.widthMm;
  const colourId = item.text.color;
  const theme = themeById(config.theme);
  const finish: FinishId = METALLIC.has(colourId) ? "mirror_acrylic" : "acrylic";
  const lines = layout.elements.map((e): LetteringLineSpec => {
    const capHeightMm = e.capHeightMm * scale;
    const a = assessFinish({ fontId: e.input.fontId, weight: e.input.weight, optical: e.input.optical, capHeightMm, text: e.input.text }, finish);
    const thin = a.notes.find((n) => n.kind === "thin_strokes");
    return {
      role: e.role,
      text: e.input.text,
      font: fontById(e.input.fontId)?.family ?? e.input.fontId,
      weight: e.input.weight,
      capHeightMm: round1(capHeightMm),
      thinStrokeMm: round1(a.thinMm),
      minStrokeMm: thin ? thin.minMm : finish === "mirror_acrylic" || finish === "acrylic" ? 2.5 : null,
      strokeOk: !thin,
      missingLetters: e.missing,
    };
  });
  return {
    colour: TEXT_COLORS.find((c) => c.id === colourId)?.label ?? describeTextColor(colourId, theme?.accent),
    colourHex: resolveTextColorHex(colourId, theme?.accent),
    finish,
    finishLabel: finish === "mirror_acrylic" ? `Mirror acrylic lettering, 3 mm — ${TO_CONFIRM}` : `Acrylic lettering, 3 mm, in the colour above — ${TO_CONFIRM}`,
    widthMm: round1(placement.widthMm),
    heightMm: round1(layout.box.heightMm * scale),
    centreXMm: round1(placement.centreXMm),
    centreYMm: round1(placement.centreYMm),
    scale,
    layout,
    lines,
  };
}

/** Where the render guide puts each board's lettering, in board millimetres. */
function letteringPlacements(config: BuilderConfig) {
  const scene = buildSceneModel(config);
  const items = config.decor.backdropItems.map((item, i) => ({ ...item, color: scene.panels[i]?.color || item.color }));
  const guide = generateStructureSilhouette(
    items, scene.plinths.map((p) => p.size), scene.balloons.style, scene.balloons.colors, [], undefined,
    { florals: scene.garlandFlorals, numberLight: scene.numberLight, neonSign: scene.neonSign, ringStyle: scene.balloonRingStyle },
  );
  return guide.letteringPlacements;
}

export function buildPackSpec(config: BuilderConfig): PackSpec {
  const scene = buildSceneModel(config);
  const d = config.decor;
  const theme = themeById(config.theme);
  const setupId = inferSetupLayoutTemplateIdFromBackdropItems(d.backdropItems);
  const setup = SETUP_LAYOUT_TEMPLATES.find((t) => t.id === setupId)?.name ?? "Custom setup";
  const placements = letteringPlacements(config);

  const boards = d.backdropItems.map((item, i): BoardSpec => {
    const kind = BOARD_KINDS[item.type] ?? { label: item.type, cut: false, material: TO_CONFIRM };
    return {
      index: i + 1,
      name: `Board ${i + 1}`,
      type: item.type,
      kind: kind.label,
      widthMm: item.widthCm * 10,
      heightMm: item.heightCm * 10,
      colourHex: scene.panels[i]?.color || item.color || "#FFFFFF",
      material: kind.material,
      hasCutFile: kind.cut,
      lettering: kind.cut || item.type === "shimmer_wall" ? letteringSpec(config, i, placements.find((p) => p.panelIdx === i)) : null,
    };
  });

  const selection = d.sempertexSelection ?? [];
  const colours = selection.length
    ? selection.map((s) => ({ code: s.code, name: s.colorName, finish: s.finish, hex: s.hex }))
    : scene.balloons.colors.map((hex) => ({ code: TO_CONFIRM, name: "Theme colour", finish: TO_CONFIRM, hex }));

  const extras: string[] = [];
  if (scene.neonSign?.enabled) extras.push(`LED neon sign: "${scene.neonSign.text}"`);
  if (scene.numberLight?.enabled) {
    extras.push(scene.numberLight.style === "foil"
      ? `Foil number balloon "${scene.numberLight.value}" (80 cm) on a balloon bunch, colour ${foilColourFor(scene.numberLight, scene.balloons.colors)}`
      : `Light-up marquee number "${scene.numberLight.value}" (100 cm)`);
  }
  if (d.cakeTable) extras.push("Cake table");

  const breakdown = priceBreakdown(config);
  return {
    title: `${theme?.name ?? "Party"} · ${setup}`,
    theme: theme?.name ?? config.theme,
    setup,
    eventType: eventTypeById(config.eventType)?.label ?? config.eventType,
    boards,
    balloons: {
      style: BALLOON_STYLES.find((b) => b.id === scene.balloons.style)?.label ?? scene.balloons.style,
      colours,
      florals: scene.garlandFlorals,
      ringStyle: d.backdropItems.some((i) => i.type === "balloon_ring") ? scene.balloonRingStyle : null,
    },
    plinths: scene.plinths.map((p) => ({ label: PLINTH_SIZES.find((s) => s.id === p.size)?.label ?? p.size, diameterMm: p.diameterCm * 10, heightMm: p.heightCm * 10 })),
    standees: (d.cutouts.selectedAssets ?? []).map((a) => ({ label: a.label, ...a.quantities })),
    extras,
    items: breakdown.lines.map((l) => ({ label: l.label, amount: l.amount })),
    estimatedTotal: breakdown.total,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
