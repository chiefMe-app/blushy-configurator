// Ready-mades for the cake part (2026-11-05). First (the owner: "pasta içinde sample örnekleri olsun hazır cakeler")
// they were whole cake tables; then (the owner: "pastada aynı şekilde ready made pasta modelleri olsun. cupcake seçme
// yerinde aynı şekilde ready made olsun 3 seçenek. bide cart plinth table resimleri sweet cart seçme yerinin orda
// olsun") three kinds, each where she chooses that thing: finished cakes at the top (the cake alone), three cupcake
// sets where the cupcakes are, and the table, the cart and the plinths as pictures where she picks what it is shown on.
// All drawn (no render spent) and applied at a tap; her name, age, lettering and flavour stay. Prices come from the
// pieces (placeholders until the owner sets them).
import { cakeDesigns, type Cake, type CakeFigure, type CakeSeed } from "./cake";
import type { CakeSweet } from "./cakeSweets";

type Design = ReturnType<typeof cakeDesigns>[number];

export interface CakeSample {
  id: string;
  name: string;
  note: string;
  /** The design it starts from (its topper's place comes with it). */
  design: Design;
  /** What it changes on that design: colours, sprinkles, the topper's colour or card. */
  look: Partial<Pick<Cake, "colours" | "sprinkles">> & { topper?: Partial<Cake["topper"]> };
}

const up = (h: string) => h.toUpperCase();
const WHITE = "#FFFFFF";

/** Three finished cakes in the theme: each a design of its own, dressed (colours, sprinkles, the topper). */
export function cakeSamples(seed: CakeSeed): CakeSample[] {
  const designs = cakeDesigns(seed);
  const design = (...ids: string[]) => ids.map((id) => designs.find((d) => d.id === id)).find(Boolean) ?? designs[0];
  const [a, b, c] = [seed.colours?.[0] ?? "#F8BBD0", seed.colours?.[1] ?? seed.colours?.[0] ?? WHITE, seed.colours?.[2] ?? seed.colours?.[0] ?? "#F8BBD0"].map(up);
  const pastelB = b === WHITE ? a : b;
  return [
    // The theme's own showpiece: the unicorn face, the printed cutouts, else the classic.
    { id: "signature", name: "The Signature", note: "The theme's own cake, the name in gold", design: design("face", "cutouts", "classic"), look: { topper: { colour: "gold" } } },
    { id: "sprinkle-drip", name: "Sprinkle Drip", note: "Two tiers, a drip and a band of sprinkles", design: design("drip"), look: { colours: [pastelB, a, c], sprinkles: "base", topper: { colour: "rose-gold" } } },
    { id: "grand-ruffles", name: "Grand Celebration", note: "Three tiers of rosettes, little hearts, the name on a cloud", design: design("grand"), look: { colours: [a, WHITE, pastelB], sprinkles: "hearts", topper: { colour: "silver", card: "cloud" } } },
  ];
}

export interface CupcakeSample { id: string; name: string; note: string; sweet: CakeSweet }

/** Three sets of a dozen cupcakes: a figure on each in gold foil, rainbow confetti with sprinkles, plain silver. */
export function cupcakeSamples(seed: CakeSeed, pieces: CakeFigure[]): CupcakeSample[] {
  const [a, b] = [seed.colours?.[0] ?? "#F8BBD0", seed.colours?.[1] ?? seed.colours?.[0] ?? WHITE].map(up);
  const piece = pieces[0];
  return [
    { id: "topped", name: "Theme Toppers", note: "A theme figure on each, gold foil", sweet: { id: "cupcakes", count: 12, colour: a, ...(piece ? { topper: piece } : {}) } },
    { id: "confetti", name: "Confetti Swirl", note: "Rainbow sprinkles, confetti liners", sweet: { id: "cupcakes", count: 12, colour: b === a ? WHITE : b, sprinkles: true, liner: "rainbow" } },
    { id: "hearts", name: "Silver Hearts", note: "White swirls, a heart on each, silver foil", sweet: { id: "cupcakes", count: 12, colour: WHITE, topper: "heart", liner: "silver" } },
  ];
}

/** Whether her cupcakes are one of the sets (what she has changed since does not count). */
export const appliedCupcakeSample = (sw: CakeSweet | undefined, samples: CupcakeSample[]) => sw
  ? samples.find((s) => s.sweet.colour === sw.colour && s.sweet.topper === sw.topper && !!s.sweet.sprinkles === !!sw.sprinkles && (s.sweet.liner ?? "gold") === (sw.liner ?? "gold"))?.id
  : undefined;

/** Where it is shown: on the table, on a sweet cart, on plinths. */
export type CakeScene = "table" | "cart" | "plinths";
export const sceneOf = (k: Pick<Cake, "cart" | "plinths">): CakeScene => (k.cart ? "cart" : k.plinths ? "plinths" : "table");
/** The cake moved to a scene: a cart keeps its roof (and balloons) when it is one already. */
export const toScene = (k: Pick<Cake, "cart" | "plinths">, s: CakeScene): Pick<Cake, "cart" | "plinths"> => ({
  cart: s === "cart" ? (k.cart ?? { roof: WHITE }) : undefined,
  plinths: s === "plinths" || undefined,
});
