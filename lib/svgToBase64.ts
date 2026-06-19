import sharp from "sharp";

export async function svgToBase64PNG(svgString: string): Promise<Buffer> {
  return sharp(Buffer.from(svgString)).resize(800, 600).png().toBuffer();
}
