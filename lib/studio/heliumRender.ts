// The words for the helium balloons' render (app/api/helium-render/route.ts, 2026-11-04): keep the scene of the live
// preview exactly — the bouquets, the foils, the ceiling balloons and the bubble in the empty room — and make it one
// real photograph, in the light the owner signed off on the cake's ("oldu sanki"): bright, well exposed. Her first
// look: "balon daha gerçek gözüksün renderda özellikle" — every balloon a real one as a camera sees it, the drawn
// weights made real; the wall white. Then "neden gerçek balon gibi durmuyor şu pembe ve morlar?": told to keep every
// balloon "exactly" as drawn, it kept the drawn latex discs, so the latex ones are now called stand-ins to photograph
// anew in their colour. And "buralardaki gibi gerçek balon gibi gözükmeli" (a professional balloon garland photo):
// that look in words — soft diffused light, matte rubber with a gentle sheen, soft shadows where balloons touch.
import { heliumWords, latexColourName, type Helium } from "./helium";
import { heliumLayout } from "./heliumLayout";

const LIGHT = "Light and colour it like a bright, cheerful, well-exposed kids' birthday party photo: soft, even daylight from the front, never overexposed, the white wall and the white panels keeping their soft shading; a fresh, clean white balance, never yellow; the balloons' colours clear and candy-bright, true to the colours of image 1, never darker or greyed; only soft, faint shadows, no direct sunlight, no glare.";

/**
 * How many of each colour each bouquet has (FLUX swapped a 4 + 3 bouquet to 2 + 5 when only told "the same
 * colour"), once when they are all alike.
 */
function bouquetCounts(h: Helium): string {
  const per = heliumLayout(h).bouquets.map((q) => {
    const n = new Map<string, number>();
    for (const b of q.balloons) n.set(b.sempertex, (n.get(b.sempertex) ?? 0) + 1);
    return Array.from(n).sort((a, b) => b[1] - a[1]).map(([c, k]) => `${k} ${latexColourName(c)}`);
  });
  if (!per.length || per[0].length < 2) return "";
  const list = (p: string[]) => `${p.slice(0, -1).join(", ")} and ${p.at(-1)}`;
  if (per.every((p) => p.join() === per[0].join())) {
    return `${per.length > 1 ? "Each bouquet's" : "The bouquet's"} latex balloons are exactly ${list(per[0])}, each in the colour and the place image 1 shows.`;
  }
  return `The bouquets' latex balloons, from left to right, are exactly ${per.map(list).join("; ")}, each in the colour and the place image 1 shows.`;
}

/** The words for the photograph: keep the scene, make it real. */
export function heliumPrompt(h: Helium): string {
  const parts = heliumWords(h);
  return [
    `Image 1 is a drawn preview of an empty children's party room decorated with helium balloons: ${parts.join("; ")}.`,
    "Make it one real, natural photograph of exactly this scene, taken with a camera, from the same camera position, with the same framing and every balloon the same size, in the same colour and in the same place — nothing moved, added or left out.",
    "The latex balloons in image 1 are only drawn stand-ins: photograph each one anew as a real 11-inch Sempertex latex balloon of that colour and finish, true to life and never drawn, illustrated, smooth CGI or 3D-rendered — real rubber with its natural soft gradient from a soft bright highlight where the light falls to a deeper, richer shade at its edge, light glowing faintly through the rubber, slightly pear-shaped with a short stretched neck and a small tied knot, each one a little different in shape and a touch uneven in size as real balloons are blown, deep colours staying rich and pastel ones soft; the Reflex and metallic ones a real shiny chrome or pearly metallic finish reflecting the room, the clear ones see-through. Photograph them the way a professional balloon decorator's portfolio photo shows balloons: soft, diffused light, a smooth matte finish with one gentle soft highlight each, soft natural shadows where the balloons touch and overlap, clear depth between the front balloons and the ones behind.",
    "Rebuild every other balloon as a real helium balloon too: the foil ones shiny metallic with puffy crinkled seams along their edges and soft reflections of the room, each printed foil keeping its own picture and colours; real thin curling ribbons; the weights on the floor real small foil-wrapped balloon weights; any bubble balloon truly clear and see-through with its lettering flat on it.",
    bouquetCounts(h),
    h.letters.on && h.letters.text ? `The foil letters spell exactly ${h.letters.text.split("").join(" ")}, in this order, each letter once.` : "",
    h.number.on && h.number.value ? `The foil number reads exactly ${h.number.value}.` : "",
    LIGHT,
    "Keep the room as it is: the white wall, the white panelled wainscoting, the white ceiling and the oak floor. Nothing added: no people, no characters, no furniture, no words or letters beyond those in image 1.",
  ].filter(Boolean).join(" ");
}
