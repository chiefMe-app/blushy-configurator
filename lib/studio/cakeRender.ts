// The words for the cake's render (app/api/cake-render/route.ts, 2026-11-03): keep the scene of the live preview
// exactly — the cake on its white stand, close up — and make it one real photograph. Since 2026-11-03 also of one
// part of it (the owner: "cake'e basacağız sadece cake, sonra cookies'e basacağız yakından cookies … bide uzaktan
// cartın üstündeyken genel"): the whole table or cart, the cake close up, or a sweet close up.
import { CAKE_FIGURES, CAKE_SPRINKLES, TOPPER_CARDS, cakeWords, holderOf, rainbowOf, tierColours, topperColour, topperShows, type Cake, type CakeView, type FigureKind } from "./cake";
import { CAKE_SWEETS, colourWords } from "./cakeSweets";
import { fontWords, tableFont } from "./tableFonts";

const TIER_NAMES: Record<number, string[]> = { 1: ["the cake"], 2: ["the bottom tier", "the top tier"], 3: ["the bottom tier", "the middle tier", "the top tier"] };
// 2026-11-03 (the owner: "kötü bir render ışığı var, çok sarı, kaliteli durmuyor hiç … örnekteki ışık kalitesi iyi"):
// a bakery's product photograph — bright, clean, white, sharp.
const LIGHT = "Light it like a high-end bakery's product photograph: bright, clean, high-key white daylight from a large soft window, a true neutral white balance — whites stay pure white, never cream, ivory, beige, yellow or orange — gentle soft shadows, no sunbeams or patches of sunlight; crisp and sharp, every detail in focus, the colours fresh and clear.";

/** The words for the photograph: keep the scene, make it real. */
export function cakePrompt(k: Cake, view: CakeView = "whole"): string {
  // Each piece once, its copies counted: "gold star ×2".
  const named = (on: "top" | "side" | "any", kind: FigureKind) => CAKE_FIGURES.flatMap((f) => {
    const n = f.kind === kind ? k.figures.filter((i) => (on === "any" || i.on === on) && i.id === f.id).length : 0;
    return n ? [`${f.name.toLowerCase()}${n > 1 ? ` ×${n}` : ""}`] : [];
  });
  const figures = named("top", "sugar"), sides = named("side", "sugar");
  const cutTop = named("top", "cutout"), cutSide = named("side", "cutout");
  const decos = named("any", "deco");
  const t = k.topper;
  const tc = topperColour(t.colour);
  // What it stands on (2026-11-03, the owner: "3 katlı olunca alttaki cake holder'ın ayaksızı olsun").
  const onBoard = holderOf(k).board;
  const holder = onBoard ? "a wide round white cake board" : "a white cake stand";
  const words = [t.name.trim(), t.age].filter(Boolean).map((w) => `"${w}"`).join(" and ");
  const lettering = fontWords(tableFont(t.font)).replace(", all capitals", "");
  const card = t.card ? TOPPER_CARDS.find((c) => c.id === t.card)!.words.replace("white", t.cardColour ? colourWords(t.cardColour) : "white") : "";
  // On the front or the board the name is real cake lettering, as in the owner's examples (2026-11-03: "renderda
  // yapay çıkmasın, pastanın üstünde bu örneklerdeki gibi olsun"): letters cut from sugar paste, with a thickness and
  // a shadow — painted with a metal's shine, or in her colour. On top, on sticks, acrylic.
  const sugar = tc.shiny ? `${tc.name.toLowerCase()}-painted sugar-paste letters with a soft metallic shine` : `${tc.words} sugar-paste letters`;
  const real = "real hand-cut sugar-paste (fondant) letters a few millimetres thick with soft rounded edges, each with its own small soft shadow — never flat print, never pasted on";
  const topper = !topperShows(k) ? ""
    : t.at === "board"
      ? `On the ${onBoard ? "cake board" : "cake stand's plate"} at the foot of the cake, in front of it, keep the name exactly where image 1 has it: ${sugar} reading ${words}, ${lettering}, standing upright and leaning lightly against the bottom tier — ${real}; the same letters in the same colour as image 1.`
      : t.at === "front"
        ? `On the front of the cake keep the name exactly where image 1 has it: ${card ? `${card} with a thin ${tc.name.toLowerCase()} border pressed flat onto the buttercream, with ${sugar} reading ${words}, ${lettering}, on it` : `${sugar} reading ${words}, ${lettering}, pressed onto the buttercream`} — ${real}; the same letters in the same colour as image 1.`
        : `Keep the cake topper exactly: ${card ? `${card} with a thin ${tc.name.toLowerCase()} border on two thin white sticks pushed into the top, with ${tc.words} printed letters reading ${words}, ${lettering}, on it` : `${tc.words} acrylic letters reading ${words}, ${lettering}, on two thin sticks pushed into the top`}, the same letters in the same colour as image 1.`;
  const colours = tierColours(k);
  const rainbow = colours.flatMap((c, i) => (rainbowOf(c) ? [`${TIER_NAMES[k.tiers][i]} in ${rainbowOf(c)!.words}`] : []));
  const sprinkles = CAKE_SPRINKLES.find((s) => s.id === k.sprinkles);
  // Each sweet as it shows.
  const said = (id: string) => CAKE_FIGURES.find((f) => f.id === id);
  const sweetWords = (id: string) => {
    const kind = CAKE_SWEETS.find((x) => x.id === id), sw = k.sweets?.find((x) => x.id === id);
    if (!kind || !sw) return "";
    const top = sw.topper ? `, each topped with a little ${said(sw.topper)!.kind === "cutout" ? "printed card" : "sugar-paste"} ${said(sw.topper)!.name.toLowerCase()}` : "";
    const print = sw.print ? `, each printed with ${sw.print === "age" ? `the number "${t.age || "1"}"` : `a little ${said(sw.print)!.name.toLowerCase()}`}` : "";
    return `${kind.words(colourWords(sw.colour))}${top}${print}${sw.sprinkles ? ", with rainbow sprinkles" : ""}`;
  };
  const sweets = CAKE_SWEETS.map((s) => sweetWords(s.id)).filter(Boolean);
  // On the sweet cart: the cake and the sweets on its counter, under its flat wooden roof (2026-11-03, the owner:
  // "stripe olmasın artık"), and her balloons up its side if she wants them.
  const roof = `a flat ${colourWords(k.cart?.awning ?? "#FFFFFF")} wooden roof with a scalloped trim`;
  const cart = k.cart ? `a white wooden sweet cart with ${roof}` : "";
  const balloons = k.cart?.balloons?.length
    ? `a full organic garland of real matte latex balloons in ${Array.from(new Set(k.cart.balloons.map(colourWords))).join(", ")}, of mixed sizes, rising from the floor up the cart's left side and over the left of its roof`
    : "";
  // On the plinths (2026-11-03): the cake on the tall middle one, each sweet on its own.
  const plinths = !k.cart && !!k.plinths;
  const where = cart ? `on the counter of ${cart}` : plinths ? "on top of a tall round white plinth, the middle one of a party dessert display of white round plinths before a plain wall" : "on a table";
  const characters = cutTop.length + cutSide.length > 0 || (k.sweets ?? []).some((x) => [x.topper, x.print].some((p) => p && p !== "age" && said(p)?.kind === "cutout"));

  // A sweet close up: only it, made real; the rest as it is, out of focus.
  const these = view !== "whole" && view !== "cake" ? sweetWords(view) : "";
  if (these) return [
    `Image 1 is a close-up preview of ${these}, ${cart ? `on the counter of ${cart}` : plinths ? "on a round white plinth" : "on a table"} at a birthday party, beside the birthday cake.`,
    "Make it one real, natural close-up photograph of exactly these, from the same camera position and with the same framing, every piece the same size and in the same place: real and freshly made, the same colours, toppers, prints and sprinkles as image 1 shows them, appetising.",
    `Keep the background as image 1 has it — the ${cart ? "cart" : plinths ? "plinths" : "table"}, the wall and whatever else shows at the edges of the picture — softly out of focus.`,
    LIGHT,
    `Nothing added and nothing taken away: no candles, ${characters ? "no real people or hands, no characters beyond the printed pictures" : "no people, no hands, no characters"}, no fresh flowers, no extra words or letters.`,
  ].join(" ");
  const close = view === "cake";
  const wide = !close && (!!cart || plinths || sweets.length > 0);
  return [
    `Image 1 is a ${close ? "close-up " : ""}preview of a birthday cake standing on ${holder} ${where}: ${cakeWords(k)}.`,
    wide
      ? `Make it one real, natural photograph of exactly this scene, from the same camera position and with the same framing — the whole ${cart ? "sweet cart" : plinths ? "display" : "table"} in view, never zoomed in or cropped — every part the same size and in the same place.`
      : "Make it one real, natural close-up photograph of exactly this cake, from the same camera position, with the same framing and every part the same size and in the same place.",
    `Keep the cake exactly: ${k.tiers > 1 ? `exactly ${k.tiers === 2 ? "two" : "three"} tiers stacked, never more and never fewer, each in its own colour as image 1 shows it` : "one single tier, the same colour as image 1"}, the same decoration, each figure once and only where image 1 has it, made of real smooth buttercream with its fine texture.`,
    rainbow.length ? `${rainbow.join("; ")} — keep its colours and patches as image 1 shows them.` : "",
    sprinkles?.words ? `Keep the sprinkles as image 1 shows them: ${sprinkles.words}, real sugar sprinkles.` : "",
    figures.length ? `On top keep the handmade sugar-paste figures exactly: ${figures.join(", ")} — the same shapes, colours, sizes and places, made real and matte.` : "",
    sides.length ? `Keep the sugar-paste figures stuck flat on the sides of the tiers exactly where image 1 has them: ${sides.join(", ")} — real and matte, pressed onto the buttercream.` : "",
    cutTop.length ? `On top keep the printed card cutout toppers exactly: ${cutTop.join(", ")} — flat glossy printed card with a thin white cut edge, each on a thin white stick pushed into the cake, the same pictures, sizes and places as image 1.` : "",
    cutSide.length ? `Keep the printed card cutouts stuck flat on the sides of the tiers exactly where image 1 has them: ${cutSide.join(", ")} — flat glossy printed card with a thin white cut edge.` : "",
    decos.length ? `Keep the small round decorations exactly where image 1 has them: ${decos.join(", ")} — real and shiny, on the top and round the foot of the cake.` : "",
    topper,
    close ? "Keep whatever else shows at the edges of the picture as it is, softly out of focus."
      : sweets.length ? `${plinths ? "On the other plinths, each on its own," : `On the ${cart ? "cart's counter" : "table"} beside the cake`} keep the sweets exactly where image 1 has them: ${sweets.join("; ")} — the same places, sizes and colours, made real.` : "",
    cart ? `Keep the ${onBoard ? "cake board" : "white cake stand"} and the sweet cart exactly as image 1 has them — its white wooden counter, its turned posts, its wheel and ${roof}, the same colour —${balloons ? ` ${balloons} exactly as image 1 has it, the same balloons in the same places and colours, —` : ""} and the floor and the wall behind it; a soft shadow under the cake.`
      : plinths ? `Keep the ${onBoard ? "cake board" : "white cake stand"} and the five white round plinths exactly as image 1 has them — their sizes, heights and places — and the floor and the wall behind them; a soft shadow under the cake.`
      : `Keep the ${onBoard ? "cake board" : "white cake stand"}, the table and the wall as they are; a soft shadow under the cake.`,
    LIGHT,
    `Nothing added and nothing taken away: no candles, ${characters ? "no real people or hands, no characters beyond the printed cutouts" : "no people, no hands, no characters"}, no fresh flowers, ${sprinkles?.words || k.sweets?.some((x) => x.sprinkles) ? "" : "no sprinkles, "}${sweets.length && !close ? "no other sweets or plates" : "no plates"}, no extra words or letters.`,
  ].filter(Boolean).join(" ");
}
