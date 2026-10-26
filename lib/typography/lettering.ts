// Board lettering in the Builder (Typography System, 2026-10-26): a Heading
// over a Name, each in its own font and size, in one colour (the board's
// lettering colour). Safe on the client and the server: data and rules only;
// the shaping itself is boardLayout.ts (server) and /api/typography/layout.
import {
  DEFAULT_TEXT_VALUE, TEXT_SIZES, messageLines,
  type BackdropItemText, type BoardLettering, type FontStyle, type LetteringLine, type TextSize,
} from "../config";
import { DEFAULT_PRESET_ID, PRESETS, presetById, type LetteringPreset } from "./presets";
import { fontById } from "./registry";

export const MAX_LETTERING_TEXT = 60;

/** The presets old designs map to, so their lettering keeps its character. */
const PRESET_FOR_LEGACY: Record<FontStyle, string> = {
  script: "soft-signature",
  elegant: "modern-editorial",
  block: "timeless-bold",
};

const line = (text: string, font: LetteringPreset["headingFont"], size: TextSize): LetteringLine =>
  ({ text, fontId: font.fontId, weight: font.weight, size });

/** Lettering for a board that has only the old single message (or nothing yet). */
export function letteringFromLegacy(t: Pick<BackdropItemText, "value" | "fontStyle">): BoardLettering {
  const preset = presetById(PRESET_FOR_LEGACY[t.fontStyle] ?? DEFAULT_PRESET_ID) ?? presetById(DEFAULT_PRESET_ID)!;
  const value = t.value.trim() || DEFAULT_TEXT_VALUE;
  // "Happy Birthday Arya": the heading and the name. Anything else is one line.
  const lines = messageLines(value);
  const [heading, name] = lines ? [lines[0], lines.slice(1).join(" ")] : [value, ""];
  return {
    presetId: preset.id,
    basedOn: preset.id,
    heading: line(heading, preset.headingFont, "medium"),
    name: line(name, preset.nameFont, "large"),
  };
}

/** The line that leads: the name, or the heading when there is no name. */
export function leadLine(l: BoardLettering): LetteringLine {
  return l.name.text.trim() ? l.name : l.heading;
}

/** What the old fields say for this lettering, for everything that still reads them. */
export function legacyFields(l: BoardLettering): Pick<BackdropItemText, "value" | "fontStyle" | "size"> {
  const lead = leadLine(l);
  const category = fontById(lead.fontId)?.category;
  return {
    value: [l.heading.text.trim(), l.name.text.trim()].filter(Boolean).join(" "),
    fontStyle: category === "signature" ? "script" : category === "playful" ? "block" : "elegant",
    size: lead.size,
  };
}

/** A text patch that sets the lettering and keeps the old fields in step. */
export function letteringPatch(l: BoardLettering): Partial<BackdropItemText> {
  return { lettering: l, ...legacyFields(l) };
}

/** Sets a preset's two fonts; texts and sizes stay. */
export function applyPreset(l: BoardLettering, presetId: string): BoardLettering {
  const p = presetById(presetId);
  if (!p) return l;
  return {
    presetId: p.id,
    basedOn: p.id,
    heading: { ...l.heading, fontId: p.headingFont.fontId, weight: p.headingFont.weight },
    name: { ...l.name, fontId: p.nameFont.fontId, weight: p.nameFont.weight },
  };
}

/** Changes one line; a font change leaves the preset ("Your own mix"). */
export function changeLine(l: BoardLettering, role: "heading" | "name", patch: Partial<LetteringLine>): BoardLettering {
  const fontChanged = (patch.fontId !== undefined && patch.fontId !== l[role].fontId)
    || (patch.weight !== undefined && patch.weight !== l[role].weight);
  return { ...l, presetId: fontChanged ? null : l.presetId, [role]: { ...l[role], ...patch } };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function cleanLine(raw: unknown): LetteringLine | null {
  if (!isObject(raw) || typeof raw.text !== "string" || typeof raw.fontId !== "string") return null;
  const font = fontById(raw.fontId);
  const weight = Number(raw.weight);
  if (!font || font.legacyOnly || !font.weights.some((w) => w.weight === weight)) return null;
  const size = TEXT_SIZES.find((s) => s.id === raw.size)?.id ?? "medium";
  return { text: raw.text.replace(/[\r\n\t]+/g, " ").slice(0, MAX_LETTERING_TEXT), fontId: font.id, weight, size };
}

/** Lettering read from outside (a request, a saved draft), or null if it is not usable. */
export function cleanLettering(raw: unknown): BoardLettering | null {
  if (!isObject(raw)) return null;
  const heading = cleanLine(raw.heading), name = cleanLine(raw.name);
  if (!heading || !name) return null;
  const presetId = typeof raw.presetId === "string" && presetById(raw.presetId) ? raw.presetId : null;
  const basedOn = typeof raw.basedOn === "string" && presetById(raw.basedOn) ? raw.basedOn : DEFAULT_PRESET_ID;
  return { presetId, basedOn, heading, name };
}

/** How the render prompt names a line's typeface. */
export function lineDescriptor(l: LetteringLine): string {
  return fontById(l.fontId)?.promptDescriptor ?? "elegant lettering";
}

export { PRESETS as LETTERING_PRESETS };
