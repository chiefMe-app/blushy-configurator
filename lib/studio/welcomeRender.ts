// The real render of the welcome board (2026-10-31, the owner: "bu seçeneklerin
// renderını alıp preview'a koyalım, table setup ve backdrop'ta yaptığımız
// gibi"). The one picture sent is the board exactly as the builder draws it —
// its printed face with the customer's words, and the easel — made into a
// picture in the customer's browser, which has the lettering's fonts
// (components/builder/welcome/boardPicture.ts). The balloons and flowers are
// left out of it and asked for in words: drawn, they came back as flat circles
// and paper rosettes, and the option photo sent with them lent its pink
// balloons to every party (2026-10-31 test renders). Shared by the API route
// (the prompt) and the builder (is the render still current?).
import { boardFace, type WelcomeBoard } from "./welcomeBoard";
import { asPrinted, tableFont } from "./tableFonts";

export type { WelcomeRender } from "./welcomeBoard";

/** Changes whenever anything that shows in the picture changes: the board, the theme, the party's balloon colours. */
export function welcomeRenderKey(b: WelcomeBoard, themeId: string, balloons: string[] = []): string {
  const { render: _r, done: _d, ...shown } = b;
  const s = JSON.stringify([themeId, Object.entries(shown).sort(), b.garnish === "none" || b.garnish === "flowers" ? [] : balloons]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

const SHAPE_WORDS: Record<WelcomeBoard["shape"], string> = {
  rectangle: "rectangular, portrait-format",
  arch: "arch-topped (a tall rectangle with a fully rounded top)",
  round: "perfectly round",
};

/**
 * A balloon colour in words, from its hue and lightness (the generic namer
 * called the theme's lilac "ivory", and the render then took its colours from
 * the option photo instead).
 */
export function balloonColourName(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  if (l > 0.93 && s < 0.45) return "white";
  if (s < 0.12) return l > 0.7 ? "silver" : l > 0.3 ? "grey" : "black";
  const h = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  const hue = h < 15 ? "red" : h < 40 ? (l > 0.7 ? "peach" : "orange") : h < 65 ? (l < 0.6 ? "gold" : "yellow") : h < 165 ? "green" : h < 190 ? "turquoise" : h < 245 ? "blue" : h < 290 ? "lilac" : h < 345 ? "pink" : "red";
  // A pale red is a pink.
  return l > 0.75 ? `pastel ${hue === "red" ? "pink" : hue}` : l < 0.32 ? `deep ${hue}` : hue;
}

/** The words for the render, sent with the board's drawing. */
export function welcomePrompt(b: WelcomeBoard, balloons: string[]): string {
  const face = boardFace(b);
  const font = tableFont(b.font);
  const words = [b.heading.trim().toUpperCase(), b.name.trim() ? asPrinted(b.name.trim(), font) : "", b.line.trim().toUpperCase()].filter(Boolean);
  const garland = b.garnish === "balloons" || b.garnish === "both";
  const flowers = b.garnish === "flowers" || b.garnish === "both";
  const colours = Array.from(new Set(balloons.map(balloonColourName))).join(", ");
  const acrylic = b.material === "acrylic";
  return [
    `The image is a flat drawing of a ${SHAPE_WORDS[b.shape]} printed welcome sign, ${face.w} cm wide and ${face.h} cm tall, ${b.stand === "easel" ? "on a white wooden display easel" : "with no stand"}.`,
    "Turn it into a real photograph of this welcome sign standing at the entrance of a party. Keep the sign's exact shape and proportions, and keep it where the drawing has it, seen straight on.",
    b.shape === "arch" ? "Its rounded arch top stays fully visible and clearly round — nothing covers it." : "",
    `The sign's face in the drawing is the exact print: reproduce it exactly as real print on the board — the same design, the same painted shapes and colours, and the same words in the same lettering, size, colour and place${words.length ? `: ${words.map((w) => `"${w}"`).join(", then ")}` : ""}. Every letter there, spelled exactly like that, none added, none changed. No other writing anywhere in the picture.`,
    // 2026-10-31 test: the round board's painted corners were dropped.
    b.design === "corners" ? "The soft watercolour motifs painted around the sign's edges are part of its print: keep every one of them, in the same place, size and colours." : "",
    acrylic ? "The sign is a glossy acrylic board with a polished, clear 5 mm edge catching the light." : "The sign is a smooth, flat, matt printed board with a clean, crisp, thin white edge — no texture on its face or edges.",
    b.stand === "easel" ? "It stands on a simple white wooden A-frame display easel, exactly where the drawing has the easel." : "It hangs flat on the wall with no stand.",
    garland ? `In the empty space to the right of the sign stands a real, lush, full organic balloon garland — many round latex balloons of mixed sizes, big, medium and small, clustered tightly${colours ? `, ONLY in ${colours}` : ""} — rising from the floor up the sign's right side to about its top${b.shape === "arch" ? ", beside the arch, not over it" : ""}, overlapping its right edge a little, without covering any words.${colours ? ` No balloon in any colour that is not listed — no pink unless pink is listed.` : ""}` : "No balloons.",
    flowers ? `A lush cluster of real-looking white and ivory silk roses with soft green leaves is fixed on the sign's ${b.shape === "round" ? "upper-left edge, and a second one on its lower-right edge" : garland ? "top-left corner, with a few more roses tucked into the garland" : "top-left corner, and a second one on its bottom-right corner"}, over the edge of the print but not over any words.` : "No flowers.",
    "Nothing of the drawing itself may remain — no outlines, no flat colours.",
    "In a bright, airy party venue with a pale wall and a light floor, soft natural daylight, the sign sharp and the background softly out of focus.",
    "Photo-real event-styling photograph, crisp fine detail, shot straight on at eye level. No people, no characters, no faces, no logos.",
  ].filter(Boolean).join(" ");
}
