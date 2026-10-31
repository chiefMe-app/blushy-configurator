// Cutting a piece out of its key-colour render (2026-10-29, moved here
// 2026-10-31 to be shared by the table's top view and the welcome board).
import sharp from "sharp";

export type Raw = { data: Buffer; width: number; height: number };

/** The green (or magenta: a piece with green in it, 2026-10-30) away, with a soft edge, its spill out, and only the piece's own blobs kept. */
export async function cutOut(file: string, magenta = false): Promise<Raw> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, n = W * H, o = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    let r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    // How much of the background's colour a pixel has: green over red and blue, or red and blue over green.
    const key = magenta ? Math.min(r, b) - g : g - Math.max(r, b), bright = magenta ? Math.min(r, b) : g;
    // ≤25: opaque, ≥70: gone; a dark keyed pixel is the background's own shading.
    const a = key > 8 && bright < 120 ? 0 : Math.max(0, Math.min(1, (70 - key) / 45));
    // The spill: only at the soft edge for magenta, where a pink piece would lose its own pink.
    if (magenta ? key > 25 : key > 0) { if (magenta) { r = Math.min(r, g + 6); b = Math.min(b, g + 6); } else g = Math.max(r, b) + Math.min(key, 6); }
    o[i * 4] = r; o[i * 4 + 1] = g; o[i * 4 + 2] = b; o[i * 4 + 3] = a < 0.24 ? 0 : Math.round(a * 255);
  }
  // Blobs of solid pixels on an 8× smaller grid; those at least a twentieth of
  // the biggest, away from the picture's edge, are the piece.
  const G = 8, gw = Math.ceil(W / G), gh = Math.ceil(H / G), solid = new Uint8Array(gw * gh);
  for (let i = 0; i < n; i++) if (o[i * 4 + 3] > 200) solid[(((i / W) | 0) / G | 0) * gw + ((i % W) / G | 0)] = 1;
  const label = new Int32Array(gw * gh).fill(-1);
  const blobs: { n: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let s = 0; s < solid.length; s++) {
    if (!solid[s] || label[s] >= 0) continue;
    const q = [s], bb = { n: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
    label[s] = blobs.length;
    while (q.length) {
      const c = q.pop()!, x = c % gw, y = (c / gw) | 0;
      bb.n++; bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x); bb.y0 = Math.min(bb.y0, y); bb.y1 = Math.max(bb.y1, y);
      for (const d of [c - 1, c + 1, c - gw, c + gw]) if (d >= 0 && d < solid.length && solid[d] && label[d] < 0 && Math.abs((d % gw) - x) <= 1) { label[d] = blobs.length; q.push(d); }
    }
    blobs.push(bb);
  }
  const big = Math.max(...blobs.map((b) => b.n));
  const keep = new Set(blobs.flatMap((b, i) => (b.n >= big / 20 && b.x0 > 0 && b.y0 > 0 && b.x1 < gw - 1 && b.y1 < gh - 1 ? [i] : [])));
  const near = new Uint8Array(gw * gh);
  for (let c = 0; c < near.length; c++) if (keep.has(label[c])) {
    const x = c % gw, y = (c / gw) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) near[yy * gw + xx] = 1; }
  }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let i = 0; i < n; i++) {
    if (!near[(((i / W) | 0) / G | 0) * gw + ((i % W) / G | 0)]) { o[i * 4 + 3] = 0; continue; }
    if (o[i * 4 + 3]) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const out = await sharp(o, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).raw().toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}

export const lum = (d: Buffer, i: number) => (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);

/** Grey, with the paper's white at white: ready to be tinted by multiplying. */
export function whiten(r: Raw): Raw {
  const ls: number[] = [];
  for (let i = 0; i < r.data.length; i += 4) if (r.data[i + 3] > 200) ls.push(lum(r.data, i));
  ls.sort((a, b) => a - b);
  const top = ls[Math.floor(ls.length * 0.9)] || 255;
  const d = Buffer.from(r.data);
  for (let i = 0; i < d.length; i += 4) { const v = Math.min(255, Math.round((lum(d, i) / top) * 255)); d[i] = d[i + 1] = d[i + 2] = v; }
  return { ...r, data: d };
}
