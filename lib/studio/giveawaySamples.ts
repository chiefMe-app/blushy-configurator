// Ready-made giveaways (2026-11-05, the owner: "tablesetup için söylediğim ayarları giveaways için de uygula" —
// the kids' table's ready-made looks among them): a few finished looks per theme, each shown as its own box drawing
// (no render spent), applied at a tap. Her number of boxes, what is in them and the name stay; the look changes the
// box's print and colour, the lettering, and where they go and the board. Everything can be changed after.
import { pastelOf } from "./tableCatalog";
import type { Giveaways } from "./giveaways";

export interface GiveawaySample {
  id: string;
  name: string;
  note: string;
  patch: Partial<Omit<Giveaways, "enabled" | "count" | "contents" | "name" | "done" | "render">>;
}

type Theme = { accent: string; balloonColors: string[]; backdropColors?: string[] };

export function giveawaySamples(theme: Theme, tableKept: boolean): GiveawaySample[] {
  const tone = theme.balloonColors.find((h) => h.toUpperCase() !== "#FFFFFF") ?? theme.accent;
  const board = pastelOf(theme.backdropColors?.find((h) => h.toUpperCase() !== "#FFFFFF") ?? tone);
  return [
    {
      id: "board-party", name: "Party Board", note: "Printed boxes on a board with balloons",
      patch: { place: "board", boxPrint: "pattern", font: "nunito", ink: "", boardColour: board, boardFont: "sacramento", boardLineFont: "archivo-black", boardInk: "", boardGarland: true, boardLine: "Thank you for coming" },
    },
    {
      id: "watercolour", name: "Soft Watercolour", note: tableKept ? "A watercolour box at each place" : "Watercolour boxes on a white board",
      patch: { place: tableKept ? "table" : "board", boxPrint: "watercolour", font: "birthstone-bounce", ink: "", boardColour: "#FFFFFF", boardFont: "birthstone-bounce", boardLineFont: "birthstone-bounce", boardInk: "", boardGarland: false },
    },
    {
      id: "plain", name: "Simple & Sweet", note: "Plain pastel boxes, the name in the theme's colour",
      patch: { place: "board", boxPrint: "plain", boxColour: pastelOf(tone), font: "fraunces", ink: "", boardColour: "#FFFFFF", boardFont: "fraunces", boardLineFont: "fraunces", boardInk: "", boardGarland: false },
    },
  ];
}

/** Her giveaways with a look applied: her boxes' number, what is in them and the name kept. */
export const withGiveawaySample = (g: Giveaways, s: GiveawaySample): Giveaways => ({ ...g, ...s.patch });
