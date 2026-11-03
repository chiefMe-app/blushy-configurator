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
export async function finishSketchRender(render: Buffer, sketch: Buffer, words?: Buffer, { shadow = false } = {}): Promise<Buffer> {
  const { width = 1024, height = 1024 } = await sharp(render).metadata();
  const gains = await colourGains(render, sketch);
  let img = sharp(render).removeAlpha().linear(gains, [0, 0, 0]);
  if (words) {
    // The words drawn at the sketch's own square, so at the render's (made at the sketch's size).
    const layer = await sharp(words).resize(width, height, { fit: "fill" }).ensureAlpha().png().toBuffer();
    const under = shadow ? [{ input: await softShadow(layer, width, height), left: 0, top: 0 }] : [];
    img = sharp(await img.toBuffer()).composite([...under, { input: layer }]);
  }
  return img.jpeg({ quality: 90 }).toBuffer();
}

/** A layer's soft shadow: its shape, blurred, a little below it. */
async function softShadow(layer: Buffer, width: number, height: number): Promise<Buffer> {
  const k = width / 1000;
  const alpha = await sharp(layer).extractChannel(3).blur(Math.max(1, 5 * k)).linear(0.45, 0).raw().toBuffer();
  const drop = Math.round(5 * k);
  const shifted = Buffer.alloc(width * height);
  alpha.copy(shifted, drop * width, 0, (height - drop) * width);
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 30, b: 35 } } })
    .joinChannel(shifted, { raw: { width, height, channels: 1 } }).png().toBuffer();
}
