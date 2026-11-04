// The words for the helium balloons' render (app/api/helium-render/route.ts, 2026-11-04): keep the scene of the live
// preview exactly — the bouquets, the foils, the ceiling balloons and the bubble in the empty room — and make it one
// real photograph, in the light the owner signed off on the cake's ("oldu sanki"): bright, well exposed. Her first
// look: "balon daha gerçek gözüksün renderda özellikle" — every balloon a real one as a camera sees it, the drawn
// weights made real; the wall white.
import { heliumWords, type Helium } from "./helium";

const LIGHT = "Light and colour it like a bright, cheerful, well-exposed kids' birthday party photo: soft, even daylight from the front, never overexposed, the white wall and the white panels keeping their soft shading; a fresh, clean white balance, never yellow; the balloons' colours clear and candy-bright, exactly as image 1 shows them, never darker or greyed; only soft, faint shadows, no direct sunlight, no glare.";

/** The words for the photograph: keep the scene, make it real. */
export function heliumPrompt(h: Helium): string {
  const parts = heliumWords(h);
  return [
    `Image 1 is a drawn preview of an empty children's party room decorated with helium balloons: ${parts.join("; ")}.`,
    "Make it one real, natural photograph of exactly this scene, taken with a camera, from the same camera position, with the same framing and every balloon the same size, in the same colour and in the same place — nothing moved, added or left out.",
    "Rebuild every balloon as a real helium balloon, true to life and never drawn, illustrated or 3D-rendered: the latex ones round, slightly pear-shaped and matte with a soft satin sheen, a little light glowing through their rubber, each with its small tied knot, a touch uneven in size as real balloons are blown; the foil ones shiny metallic with puffy crinkled seams along their edges and soft reflections of the room, each printed foil keeping its own picture and colours; real thin curling ribbons; the weights on the floor real small foil-wrapped balloon weights; any bubble balloon truly clear and see-through with its lettering flat on it.",
    h.letters.on && h.letters.text ? `The foil letters spell exactly ${h.letters.text.split("").join(" ")}, in this order, each letter once.` : "",
    h.number.on && h.number.value ? `The foil number reads exactly ${h.number.value}.` : "",
    LIGHT,
    "Keep the room as it is: the white wall, the white panelled wainscoting, the white ceiling and the oak floor. Nothing added: no people, no characters, no furniture, no words or letters beyond those in image 1.",
  ].filter(Boolean).join(" ");
}
