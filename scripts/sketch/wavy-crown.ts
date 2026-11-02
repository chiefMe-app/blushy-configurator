// The Wavy's crown tucked behind its board (2026-11-02, the owner, circling the balloons over the board's top:
// "havada duruyor gibi"): in the shot the crown's right-hand cluster stops a little above the board's wavy top,
// so the wall shows between them and it seems to hang in the air. The board stands in front of its garland, so
// the cluster is lowered until its foot goes behind the board's top, as the garland's balloons do everywhere
// else. Each balloon is moved whole (SAM 2 segments from the paid auto-segment of the shot, scripts/sketch/segs/
// single_wavy-<set>.png); where the crown was, the room's wall is carried down from just above it. Free and local;
// run once on the shipped files (it rewrites them in place).
// npx tsx scripts/sketch/wavy-crown.ts [set…]
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import path from "node:path";

sharp.cache(false);

const SETS = ["unicorn-pastel", "unicorn-bright", "frozen-pastel", "frozen-bright"];
/** How far the crown comes down (px of the 1024 shot): its foot ~255, the board's top 262 at the crests, 275 between. */
const DROP = 30;
/** The crown: balloons centred above this height; lowered fully right of X1 (the board's top-left corner),
 *  eased in from X0 (left of it, the crown turns down into the column, which stands on the floor). */
const CROWN_Y = 285, X0 = 300, X1 = 380;
/** How far round the crown the room is taken as its own (its soft edge and glow), px. */
const GLOW = 14;

const smoothstep = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

async function lower(set: string) {
  const dir = `public/design/sketch/${set}`;
  const file = (f: string) => path.join(dir, `single_wavy-${f}`);
  const { data: img, info } = await sharp(file("balloons.webp")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const fam = await sharp(file("families.png")).removeAlpha().raw().toBuffer();
  const room = await sharp(file("room.webp")).removeAlpha().raw().toBuffer();
  const lab = await sharp(`scripts/sketch/segs/single_wavy-${set}.png`).resize(W, H, { kernel: "nearest" }).removeAlpha().raw().toBuffer();
  const opaque = (k: number) => img[k * 4 + 3] > 128;
  const id = (k: number) => lab[k * 3] + lab[k * 3 + 1] * 256;
  const drop = (x: number) => Math.round(DROP * smoothstep((x - X0) / (X1 - X0)));

  const seg = new Map<number, { n: number; on: number; xs: number; ys: number }>();
  for (let k = 0; k < W * H; k++) {
    const i = id(k); if (!i) continue;
    const s = seg.get(i) ?? { n: 0, on: 0, xs: 0, ys: 0 };
    s.n++; s.xs += k % W; s.ys += Math.floor(k / W); if (opaque(k)) s.on++;
    seg.set(i, s);
  }
  // Each pixel's move: a crown balloon's by its centre; anything else up there by its own column.
  const move = new Map<number, number>();
  for (const [i, s] of Array.from(seg)) if (s.n < 60000 && s.on / s.n > 0.6) move.set(i, s.ys / s.n < CROWN_Y ? drop(s.xs / s.n) : 0);
  // Anything else up there (a balloon's soft edge the segments left to the wall, a sliver) goes with its column:
  // left behind, a soft edge showed as a smudge where the balloon had been.
  const dyOf = (k: number) => {
    if (!img[k * 4 + 3]) return 0;
    const m = move.get(id(k));
    if (m !== undefined) return m;
    return Math.floor(k / W) < CROWN_Y ? drop(k % W) : 0;
  };

  const out = Buffer.alloc(W * H * 4), outFam = Buffer.alloc(W * H * 3);
  const put = (k: number, dy: number) => {
    const j = k + dy * W;
    if (j >= W * H) return;
    img.copy(out, j * 4, k * 4, k * 4 + 4); fam.copy(outFam, j * 3, k * 3, k * 3 + 3);
  };
  // What stays first, then the lowered crown over it.
  const dys = new Int16Array(W * H).map((_, k) => dyOf(k));
  for (let k = 0; k < W * H; k++) if (img[k * 4 + 3] && !dys[k]) put(k, 0);
  for (let k = 0; k < W * H; k++) if (img[k * 4 + 3] && dys[k]) put(k, dys[k]);
  // A sliver left between balloons that moved apart takes the photo's own pixel from above (the column's move).
  for (let k = 0; k < W * H; k++) {
    const y = Math.floor(k / W), x = k % W, src = k - drop(x) * W;
    if (out[k * 4 + 3] > 128 || y >= CROWN_Y + DROP || src < 0 || !opaque(src)) continue;
    img.copy(out, k * 4, src * 4, src * 4 + 4); fam.copy(outFam, k * 3, src * 3, src * 3 + 3);
  }
  // Behind the board: the sketch draws the balloons over everything, the board being the room's own (sketch-base
  // cleared the balloons inside its outline), so what came down onto the board and its rim is cleared the same way.
  const board = new Uint8Array(W * H);
  for (const m of ["board-0.png", "rim-0.png"]) {
    const mask = await sharp(file(m)).resize(W, H).extractChannel(0).raw().toBuffer();
    for (let k = 0; k < W * H; k++) if (mask[k]) { out[k * 4 + 3] = Math.round(out[k * 4 + 3] * (1 - mask[k] / 255)); board[k] = 1; }
  }
  // The room under the balloons is the shot itself: where the crown no longer covers it, the wall from just above.
  // The crown's reach is taken a few px wide, for its soft edge (and the photo's glow round it).
  const was = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) {
    if (img[k * 4 + 3] <= 8) continue;
    const x = k % W, y = Math.floor(k / W);
    for (let dy = -GLOW; dy <= GLOW; dy++) for (let dx = -GLOW; dx <= GLOW; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H) was[yy * W + xx] = 1;
    }
  }
  let wall = 0;
  const filledWall = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    let above: number[] | null = null;
    for (let y = 0; y < CROWN_Y + DROP; y++) {
      const k = y * W + x;
      if (board[k]) continue; // the board and its rim are the room's own, never wall
      if (!was[k]) { above = [room[k * 3], room[k * 3 + 1], room[k * 3 + 2]]; continue; }
      // Kept where the balloon layer covers it as before (a see-through balloon that stayed), or fully.
      if (out[k * 4 + 3] === 255 || (img[k * 4 + 3] > 48 && Math.abs(out[k * 4 + 3] - img[k * 4 + 3]) < 24) || !above) continue;
      room[k * 3] = above[0]; room[k * 3 + 1] = above[1]; room[k * 3 + 2] = above[2]; wall++; filledWall[k] = 1;
    }
  }
  // Carried down column by column it streaks: evened out along each row.
  const R = 12, ev = Buffer.from(room);
  for (let k = 0; k < W * H; k++) {
    if (!filledWall[k]) continue;
    const x = k % W, sum = [0, 0, 0];
    let n = 0;
    for (let d = -R; d <= R; d++) { const xx = x + d; if (xx < 0 || xx >= W) continue; for (let c = 0; c < 3; c++) sum[c] += room[(k + d) * 3 + c]; n++; }
    for (let c = 0; c < 3; c++) ev[k * 3 + c] = Math.round(sum[c] / n);
  }
  ev.copy(room);
  const raw = (b: Buffer, c: 3 | 4) => sharp(b, { raw: { width: W, height: H, channels: c } });
  writeFileSync(file("balloons.webp"), await raw(out, 4).webp({ quality: 90, alphaQuality: 100 }).toBuffer());
  writeFileSync(file("families.png"), await raw(outFam, 3).png().toBuffer());
  writeFileSync(file("room.webp"), await raw(room, 3).webp({ quality: 90 }).toBuffer());
  console.log(set, move.size, "crown balloons lowered", DROP, "px;", wall, "px of wall carried down");
}

(async () => {
  const sets = process.argv.slice(2).length ? process.argv.slice(2) : SETS;
  for (const set of sets) await lower(set);
})();
