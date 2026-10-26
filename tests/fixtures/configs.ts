// Named BuilderConfig fixtures — the baseline every later phase is measured
// against (pricing, scene, lettering, render guide and prompt). Add new
// fixtures at the end; never edit one that already has a baseline without an
// approved, listed reason.
import type { BoardLettering, BuilderConfig } from "@/lib/config";
import { applyPreset, letteringPatch } from "@/lib/typography/lettering";
import { finalize, frozen, withDecor, withSetup, withStandees, withText, withTheme } from "./builder";
import { defaultConfig } from "@/lib/config";

export interface Fixture {
  id: string;
  note: string;
  config: BuilderConfig;
}

const SETUPS = [
  "single_arch", "single_round", "single_banner", "single_shimmer", "arch_shimmer",
  "balloon_ring", "arch_open_frame", "double_arch", "triple_arch",
] as const;

const round = () => frozen("single_round");
const roundText = (value: string, fontStyle: "script" | "block" | "elegant" = "script", extra: Record<string, unknown> = {}) =>
  withText(round(), 0, { enabled: true, value, fontStyle, ...extra });

// 2026-10-26: Typography System lettering on the setup's lettered board.
const lettered = (setup: string, presetId: string, heading: string, name: string, color?: string) => {
  const c = frozen(setup);
  const idx = Math.max(0, c.decor.backdropItems.findIndex((i) => i.text.enabled));
  const base: BoardLettering = {
    presetId: null, basedOn: presetId,
    heading: { text: heading, fontId: "", weight: 0, size: "medium" },
    name: { text: name, fontId: "", weight: 0, size: "large" },
  };
  return withText(c, idx, { enabled: true, ...letteringPatch(applyPreset(base, presetId)), ...(color ? { color } : {}) });
};

const list: Fixture[] = [
  // A. Every setup as it opens, Frozen
  ...SETUPS.map((s) => ({ id: `A-${s}`, note: `Frozen ${s}, as the setup opens`, config: frozen(s) })),

  // B. Board lettering (BackdropItemText) on Single Round
  { id: "B01-hb-arya-script", note: "Happy Birthday Arya, script, medium", config: roundText("Happy Birthday Arya") },
  { id: "B02-hb-arya-elegant", note: "Happy Birthday Arya, elegant", config: roundText("Happy Birthday Arya", "elegant") },
  { id: "B03-hb-arya-block", note: "Happy Birthday Arya, block", config: roundText("Happy Birthday Arya", "block") },
  { id: "B04-hb-arya-small", note: "script, Small", config: roundText("Happy Birthday Arya", "script", { size: "small" }) },
  { id: "B05-hb-arya-large", note: "script, Large", config: roundText("Happy Birthday Arya", "script", { size: "large" }) },
  { id: "B06-ordinal-layla", note: "ordinal: messageLines does not split this today", config: roundText("Happy 1st Birthday Layla") },
  { id: "B07-ordinal-malek-elegant", note: "ordinal, elegant", config: roundText("Happy 2nd Birthday Malek", "elegant") },
  { id: "B08-turkish", note: "Turkish letters: Brittany lacks them, Sacramento fallback", config: roundText("İyi ki doğdun Ayşe Gül") },
  { id: "B09-name-only", note: "name only", config: roundText("Arya") },
  { id: "B10-oh-baby", note: "free phrase", config: roundText("Oh Baby") },
  { id: "B11-welcome-elegant", note: "free phrase with ordinal, elegant", config: roundText("Welcome to Arya's 5th Birthday", "elegant") },
  { id: "B12-hb-only", note: "default value, no name", config: roundText("Happy Birthday") },
  { id: "B13-newline", note: "line break inside the text", config: roundText("Happy Birthday\nArya") },
  { id: "B14-long-block", note: "28-character name, block", config: roundText("Happy Birthday Alexandrina Montgomery", "block") },

  // C. Legacy decor.backdropText (birthday / custom) — still read by sketch and prompt paths
  { id: "C01-legacy-birthday", note: "legacy backdropText birthday + name", config: withDecor(round(), { backdropText: { ...round().decor.backdropText, enabled: true, type: "birthday", name: "Arya" } }) },
  { id: "C02-legacy-custom", note: "legacy backdropText custom", config: withDecor(round(), { backdropText: { ...round().decor.backdropText, enabled: true, type: "custom", customText: "Oh Baby" } }) },
  { id: "C03-legacy-turkish", note: "legacy backdropText Turkish name", config: withDecor(round(), { backdropText: { ...round().decor.backdropText, enabled: true, type: "birthday", name: "Ayşe" } }) },
  { id: "C04-legacy-off", note: "legacy backdropText disabled with a name left in it", config: withDecor(round(), { backdropText: { ...round().decor.backdropText, enabled: false, type: "birthday", name: "Arya" } }) },

  // D. Colour and boards
  { id: "D01-gold", note: "gold lettering", config: withText(round(), 0, { color: "gold" }) },
  { id: "D02-rose-gold", note: "rose gold lettering", config: withText(round(), 0, { color: "rose_gold" }) },
  { id: "D03-white", note: "white lettering", config: withText(round(), 0, { color: "white" }) },
  { id: "D04-custom-hex", note: "custom hex lettering", config: withText(round(), 0, { color: "#7B2D8E" }) },
  { id: "D05-pink-board", note: "pink board", config: withDecor(round(), { backdropColor: "#F8BBD0" }) },
  {
    id: "D06-double-two-colours", note: "Double Arch, two board colours",
    config: (() => {
      const c = frozen("double_arch");
      return withDecor(c, { backdropItems: c.decor.backdropItems.map((p, i) => ({ ...p, color: i === 0 ? "#F8BBD0" : "#DCD7F2" })) });
    })(),
  },

  // E. Extras and other
  { id: "E01-neon", note: "neon sign instead of lettering", config: withDecor(withText(round(), 0, { enabled: false }), { neonSign: { enabled: true, text: "Happy Birthday" } }) },
  { id: "E02-marquee-3-plinths", note: "marquee 1 + 3 plinths (XXL, XL, XL)", config: withDecor(round(), { numberLight: { enabled: true, value: "1", style: "marquee" }, plinths: 3, plinthSizes: ["large", "medium", "medium"] }) },
  { id: "E03-foil-pink", note: "foil 1, pink", config: withDecor(round(), { numberLight: { enabled: true, value: "1", style: "foil", foilColor: "#F472B6" } }) },
  { id: "E04-foil-gold", note: "foil 1, gold", config: withDecor(round(), { numberLight: { enabled: true, value: "1", style: "foil", foilColor: "#D4AF37" } }) },
  { id: "E05-florals", note: "garland florals", config: withDecor(round(), { garlandFlorals: true }) },
  { id: "E06-two-standees", note: "two standees (scene/pricing)", config: withStandees(round(), [0, 1]) },
  { id: "E07-ring-half", note: "balloon ring, half", config: withDecor(frozen("balloon_ring"), { balloonRingStyle: "half" }) },
  { id: "E08-ring-none", note: "balloon ring, bare hoop", config: withDecor(frozen("balloon_ring"), { balloonRingStyle: "none", balloonStyle: "none" }) },
  { id: "E09-no-balloons", note: "Single Round, no balloons", config: withDecor(round(), { balloonStyle: "none" }) },
  { id: "E10-barbie", note: "Barbie palette, Single Round", config: withSetup(withTheme(defaultConfig(), "barbie"), "single_round") },
  { id: "E11-minecraft", note: "Minecraft palette, Double Arch", config: withSetup(withTheme(defaultConfig(), "minecraft"), "double_arch") },
  { id: "E12-zero-plinths", note: "no plinth", config: withDecor(round(), { plinths: 0, plinthSizes: [] }) },

  // N. Typography System lettering (2026-10-26): a Heading over a Name, each in its own font
  { id: "N01-soft-signature-round", note: "#5 Soft Signature, Single Round", config: lettered("single_round", "soft-signature", "Happy Birthday", "Arya") },
  { id: "N02-editorial-gold", note: "#9 Modern Editorial, gold, ordinal", config: lettered("single_round", "modern-editorial", "Happy 1st Birthday", "Layla", "gold") },
  { id: "N03-party-pop-double", note: "Party Pop, Double Arch", config: lettered("double_arch", "party-pop", "Happy Birthday", "Malek") },
  { id: "N04-one-line", note: "one line only: it leads at the name's size", config: lettered("single_round", "flowing-script", "Oh Baby", "") },
  { id: "N05-timeless-black-arch", note: "Timeless Bold, black, Single Arch", config: lettered("single_arch", "timeless-bold", "Happy Birthday", "Zayn", "black") },
  { id: "N06-triple-overlay", note: "Soft Signature, Triple Arch (laid over the render)", config: lettered("triple_arch", "soft-signature", "Happy Birthday", "Arya") },
  { id: "N07-turkish", note: "Whisper Light, Turkish letters", config: lettered("single_round", "whisper-light", "İyi ki doğdun", "Ayşe Gül") },
  { id: "N08-open-frame-overlay", note: "Gallery, Arch + Open Frame (laid over the render)", config: lettered("arch_open_frame", "gallery", "Happy Birthday", "Noor") },
];

export const FIXTURES: Fixture[] = list.map((f) => ({ ...f, config: finalize(f.config) }));

export function fixtureById(id: string): Fixture {
  const f = FIXTURES.find((x) => x.id === id);
  if (!f) throw new Error(`unknown fixture ${id}`);
  return f;
}
