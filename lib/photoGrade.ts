// A real photo's finishing edit (2026-11-04, the owner, of a photo-editing guide — white balance, exposure, brightness,
// contrast, saturation, vibrance, highlights and shadows: "ayarları ona göre düzenle, istediğim canlılığı ver"): what a
// photographer does to a party shot before it is shown — the light's colour cast taken out, brighter, the shadows
// opened, a little contrast, and vibrance, which lifts the soft pastels more than the colours already strong.
import sharp from "sharp";

/** How far each step may go. */
const GRADE = {
  /** White balance: the light parts' cast taken out, at most this much per channel. */
  balance: 0.08,
  /** Exposure: the brightest parts (the 97th percentile of light) lifted towards this, by at most `lift` — on the
   * light alone, so a pastel brightened keeps its colour instead of fading into white where a channel would clip. */
  white: 246, lift: 0.12,
  /** Shadows: the dark tones opened, most at about a sixth of the way up, by up to ~0.6× this (of full white). */
  shadows: 0.1,
  /** Contrast: an S-curve, up to this much over its full strength (0 none, 1 strong). */
  contrast: 0.35,
  /** Vibrance: the softest colours made this much stronger, the strongest hardly at all; greys and whites left. */
  vibrance: 0.4,
  /** Saturation: every colour this much as well. */
  saturation: 0.05,
};

/** The photo graded (a JPEG in, a JPEG out, the same size). */
export async function gradePhoto(jpeg: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(jpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const lum = (i: number) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

  // White balance: the near-white, nearly grey parts (the wall, the cloth, a white tier) made neutral.
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 3) hist[Math.min(255, Math.round(lum(i)))]++;
  const at = (q: number) => { let c = 0; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= q * n) return v; } return 255; };
  const p97 = at(0.97), p85 = at(0.85), p50 = at(0.5);
  const sum = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < data.length; i += 3) {
    const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]);
    if (lum(i) >= p85 && mx - mn < 40) { sum[0] += data[i]; sum[1] += data[i + 1]; sum[2] += data[i + 2]; count++; }
  }
  const grey = count ? (sum[0] + sum[1] + sum[2]) / (3 * count) : 1;
  const wb = sum.map((s) => (count ? Math.min(1 + GRADE.balance, Math.max(1 - GRADE.balance, grey / (s / count))) : 1));
  // Exposure: the light parts towards white, never darker.
  const gain = Math.min(1 + GRADE.lift, Math.max(1, GRADE.white / Math.max(1, p97)));

  // The S's upper half lifts the light tones: on a photo already bright (its middle tone near white — the wall, the
  // cloth, a white cake) that only flattens them into one white (2026-11-04, the owner: "aşırı aydınlık ortam"), so it
  // fades out as the middle passes 175 and is gone by 215.
  const upper = Math.min(1, Math.max(0, (215 - p50) / 40));

  // One curve for the light: the exposure with a soft shoulder (no hard clip), shadows opened, an S of contrast.
  const curve = new Float32Array(256);
  for (let v = 0; v < 256; v++) {
    let x = (v / 255) * gain;
    // The shoulder reaches white where the exposure puts it (a photo needing none keeps its white white).
    if (gain > 1 && x > 0.85) x = 0.85 + (0.15 * Math.tanh((x - 0.85) / 0.15)) / Math.tanh((gain - 0.85) / 0.15);
    const d = Math.max(0, 1 - x / 0.5);
    x += GRADE.shadows * 4 * d * d * (x / 0.5); // nothing at black, nothing from the middle up
    x -= ((x > 0.5 ? upper : 1) * GRADE.contrast * Math.sin(2 * Math.PI * x)) / (2 * Math.PI); // darker below the middle, lighter above
    curve[v] = Math.min(1, Math.max(0, x)) * 255;
  }
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 3) {
    const r0 = data[i] * wb[0], g0 = data[i + 1] * wb[1], b0 = data[i + 2] * wb[2];
    // The light and the colour apart: the light through the curve, the colour (each channel's distance from it)
    // made livelier — more for the softer colours — and only cut back where it would pass white or black.
    const y = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
    const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0);
    const s = mx > 0 ? (mx - mn) / mx : 0;
    // The whites and greys (the wall, the cloth) take the whole lift; a colour less of it, so it is not lightened
    // into a paler one: a pastel near white has no room left for its colour.
    const y2 = y + (curve[Math.min(255, Math.max(0, Math.round(y)))] - y) * (1 - 0.7 * Math.min(1, s / 0.2));
    const ramp = Math.min(1, s / 0.08); // a grey or a white stays as it is
    let k = 1 + ramp * (GRADE.saturation + GRADE.vibrance * (1 - s));
    const cr = r0 - y, cg = g0 - y, cb = b0 - y;
    const up = Math.max(cr, cg, cb), down = Math.min(cr, cg, cb);
    if (up > 0) k = Math.min(k, (255 - y2) / up);
    if (down < 0) k = Math.min(k, -y2 / down);
    k = Math.max(0, k);
    out[i] = Math.min(255, Math.max(0, Math.round(y2 + cr * k)));
    out[i + 1] = Math.min(255, Math.max(0, Math.round(y2 + cg * k)));
    out[i + 2] = Math.min(255, Math.max(0, Math.round(y2 + cb * k)));
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
