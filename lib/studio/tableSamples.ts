// Ready-made kids' tables (2026-11-05, the owner: "table setupta da samplelar olsun yanda gene user seçsin"): a few
// finished place settings per theme, each shown as its own one-place drawing (TablePlace, no render spent), applied
// at a tap. Her number of kids, her words and her table and chairs stay; the look changes the tableware, its colours
// and lettering. Everything can be changed after.
import { NONE, pastelOf, type TableItemKey } from "./tableCatalog";
import { defaultTableSetup, themeTones, type TableSetup } from "./tableSetup";

export interface TableSample {
  id: string;
  name: string;
  note: string;
  /** The pieces it picks, and their colours and lettering, set over her table. */
  choices: Partial<Record<TableItemKey, string>>;
  patch: Partial<Omit<TableSetup, "choices">>;
}

type Theme = { id: string; balloonColors: string[]; accent: string; backdropColors?: string[] };

export function tableSamples(theme: Theme): TableSample[] {
  // The theme's own plates and napkins on its watercolour look (Unicorn's rainbow ones), else the plain ones.
  const d = defaultTableSetup(theme).choices;
  const ownPieces = { plates: d.plates, cups: d.cups, napkins: d.napkins };
  const [a, b] = themeTones(theme), c = theme.balloonColors.find((h) => h !== a && h !== b && !/^#F[0-9A-F]F[0-9A-F]F[0-9A-F]$/i.test(h)) ?? a;
  return [
    {
      id: "watercolour", name: "Watercolour Party", note: "Soft printed placemats and labels, a hat each",
      choices: { placemats: "watercolour", bottleLabel: "watercolour", partyHats: "cone", cutleryHolder: "band", centrepiece: "balloons", cutlery: "wooden", tablecloth: NONE, ...ownPieces },
      patch: {
        plateColor: pastelOf(a), smallPlateColor: pastelOf(b), cupColor: b ?? theme.accent, holderColor: a ?? theme.accent, napkinColor: "#FFFFFF", hatColor: a ?? theme.accent,
        placematFont: "birthstone-bounce", labelFont: "birthstone-bounce", plateShape: "round",
      },
    },
    {
      id: "sparkle", name: "Sparkle & Shine", note: "Glitter placemats, foil plates and cups",
      choices: { placemats: "sparkle", bottleLabel: "sparkle", partyHats: "cone", cutleryHolder: "band", centrepiece: "toppers", cutlery: "glitter", tablecloth: NONE, plates: "plain", cups: "plain", napkins: "plain" },
      patch: {
        plateColor: "iridescent", smallPlateColor: "silver", cupColor: "iridescent", holderColor: "#FFFFFF", napkinColor: "#FFFFFF", hatColor: c,
        placematFont: "italianno", labelFont: "italianno", plateShape: "scalloped",
      },
    },
    {
      id: "simple", name: "Simple & Sweet", note: "Plain colours in the theme's tones",
      choices: { placemats: "plain", bottleLabel: "plain", partyHats: NONE, cutleryHolder: "band", centrepiece: "florals", cutlery: "dipped", tablecloth: NONE, plates: "plain", cups: "plain", napkins: "plain" },
      patch: {
        placematColor: pastelOf(a), labelColor: pastelOf(a), plateColor: "#FFFFFF", smallPlateColor: pastelOf(b), cupColor: pastelOf(b), holderColor: b ?? theme.accent, napkinColor: pastelOf(c),
        placematFont: "fraunces", labelFont: "fraunces", plateShape: "round",
      },
    },
  ];
}

/** Her table with a look applied: her kids, words, table and chairs kept. */
export function withSample(t: TableSetup, s: TableSample): TableSetup {
  return { ...t, ...s.patch, choices: { ...t.choices, ...s.choices } as TableSetup["choices"] };
}
