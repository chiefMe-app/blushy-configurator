// The words for the cake's render (app/api/cake-render/route.ts, 2026-11-03): keep the scene of the live preview
// exactly — the cake on its white stand, close up — and make it one real photograph.
import { CAKE_FIGURES, cakeWords, topperColour, topperShows, type Cake } from "./cake";
import { fontWords, tableFont } from "./tableFonts";

/** The words for the photograph: keep the scene, make it real. */
export function cakePrompt(k: Cake): string {
  const figures = k.figures.map((f) => CAKE_FIGURES.find((x) => x.id === f)!.name.toLowerCase());
  const words = [k.topper.name.trim(), k.topper.age].filter(Boolean).map((w) => `"${w}"`).join(" and ");
  const face = tableFont(k.topper.font);
  return [
    `Image 1 is a preview of a birthday cake standing on a white cake stand on a table: ${cakeWords(k)}.`,
    "Make it one real, natural close-up photograph of exactly this cake, from the same camera position, with the same framing and every part the same size and in the same place.",
    `Keep the cake exactly: ${k.tiers > 1 ? "the same tiers, each in its own colour as image 1 shows it" : "the same colour as image 1"}, the same decoration, made of real soft buttercream with its texture.`,
    figures.length ? `On top keep the handmade sugar-paste figures exactly: ${figures.join(", ")} — the same shapes, colours and places, made real and matte.` : "",
    topperShows(k) ? `Keep the cake topper exactly: ${topperColour(k.topper.colour).words} acrylic on two thin sticks pushed into the top, reading ${words}, ${fontWords(face).replace(", all capitals", "")}, the same letters in the same colour as image 1.` : "",
    "Keep the white cake stand, the table and the wall as they are; a soft shadow under the cake on the stand's plate.",
    "Make the light real: soft, even, neutral daylight, gentle natural shadows — never yellow or orange light, no sunbeams or patches of sunlight.",
    "Nothing added and nothing taken away: no candles, no people, no hands, no characters, no fresh flowers, no sprinkles, no plates, no extra words or letters.",
  ].filter(Boolean).join(" ");
}

