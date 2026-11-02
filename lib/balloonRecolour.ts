// A set photo's balloon family repainted in another colour (2026-11-02, the owner on a fuchsia family turned
// pastel rose: "boyanmış gibi duruyor"). Mapped in CIE Lab, so a balloon keeps its light and shade whatever
// the target's lightness: each pixel's light is taken relative to its family's mean — as a ratio of luminance,
// the way a shadow darkens any colour — and set on the target's; a highlight that would run past white rolls
// off softly instead of clipping flat. Hue and colour come from the target, dimmed in shadow and whitened
// in a sheen as the light is.

export type Rgb = [number, number, number];
export type Lab = [number, number, number];

const LIN = Array.from({ length: 256 }, (_, c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
const gam = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const XN = 0.95047, ZN = 1.08883;
const E = 216 / 24389, K = 24389 / 27;
const f = (t: number) => (t > E ? Math.cbrt(t) : (K * t + 16) / 116);
const fInv = (t: number) => { const t3 = t * t * t; return t3 > E ? t3 : (116 * t - 16) / K; };
/** Relative luminance (0–1) of a lightness, and back. */
const yOfL = (L: number) => fInv((L + 16) / 116);
const lOfY = (y: number) => 116 * f(y) - 16;

export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = LIN[r | 0], G = LIN[g | 0], B = LIN[b | 0];
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / XN);
  const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToLinear(L: number, a: number, b: number): Rgb {
  const fy = (L + 16) / 116;
  const x = XN * fInv(fy + a / 500), y = fInv(fy), z = ZN * fInv(fy - b / 200);
  return [3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z];
}
const inGamut = (c: Rgb) => c.every((v) => v >= -1e-4 && v <= 1.0001);

/** sRGB of a Lab colour; out of gamut, its chroma is reduced (hue and lightness kept) until it fits. */
export function labToRgb(L: number, a: number, b: number): Rgb {
  let lin = labToLinear(L, a, b);
  if (!inGamut(lin)) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const m = (lo + hi) / 2;
      if (inGamut(labToLinear(L, a * m, b * m))) lo = m; else hi = m;
    }
    lin = labToLinear(L, a * lo, b * lo);
  }
  return lin.map((v) => Math.max(0, Math.min(255, Math.round(gam(Math.max(0, Math.min(1, v))))))) as Rgb;
}

/** A set colour of a shot: its swatch, and its family's mean as photographed (both Lab). */
export type ShotColour = { swatch: Lab; photo: Lab };
/** The least of its colour a swatch keeps as photographed (the yellow and green swatches are far louder than
 *  the balloons, and their halving made a peach beige). */
const C_KEPT = 0.75;
/** How far (Lab ΔE) a set colour may be from a swatch before the swatch's own colour counts more. */
const FAR = 30;

/**
 * A swatch colour as the shot would have photographed it (a repaint in the raw swatch stood out lighter and
 * louder than the balloons around it, flat as paint): its luminance and chroma changed as the shot changed
 * its own set colours', the nearest of them (in Lab) counting most. A swatch hex is only a guess at the
 * balloon, so one far off counts little: Pastel Matte 650 Lilac photographs 28 L under its swatch, 609 Pink 8.
 */
export function asPhotographed(swatch: Lab, shot: ShotColour[]): Lab {
  const C = (p: Lab) => Math.hypot(p[1], p[2]);
  // The swatch as it is counts as a set colour FAR away: one far from every set colour (Fuchsia on the
  // pastel shot) keeps nearly its own colour, not a guess from pastels' (it went a dark berry).
  let w = 1 / (FAR * FAR), y = w, c = w;
  for (const p of shot) {
    if (C(p.swatch) < 8) continue; // white, silver, clear: no colour to go by
    const d = Math.hypot(swatch[0] - p.swatch[0], swatch[1] - p.swatch[1], swatch[2] - p.swatch[2]);
    const k = 1 / Math.max(1, d * d);
    w += k; y += k * (yOfL(p.photo[0]) / yOfL(p.swatch[0])); c += k * (C(p.photo) / C(p.swatch));
  }
  const kc = Math.max(C_KEPT, Math.min(1, c / w));
  return [Math.min(L_TOP, lOfY(Math.min(1, (yOfL(swatch[0]) * y) / w))), swatch[1] * kc, swatch[2] * kc];
}

/** Lightness never reached by a repainted balloon's sheen: it rolls off towards this instead. */
const L_TOP = 98;
/** How much darker (L) than its family a target must be for the family's contrast to double. */
const DARKER = 30;
/** How much of its colour a sheen loses at its brightest: at L_TOP, or SHEEN_L over the target on a dark one. */
const SHEEN_WHITE = 0.6, SHEEN_L = 30;

/** One pixel (Lab) of a family with mean lightness `famL`, repainted in `target` (Lab). */
export function recolourPixel(px: Lab, famL: number, target: Lab): Lab {
  const L = px[0], [Lt, at, bt] = target;
  // Light as a luminance ratio to the family's mean, on the target's own luminance. Made much darker, a
  // family takes up to twice the contrast: a soft pastel's light alone left Royal Blue flat as paint, where a
  // dark glossy balloon in the same light shows deep shade and a bright sheen.
  const deeper = 1 + Math.max(0, Math.min(1, (famL - Lt) / DARKER));
  let Lo = lOfY(yOfL(Lt) * (yOfL(L) / Math.max(1e-4, yOfL(famL))) ** deeper);
  if (Lo > Lt) {
    const room = Math.max(1, L_TOP - Lt);
    Lo = Lt + room * (1 - Math.exp(-(Lo - Lt) / room));
  }
  // Colourfulness follows the new light, not the pixel's own (in a pale photo that is mostly compression
  // noise, and came out blotchy): a shadow dims it as it dims the light, a sheen whitens it.
  const k = Lo <= Lt ? (Lo + 16) / (Lt + 16) : 1 - SHEEN_WHITE * Math.min(1, (Lo - Lt) / Math.max(1, Math.min(SHEEN_L, L_TOP - Lt)));
  return [Lo, at * k, bt * k];
}
