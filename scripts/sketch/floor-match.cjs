// node scripts/sketch/floor-match.cjs <ref-room.webp> <ref-balloons.webp> <room.webp> <balloons.webp> <out.webp>
// Moves the wood floor's Lab statistics onto the reference set's floor (outside the balloons).
// 2026-11-03: the Wavy + Shimmer sequin edit warmed the floor to orange; matched to the set's Single Arch floor.
const sharp = require("sharp");
const [ref, refB, room, roomB, out] = process.argv.slice(2);
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c) => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); };
function toLab(r, g, b) {
  r = lin(r); g = lin(g); b = lin(b);
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function toRgb(L, a, b) {
  let y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
  const f = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  x = f(x) * 0.95047; y = f(y); z = f(z) * 1.08883;
  return [gam(3.2406 * x - 1.5372 * y - 0.4986 * z), gam(-0.9689 * x + 1.8758 * y + 0.0415 * z), gam(0.0557 * x - 0.204 * y + 1.057 * z)];
}
async function load(p, ch) { const { data, info } = await sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; }
async function alpha(p, W, H) { const { data } = await sharp(p).resize(W, H).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true }); return data; }
// A floor pixel: warm wood in the lower part, not a balloon.
function floorW(d, i, al, y, H) {
  if (y < H * 0.7 || al[i] > 40) return 0;
  const r = d[i * 3], g = d[i * 3 + 1], b = d[i * 3 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx !== r || g < b) return 0;
  const s = (mx - mn) / (mx || 1);
  return Math.max(0, Math.min(1, (s - 0.06) / 0.12));
}
function stats(img, al) {
  const { data: d, W, H } = img; const s = [0, 0, 0], q = [0, 0, 0]; let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (floorW(d, i, al, y, H) < 1) continue;
    const L = toLab(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
    for (let k = 0; k < 3; k++) { s[k] += L[k]; q[k] += L[k] * L[k]; } n++;
  }
  const m = s.map((v) => v / n); return { m, sd: q.map((v, k) => Math.sqrt(Math.max(1e-6, v / n - m[k] * m[k]))), n };
}
(async () => {
  const R = await load(ref), Ra = await alpha(refB, R.W, R.H);
  const T = await load(room), Ta = await alpha(roomB, T.W, T.H);
  const a = stats(R, Ra), b = stats(T, Ta);
  console.log("ref", a.m.map((v) => v.toFixed(1)), a.n, "room", b.m.map((v) => v.toFixed(1)), b.n);
  const o = Buffer.from(T.data);
  for (let y = 0; y < T.H; y++) for (let x = 0; x < T.W; x++) {
    const i = y * T.W + x, w = floorW(T.data, i, Ta, y, T.H) * Math.min(1, (y - T.H * 0.7) / (T.H * 0.04));
    if (w <= 0) continue;
    const L = toLab(T.data[i * 3], T.data[i * 3 + 1], T.data[i * 3 + 2]);
    const n = L.map((v, k) => (v - b.m[k]) * (a.sd[k] / b.sd[k]) + a.m[k]);
    const c = toRgb(...n);
    for (let k = 0; k < 3; k++) o[i * 3 + k] = Math.round(T.data[i * 3 + k] * (1 - w) + c[k] * w);
  }
  await sharp(o, { raw: { width: T.W, height: T.H, channels: 3 } }).webp({ quality: 90 }).toFile(out);
})();
