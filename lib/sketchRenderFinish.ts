// The backdrop's render made from the live sketch, finished (2026-11-03, the owner: "live sketch ve render farklı
// oldu … text renderda çok kabarık duruyor flat olsun vinyl olacak çünkü"). In the test the edit model kept the
// layout, the print and the rainbows but redrew her lettering — another font, another colour, raised — and warmed
// the light. So the words are left out of the picture it is given and laid back on afterwards, as the sketch draws
// them: flat cut vinyl, letter for letter. And its colours are brought back to the sketch's, a gain per channel.
import sharp from "sharp";

/** How far the colour match may go, per channel: the render's own light is kept beyond that. */
const MAX_GAIN = 0.15;

/** Per-channel gains that bring the render's average colour to the sketch's. */
export async function colourGains(render: Buffer, sketch: Buffer): Promise<[number, number, number]> {
  const [r, s] = await Promise.all([render, sketch].map((b) => sharp(b).removeAlpha().resize(256, 256, { fit: "fill" }).stats()));
  return [0, 1, 2].map((c) => {
    const g = s.channels[c].mean / Math.max(1, r.channels[c].mean);
    return Math.min(1 + MAX_GAIN, Math.max(1 - MAX_GAIN, g));
  }) as [number, number, number];
}

/**
 * The render with the sketch's colours and, when it has any, the sketch's words laid flat on it — or (`shadow`,
 * 2026-11-03, the giveaways' boxes) things standing in the scene, each with a soft contact shadow under it.
 */
export async function finishSketchRender(render: Buffer, sketch: Buffer, words?: Buffer, { shadow = false, cast = false } = {}): Promise<Buffer> {
  const { width = 1024, height = 1024 } = await sharp(render).metadata();
  let gains = await colourGains(render, sketch);
  // `cast` (2026-11-04, the cake: "aşırı aydınlık ortam"): only the colour's cast matched, the render's own exposure
  // kept — the bright sketch had lifted an already bright photo by a twelfth, and the photo is graded after.
  if (cast) {
    const y = 0.2126 * gains[0] + 0.7152 * gains[1] + 0.0722 * gains[2];
    gains = gains.map((g) => g / y) as [number, number, number];
  }
  const lit = await brightened(render, gains);
  let img = sharp(lit.data, { raw: { width: lit.info.width, height: lit.info.height, channels: 3 } });
  if (words) {
    // The words drawn at the sketch's own square, so at the render's (made at the sketch's size).
    const layer = await sharp(words).resize(width, height, { fit: "fill" }).ensureAlpha().png().toBuffer();
    if (shadow) {
      // Things standing in the scene (2026-11-05, the owner, of the giveaway board's render: "render gerçekçi
      // durmuyor" — the boxes looked pasted on): set into the render's own light, each with its shadows.
      const base = await img.png().toBuffer();
      img = sharp(await standIn(base, layer, width, height));
    } else img = img.composite([{ input: layer }]);
  }
  return img.jpeg({ quality: 90 }).toBuffer();
}

/**
 * The render's channels times their gains, a gain above 1 easing into white instead of clipping (2026-11-04: a plain
 * multiply burned a fifth of a bright cake photo — its white tiers, wall and cloth — to flat 255).
 */
async function brightened(render: Buffer, gains: [number, number, number]) {
  const { data, info } = await sharp(render).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const curves = gains.map((g) => Uint8Array.from({ length: 256 }, (_, v) => {
    let x = (v / 255) * g;
    if (g > 1 && x > 0.8) x = 0.8 + 0.2 * Math.tanh((x - 0.8) / 0.2);
    return Math.round(Math.min(1, x) * 255);
  }));
  for (let i = 0; i < data.length; i += 3) {
    data[i] = curves[0][data[i]]; data[i + 1] = curves[1][data[i + 1]]; data[i + 2] = curves[2][data[i + 2]];
  }
  return { data, info };
}

/** A layer's shadow: its shape blurred, moved by (dx, dy), at an opacity — a soft neutral grey, never black. */
async function shadowOf(layer: Buffer, w: number, h: number, { blur, dx, dy, opacity }: { blur: number; dx: number; dy: number; opacity: number }): Promise<Buffer> {
  const alpha = await sharp(layer).extractChannel(3).blur(Math.max(0.3, blur)).linear(opacity, 0).raw().toBuffer();
  const out = Buffer.alloc(w * h);
  for (let y = Math.max(0, dy); y < Math.min(h, h + dy); y++) {
    const from = (y - dy) * w;
    for (let x = Math.max(0, dx); x < Math.min(w, w + dx); x++) out[y * w + x] = alpha[from + x - dx];
  }
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 60, g: 55, b: 58 } } })
    .joinChannel(out, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

/** A dark line where each thing stands: its alpha's lowest rows, a little blurred. */
async function contactOf(layer: Buffer, w: number, h: number, k: number): Promise<Buffer> {
  const a = await sharp(layer).extractChannel(3).raw().toBuffer();
  const d = Math.max(2, Math.round(6 * k)), t = Math.max(2, Math.round(4 * k)), out = Buffer.alloc(w * h);
  for (let y = 0; y < h - d; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (a[i] > 200 && a[i + d * w] < 40) for (let j = 0; j < t; j++) { const at = (y + d - 2 + j) * w + x; if (at < out.length) out[at] = 255; }
  }
  const soft = await sharp(out, { raw: { width: w, height: h, channels: 1 } }).blur(Math.max(0.5, 2.2 * k)).linear(0.45, 0).raw().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 45, g: 40, b: 43 } } })
    .joinChannel(soft, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

/**
 * The layer's things set into the render. 2026-11-05 (the owner: "shadow dedim ama aşırı koyu olmuş … gri tonlu bir
 * shadow"; "paketler daha gerçekçi gözüksün"): one soft shadow thrown to the side away from the window (the room's
 * light comes from the left), never a grey square all round them; a dark line where they stand; their light the
 * render's own, a touch brighter on the lit side and at the top, shaded at the foot; and crisp — a box standing in
 * the photo is as sharp as the photo (later the same day: "render kötü gene" — the boxes had come out blurred and
 * framed in grey).
 */
async function standIn(render: Buffer, layer: Buffer, w: number, h: number): Promise<Buffer> {
  const k = w / 1000;
  const cast = await shadowOf(layer, w, h, { blur: 5 * k, dx: Math.round(7 * k), dy: Math.round(3 * k), opacity: 0.2 });
  const contact = await contactOf(layer, w, h, k);
  const lum = await sharp(render).removeAlpha().greyscale().blur(40 * k).raw().toBuffer();
  const px = await sharp(layer).ensureAlpha().raw().toBuffer();
  // Each thing's top and foot, column by column, and its left and right, row by row: where it is in its own shape.
  const top = new Int32Array(w * h), foot = new Int32Array(w * h), left = new Int32Array(w * h), right = new Int32Array(w * h);
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!px[(y * w + x) * 4 + 3]) { y++; continue; }
      const y0 = y;
      while (y < h && px[(y * w + x) * 4 + 3]) y++;
      for (let j = y0; j < y; j++) { top[j * w + x] = y0; foot[j * w + x] = y - 1; }
    }
  }
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!px[(y * w + x) * 4 + 3]) { x++; continue; }
      const x0 = x;
      while (x < w && px[(y * w + x) * 4 + 3]) x++;
      for (let j = x0; j < x; j++) { left[y * w + j] = x0; right[y * w + j] = x - 1; }
    }
  }
  let sum = 0, n = 0;
  for (let i = 3, p = 0; i < px.length; i += 4, p++) if (px[i] > 128) { sum += lum[p]; n++; }
  const mean = n ? sum / n : 200;
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    if (!px[i + 3]) continue;
    // Brighter where the scene is brighter, darker where it is darker — within a few percent.
    const f = Math.pow(Math.min(1.04, Math.max(0.88, lum[p] / mean)), 0.6);
    const span = foot[p] - top[p], v = span > 0 ? (((p / w) | 0) - top[p]) / span : 0.5;
    const wide = right[p] - left[p], u = wide > 0 ? ((p % w) - left[p]) / wide : 0.5;
    const shade = 1 + 0.04 * (0.5 - v) - (v > 0.88 ? (0.06 * (v - 0.88)) / 0.12 : 0) + 0.035 * (0.5 - u);
    const grey = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    for (let c = 0; c < 3; c++) {
      const vivid = px[i + c] * 0.96 + grey * 0.04;
      px[i + c] = Math.max(0, Math.min(255, Math.round((4 + vivid * (1 - 4 / 255)) * f * shade)));
    }
  }
  // Only their edges softened, to the photo's own (a hair), then its grain, the same on all three channels.
  const soft = await sharp(px, { raw: { width: w, height: h, channels: 4 } }).blur(Math.max(0.3, 0.35 * k)).raw().toBuffer();
  for (let i = 0; i < soft.length; i += 4) {
    if (!soft[i + 3]) continue;
    const grain = (Math.random() - 0.5) * 5;
    for (let c = 0; c < 3; c++) soft[i + c] = Math.max(0, Math.min(255, Math.round(soft[i + c] + grain)));
  }
  const lit = await sharp(soft, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return sharp(render).composite([{ input: cast }, { input: contact }, { input: lit }]).png().toBuffer();
}
