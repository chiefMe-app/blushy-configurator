// Ready-made giveaway boxes (2026-11-05, the owner: "tablesetup için söylediğim ayarları giveaways için de uygula";
// later the same day: "ready made giveaways'de board değil de farklı box ready made boxlar olsun, farklı font farklı
// texture"): a few finished boxes per theme — each its own print, lettering and colour — shown as the box itself (no
// render spent) and applied at a tap. Where the boxes go, the board, their number, what is in them and the name stay.
import { pastelOf } from "./tableCatalog";
import type { Giveaways } from "./giveaways";

export interface GiveawaySample {
  id: string;
  name: string;
  note: string;
  patch: Pick<Giveaways, "boxPrint" | "font" | "ink"> & Partial<Pick<Giveaways, "boxColour">>;
}

type Theme = { accent: string; balloonColors: string[]; backdropColors?: string[] };

export function giveawaySamples(theme: Theme): GiveawaySample[] {
  const tone = theme.balloonColors.find((h) => h.toUpperCase() !== "#FFFFFF") ?? theme.accent;
  return [
    { id: "watercolour-script", name: "Soft Watercolour", note: "A watercolour wash, the name in a flowing script",
      patch: { boxPrint: "watercolour", font: "birthstone-bounce", ink: "" } },
    { id: "pattern-bold", name: "Pattern Party", note: "The theme's little prints all over, the name in bold capitals",
      patch: { boxPrint: "pattern", font: "archivo-black", ink: "" } },
    { id: "plain-classic", name: "Simple & Sweet", note: "One soft colour all over, the name in a classic serif",
      patch: { boxPrint: "plain", boxColour: pastelOf(tone), font: "fraunces", ink: theme.accent } },
  ];
}

/** Her giveaways with a box applied: where they go, the board, her boxes' number, what is in them and the name kept. */
export const withGiveawaySample = (g: Giveaways, s: GiveawaySample): Giveaways => ({ ...g, ...s.patch });

/** The ready-made box she has now, if any. */
export const appliedGiveawaySample = (g: Giveaways, samples: GiveawaySample[]) =>
  samples.find((s) => s.patch.boxPrint === g.boxPrint && s.patch.font === g.font && s.patch.ink === g.ink && (s.patch.boxColour === undefined || s.patch.boxColour === g.boxColour))?.id;
