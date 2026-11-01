// Which colour each balloon of the welcome board's garland takes (2026-11-01, the
// owner: "her tema bu rengi kullanamaz … temanın default balon renkleriyle,
// hatta userın son seçimleriyle match olması lazım"). The garland is one real
// photo split into its four latex colours and its chrome
// (scripts/welcome/garland-split.ts); each latex layer is tinted live to one of
// the party's balloon colours — the customer's own picks, which start as the
// theme's — and the chrome stays silver unless the party has gold chrome.

/** The photo's own layers, the most balloons first, with the colour each is in the photo and how much of it they are (welcomePieces.json). */
export const GARLAND_LAYERS = [
  { id: "white", photo: "#F2F1EC", share: 0.129 },
  { id: "pink", photo: "#EFB2B9", share: 0.111 },
  { id: "blue", photo: "#9FC5E8", share: 0.085 },
  { id: "lilac", photo: "#B39DDB", share: 0.083 },
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
const hex2 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0").toUpperCase();
function fromHsl(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${hex2(r + m)}${hex2(g + m)}${hex2(b + m)}`;
}
/** How light a coloured balloon is drawn at most, and how strong: the photo's own pink, blue and lilac are at 0.74–0.82, 0.47–0.68. */
export const MAX_COLOUR_LIGHT = 0.8;
const MAX_PASTEL_SAT = 0.7;
/**
 * The colour a balloon is drawn in (2026-11-01, the owner, of the photo's own garland: "burdaki gibi balonlar
 * daha renkleri birbirine karışmamış"): a palette's pale pastels (Ice Princess's ice blue and lilac, all but
 * white) as deep as the photo's balloons, so each colour reads apart from the next and from white; white
 * and the near-whites as they are; darker colours as they are.
 */
export function balloonBody(hex: string): string {
  const { h, s, l } = hsl(hex);
  // Creams and pale yellows read apart from white as they are (deeper, a cream went tan).
  if (l <= MAX_COLOUR_LIGHT || s < 0.2 || l > 0.93 || (h >= 35 && h <= 70)) return hex.toUpperCase();
  return fromHsl(h, Math.min(Math.max(s, 0.45), MAX_PASTEL_SAT), MAX_COLOUR_LIGHT);
}
const far = (a: string, b: string) => { const x = rgb(a), y = rgb(b); return 2 * (x[0] - y[0]) ** 2 + 4 * (x[1] - y[1]) ** 2 + 3 * (x[2] - y[2]) ** 2; };

/**
 * Each latex layer's colour, and the chrome's (null: as photographed, silver). The latex colours go to the
 * layers nearest them in the photo, so pastels stay where they were; a short palette goes round again.
 */
export function garlandColours(colours: string[]): { latex: Record<GarlandLayer, string>; chrome: string | null } {
  const valid = colours.filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  // Two all but the same colours (Ice Princess's white and its ice white) are one: twice white, half the
  // garland came out white, its shaded balloons grey.
  let latex = valid.filter((c, i) => balloonLook(c) === "latex" && !valid.slice(0, i).some((o) => balloonLook(o) === "latex" && far(o, c) < 2000));
  const gold = valid.find((c) => balloonLook(c) === "gold");
  if (!latex.length) latex = valid.length ? valid : GARLAND_LAYERS.map((l) => l.photo);
  const out = {} as Record<GarlandLayer, string>;
  // Once every colour has its layer, the rest go to the colours with the fewest balloons so far (by
  // nearness, one colour came out on half the garland).
  const left = [...latex], used = new Map<string, number>();
  for (const layer of GARLAND_LAYERS) {
    const from = left.length ? left : latex.filter((c) => used.get(c) === Math.min(...latex.map((x) => used.get(x) ?? 0)));
    const pick = from.reduce((a, b) => (far(b, layer.photo) < far(a, layer.photo) ? b : a));
    out[layer.id] = pick;
    used.set(pick, (used.get(pick) ?? 0) + layer.share);
    if (left.includes(pick)) left.splice(left.indexOf(pick), 1);
  }
  return { latex: out, chrome: gold ?? null };
}
