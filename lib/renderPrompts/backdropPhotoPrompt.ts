// The backdrop's render made from the live sketch (2026-11-03, the owner: "live sketch ve render farklı oldu
// düzeltelim … text renderda çok kabarık duruyor flat olsun vinyl olacak çünkü … rainbow balonlar düzgün değil ve
// grafik çıkmamış"). The sketch is already a real photograph of the set-up with the customer's pieces laid on it
// (components/design/LiveSketch.tsx): her words, the theme's print, the standees, the balloon rainbows, the
// number and the neon. Made into one photograph by an edit model, the render keeps all of it where the sketch has
// it — as the kids' table's and the welcome board's renders do — instead of being drawn again from a layout guide.
import type { SceneModel } from "@/lib/buildSceneModel";
import { cutoutTotalCount } from "@/lib/config";
import { cleanLettering } from "@/lib/typography/lettering";

/** The words a board carries, as the sketch letters them. */
function boardWords(p: SceneModel["panels"][number]): string {
  if (!p.text?.enabled) return "";
  const l = cleanLettering(p.text.lettering);
  const lines = l ? [l.heading.text, l.name.text].map((t) => t.trim()).filter(Boolean) : [];
  return (lines.length ? lines.join(" ") : (p.text.value ?? "")).replace(/\s+/g, " ").trim();
}

/**
 * `wordsAfter`: the picture comes without her words, which are laid flat on the render afterwards
 * (lib/sketchRenderFinish.ts) — the boards are to be left as plain as image 1 shows them.
 */
export function backdropPhotoPrompt(scene: SceneModel, { wordsAfter = false } = {}): string {
  const words = scene.panels.map(boardWords).filter(Boolean);
  const printed = scene.panels.some((p) => p.graphic?.enabled);
  const standees = !!scene.cutouts && cutoutTotalCount(scene.cutouts) > 0;
  const balloons = scene.balloons.style !== "none";
  const neon = scene.neonSign?.enabled && scene.neonSign.text.trim() ? scene.neonSign.text.trim() : "";
  const number = scene.numberLight?.enabled && scene.numberLight.value.trim() ? scene.numberLight : null;
  return [
    "Image 1 is a preview of a children's party backdrop set-up: a real photograph of the set-up with some of its pieces laid on top of it.",
    "Make it one real, natural photograph of exactly this scene: the same camera position, the same framing and the same room, every piece in its place, at its size and in its colours — nothing added, nothing moved, nothing left out.",
    words.length && wordsAfter
      ? "The boards stay exactly as plain as image 1 shows them: no words, letters or numbers drawn on them — their lettering is added afterwards."
      : words.length
      ? `The lettering on the board${words.length > 1 ? "s" : ""} (${words.map((w) => `"${w}"`).join(" and ")}) stays exactly as image 1 has it — letter for letter, the same lettering, size, colour and place. It is FLAT cut vinyl: thin decal letters stuck flat on the board's surface, with no thickness — not raised, not puffy, not rounded, not 3D, not acrylic, not wooden, casting no shadow.`
      : "The boards carry no words.",
    printed ? "The artwork on the board is printed flat on its surface, exactly as image 1 shows it: the same picture, size and place, as a matte print — not a sticker, not raised, never left out." : "",
    standees ? "The standing character cut-outs are flat printed foam-board standees on the floor, exactly as image 1 shows them — the same pictures, sizes and places." : "",
    scene.rainbowBalloons && balloons ? "The balloon rainbows stay exactly where image 1 has them: long modelling balloons bent into rainbow arcs, each end in a cloud of small white balloons." : "",
    neon ? `The neon sign reading "${neon}" stays exactly as image 1 has it, glowing softly.` : "",
    number ? `The number "${number.value.trim()}" stays exactly as image 1 has it${number.style === "foil" ? ", a foil number balloon" : ", a light-up marquee number"}.` : "",
    balloons ? "Every balloon keeps its colour, size and place: matte latex balloons, with the chrome and clear ones as image 1 shows them." : "",
    "Soft, even, neutral daylight from the window — never yellow or orange — with natural soft shadows on the floor. Crisp, real textures: board, balloons, floor. No people, no faces other than the standees' own pictures, no logos, no extra words.",
  ].filter(Boolean).join(" ");
}
