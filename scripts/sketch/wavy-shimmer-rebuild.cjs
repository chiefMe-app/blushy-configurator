// node rebuild-ws.cjs <setdir> <raw.png> <outdir> — Wavy + Shimmer layers rebuilt: the board face (its largest piece,
// clear of the balloons), its pink rim read from the edited photo, and the room = the Arch + Shimmer photo with only
// the board's area from the edit (colour-matched).
const sharp = require("C:/Users/Architect/blushy-configurator/node_modules/sharp");
const [, , dir, rawPath, out] = process.argv;
const W = 1024, N = W * W;
const rgb = async (f) => sharp(f).resize(W, W).removeAlpha().toColourspace("srgb").raw().toBuffer();
const grey = async (f) => sharp(f).resize(W, W).greyscale().raw().toBuffer();
const dil = (m, r) => { const t = new Uint8Array(N), o = new Uint8Array(N);
  for (let y = 0; y < W; y++) { let last = -1e9; for (let x = 0; x < W; x++) { if (m[y * W + x]) last = x; t[y * W + x] = x - last <= r ? 1 : 0; } last = 1e9; for (let x = W - 1; x >= 0; x--) { if (m[y * W + x]) last = x; if (last - x <= r) t[y * W + x] = 1; } }
  for (let x = 0; x < W; x++) { let last = -1e9; for (let y = 0; y < W; y++) { if (t[y * W + x]) last = y; o[y * W + x] = y - last <= r ? 1 : 0; } last = 1e9; for (let y = W - 1; y >= 0; y--) { if (t[y * W + x]) last = y; if (last - y <= r) o[y * W + x] = 1; } }
  return o; };
const comps = (m) => { const lab = new Int32Array(N), sizes = [0]; let k = 0;
  for (let i = 0; i < N; i++) if (m[i] && !lab[i]) { k++; let s = 0; const st = [i]; lab[i] = k;
    while (st.length) { const j = st.pop(); s++; const x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue; const q = yy * W + xx; if (m[q] && !lab[q]) { lab[q] = k; st.push(q); } } }
    sizes.push(s); }
  return { lab, sizes }; };
const png = (m, f) => sharp(Buffer.from(m.map((v) => (v ? 255 : 0))), { raw: { width: W, height: W, channels: 1 } }).png().toFile(f);
(async () => {
  const raw = await rgb(rawPath), arch = await rgb(`${dir}/arch_shimmer-room.webp`), wroom = await rgb(`${dir}/wavy_shimmer-room.webp`);
  const balA = (await sharp(`${dir}/wavy_shimmer-balloons.webp`).resize(W, W).ensureAlpha().extractChannel(3).raw().toBuffer()).map((v) => (v > 60 ? 1 : 0));
  const bal = dil(balA, 5);
  const b0 = await grey(`${dir}/wavy_shimmer-board-0.png`);
  // The face: the board mask's largest piece, off the balloons.
  let face = new Uint8Array(N); for (let i = 0; i < N; i++) face[i] = b0[i] > 127 && !balA[i] ? 1 : 0;
  { const { lab, sizes } = comps(face); const big = sizes.indexOf(Math.max(...sizes.slice(1))); face = face.map((_, i) => (lab[i] === big ? 1 : 0)); }
  let x0 = W, x1 = 0, y0 = W, y1 = 0; for (let i = 0; i < N; i++) if (face[i]) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  // The rim: pink pixels of the edited photo around the face, not the balloons'.
  const near = dil(face, 30); const pink = new Uint8Array(N);
  for (let i = 0; i < N; i++) { if (!near[i] || bal[i] || face[i]) continue; const r = raw[i * 3], g = raw[i * 3 + 1], b = raw[i * 3 + 2]; pink[i] = r - g > 12 && r - b > 2 && b - g > 4 && r > 110 ? 1 : 0; }
  let rim = pink; { const { lab, sizes } = comps(pink); rim = pink.map((_, i) => (sizes[lab[i]] > 300 ? 1 : 0)); }
  { const b = await sharp(Buffer.from(rim.map((v) => v * 255)), { raw: { width: W, height: W, channels: 1 } }).blur(2).extractChannel(0).raw().toBuffer(); rim = rim.map((_, i) => (b[i] > 110 && !balA[i] && !face[i] ? 1 : 0)); }
  // The board's foot: the pink strip under the face, which the balloon cut-out took for a balloon.
  let xb0 = W; for (let y = y1 - 10; y <= y1; y++) for (let x = x0; x <= x1; x++) if (face[y * W + x]) { xb0 = Math.min(xb0, x); break; }
  const foot = new Uint8Array(N);
  for (let y = y1 - 8; y <= Math.min(W - 1, y1 + 45); y++) for (let x = xb0 - 6; x <= x1 + 30; x++) { const i = y * W + x; const r = raw[i * 3], g = raw[i * 3 + 1], b = raw[i * 3 + 2]; if (!face[i] && r - g > 12 && b - g > 4 && r > 110) foot[i] = 1; }
  // Under the garland, only the rim's own pink (not a pink balloon's).
  for (let y = y1 - 8; y <= Math.min(W - 1, y1 + 45); y++) for (let x = Math.max(0, xb0 - 110); x < xb0 - 6; x++) { const i = y * W + x; const r = raw[i * 3], g = raw[i * 3 + 1], b = raw[i * 3 + 2]; if (r > 120 && r < 240 && r - g > 55 && r - g < 120 && b - g > 10 && b - g < 50) foot[i] = 1; }
  { const { lab, sizes } = comps(foot); for (let i = 0; i < N; i++) if (foot[i] && sizes[lab[i]] < 60) foot[i] = 0; }
  // Anywhere else next to the rim: the rim's own pink, cut out with the garland where it goes behind it.
  { const band = dil(rim, 14); for (let i = 0; i < N; i++) { if (!band[i] || face[i] || !balA[i]) continue; const r = raw[i * 3], g = raw[i * 3 + 1], b = raw[i * 3 + 2]; if (r > 120 && r < 240 && r - g > 55 && r - g < 120 && b - g > 10 && b - g < 50) foot[i] = 1; } }
  { const { lab, sizes } = comps(foot); for (let i = 0; i < N; i++) if (foot[i] && sizes[lab[i]] < 60) foot[i] = 0; }
  for (let i = 0; i < N; i++) if (foot[i]) rim[i] = 1;
  const footD = dil(foot, 1);
  { const bl = await sharp(`${dir}/wavy_shimmer-balloons.webp`).ensureAlpha().raw().toBuffer(); for (let i = 0; i < N; i++) if (footD[i]) bl[i * 4 + 3] = 0;
    await sharp(bl, { raw: { width: W, height: W, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toFile(`${out}/wavy_shimmer-balloons.webp`);
    for (let i = 0; i < N; i++) if (footD[i]) { balA[i] = 0; bal[i] = 0; } }
  // Room.
  const ab = await grey(`${dir}/arch_shimmer-board-0.png`);
  const u = new Uint8Array(N); for (let i = 0; i < N; i++) u[i] = face[i] || rim[i] || ab[i] > 127 ? 1 : 0;
  const M = dil(u, 8), R = dil(M, 24); const s = [[0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < N; i++) if (R[i] && !M[i] && !bal[i]) for (let c = 0; c < 3; c++) { s[0][c] += arch[i * 3 + c]; s[1][c] += wroom[i * 3 + c]; }
  const gain = [0, 1, 2].map((c) => s[0][c] / s[1][c]);
  const soft = await sharp(Buffer.from(M.map((v) => v * 255)), { raw: { width: W, height: W, channels: 1 } }).blur(3).extractChannel(0).raw().toBuffer();
  const o = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) { const a = soft[i] / 255; for (let c = 0; c < 3; c++) o[i * 3 + c] = Math.max(0, Math.min(255, Math.round(arch[i * 3 + c] * (1 - a) + wroom[i * 3 + c] * gain[c] * a))); }
  const rimG = dil(rim, 2);
  for (let i = 0; i < N; i++) if (rimG[i] && !bal[i]) { const l = Math.min(255, Math.round((0.3 * o[i * 3] + 0.59 * o[i * 3 + 1] + 0.11 * o[i * 3 + 2]) * 1.08)); o[i * 3] = o[i * 3 + 1] = o[i * 3 + 2] = l; }
  await sharp(o, { raw: { width: W, height: W, channels: 3 } }).webp({ quality: 90 }).toFile(`${out}/wavy_shimmer-room.webp`);
  await png(face, `${out}/wavy_shimmer-board-0.png`);
  // The sequin wall: the Arch + Shimmer one, behind the wavy board.
  { const a1 = await grey(`${dir}/arch_shimmer-board-1.png`); const front = dil(u, 2); await png(a1.map((v, i) => (v > 127 && !front[i] ? 1 : 0)), `${out}/wavy_shimmer-board-1.png`); } await png(rimG.map((v, i) => v && !bal[i] ? 1 : 0), `${out}/wavy_shimmer-rim-0.png`);
  let rx0 = W, rx1 = 0, ry0 = W, ry1 = 0; for (let i = 0; i < N; i++) if (u[i]) { const x = i % W, y = (i / W) | 0; rx0 = Math.min(rx0, x); rx1 = Math.max(rx1, x); ry0 = Math.min(ry0, y); ry1 = Math.max(ry1, y); }
  console.log(dir.split("/").pop(), "face", [x0, y0, x1, y1].map((v) => (v / W).toFixed(4)).join(" "), "board+rim", [rx0, ry0, rx1, ry1].map((v) => (v / W).toFixed(4)).join(" "), "rim px", rim.reduce((a, b) => a + b, 0), "gain", gain.map((g) => g.toFixed(3)).join(" "));
})().catch((e) => { console.error(e); process.exit(1); });
