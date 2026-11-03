// node scripts/sketch/rim-thin.cjs <rim.png>… — keeps only the thin rim line in a rim mask, in place (2026-11-03):
// where the rim test also took a shaded patch of the board's face, that patch is a thick blob; what survives an
// erosion of 9 px is a blob, and it is cut out (grown back 11 px). Then the outline is smoothed.
const sharp = require("sharp");
(async () => {
  for (const f of process.argv.slice(2)) {
    const { data, info } = await sharp(f).greyscale().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, on = (a, i) => a[i] > 127;
    const morph = (a, r, grow) => {
      // A square structuring element, separably: rows then columns.
      const t = new Uint8Array(W * H), o = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let v = grow ? 0 : 255;
        for (let k = -r; k <= r; k++) { const xx = Math.min(W - 1, Math.max(0, x + k)); v = grow ? Math.max(v, a[y * W + xx]) : Math.min(v, a[y * W + xx]); }
        t[y * W + x] = v;
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let v = grow ? 0 : 255;
        for (let k = -r; k <= r; k++) { const yy = Math.min(H - 1, Math.max(0, y + k)); v = grow ? Math.max(v, t[yy * W + x]) : Math.min(v, t[yy * W + x]); }
        o[y * W + x] = v;
      }
      return o;
    };
    const bin = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) bin[i] = on(data, i) ? 255 : 0;
    const blobs = morph(morph(bin, 9, false), 11, true);
    let cut = 0;
    for (let i = 0; i < W * H; i++) if (blobs[i] && bin[i]) { bin[i] = 0; cut++; }
    const out = await sharp(Buffer.from(bin), { raw: { width: W, height: H, channels: 1 } }).blur(1.5).raw().toBuffer();
    for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, (out[i] - 128) * 6 + 128));
    await sharp(out, { raw: { width: W, height: H, channels: 1 } }).toColourspace("srgb").png().toFile(f + ".tmp.png");
    require("fs").renameSync(f + ".tmp.png", f);
    console.log(f, "blob px cut", cut);
  }
})();
