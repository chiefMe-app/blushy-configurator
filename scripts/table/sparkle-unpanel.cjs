// Remove the translucent white writing panel on the left of a sparkle placemat.
const sharp = require(process.cwd() + "/node_modules/sharp");
async function run(src, out, mode) {
  if (mode === undefined) {
    let best = null;
    for (const m of [0, 0.5, 1, 2]) { const r = await run(src, null, m); if (r && (!best || r.score < best.score)) best = { ...r, m }; }
    if (!best) { if (out) await sharp(src).toFile(out); return false; }
    console.log("  best mode", best.m, best.score.toFixed(2));
    return run(src, out, best.m);
  }
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = 3;
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];
  const colMean = (x, y0, y1) => { let s = 0; for (let y = y0; y < y1; y++) s += L[y * W + x]; return s / (y1 - y0); };
  const rowMean = (y, x0, x1) => { let s = 0; for (let x = x0; x < x1; x++) s += L[y * W + x]; return s / (x1 - x0); };
  const cp = []; for (let x = 0; x < W; x++) cp.push(colMean(x, Math.round(H * .25), Math.round(H * .75)));
  const step = (arr, i, k = 3) => { let a = 0, b = 0; for (let j = 1; j <= k; j++) { a += arr[Math.max(0, i - j)]; b += arr[Math.min(arr.length - 1, i + j - 1)]; } return (b - a) / k; };
  let x0 = 0, s0 = 0; for (let x = 3; x < W * .15; x++) { const s = step(cp, x); if (s > s0) { s0 = s; x0 = x; } }
  let x1 = 0, s1 = 0; for (let x = Math.round(W * .3); x < W * .65; x++) { const s = -step(cp, x); if (s > s1) { s1 = s; x1 = x; } }
  const rp = []; for (let y = 0; y < H; y++) rp.push(rowMean(y, x0 + 10, x1 - 10));
  let y0 = 0, t0 = 0; for (let y = 3; y < H * .2; y++) { const s = step(rp, y); if (s > t0) { t0 = s; y0 = y; } }
  let y1 = 0, t1 = 0; for (let y = Math.round(H * .8); y < H - 3; y++) { const s = -step(rp, y); if (s > t1) { t1 = s; y1 = y; } }
  if (out) console.log(src.split("/").slice(-2).join("/"), { x0, x1, y0, y1, s0: s0.toFixed(1), s1: s1.toFixed(1), t0: t0.toFixed(1), t1: t1.toFixed(1) });
  if (Math.min(s0, s1, t0, t1) < 4) { if (out) { console.log("  no panel"); await sharp(src).toFile(out); } return false; }
  const m = 6; // margin outside the edge, past its feather
  const X0 = Math.max(0, x0 - m), X1 = Math.min(W - 1, x1 + m), Y0 = Math.max(0, y0 - m), Y1 = Math.min(H - 1, y1 + m);
  const px = (x, y, c) => data[(y * W + x) * 3 + c];
  // Background under the panel: horizontal and vertical interpolation from just outside it, averaged (a band mean).
  const band = (x, y, c, dx, dy) => { let s = 0, n = 0; for (let k = 0; k < 4; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx >= 0 && xx < W && yy >= 0 && yy < H) { s += px(xx, yy, c); n++; } } return s / n; };
  const B = new Float32Array(W * H * 3);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) for (let c = 0; c < 3; c++) {
    const u = (x - X0) / (X1 - X0), v = (y - Y0) / (Y1 - Y0);
    const h = band(X0, y, c, -1, 0) * (1 - u) + band(X1, y, c, 1, 0) * u;
    const vv = band(x, Y0, c, 0, -1) * (1 - v) + band(x, Y1, c, 0, 1) * v;
    const mm = mode > 1 ? 0.5 : mode; B[(y * W + x) * 3 + c] = h * (1 - mm) + vv * mm;
  }
  // The panel's opacity, row by row (some panels fade top to bottom): the median of each row, smoothed.
  const rowA = new Float32Array(H);
  for (let y = y0; y <= y1; y++) {
    const as = [];
    for (let x = x0 + 12; x < x1 - 12; x += 2) {
      const i = y * W + x; const pl = L[i]; const b = 0.299 * B[i * 3] + 0.587 * B[i * 3 + 1] + 0.114 * B[i * 3 + 2];
      if (255 - b > 20) as.push((pl - b) / (255 - b));
    }
    as.sort((a, b) => a - b); rowA[y] = as.length ? as[Math.floor(as.length * 0.4)] : 0;
    if (mode === 2) {
      // From right across its left and right edges: just inside against just outside.
      const mean = (xa, xb) => { let s = 0, n = 0; for (let x = xa; x <= xb; x++) { if (x < 0 || x >= W) continue; s += L[y * W + x]; n++; } return n ? s / n : NaN; };
      const e = [];
      const li = mean(x0 + 8, x0 + 14), lo = mean(x0 - 14, x0 - 8); if (x0 >= 16 && 255 - lo > 15) e.push((li - lo) / (255 - lo));
      const ri = mean(x1 - 14, x1 - 8), ro = mean(x1 + 8, x1 + 14); if (255 - ro > 15) e.push((ri - ro) / (255 - ro));
      rowA[y] = e.length ? e.reduce((a, b) => a + b) / e.length : rowA[y];
    }
  }
  const sm = new Float32Array(H);
  for (let y = y0; y <= y1; y++) { let s = 0, n = 0; for (let k = -25; k <= 25; k++) { const yy = Math.min(y1 - 12, Math.max(y0 + 12, y + k)); s += rowA[yy]; n++; } sm[y] = Math.max(0, Math.min(0.85, s / n)); }
  if (out) console.log("  alpha", sm[Math.round((y0 + y1) / 2)].toFixed(3));
  const out8 = Buffer.from(data);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const a = sm[y];
    for (let c = 0; c < 3; c++) { const i = (y * W + x) * 3 + c; out8[i] = Math.max(0, Math.min(255, Math.round((data[i] - 255 * a) / (1 - a)))); }
  }
  // The edge (its light line and soft shadow): blended across from 6 px outside to 6 px inside, along its normal.
  const E = 6;
  const get = (x, y, c) => out8[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 3 + c];
  const fixed = Buffer.from(out8);
  for (let y = y0 - E; y <= y1 + E; y++) for (let x = x0 - E; x <= x1 + E; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const d = [[x - x0, -1, 0], [x1 - x, 1, 0], [y - y0, 0, -1], [y1 - y, 0, 1]].map(([e, dx, dy]) => ({ e: Math.abs(e), dx, dy, s: e }));
    const n = d.reduce((m, v) => (v.e < m.e ? v : m));
    if (n.e > E) continue;
    // Along the normal: point outside (o) and inside (i).
    const k = n.s; // signed: positive inside
    const ox = x + n.dx * (E - (-k)) , oy = y + n.dy * (E - (-k));
    const ix = x - n.dx * (E + (-k)) , iy = y - n.dy * (E + (-k));
    const t = (k + E) / (2 * E); // 0 outside .. 1 inside
    for (let c = 0; c < 3; c++) fixed[(y * W + x) * 3 + c] = Math.round(get(ox, oy, c) * (1 - t) + get(ix, iy, c) * t);
  }
  out8.set(fixed);
  // How well it joins: inside (8–14 px in) against outside (8–14 px out), along the four edges.
  const lum = (b, x, y) => { const i = (y * W + x) * 3; return 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2]; };
  let score = 0, cnt = 0;
  for (let y = y0 + 20; y < y1 - 20; y += 3) for (const [xi, xo] of [[x0 + 11, x0 - 11], [x1 - 11, x1 + 11]]) { if (xo < 0 || xo >= W) continue; score += Math.abs(lum(out8, xi, y) - lum(out8, xo, y)); cnt++; }
  for (let x = x0 + 20; x < x1 - 20; x += 3) for (const [yi, yo] of [[y0 + 11, y0 - 11], [y1 - 11, y1 + 11]]) { if (yo < 0 || yo >= H) continue; score += Math.abs(lum(out8, x, yi) - lum(out8, x, yo)); cnt++; }
  score /= cnt;
  if (!out) return { score };
  await sharp(out8, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 90 }).toFile(out);
  return true;
}
module.exports = run;
if (require.main === module) run(process.argv[2], process.argv[3]);
