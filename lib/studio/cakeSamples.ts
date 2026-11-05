// Ready-made cakes (2026-11-05, the owner: "pasta içinde sample örnekleri olsun hazır cakeler"): a few finished cake
// tables per theme — a design from the theme's own (cakeDesigns), where it is shown and the sweets beside it — each
// drawn as its whole scene (no render spent), applied at a tap. Her name, age, lettering and flavour stay; everything
// can be changed after. Prices come from the pieces (placeholders until the owner sets them).
import { cakeDesigns, type Cake, type CakeFigure, type CakeSeed } from "./cake";
import type { CakeSweet } from "./cakeSweets";

export interface CakeSample {
  id: string;
  name: string;
  note: string;
  /** The design it starts from (its topper's place comes with it). */
  design: ReturnType<typeof cakeDesigns>[number];
  /** Where it is shown and the sweets beside it. */
  scene: Pick<Cake, "cart" | "plinths" | "sweets">;
}

/** `pieces`: what a cupcake can carry or a cookie have printed on it, the theme's own first. */
export function cakeSamples(seed: CakeSeed, pieces: CakeFigure[]): CakeSample[] {
  const designs = cakeDesigns(seed);
  const design = (...ids: string[]) => ids.map((id) => designs.find((d) => d.id === id)).find(Boolean) ?? designs[0];
  const [a, b] = [seed.colours?.[0] ?? "#F8BBD0", seed.colours?.[1] ?? seed.colours?.[0] ?? "#FFFFFF"].map((h) => h.toUpperCase());
  const piece = pieces[0];
  const sweet = (id: CakeSweet["id"], count: CakeSweet["count"], colour: string, extra: Partial<CakeSweet> = {}): CakeSweet => ({ id, count, colour, ...extra });
  return [
    {
      id: "cart", name: "Sweet Cart", note: "Two tiers on a sweet cart, cupcakes and cake pops",
      design: design("sweet", "drip"),
      scene: { cart: { roof: "#FFFFFF" }, plinths: undefined, sweets: [sweet("cupcakes", 12, a, piece ? { topper: piece } : {}), sweet("cakepops", 12, b)] },
    },
    {
      id: "plinths", name: "Grand Display", note: "Three tiers on white plinths, cookies and macarons",
      design: design("grand"),
      scene: { cart: undefined, plinths: true, sweets: [sweet("cookies", 12, b, piece ? { print: piece } : {}), sweet("macarons", 12, a)] },
    },
    {
      id: "table", name: "Simply Sweet", note: "One cake on its stand, donuts beside it",
      design: design("face", "classic"),
      scene: { cart: undefined, plinths: undefined, sweets: [sweet("donuts", 6, a)] },
    },
  ];
}
