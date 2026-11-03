// The words for the cake's render (app/api/cake-render/route.ts, 2026-11-03): keep the scene of the live preview
// exactly — the cake on its white stand, close up — and make it one real photograph.
import { CAKE_FIGURES, CAKE_SPRINKLES, TOPPER_CARDS, cakeWords, rainbowOf, tierColours, topperColour, topperShows, type Cake, type FigureKind } from "./cake";
import { CAKE_SWEETS, colourWords } from "./cakeSweets";
import { fontWords, tableFont } from "./tableFonts";

const TIER_NAMES: Record<number, string[]> = { 1: ["the cake"], 2: ["the bottom tier", "the top tier"], 3: ["the bottom tier", "the middle tier", "the top tier"] };

/** The words for the photograph: keep the scene, make it real. */
export function cakePrompt(k: Cake): string {
  // Each piece once, its copies counted: "gold star ×2".
  const named = (on: "top" | "side" | "any", kind: FigureKind) => CAKE_FIGURES.flatMap((f) => {
    const n = f.kind === kind ? k.figures.filter((i) => (on === "any" || i.on === on) && i.id === f.id).length : 0;
    return n ? [`${f.name.toLowerCase()}${n > 1 ? ` ×${n}` : ""}`] : [];
  });
  const figures = named("top", "sugar"), sides = named("side", "sugar");
  const cutTop = named("top", "cutout"), cutSide = named("side", "cutout");
  const decos = named("any", "deco");
  const t = k.topper;
  const words = [t.name.trim(), t.age].filter(Boolean).map((w) => `"${w}"`).join(" and ");
  const face = tableFont(t.font);
  const letters = `${topperColour(t.colour).words} ${t.card ? "printed letters" : "acrylic letters"} reading ${words}, ${fontWords(face).replace(", all capitals", "")}`;
  const card = t.card ? TOPPER_CARDS.find((c) => c.id === t.card)!.words : "";
  const topper = !topperShows(k) ? ""
    : t.at === "front"
      ? `On the front of the cake keep the name exactly where image 1 has it: ${card ? `${card} with a thin ${topperColour(t.colour).name.toLowerCase()} border pressed flat onto the buttercream, with ` : ""}${letters}${card ? " on it" : " pressed flat onto the buttercream"}, the same letters in the same colour as image 1.`
      : `Keep the cake topper exactly: ${card ? `${card} with a thin ${topperColour(t.colour).name.toLowerCase()} border on two thin white sticks pushed into the top, with ${letters} on it` : `${letters} on two thin sticks pushed into the top`}, the same letters in the same colour as image 1.`;
  const colours = tierColours(k);
  const rainbow = colours.flatMap((c, i) => (rainbowOf(c) ? [`${TIER_NAMES[k.tiers][i]} in ${rainbowOf(c)!.words}`] : []));
  const sprinkles = CAKE_SPRINKLES.find((s) => s.id === k.sprinkles);
  // The sweets on the table, each as it shows.
  const said = (id: string) => CAKE_FIGURES.find((f) => f.id === id);
  const sweets = CAKE_SWEETS.flatMap((kind) => {
    const sw = k.sweets?.find((x) => x.id === kind.id);
    if (!sw) return [];
    const top = sw.topper ? `, each topped with a little ${said(sw.topper)!.kind === "cutout" ? "printed card" : "sugar-paste"} ${said(sw.topper)!.name.toLowerCase()}` : "";
    const print = sw.print ? `, each printed with ${sw.print === "age" ? `the number "${t.age || "1"}"` : `a little ${said(sw.print)!.name.toLowerCase()}`}` : "";
    return [`${kind.words(colourWords(sw.colour))}${top}${print}${sw.sprinkles ? ", with rainbow sprinkles" : ""}`];
  });
  // On the sweet cart: the cake and the sweets on its counter, under its striped awning.
  const cart = k.cart ? `a white wooden sweet cart with a ${colourWords(k.cart.awning)} and white striped awning` : "";
  const characters = cutTop.length + cutSide.length > 0 || (k.sweets ?? []).some((x) => [x.topper, x.print].some((p) => p && p !== "age" && said(p)?.kind === "cutout"));
  return [
    `Image 1 is a preview of a birthday cake standing on a white cake stand ${cart ? `on the counter of ${cart}` : "on a table"}: ${cakeWords(k)}.`,
    "Make it one real, natural close-up photograph of exactly this cake, from the same camera position, with the same framing and every part the same size and in the same place.",
    `Keep the cake exactly: ${k.tiers > 1 ? "the same tiers, each in its own colour as image 1 shows it" : "the same colour as image 1"}, the same decoration, made of real soft buttercream with its texture.`,
    rainbow.length ? `${rainbow.join("; ")} — keep its colours and patches as image 1 shows them.` : "",
    sprinkles?.words ? `Keep the sprinkles as image 1 shows them: ${sprinkles.words}, real sugar sprinkles.` : "",
    figures.length ? `On top keep the handmade sugar-paste figures exactly: ${figures.join(", ")} — the same shapes, colours, sizes and places, made real and matte.` : "",
    sides.length ? `Keep the sugar-paste figures stuck flat on the sides of the tiers exactly where image 1 has them: ${sides.join(", ")} — real and matte, pressed onto the buttercream.` : "",
    cutTop.length ? `On top keep the printed card cutout toppers exactly: ${cutTop.join(", ")} — flat glossy printed card with a thin white cut edge, each on a thin white stick pushed into the cake, the same pictures, sizes and places as image 1.` : "",
    cutSide.length ? `Keep the printed card cutouts stuck flat on the sides of the tiers exactly where image 1 has them: ${cutSide.join(", ")} — flat glossy printed card with a thin white cut edge.` : "",
    decos.length ? `Keep the small round decorations exactly where image 1 has them: ${decos.join(", ")} — real and shiny, on the top and round the foot of the cake.` : "",
    topper,
    sweets.length ? `On the ${cart ? "cart's counter" : "table"} beside the cake stand keep the sweets exactly where image 1 has them: ${sweets.join("; ")} — the same places, sizes and colours, made real.` : "",
    cart ? `Keep the white cake stand and the sweet cart exactly as image 1 has them — its white wooden counter, its posts and its ${colourWords(k.cart!.awning)} and white striped awning, the same stripes and colour — and the floor and the wall behind it; a soft shadow under the cake on the stand's plate.`
      : "Keep the white cake stand, the table and the wall as they are; a soft shadow under the cake on the stand's plate.",
    "Make the light real: soft, even, neutral daylight, gentle natural shadows — never yellow or orange light, no sunbeams or patches of sunlight.",
    `Nothing added and nothing taken away: no candles, ${characters ? "no real people or hands, no characters beyond the printed cutouts" : "no people, no hands, no characters"}, no fresh flowers, ${sprinkles?.words || k.sweets?.some((x) => x.sprinkles) ? "" : "no sprinkles, "}${sweets.length ? "no other sweets or plates" : "no plates"}, no extra words or letters.`,
  ].filter(Boolean).join(" ");
}
