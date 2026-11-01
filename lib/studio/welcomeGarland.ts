// Which colour each balloon of the welcome board's garland takes (2026-11-01, the
// owner: "her tema bu rengi kullanamaz … temanın default balon renkleriyle,
// hatta userın son seçimleriyle match olması lazım"). The garland is one real
// photo split into its four latex colours and its chrome
// (scripts/welcome/garland-split.ts); each latex layer is tinted live to one of
// the party's balloon colours — the customer's own picks, which start as the
// theme's — and the chrome stays silver unless the party has gold chrome.

/** The photo's own layers, the most balloons first, with the colour each is in the photo. */
export const GARLAND_LAYERS = [
  { id: "white", photo: "#F2F1EC" },
  { id: "pink", photo: "#EFB2B9" },
  { id: "blue", photo: "#9FC5E8" },
  { id: "lilac", photo: "#B39DDB" },
] as const;
export type GarlandLayer = (typeof GARLAND_LAYERS)[number]["id"];

const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function hsl(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
/** How a balloon colour reads: silver or gold chrome, or latex (the swatches' own rule of thumb). */
export function balloonLook(hex: string): "silver" | "gold" | "latex" {
  const { h, s, l } = hsl(hex);
  if (s < 0.12 && l > 0.45 && l < 0.92) return "silver";
  if (h >= 35 && h <= 60 && s > 0.35 && l < 0.62) return "gold";
  return "latex";
}
const far = (a: string, b: string) => { const x = rgb(a), y = rgb(b); return 2 * (x[0] - y[0]) ** 2 + 4 * (x[1] - y[1]) ** 2 + 3 * (x[2] - y[2]) ** 2; };

/**
 * Each latex layer's colour, and the chrome's (null: as photographed, silver). The latex colours go to the
 * layers nearest them in the photo, so pastels stay where they were; a short palette goes round again.
 */
export function garlandColours(colours: string[]): { latex: Record<GarlandLayer, string>; chrome: string | null } {
  const valid = colours.filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  let latex = valid.filter((c) => balloonLook(c) === "latex");
  const gold = valid.find((c) => balloonLook(c) === "gold");
  if (!latex.length) latex = valid.length ? valid : GARLAND_LAYERS.map((l) => l.photo);
  const out = {} as Record<GarlandLayer, string>;
  let left = [...latex];
  for (const layer of GARLAND_LAYERS) {
    if (!left.length) left = [...latex];
    const pick = left.reduce((a, b) => (far(b, layer.photo) < far(a, layer.photo) ? b : a));
    out[layer.id] = pick;
    left.splice(left.indexOf(pick), 1);
  }
  return { latex: out, chrome: gold ?? null };
}
