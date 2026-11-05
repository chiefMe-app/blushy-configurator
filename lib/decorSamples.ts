// Ready-made looks (2026-11-05, the owner: "hazır setuplar olsun her temada. görseli görsün müşteri basınca o ayarlar
// olsun … bu yolladığım render bir tane sample setlerden biri olsun"): a few finished backdrops per theme, shown as a
// picture — her own render where she gave one, else the look's live sketch (no render spent) — and applied whole at a
// tap: the boards, their colours and words, the balloon set, the rainbows, a standee and the plinths. Everything can
// be changed after, as if she had picked it herself.
import {
  DEFAULT_TEXT_VALUE, emptyCutoutQuantities, emptyCutoutStandees, makeBackdropItem,
  type BackdropItem, type CutoutSelection, type DecorConfig, type PlinthSize,
} from "@/lib/config";
import type { BalloonSetId } from "@/lib/balloonSets";
import { letteringFromLegacy, letteringPatch } from "@/lib/typography/lettering";

export interface DecorSample {
  id: string;
  name: string;
  note: string;
  /** A real photograph of the look (the owner's own render); without one the card shows its live sketch. */
  photo?: string;
  /** The theme's own balloon set it uses. */
  balloonSet: BalloonSetId;
  /** The look, for a theme; `name` is the name already on her board, kept. */
  build: (name: string) => Partial<DecorConfig>;
}

/** Her board's words: "Happy Birthday" over the name she has written, if any. */
function lettered(item: BackdropItem, name: string, color: string): BackdropItem {
  const value = name.trim() ? `${DEFAULT_TEXT_VALUE} ${name.trim()}` : DEFAULT_TEXT_VALUE;
  const l = letteringFromLegacy({ value, fontStyle: "script" });
  return { ...item, text: { ...item.text, enabled: true, color, ...letteringPatch(l) } };
}

const standee = (assetId: string, label: string): CutoutSelection => ({
  size: "none", position: "floor", source: "preset", presetAssetId: undefined, mode: "standees",
  selectedAssets: [{ assetId, label, previewUrl: `/cutouts/${assetId.split("-")[0]}/${assetId}.png`, quantities: { ...emptyCutoutQuantities(), large: 1 } }],
});
const noStandee: CutoutSelection = { size: "none", mode: "none", position: "floor", source: "preset", presetAssetId: undefined, selectedAssets: [], items: emptyCutoutStandees() };

const plinths = (...sizes: PlinthSize[]) => ({ plinths: sizes.length, plinthSizes: sizes });
const off = { enabled: false, text: DEFAULT_TEXT_VALUE };
/** What every look sets, so nothing of the last one is left behind. */
const look = (items: BackdropItem[], extra: Partial<DecorConfig>): Partial<DecorConfig> => ({
  backdropChoice: "yes", backdropItems: items, balloonStyle: "full", rainbowBalloons: false, garlandFlorals: false,
  cutouts: noStandee, neonSign: off, numberLight: undefined, ...plinths("large"), ...extra,
});
const arch = () => ({ ...makeBackdropItem("arch", "large"), id: "arch-1" });

const UNICORN: DecorSample[] = [
  {
    // Her own render, 2026-11-05: a lilac wavy board on a pink rim, the bright set, three balloon rainbows, a unicorn.
    id: "unicorn-rainbow-dream", name: "Rainbow Dream", note: "Lilac wavy board, rainbows and a unicorn",
    photo: "/design/samples/unicorn-rainbow-dream.webp", balloonSet: "bright",
    build: (name) => look([lettered({ ...makeBackdropItem("wavy", undefined, "#DCC6F0"), borderColor: "#F8BBD0" }, name, "white")],
      { rainbowBalloons: true, cutouts: standee("unicorn-01", "Prancing Unicorn") }),
  },
  {
    id: "unicorn-pastel-arch", name: "Pastel Arch", note: "White arch in rainbow pastels",
    balloonSet: "pastel",
    build: (name) => look([lettered(arch(), name, "gold")], { rainbowBalloons: true, cutouts: standee("unicorn-02", "Rainbow Unicorn"), ...plinths("large", "medium") }),
  },
  {
    id: "unicorn-wavy-shimmer", name: "Wavy Sparkle", note: "Pink wavy board and a silver shimmer wall",
    balloonSet: "pastel",
    build: (name) => look([lettered({ ...makeBackdropItem("wavy", undefined, "#F9D5DF"), borderColor: "#DDD6FE" }, name, "white"), makeBackdropItem("shimmer_wall")],
      { shimmerColor: "silver" }),
  },
];

const FROZEN: DecorSample[] = [
  {
    id: "frozen-ice-arch", name: "Ice Arch", note: "White arch, icy pastels and a princess",
    balloonSet: "pastel",
    build: (name) => look([lettered(arch(), name, "silver")], { cutouts: standee("frozen-03", "Ice Princess Solo"), ...plinths("large", "medium") }),
  },
  {
    id: "frozen-wavy-shimmer", name: "Frosty Sparkle", note: "Ice-blue wavy board and a shimmer wall",
    balloonSet: "bright",
    build: (name) => look([lettered({ ...makeBackdropItem("wavy", undefined, "#E8F4FD"), borderColor: "#B3D9F2" }, name, "silver"), makeBackdropItem("shimmer_wall")],
      { shimmerColor: "silver" }),
  },
  {
    id: "frozen-round", name: "Snow Globe", note: "Round board in soft ice blue",
    balloonSet: "pastel",
    build: (name) => look([lettered({ ...makeBackdropItem("round", undefined, "#E8F4FD"), id: "round" }, name, "silver")], {}),
  },
];

/** Every other theme: three looks in its own colours (its first backdrop colour, its balloons). */
const generic = (themeId: string, boardColour: string): DecorSample[] => [
  { id: `${themeId}-classic-arch`, name: "Classic Arch", note: "A white arch with a full garland", balloonSet: "pastel",
    build: (name) => look([lettered(arch(), name, "gold")], { ...plinths("large", "medium") }) },
  { id: `${themeId}-round`, name: "Round & Sweet", note: "A round board in the theme's colour", balloonSet: "pastel",
    build: (name) => look([lettered({ ...makeBackdropItem("round", undefined, boardColour), id: "round" }, name, "gold")], {}) },
  { id: `${themeId}-wavy`, name: "Wavy Pop", note: "A wavy board in bright colours", balloonSet: "bright",
    build: (name) => look([lettered(makeBackdropItem("wavy", undefined, boardColour), name, "gold")], {}) },
];

/** The ready-made looks for a theme. */
export function decorSamples(themeId: string, backdropColors: string[] = []): DecorSample[] {
  if (themeId === "unicorn") return UNICORN;
  if (themeId === "frozen") return FROZEN;
  return generic(themeId, backdropColors.find((c) => c.toUpperCase() !== "#FFFFFF") ?? "#FFFFFF");
}

/** The name already lettered on her boards, kept when a look is applied. */
export function currentName(items: BackdropItem[]): string {
  for (const i of items) {
    const n = i.text?.enabled ? i.text.lettering?.name.text.trim() : "";
    if (n) return n;
  }
  return "";
}
