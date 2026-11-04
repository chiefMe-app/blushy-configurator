// A colour's name for the renders, on its own (2026-11-04): kept in cakeSweets.ts it pulled the cake in with it, and
// cake.ts and cakeSweets.ts import each other, so the helium balloons' words loading it first broke the cake's.

/** A colour's name for the render (the theme's hexes have none): near what it is. */
export function colourWords(hex: string): string {
  const h = hex.toUpperCase();
  if (h === "#FFFFFF") return "white";
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510;
  if (max - min < 24) return l > 0.85 ? "white" : l > 0.4 ? "grey" : "black";
  let hue = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  const name = hue < 15 || hue >= 340 ? (l > 0.7 ? "pink" : "red") : hue < 40 ? (l > 0.7 ? "peach" : "orange") : hue < 65 ? "yellow" : hue < 165 ? (l > 0.7 ? "mint green" : "green")
    : hue < 200 ? (l > 0.7 ? "aqua" : "teal") : hue < 250 ? (l > 0.7 ? "baby blue" : "blue") : hue < 290 ? (l > 0.7 ? "lilac" : "purple") : l > 0.7 ? "pink" : "fuchsia";
  return `${l > 0.78 && !/pink|peach|mint|aqua|baby|lilac/.test(name) ? "pastel " : ""}${name}`;
}
