"use client";

// 2026-10-23: a live sketch of the customer's choices — not a render. It is
// drawn from the configuration alone (boards, colours, lettering, balloons,
// florals, neon, number light, plinths and standees) and changes the moment
// a choice does, so each step can be seen as it is made. The same layout also
// draws the small clickable piece picker on the Style tab.

import { useEffect, useId, useMemo, useState } from "react";
import {
  themeById,
  resolveTextColorHex,
  normalizeBalloonStyle,
  textSizeScale,
  messageLines,
  foilColourFor,
  SHIMMER_COLOR_HEX,
  type BuilderConfig,
  type BackdropItem,
  type BoardLettering,
} from "@/lib/config";
import { useLetteringLayout } from "./useLetteringLayout";
import { hexPaletteKind, sceneBalloonSet, setHexes, themeBalloonSets } from "@/lib/balloonSets";
import { bannerPrintTheme } from "@/lib/bannerPrintThemes";
import { wavyBoardPath, wavyFacePath, wavyBorderColor } from "@/lib/wavyBoard";

const VB = 1000;
const FLOOR = 870;

/**
 * 2026-10-24: the Single Round is drawn on the customer's own render of it
 * (Frozen, no lettering, snowflakes removed), cut into layers: the room with
 * the plinth painted out, a mask of the board (where its colour goes), the
 * balloons on their own, and the plinth. The board's lettering goes between
 * the room and the balloons; plinths, neon, number and standees on top.
 * Geometry is in fractions of the square image.
 */
const ROUND = { cx: 0.507, cy: 0.547, r: 0.283 };
/**
 * 2026-11-01 (owner: "roundda sadece live sketch bu şekilde yapmıştık, diğer
 * backdrop seçeneklerini … bütün temalara uygulamamız lazım"): every setup
 * with a photographed base is drawn on it, made the same way
 * (scripts/sketch/sketch-base.ts). Keyed by the boards' types, left to right.
 */
type PhotoBase = {
  room: string;
  balloons: string;
  // Which balloon family each pixel belongs to (0 white/silver, 100 blue,
  // 200 lilac), worked out ahead of time and smoothed, so a balloon's
  // highlight is repainted with the balloon.
  families: string;
  /** families.png's step between families: 100 for the Frozen photos' three (white/silver/clear first, kept
   *  so when the palette has one), 50 for a theme's own (one per its colour, 255 for a balloon left as shot). */
  familyStep?: number;
  /** A set photographed whole (the Customized Themed set): no balloon layer of its own, nothing repainted. */
  fixed?: boolean;
  /** Each board, left to right: where it shows (none for the ring), its box and where its words go. */
  boards: { mask?: string; rim?: string; x0: number; y0: number; x1: number; y1: number; text: { cx: number; cy: number; w: number } }[];
  /** The photographed plinth (the XXL, 90 cm): left, top, width, height. */
  plinth: { x: number; y: number; w: number; h: number };
  /** Florals tucked into the garland: x, y and their turn in degrees. */
  florals: [number, number, number][];
  /** Where the number and the standees stand when there are no plinths. */
  numberX: number;
  standeeX: [number, number];
};
const SK = "/design/sketch";
const fromPx = (pts: [number, number][]) => pts.map(([x, y], i) => [x / 1024, y / 1024, (i * 67) % 180 - 60] as [number, number, number]);
const PHOTO_BASES: Record<string, PhotoBase> = {
  round: {
    room: `${SK}/round-room.webp`, balloons: `${SK}/round-balloons.webp`, families: `${SK}/round-families.png`,
    // The garland covers the board's left side: the words sit right of centre.
    boards: [{ mask: `${SK}/round-board-mask.png`, x0: ROUND.cx - ROUND.r, y0: ROUND.cy - ROUND.r, x1: ROUND.cx + ROUND.r, y1: ROUND.cy + ROUND.r,
      text: { cx: ROUND.cx + ROUND.r * 0.12, cy: ROUND.cy - ROUND.r * 0.18, w: ROUND.r * 2 * 0.66 } }],
    plinth: { x: 0.5, y: 0.625, w: 0.0875, h: 0.255 },
    florals: fromPx([[511, 200], [487, 270], [303, 340], [268, 410], [263, 480], [350, 550], [223, 620], [803, 620], [375, 690], [385, 760], [824, 760], [399, 830], [810, 830]]),
    numberX: 0.68, standeeX: [0.1, 0.92],
  },
  arch: {
    room: `${SK}/single_arch-room.webp`, balloons: `${SK}/single_arch-balloons.webp`, families: `${SK}/single_arch-families.png`,
    boards: [{ mask: `${SK}/single_arch-board-0.png`, x0: 0.2783, y0: 0.237, x1: 0.62, y1: 0.835, text: { cx: 0.4336, cy: 0.42, w: 0.266 } }],
    plinth: { x: 0.426, y: 0.65, w: 0.084, h: 0.245 },
    florals: fromPx([[442, 60], [462, 130], [582, 130], [485, 200], [551, 270], [662, 270], [680, 410], [758, 480], [708, 550], [667, 690], [644, 760], [761, 760], [773, 830]]),
    numberX: 0.2, standeeX: [0.13, 0.9],
  },
  "arch,arch": {
    room: `${SK}/double_arch-room.webp`, balloons: `${SK}/double_arch-balloons.webp`, families: `${SK}/double_arch-families.png`,
    boards: [
      { mask: `${SK}/double_arch-board-0.png`, x0: 0.335, y0: 0.19, x1: 0.541, y1: 0.826, text: { cx: 0.4552, cy: 0.4034, w: 0.173 } },
      { mask: `${SK}/double_arch-board-1.png`, x0: 0.529, y0: 0.273, x1: 0.804, y1: 0.837, text: { cx: 0.6626, cy: 0.4647, w: 0.2257 } },
    ],
    plinth: { x: 0.469, y: 0.626, w: 0.089, h: 0.26 },
    florals: fromPx([[224, 200], [210, 270], [179, 340], [270, 410], [837, 480], [261, 550], [131, 620], [843, 620], [285, 690], [277, 760], [929, 760], [282, 830], [922, 830]]),
    numberX: 0.9, standeeX: [0.12, 0.93],
  },
  "arch,open_arch_frame": {
    room: `${SK}/arch_open_frame-room.webp`, balloons: `${SK}/arch_open_frame-balloons.webp`, families: `${SK}/arch_open_frame-families.png`,
    boards: [
      { mask: `${SK}/arch_open_frame-board-0.png`, x0: 0.215, y0: 0.207, x1: 0.528, y1: 0.83, text: { cx: 0.395, cy: 0.3844, w: 0.2176 } },
      { mask: `${SK}/arch_open_frame-board-1.png`, x0: 0.531, y0: 0.297, x1: 0.81, y1: 0.831, text: { cx: 0.6692, cy: 0.4391, w: 0.1282 } },
    ],
    plinth: { x: 0.418, y: 0.635, w: 0.0875, h: 0.255 },
    florals: fromPx([[227, 60], [328, 130], [251, 200], [129, 270], [722, 270], [209, 340], [916, 340], [149, 480], [874, 550], [98, 690], [99, 760], [906, 760], [842, 830]]),
    numberX: 0.66, standeeX: [0.08, 0.95],
  },
  // 2026-11-02 ("shimmer neden perde gibi?"): both shimmers re-shot on the earlier shots she liked, a rigid
  // flat panel of sequins in a square grid.
  "arch,shimmer_wall": {
    room: `${SK}/arch_shimmer-room.webp`, balloons: `${SK}/arch_shimmer-balloons.webp`, families: `${SK}/arch_shimmer-families.png`,
    boards: [
      { mask: `${SK}/arch_shimmer-board-0.png`, x0: 0.2705, y0: 0.3584, x1: 0.4385, y1: 0.7656, text: { cx: 0.358, cy: 0.48, w: 0.12 } },
      { mask: `${SK}/arch_shimmer-board-1.png`, x0: 0.4365, y0: 0.3975, x1: 0.7061, y1: 0.7793, text: { cx: 0.571, cy: 0.51, w: 0.19 } },
    ],
    plinth: { x: 0.464, y: 0.647, w: 0.0573, h: 0.167 },
    florals: fromPx([[253, 410], [794, 410], [252, 480], [261, 550], [831, 550], [215, 620], [834, 620], [172, 690], [281, 690], [840, 690], [268, 760], [779, 760], [893, 760]]),
    numberX: 0.6, standeeX: [0.04, 0.97],
  },
  // 2026-11-02 (the owner: "wavy + shimmer backdropu yapalım"): laid out as the Arch + Shimmer, shot fresh.
  "wavy,shimmer_wall": {
    room: `${SK}/wavy_shimmer-room.webp`, balloons: `${SK}/wavy_shimmer-balloons.webp`, families: `${SK}/wavy_shimmer-families.png`,
    // The wavy board stands in front of its garland, on its rim ("backdrop önde olması lazım").
    boards: [
      { mask: `${SK}/wavy_shimmer-board-0.png`, rim: `${SK}/wavy_shimmer-rim-0.png`, x0: 0.2275, y0: 0.3389, x1: 0.4453, y1: 0.7598, text: { cx: 0.34, cy: 0.465, w: 0.15 } },
      { mask: `${SK}/wavy_shimmer-board-1.png`, x0: 0.4561, y0: 0.373, x1: 0.6865, y1: 0.7773, text: { cx: 0.571, cy: 0.5, w: 0.17 } },
    ],
    plinth: { x: 0.4275, y: 0.636, w: 0.059, h: 0.172 },
    florals: fromPx([[194, 340], [168, 410], [732, 410], [843, 410], [806, 480], [799, 550], [146, 620], [759, 620], [158, 690], [893, 690], [119, 760], [248, 760], [903, 760]]),
    numberX: 0.6, standeeX: [0.04, 0.97],
  },
  banner: {
    room: `${SK}/single_banner-room.webp`, balloons: `${SK}/single_banner-balloons.webp`, families: `${SK}/single_banner-families.png`,
    // The garland covers the banner's top right: the words sit a little left of centre.
    boards: [{ mask: `${SK}/single_banner-board-0.png`, x0: 0.209, y0: 0.249, x1: 0.8, y1: 0.83, text: { cx: 0.47, cy: 0.45, w: 0.3 } }],
    plinth: { x: 0.46, y: 0.66, w: 0.079, h: 0.23 },
    florals: fromPx([[395, 130], [384, 200], [634, 200], [439, 270], [744, 270], [649, 340], [705, 410], [821, 410], [783, 550], [808, 690], [841, 760], [607, 830], [845, 830]]),
    numberX: 0.14, standeeX: [0.08, 0.95],
  },
  shimmer_wall: {
    room: `${SK}/single_shimmer-room.webp`, balloons: `${SK}/single_shimmer-balloons.webp`, families: `${SK}/single_shimmer-families.png`,
    boards: [{ mask: `${SK}/single_shimmer-board-0.png`, x0: 0.3311, y0: 0.373, x1: 0.7109, y1: 0.7842, text: { cx: 0.521, cy: 0.496, w: 0.274 } }],
    plinth: { x: 0.489, y: 0.644, w: 0.0635, h: 0.185 },
    florals: fromPx([[703, 340], [284, 410], [277, 480], [799, 480], [814, 550], [246, 620], [770, 620], [180, 690], [293, 690], [896, 690], [178, 760], [762, 760], [901, 760]]),
    numberX: 0.62, standeeX: [0.06, 0.96],
  },
  // 2026-11-02 ("triple arch bozuk"): re-shot on the earlier shot she liked, all three boards in sight.
  "half_arch,arch,half_arch": {
    room: `${SK}/triple_arch-room.webp`, balloons: `${SK}/triple_arch-balloons.webp`, families: `${SK}/triple_arch-families.png`,
    boards: [
      { mask: `${SK}/triple_arch-board-0.png`, x0: 0.2725, y0: 0.452, x1: 0.3643, y1: 0.766, text: { cx: 0.32, cy: 0.56, w: 0.07 } },
      { mask: `${SK}/triple_arch-board-1.png`, x0: 0.367, y0: 0.398, x1: 0.637, y1: 0.766, text: { cx: 0.502, cy: 0.508, w: 0.19 } },
      { mask: `${SK}/triple_arch-board-2.png`, x0: 0.639, y0: 0.447, x1: 0.763, y1: 0.766, text: { cx: 0.7, cy: 0.56, w: 0.07 } },
    ],
    plinth: { x: 0.4685, y: 0.629, w: 0.067, h: 0.195 },
    florals: fromPx([[511, 270], [595, 340], [393, 410], [773, 410], [199, 480], [675, 480], [192, 550], [192, 620], [138, 690], [265, 690], [883, 690], [298, 760], [899, 760]]),
    numberX: 0.9, standeeX: [0.06, 0.95],
  },
  // 2026-11-01: the Wavy Backdrop (the Single Arch photo, its board made wavy) and the Fringe Backdrop (the Banner
  // photo, its board made a layered fringe of tissue and tinsel in a wooden frame, repainted with the balloons).
  wavy: {
    room: `${SK}/single_wavy-room.webp`, balloons: `${SK}/single_wavy-balloons.webp`, families: `${SK}/single_wavy-families.png`,
    // Re-shot 2026-11-02 from a real render of its garland as in the owner's unicorn photo ("wavy backdrop balon
    // lokasyonlari ve genisligi ayni olsun burdakiyle"): a wide column down the left, over the top to the right
    // shoulder, a cluster on the right from halfway down; the offset rim has its own mask.
    boards: [{ mask: `${SK}/single_wavy-board-0.png`, rim: `${SK}/single_wavy-rim-0.png`, x0: 0.408, y0: 0.279, x1: 0.652, y1: 0.831, text: { cx: 0.55, cy: 0.436, w: 0.175 } }],
    plinth: { x: 0.488, y: 0.646, w: 0.084, h: 0.245 },
    florals: fromPx([[413, 130], [403, 200], [478, 270], [298, 340], [306, 480], [353, 550], [369, 620], [204, 690], [685, 690], [361, 760], [804, 760], [404, 830], [796, 830]]),
    numberX: 0.5, standeeX: [0.06, 0.93],
  },
  fringe: {
    room: `${SK}/single_fringe-room.webp`, balloons: `${SK}/single_fringe-balloons.webp`, families: `${SK}/single_fringe-families.png`,
    // Re-shot 2026-11-02 from a real render, to the owner's second fringe photo ("fringe neden boyle gozukuyor
    // bunun gibi olmali"): wide vertical colour blocks, tinsel panels over them, packed solid to the floor.
    boards: [{ mask: `${SK}/single_fringe-board-0.png`, x0: 0.213, y0: 0.252, x1: 0.787, y1: 0.83, text: { cx: 0.41, cy: 0.45, w: 0.32 } }],
    plinth: { x: 0.456, y: 0.635, w: 0.0875, h: 0.255 },
    florals: fromPx([[400, 250], [470, 200], [560, 215], [650, 250], [760, 300], [840, 380], [860, 480], [840, 600], [860, 720], [780, 820], [690, 830]]),
    numberX: 0.2, standeeX: [0.06, 0.96],
  },
  // 2026-11-01: the Customized Themed set (Frozen), the owner's photo re-made with generic art and no name;
  // the name goes on the top of the centre panel. It is shown as it is. 2026-11-02 (the owner: "stage gibi olan
  // şeyi kaldıralım, floordaki banner da kalksın"): its round stage and printed floor mat edited out, so the
  // plinths stand on the floor in front of the castle panel, to the set's scale (250 cm tall).
  themed_set: {
    room: `${SK}/themed_set-room.webp`, balloons: "", families: "", fixed: true,
    boards: [{ x0: 0.39, y0: 0.17, x1: 0.61, y1: 0.75, text: { cx: 0.515, cy: 0.37, w: 0.17 } }],
    plinth: { x: 0.453, y: 0.59, w: 0.094, h: 0.212 },
    florals: [],
    numberX: 0.78, standeeX: [0.07, 0.93],
  },
  balloon_ring: {
    room: `${SK}/balloon_ring-room.webp`, balloons: `${SK}/balloon_ring-balloons.webp`, families: `${SK}/balloon_ring-families.png`,
    // No board: the ring is all balloons, with the wall showing through.
    boards: [{ x0: 0.06, y0: 0.16, x1: 0.96, y1: 0.88, text: { cx: 0.52, cy: 0.45, w: 0.3 } }],
    plinth: { x: 0.47, y: 0.635, w: 0.0875, h: 0.255 },
    florals: fromPx([[520, 130], [314, 270], [219, 340], [809, 340], [741, 410], [756, 480], [906, 550], [896, 620], [753, 690], [385, 760], [796, 760], [386, 830], [917, 830]]),
    numberX: 0.66, standeeX: [0.04, 0.97],
  },
};
/**
 * Every setup photographed per theme and balloon set (2026-11-02, the owner: "boyayarak yapma render al
 * hepsini sonra ordan koy", "pastel tone opsiyon 1 … bright color opsiyon 2"): re-shot in bright neutral
 * daylight, in /design/sketch/<theme>-<set>/, one family per set colour (families.png holds its turn × 50,
 * 255 left as shot). A set as chosen shows as shot, never repainted; a mix of one's own is repainted on the
 * nearest shot — its theme's own set of that kind, else Unicorn's (colours) or Frozen's (whites and silvers).
 */
const SET_SHOT_THEMES = new Set(["unicorn", "frozen"]);
function setShot(themeId: string, palette: string[]): { folder: string; asShot: boolean } {
  const kind = sceneBalloonSet(themeId, palette);
  if (SET_SHOT_THEMES.has(themeId)) {
    const own = themeBalloonSets(themeId)[kind];
    const themeDefault = themeById(themeId)?.balloonColors ?? [];
    const asShot = sameColours(palette, setHexes(own)) || (hexPaletteKind(themeDefault) === kind && sameColours(palette, themeDefault.slice(0, 5)));
    return { folder: `${themeId}-${kind}`, asShot };
  }
  const sat = (h: string) => { const [r, g, b] = hexRgb(h), mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0; };
  const whites = palette.filter((h) => sat(h) < 0.15).length * 2 >= palette.length;
  return { folder: `${whites ? "frozen" : "unicorn"}-${kind}`, asShot: false };
}
function themeShot(base: PhotoBase, folder: string): PhotoBase {
  const at = (u: string) => u.replace(`${SK}/`, `${SK}/${folder}/`).replace("round-board-mask", "round-board-0");
  return { ...base, room: at(base.room), balloons: at(base.balloons), families: at(base.families), familyStep: 50,
    boards: base.boards.map((b) => ({ ...b, mask: b.mask && at(b.mask), rim: b.rim && at(b.rim) })) };
}
/** The rainbow balloon sprite (scripts/sketch/rainbow-sprite.mjs): its width in the sketch, and height / width. */
const RAINBOW_W = 165;
const RAINBOW_ASPECT = 0.558;
/** The plinth cut from the same photo, used for every plinth in every sketch. */
const PLINTH_SRC = "/design/sketch/plinth.webp";
const PLINTH_CM: Record<string, { h: number; d: number }> = { large: { h: 90, d: 40 }, medium: { h: 75, d: 36 }, small: { h: 60, d: 33 } };

type Rgb = [number, number, number];
const hexRgb = (h: string): Rgb => {
  const m = h.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.padEnd(6, "0").slice(0, 6);
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
/** Mirror-metal lettering (silver, gold, rose gold): its tint, else null. */
const METAL_TINT: Record<string, [number, number, number]> = {
  silver: [1.0, 1.01, 1.04], gold: [1.0, 0.84, 0.5], rose_gold: [1.0, 0.8, 0.74],
};
const tintHex = (t: [number, number, number], l: number) => "#" + t.map((k) =>
  Math.max(0, Math.min(255, Math.round(l * 255 * (l > 0.5 ? k : 1 + (k - 1) * 0.5))))
    .toString(16).padStart(2, "0")).join("");
const isWhite = (h: string) => { const [r, g, b] = hexRgb(h || "#ffffff"); return r > 246 && g > 246 && b > 246; };

type BaseData = { img: ImageData; fam: Uint8Array; means: { rgb: Rgb; l: number }[]; neutral: boolean };
const AS_SHOT = 255;
const baseCache = new Map<string, Promise<BaseData>>();
const pixelsOf = (src: string, w?: number, h?: number) => new Promise<ImageData>((resolve, reject) => {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement("canvas");
    c.width = w ?? im.naturalWidth; c.height = h ?? im.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, 0, 0, c.width, c.height);
    resolve(ctx.getImageData(0, 0, c.width, c.height));
  };
  im.onerror = reject;
  im.src = src;
});
function loadBase(src: string, familiesSrc: string, step = 100): Promise<BaseData> {
  let p = baseCache.get(src);
  if (!p) {
    p = pixelsOf(src).then(async (img) => {
      const map = await pixelsOf(familiesSrc, img.width, img.height);
      const px = img.data;
      const fam = new Uint8Array(img.width * img.height);
      const last = Math.round(200 / step);
      const sum = Array.from({ length: last + 1 }, () => [0, 0, 0, 0]);
      for (let k = 0, i = 0; i < px.length; k++, i += 4) {
        const f = step < 100 && map.data[i] > 230 ? AS_SHOT : Math.min(last, Math.round(map.data[i] / step));
        fam[k] = f;
        if (f === AS_SHOT || px[i + 3] < 128) continue;
        sum[f][0] += px[i]; sum[f][1] += px[i + 1]; sum[f][2] += px[i + 2]; sum[f][3]++;
      }
      const means = sum.map(([r, g, b, n]) => {
        const rgb: Rgb = n ? [r / n, g / n, b / n] : [235, 235, 235];
        return { rgb, l: lum(...rgb) };
      });
      return { img, fam, means, neutral: step === 100 };
    });
    baseCache.set(src, p);
  }
  return p;
}

/**
 * The base's balloons repainted in the chosen colours, keeping their shading:
 * each family takes the closest chosen colour. `asShot` (the palette the photo
 * was taken with) shows the photo untouched — "purple kaybolmus" came from
 * repainting Frozen's own lilac a paler lilac.
 */
function useRecoloredBase(src: string | null, familiesSrc: string, palette: string[], asShot: boolean, familyStep?: number): string | null {
  // Kept with the base it was made for: on another setup's room a previous
  // setup's balloons must not show while its own are repainted.
  const [got, setGot] = useState<{ src: string | null; url: string | null }>({ src: null, url: null });
  const setUrl = (url: string | null) => setGot((prev) => {
    if (prev.url?.startsWith("blob:") && prev.url !== url) URL.revokeObjectURL(prev.url);
    return { src, url };
  });
  const key = palette.join(",");
  useEffect(() => () => { setGot((prev) => { if (prev.url?.startsWith("blob:")) URL.revokeObjectURL(prev.url); return prev; }); }, []);
  useEffect(() => {
    if (!src) { setUrl(null); return; }
    if (asShot) { setUrl(src); return; }
    let alive = true;
    loadBase(src, familiesSrc, familyStep).then(({ img, fam, means, neutral }) => {
      if (!alive) return;
      const cols = palette.map(hexRgb);
      const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const target: (Rgb | null)[] = means.map(() => null);
      const used = new Set<number>();
      // White and silver stay white and silver when a white, silver or grey
      // is chosen (matched by distance, the chrome would pull them to a pastel).
      const sat = (c: Rgb) => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const neutralK = cols.map((c, k) => ({ c, k })).filter(({ c }) => sat(c) < 0.12).sort((a, b) => lum(...b.c) - lum(...a.c))[0];
      if (neutral && neutralK) { target[0] = neutralK.c; used.add(neutralK.k); }
      // The rest: greedy nearest match, each chosen colour used once while any are left.
      const pairs = means.flatMap((m, f) => cols.map((c, k) => ({ f, k, dd: dist(m.rgb, c) }))).sort((a, b) => a.dd - b.dd);
      for (const pr of pairs) {
        if (target[pr.f] || (used.has(pr.k) && used.size < cols.length)) continue;
        target[pr.f] = cols[pr.k]; used.add(pr.k);
      }
      const out = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
      const px = out.data;
      const keep = target.map((t, f) => !t || dist(t, means[f].rgb) < 24 || (neutral && f === 0 && sat(t) < 0.12 && lum(...t) > 170));
      for (let k = 0, i = 0; i < px.length; k++, i += 4) {
        if (px[i + 3] === 0) continue;
        const f = fam[k];
        if (f === AS_SHOT || keep[f]) continue;
        const t = target[f]!, lb = means[f].l, l = lum(px[i], px[i + 1], px[i + 2]);
        for (let c = 0; c < 3; c++) {
          px[i + c] = l <= lb ? t[c] * (l / lb) : t[c] + (255 - t[c]) * ((l - lb) / (255 - lb));
        }
      }
      const cv = document.createElement("canvas");
      cv.width = out.width; cv.height = out.height;
      cv.getContext("2d")!.putImageData(out, 0, 0);
      cv.toBlob((b) => {
        if (!alive || !b) return;
        setUrl(URL.createObjectURL(b));
      }, "image/png");
    }).catch(() => { if (alive) setUrl(src); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, familiesSrc, key, asShot]);
  return got.src === src ? got.url : null;
}

type Piece = {
  item: BackdropItem;
  idx: number;
  x: number;      // left edge
  w: number;
  h: number;
  top: number;    // y of the top
  curveLeft: boolean; // half arch: which top corner is rounded
};

/** Pieces laid out left to right at a shared scale, the group centred. */
function layoutPieces(items: BackdropItem[], room: { maxW: number; maxH: number }): { pieces: Piece[]; scale: number } {
  if (items.length === 0) return { pieces: [], scale: 1 };
  const gapCm = 14;
  const totalWcm = items.reduce((s, it) => s + Math.max(40, it.widthCm || 100), 0) + gapCm * (items.length - 1);
  const maxHcm = Math.max(...items.map((it) => Math.max(60, it.heightCm || 200)));
  const scale = Math.min(room.maxW / totalWcm, room.maxH / maxHcm);
  let x = (VB - totalWcm * scale) / 2;
  const mid = VB / 2;
  const pieces = items.map((item, idx) => {
    const w = Math.max(40, item.widthCm || 100) * scale;
    const h = Math.max(60, item.heightCm || 200) * scale;
    const p: Piece = { item, idx, x, w, h, top: FLOOR - h, curveLeft: x + w / 2 < mid };
    x += w + gapCm * scale;
    return p;
  });
  return { pieces, scale };
}

/** The board's outline as an SVG path (filled boards), or null for the ring. */
function piecePath(p: Piece, floor = FLOOR): string | null {
  const { x, w, top } = p;
  const r = w / 2;
  switch (p.item.type) {
    case "round": {
      const cy = floor - r;
      return `M ${x} ${cy} a ${r} ${r} 0 1 0 ${w} 0 a ${r} ${r} 0 1 0 ${-w} 0 Z`;
    }
    case "rect": case "banner": case "shimmer_wall": case "fringe": case "themed_set":
      return `M ${x} ${floor} V ${top} H ${x + w} V ${floor} Z`;
    case "wavy":
      return wavyBoardPath(x, top, w, floor - top);
    case "half_arch": {
      const rr = Math.min(w, floor - top);
      return p.curveLeft
        ? `M ${x} ${floor} V ${top + rr} A ${rr} ${rr} 0 0 1 ${x + rr} ${top} H ${x + w} V ${floor} Z`
        : `M ${x} ${floor} V ${top} H ${x + w - rr} A ${rr} ${rr} 0 0 1 ${x + w} ${top + rr} V ${floor} Z`;
    }
    case "balloon_ring":
      return null;
    default: // arch and open frame
      return `M ${x} ${floor} V ${top + r} A ${r} ${r} 0 0 1 ${x + w} ${top + r} V ${floor} Z`;
  }
}

/** The fringe's strands (2026-11-01, the owner's fringe references: "o frame'in içinde olsun … yere değmeli,
 *  aralarda glitter renkler de ok"; 2026-11-02, her second photo, "bunun gibi olmali"): wide vertical blocks of
 *  tissue streamers in the party's colours, packed to the floor, with panels of gold tinsel hung over them from
 *  different heights. */
function fringeStrands(x: number, top: number, w: number, h: number, palette: string[], seed: number): { x: number; y0: number; y1: number; w: number; hex: string }[] {
  const rnd = seeded(seed * 31 + 7), cols = palette.length ? palette : ["#f7c5d8"];
  const blocks = 9, bw = w / blocks, out: { x: number; y0: number; y1: number; w: number; hex: string }[] = [];
  for (let b = 0; b < blocks; b++) {
    for (let sx = x + b * bw; sx < x + (b + 1) * bw; sx += 3) {
      out.push({ x: sx + rnd(), y0: top, y1: top + h - rnd() * h * 0.04, w: 3.4, hex: cols[b % cols.length] });
    }
  }
  for (const [fx, fw, ft, fl] of [[0.03, 0.07, 0.22, 0.42], [0.37, 0.07, 0.35, 0.5], [0.7, 0.07, 0.3, 0.6]]) {
    for (let sx = x + fx * w, k = 0; sx < x + (fx + fw) * w; sx += 2, k++) {
      out.push({ x: sx, y0: top + ft * h, y1: Math.min(top + h, top + (ft + fl * (0.92 + rnd() * 0.1)) * h), w: 1.6, hex: k % 2 ? "#b8902e" : "#f3d98b" });
    }
  }
  return out;
}

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points along a piece's outer edge where its garland sits, from the foot up. */
function garlandTrack(p: Piece, side: "left" | "right" | "both"): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const { x, w, top } = p;
  const r = w / 2;
  const cx = x + r;
  // Angles in units of pi, walked from a to b.
  const arc = (ox: number, oy: number, rad: number, a: number, b: number) => {
    const n = Math.max(4, Math.round(Math.abs(b - a) * rad / 9));
    for (let i = 0; i <= n; i++) {
      const t = Math.PI * (a + (b - a) * (i / n));
      pts.push({ x: ox + Math.cos(t) * rad, y: oy - Math.sin(t) * rad });
    }
  };
  if (p.item.type === "round" || p.item.type === "balloon_ring") {
    const cy = FLOOR - r;
    if (side === "right") arc(cx, cy, r, -0.4, 0.62);
    else if (side === "left") arc(cx, cy, r, 1.4, 0.38);
    else arc(cx, cy, r, 1.4, -0.4);
    return pts;
  }
  if (p.item.type === "half_arch") {
    // The curved corner faces outward; the garland follows it.
    const rr = Math.min(w, FLOOR - top);
    const sx = p.curveLeft ? x : x + w;
    for (let y = FLOOR; y >= top + rr; y -= 18) pts.push({ x: sx, y });
    if (p.curveLeft) arc(x + rr, top + rr, rr, 1, 0.5); else arc(x + w - rr, top + rr, rr, 0, 0.5);
    return pts;
  }
  const flat = ["rect", "banner", "shimmer_wall", "wavy", "fringe"].includes(p.item.type);
  const springY = flat ? top : top + r;
  const up = (sx: number) => { for (let y = FLOOR; y >= springY; y -= 18) pts.push({ x: sx, y }); };
  const along = (from: number, to: number) => { for (let i = 0; i <= 10; i++) pts.push({ x: x + w * (from + (to - from) * (i / 10)), y: top }); };
  if (side === "left" || side === "both") {
    up(x);
    if (flat) along(0, side === "both" ? 1 : 0.5); else arc(cx, springY, r, 1, side === "both" ? 0 : 0.45);
    if (side === "both") up(x + w);
  } else {
    up(x + w);
    if (flat) along(1, 0.5); else arc(cx, springY, r, 0, 0.55);
  }
  return pts;
}

/**
 * The light-up marquee number, drawn as the renders' layout guide draws it
 * (marqueeBlockDigit): a deep white box letter with thick strokes, rounded
 * corners and a row of lit bulbs down every stroke.
 */
function MarqueeDigit({ glyph, x, y, w, h, uid }: { glyph: string; x: number; y: number; w: number; h: number; uid: string }) {
  type Pt = [number, number];
  const t = w * 0.36;
  const midT = h / 2 - t / 2;
  const rect = (rx: number, ry: number, rw: number, rh: number) => ({ x: rx, y: ry, w: rw, h: rh });
  const SEG: Record<string, { r: ReturnType<typeof rect>; line: [Pt, Pt] }> = {
    a: { r: rect(0, 0, w, t), line: [[t / 2, t / 2], [w - t / 2, t / 2]] },
    b: { r: rect(w - t, 0, t, h / 2 + t / 2), line: [[w - t / 2, t / 2], [w - t / 2, h / 2]] },
    c: { r: rect(w - t, midT, t, h - midT), line: [[w - t / 2, h / 2], [w - t / 2, h - t / 2]] },
    d: { r: rect(0, h - t, w, t), line: [[t / 2, h - t / 2], [w - t / 2, h - t / 2]] },
    e: { r: rect(0, midT, t, h - midT), line: [[t / 2, h / 2], [t / 2, h - t / 2]] },
    f: { r: rect(0, 0, t, h / 2 + t / 2), line: [[t / 2, t / 2], [t / 2, h / 2]] },
    g: { r: rect(0, midT, w, t), line: [[t / 2, h / 2], [w - t / 2, h / 2]] },
  };
  const DIGIT: Record<string, string> = {
    "0": "abcdef", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
    "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  };
  let parts: { d: string; line: [Pt, Pt] }[];
  const rectD = (r: ReturnType<typeof rect>) => `M ${r.x} ${r.y} h ${r.w} v ${r.h} h ${-r.w} Z`;
  if (glyph === "1") {
    const bx = w * 0.40, t1 = w * 0.42;
    parts = [
      { d: rectD(rect(bx, 0, t1, h)), line: [[bx + t1 / 2, t / 2], [bx + t1 / 2, h - t / 2]] },
      { d: `M ${bx + t1 / 2} 0 L ${bx + t1 / 2} ${t * 1.15} L ${w * 0.06} ${h * 0.3} L ${w * 0.06} ${h * 0.3 - t * 1.05} Z`,
        line: [[bx, t * 0.55], [w * 0.06 + t * 0.45, h * 0.3 - t * 0.6]] },
    ];
  } else {
    parts = (DIGIT[glyph] ?? DIGIT["8"]).split("").map((k) => ({ d: rectD(SEG[k].r), line: SEG[k].line }));
  }
  const bulbs: Pt[] = [];
  const step = h * 0.14;
  for (const pt of parts) {
    const [[x0, y0], [x1, y1]] = pt.line;
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i <= n; i++) {
      const q: Pt = [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n];
      if (!bulbs.some((b) => Math.hypot(b[0] - q[0], b[1] - q[1]) < t * 0.6)) bulbs.push(q);
    }
  }
  const dx = w * 0.075, dy = -w * 0.045, br = w * 0.075;
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <clipPath id={`${uid}c`}><rect width={w} height={h} rx={w * 0.12} /></clipPath>
        <clipPath id={`${uid}s`}><rect x={dx} y={dy} width={w} height={h} rx={w * 0.12} /></clipPath>
      </defs>
      <g clipPath={`url(#${uid}s)`}>{parts.map((p, i) => <path key={i} d={p.d} transform={`translate(${dx} ${dy})`} fill="#cfcac2" />)}</g>
      <g clipPath={`url(#${uid}c)`}>
        {parts.map((p, i) => <path key={`o${i}`} d={p.d} fill="#a9a6a0" stroke="#a9a6a0" strokeWidth={3} strokeLinejoin="round" />)}
        {parts.map((p, i) => <path key={`f${i}`} d={p.d} fill="#f8f6f2" />)}
      </g>
      {bulbs.map(([bx, by], i) => <circle key={i} cx={bx} cy={by} r={br * 1.9} fill="url(#skBulb)" />)}
    </g>
  );
}

/** A foil number balloon on a small bunch of balloons, as the guide draws it (foilNumberBunch). */
function FoilDigit({ glyph, x, y, w, h, hex, palette, uid }: { glyph: string; x: number; y: number; w: number; h: number; hex: string; palette: string[]; uid: string }) {
  const [r, g, b] = hexRgb(hex);
  const mix = (t: number, to: number) => `rgb(${[r, g, b].map((v) => Math.round(v + (to - v) * t)).join(",")})`;
  // A low bunch of medium balloons at its feet in the garland's colours, the
  // number standing in front of it, whole — as the guide draws it.
  const R = w * 0.22, cx = x + w / 2, by = y + h;
  const digitH = h * 0.8, baseY = by - R * 1.75;
  const spots: [number, number, number][] = [[-1.55, -1, 1], [-0.52, -1.05, 1.05], [0.52, -1, 1], [1.55, -1.05, 1.05], [-1.05, -1.95, 0.8], [1.05, -1.9, 0.8]];
  const cols = palette.length ? palette : [hex, "#ffffff"];
  return (
    <g>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0.35" y2="1">
          {[[0, mix(0.75, 255)], [0.3, mix(0.1, 0)], [0.48, mix(0.85, 255)], [0.66, mix(0.25, 0)], [1, mix(0.45, 255)]].map(([o, c]) => <stop key={o as number} offset={o as number} stopColor={c as string} />)}
        </linearGradient>
      </defs>
      {spots.map(([ox, oy, k], i) => (
        <g key={i}>
          <circle cx={cx + ox * R} cy={by + oy * R} r={R * k} fill={cols[(i * 2) % cols.length]} stroke="rgba(39,22,23,.12)" strokeWidth={1} />
          <circle cx={cx + ox * R} cy={by + oy * R} r={R * k} fill="url(#skShine)" />
        </g>
      ))}
      <text x={cx} y={baseY} textAnchor="middle" fontFamily="var(--bz-sans), Arial, sans-serif" fontWeight={800} fontSize={digitH / 0.72}
        transform={`translate(${cx} 0) scale(0.8 1) translate(${-cx} 0)`}
        fill={`url(#${uid})`} stroke={mix(0.35, 0)} strokeWidth={w * 0.1} strokeLinejoin="round" style={{ paintOrder: "stroke" }}>{glyph}</text>
    </g>
  );
}

const sameColours = (a: string[], b: string[]) =>
  a.length === b.length && a.every((c) => b.some((x) => x.toLowerCase() === c.toLowerCase()));

/**
 * 2026-10-26: Typography System lettering — the engine's own paths (the same
 * the render guide draws), scaled into the board's clear area and centred
 * where the sketch puts lettering.
 */
function SketchLettering({ lettering, spot, fill, metal, gid }: {
  lettering: BoardLettering;
  /** Where the lettering goes for a block this tall: its centre and the clear width. */
  spot: (blockH: number) => { cx: number; cy: number; w: number };
  fill: string;
  metal?: [number, number, number];
  gid: string;
}) {
  const drawing = useLetteringLayout(lettering);
  if (!drawing) return null;
  const w = spot(0).w;
  const s = w / drawing.box.widthMm, h = drawing.box.heightMm * s;
  const at = spot(h * 0.62);
  return (
    <g transform={`translate(${at.cx - w / 2} ${at.cy - h / 2}) scale(${s})`} filter="url(#skSoft)" data-testid="sketch-lettering" data-hash={drawing.hash}>
      {metal && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0.25" y2="1">
            {[[0, 0.94], [0.3, 0.6], [0.47, 1], [0.6, 0.5], [0.78, 0.86], [1, 0.62]].map(([o, l]) => <stop key={o} offset={o} stopColor={tintHex(metal, l)} />)}
          </linearGradient>
        </defs>
      )}
      {drawing.paths.map((p) => (
        <path key={p.role} d={p.d} data-role={p.role} fill={metal ? `url(#${gid})` : fill}
          stroke={metal ? tintHex(metal, 0.42) : undefined} strokeWidth={metal ? Math.max(0.6, p.fontSizeMm * 0.012) : undefined} />
      ))}
    </g>
  );
}

export default function LiveSketch({
  config,
  activeId,
  cutoutPreviews = [],
}: {
  config: BuilderConfig;
  /** The piece being styled — outlined in pink. */
  activeId?: string | null;
  /** Standee pictures (selected characters): the first left of the backdrop, the second right. */
  cutoutPreviews?: string[];
}) {
  const d = config.decor;
  const theme = themeById(config.theme);
  // 2026-10-26: several sketches on one page (My designs) — each one's
  // per-design gradients need their own ids.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const accent = theme?.accent ?? "#ff0d66";
  const items = d.backdropItems;
  const hasNumber = !!d.numberLight?.enabled && !!(d.numberLight.value ?? "").trim();
  const standees = cutoutPreviews.slice(0, 2);
  // A lone round board is drawn on the photographed base.
  const balloonsOn = normalizeBalloonStyle(d.balloonStyle) !== "none";
  // Without balloons (or a ring that isn't a full one) the photo's own garland would stay, so then it's drawn plain.
  const fullRing = !items.some((i) => i.type === "balloon_ring") || (d.balloonRingStyle ?? "full") === "full";
  // The themed set is its photo, garland and all, whatever the balloon choice.
  const frozenBase = (balloonsOn && fullRing) || items.some((i) => i.type === "themed_set") ? PHOTO_BASES[items.map((i) => i.type).join(",")] ?? null : null;
  const palette = d.balloonColors.length ? d.balloonColors : (theme?.balloonColors ?? ["#f7c5d8"]);
  // The photo of the chosen theme and balloon set (a mix of one's own is repainted on the nearest).
  const shot = frozenBase && !frozenBase.fixed ? setShot(config.theme, palette) : null;
  // The fringe keeps its theme's Pastel tones whatever the balloons are (SceneModel.fringeColors).
  const fringePalette = (() => { const p = setHexes(themeBalloonSets(config.theme).pastel); return p.length ? p : palette; })();
  const base = useMemo(() => frozenBase && shot ? themeShot(frozenBase, shot.folder) : frozenBase, [frozenBase, shot?.folder]);
  const { pieces, scale } = useMemo(() => {
    if (!base) return layoutPieces(items, { maxW: hasNumber || standees.length ? 640 : 760, maxH: 640 });
    const ps: Piece[] = base.boards.map((b, idx) => ({ item: items[idx], idx, x: b.x0 * VB, w: (b.x1 - b.x0) * VB, h: (b.y1 - b.y0) * VB, top: b.y0 * VB, curveLeft: b.x0 + b.x1 < 1 }));
    // To scale: the first board as photographed for its size (a round one's width, else its height).
    const cm = items[0].type === "round" ? items[0].widthCm : items[0].heightCm;
    return { pieces: ps, scale: (items[0].type === "round" ? ps[0].w : ps[0].h) / Math.max(60, cm || 200) };
  }, [items, hasNumber, standees.length, base]);
  // Where things stand: the floor line, and how far in front of it the front row sits.
  const floorY = base ? (base.plinth.y + base.plinth.h) * VB : FLOOR;
  const rimOf = (item: BackdropItem) => wavyBorderColor(item.borderColor, palette, accent);
  const asShot = !shot || shot.asShot;
  const baseBalloons = useRecoloredBase(base && !base.fixed ? base.balloons : null, base?.families ?? "", palette, asShot, base?.familyStep);
  const garlandSize = 18 + scale * 8;
  // How far the garland reaches past the boards' outer edges.
  const garlandReach = !balloonsOn ? 12 : base ? 0.17 * VB : garlandSize * 2.6;
  const groupL = pieces.length ? pieces[0].x : VB / 2;
  const groupR = pieces.length ? pieces[pieces.length - 1].x + pieces[pieces.length - 1].w : VB / 2;
  const groupMid = base ? (base.plinth.x + base.plinth.w / 2) * VB : (groupL + groupR) / 2;

  // Plinths: the photographed one, sized by the ladder (XXL 90, XL 75, L 60 cm).
  // The biggest stands in the middle, the next on its left, the last on its right.
  const plinths = useMemo(() => {
    const sizes = d.plinthSizes.slice(0, 3);
    const dims = sizes.map((s) => {
      const c = PLINTH_CM[s] ?? PLINTH_CM.medium;
      const h = base ? base.plinth.h * VB * (c.h / 90) : c.h * scale;
      // 2026-11-02 ("plinth size bi tuhaf olmuş"): as wide as it really is (the XXL is 40 cm across, 90 tall);
      // the sprite alone drew it a quarter too narrow.
      return { h, w: h * (c.d / c.h) };
    });
    const order = dims.map((dm, i) => ({ ...dm, i })).sort((a, b) => b.h - a.h);
    const out: { x: number; y: number; w: number; h: number }[] = [];
    if (order[0]) out.push({ x: groupMid - order[0].w / 2, y: floorY - order[0].h, w: order[0].w, h: order[0].h });
    if (order[1]) out.push({ x: out[0].x - order[1].w * 1.02, y: floorY - order[1].h, w: order[1].w, h: order[1].h });
    if (order[2]) out.push({ x: out[0].x + out[0].w * 1.02, y: floorY - order[2].h, w: order[2].w, h: order[2].h });
    return out;
  }, [d.plinthSizes, base, scale, groupMid, floorY]);
  const plinthTop = plinths.length ? Math.min(...plinths.map((p) => p.y)) : Infinity;
  const plinthRight = plinths.length ? Math.max(...plinths.map((p) => p.x + p.w)) : groupMid;

  // Garland balloons (drawn setups): on the outer sides of the group, as the renders have them.
  const balloons = useMemo(() => {
    if (!balloonsOn || pieces.length === 0 || base) return [] as { x: number; y: number; r: number; c: string }[];
    const rnd = seeded(items.length * 131 + palette.length * 17 + 7);
    const out: { x: number; y: number; r: number; c: string }[] = [];
    const add = (track: { x: number; y: number }[], size: number) => {
      track.forEach((pt, i) => {
        const n = 2 + (i % 2);
        for (let k = 0; k < n; k++) {
          const r = size * (0.55 + rnd() * 0.75);
          out.push({ x: pt.x + (rnd() - 0.5) * size * 1.6, y: pt.y + (rnd() - 0.5) * size * 1.4, r, c: palette[Math.floor(rnd() * palette.length)] });
        }
      });
      // A pile at the foot.
      const foot = track[0];
      if (foot) for (let k = 0; k < 6; k++) {
        const r = size * (0.8 + rnd() * 0.7);
        out.push({ x: foot.x + (rnd() - 0.5) * size * 3.2, y: FLOOR - r * 0.9 - rnd() * size, r, c: palette[Math.floor(rnd() * palette.length)] });
      }
    };
    const size = garlandSize;
    if (pieces.length === 1) {
      const p = pieces[0];
      if (p.item.type === "balloon_ring" && d.balloonRingStyle === "none") return out;
      add(garlandTrack(p, p.item.type === "balloon_ring" && d.balloonRingStyle !== "half" ? "both" : "right"), size);
    } else {
      add(garlandTrack(pieces[0], "left"), size);
      add(garlandTrack(pieces[pieces.length - 1], "right"), size);
    }
    return out.sort((a, b) => a.y - b.y);
  }, [balloonsOn, pieces, palette, garlandSize, items.length, d.balloonRingStyle, base]);

  // 2026-11-02 ("rainbow balonlar da eklenebilsin"): three foil rainbows on clouds tucked into the garland,
  // low, middle and high along it, as the render guide places them.
  const rainbowSpots = !(d.rainbowBalloons && balloonsOn) ? [] : base
    ? [0.82, 0.5, 0.15].map((f) => base.florals[Math.min(base.florals.length - 1, Math.round(f * (base.florals.length - 1)))]).filter(Boolean)
      .map(([x, y]) => ({ x: x * VB, y: y * VB }))
    : [];
  // Florals on the base: tucked in along its garland.
  const baseFlorals = base && d.garlandFlorals
    ? base.florals.map(([x, y, a]) => ({ x: x * VB, y: y * VB, r: ROUND.r * VB * 0.104, a }))
    : [];

  const neon = d.neonSign?.enabled && (d.neonSign.text ?? "").trim() ? d.neonSign : null;
  const neonPiece = neon ? (pieces.find((p) => p.idx === (neon.panelIndex ?? 0)) ?? pieces[0]) : undefined;

  const lines = (s: string) => {
    // "Happy" over "Birthday", the name centred below them.
    const fixed = messageLines(s);
    if (fixed) return fixed;
    const words = s.trim().split(/\s+/);
    if (s.includes("\n")) return s.split("\n").map((l) => l.trim()).filter(Boolean);
    return words.length >= 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [s.trim()];
  };
  // The faces the render guide draws (lib/guideFontData.ts). `adv` is the
  // average character width in em, measured from each font (x1.06, the same
  // allowance the first script was tuned with), so the sketch fits the words
  // to the board as the guide does. 2026-10-25 (T0): Italianno replaces
  // Brittany Signature; Serif and Bold were Georgia and DM Sans, not the
  // Playfair Display and Archivo Black the renders print.
  const fontFor = (f: string) => f === "block"
    ? { family: "var(--bz-bold)", weight: 400, k: 0.13, adv: 0.65 }
    : f === "elegant" ? { family: "var(--bz-serif)", weight: 400, k: 0.14, adv: 0.55 }
    : { family: "var(--bz-signature)", weight: 400, k: 0.15, adv: 0.37 };

  /** Where a board's words go: its centre, clear of the garland and above the plinth. */
  const textSpot = (p: Piece, blockH: number) => {
    if (base) {
      const t = base.boards[p.idx].text;
      let cy = t.cy * VB;
      if (cy + blockH / 2 > plinthTop - 34) cy = plinthTop - 34 - blockH / 2;
      return { cx: t.cx * VB, cy, w: t.w * VB };
    }
    const cy = p.item.type === "round" ? FLOOR - p.w / 2 : p.top + p.h * 0.36;
    return { cx: p.x + p.w / 2, cy, w: p.w * 0.85 };
  };

  // Standees: the first stands left of the backdrop, the second right.
  // The light-up number: beside the plinths (or the middle of the decor without them).
  const numberH = 100 * scale;
  const numberDigits = String(d.numberLight?.value ?? "").replace(/[^0-9]/g, "").slice(0, 2);
  const digitW = numberH * 0.66, digitGap = digitW * 0.14;
  const numberW = digitW * numberDigits.length + digitGap * Math.max(0, numberDigits.length - 1);
  const numberX = Math.min(VB - numberW / 2 - 6, plinths.length ? plinthRight + numberW / 2 + 10 : base ? base.numberX * VB : groupMid + numberW / 2);
  const standeeBoxes = standees.map((src, i) => {
    // Wide enough for a two-character picture, which a narrow box shrank.
    const h = 150 * scale, w = h * 0.95;
    let cx = i === 0
      ? Math.max(w * 0.42, base ? base.standeeX[0] * VB : groupL - garlandReach * 0.55)
      : Math.min(VB - w * 0.42, base ? base.standeeX[1] * VB : groupR + garlandReach * 0.55);
    // The right one steps aside so the number stays in view.
    if (i === 1 && hasNumber) cx = Math.max(cx, numberX + numberW / 2 + w * 0.3);
    return { src, x: cx - w / 2, y: floorY + (base ? 0.05 * VB : 14) - h, w, h };
  });

  const wallTop = "#7d8085", wallLow = "#a4a6aa", floorTop = "#c3c4c7", floorLow = "#e2e3e5";

  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="bz-sketch" role="img" aria-label="Live sketch of your choices">
      <defs>
        <linearGradient id="skWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={wallTop} /><stop offset="1" stopColor={wallLow} /></linearGradient>
        <linearGradient id="skFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={floorTop} /><stop offset="1" stopColor={floorLow} /></linearGradient>
        <radialGradient id="skShine" cx="0.32" cy="0.28" r="0.75"><stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset=".35" stopColor="#fff" stopOpacity=".15" /><stop offset="1" stopColor="#000" stopOpacity=".12" /></radialGradient>
        <radialGradient id="skBulb"><stop offset="0" stopColor="#fffdf4" /><stop offset=".28" stopColor="#fff0c2" /><stop offset=".45" stopColor="#ffd978" stopOpacity=".85" /><stop offset=".7" stopColor="#ffc45c" stopOpacity=".28" /><stop offset="1" stopColor="#ffb040" stopOpacity="0" /></radialGradient>
        <filter id="skGlow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id="skShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity=".18" /></filter>
        <filter id="skSoft" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" floodColor="#2a2a30" floodOpacity=".28" /></filter>
        <pattern id="skSequin" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="6.2" fill="rgba(255,255,255,.55)" /><circle cx="6" cy="6" r="2" fill="#fff" opacity=".7" />
        </pattern>
        {base?.boards.map((b, i) => b.mask && (
          <mask key={i} id={`skBoard${uid}${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width={VB} height={VB}><image href={b.mask} width={VB} height={VB} /></mask>
        ))}
        {base?.boards.map((b, i) => b.rim && (
          <mask key={`r${i}`} id={`skRim${uid}${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width={VB} height={VB}><image href={b.rim} width={VB} height={VB} /></mask>
        ))}
      </defs>

      {base ? (
        <>
          {/* The room, the boards and (beneath the balloon layer) the balloons, as photographed. */}
          <image href={base.room} width={VB} height={VB} />
          {/* Each board's colour, laid over its photographed light and shade. */}
          {pieces.map((p) => {
            // The fringe was photographed in colour, in its frame: it is repainted with the balloons.
            if (p.item.type === "fringe") return null;
            // A shimmer wall was photographed silver; a board white.
            const tint = p.item.type === "shimmer_wall"
              ? ((d.shimmerColor ?? "silver") === "silver" ? null : SHIMMER_COLOR_HEX[d.shimmerColor!])
              : isWhite(p.item.color || d.backdropColor) ? null : p.item.color || d.backdropColor;
            const rim = base.boards[p.idx].rim;
            return (
              <g key={p.item.id}>
                {tint && base.boards[p.idx].mask && (
                  <rect width={VB} height={VB} fill={tint} mask={`url(#skBoard${uid}${p.idx})`} style={{ mixBlendMode: "multiply" }} />
                )}
                {/* A wavy board's offset rim, photographed white, in its colour. */}
                {rim && <rect width={VB} height={VB} fill={rimOf(p.item)} mask={`url(#skRim${uid}${p.idx})`} style={{ mixBlendMode: "multiply" }} />}
              </g>
            );
          })}
        </>
      ) : (
        <>
          <rect width={VB} height={FLOOR} fill="url(#skWall)" />
          <rect y={FLOOR} width={VB} height={VB - FLOOR} fill="url(#skFloor)" />
          {/* Boards */}
          {pieces.map((p) => {
            const path = piecePath(p);
            const color = p.item.type === "shimmer_wall"
              ? (SHIMMER_COLOR_HEX[d.shimmerColor ?? "silver"] ?? "#d1d5db")
              : (p.item.color || d.backdropColor || "#ffffff");
            if (p.item.type === "balloon_ring") {
              const r = p.w / 2;
              return <circle key={p.item.id} cx={p.x + r} cy={FLOOR - r} r={r - 6} fill="none" stroke="#efe6d2" strokeWidth={12} filter="url(#skShadow)" />;
            }
            if (p.item.type === "open_arch_frame") {
              return <path key={p.item.id} d={path!} fill="none" stroke={color} strokeWidth={Math.max(18, p.w * 0.16)} strokeLinejoin="round" filter="url(#skShadow)" />;
            }
            if (p.item.type === "fringe") {
              return (
                <g key={p.item.id} filter="url(#skShadow)">
                  <clipPath id={`skFringe${uid}${p.idx}`}><path d={path!} /></clipPath>
                  <g clipPath={`url(#skFringe${uid}${p.idx})`}>
                    {fringeStrands(p.x, p.top, p.w, FLOOR - p.top, fringePalette, p.idx).map((st, i) => (
                      <line key={i} x1={st.x} x2={st.x} y1={st.y0} y2={st.y1} stroke={st.hex} strokeWidth={st.w} strokeLinecap="round" />
                    ))}
                  </g>
                  {/* The slim wooden frame it hangs in. */}
                  <path d={`M ${p.x - 4} ${FLOOR} V ${p.top - 4} H ${p.x + p.w + 4} V ${FLOOR}`} fill="none" stroke="#d9bf94" strokeWidth={5} strokeLinejoin="round" />
                </g>
              );
            }
            if (p.item.type === "wavy") {
              return (
                <g key={p.item.id}>
                  <path d={path!} fill={rimOf(p.item)} stroke="rgba(39,22,23,.18)" strokeWidth={2} filter="url(#skShadow)" />
                  <path d={wavyFacePath(p.x, p.top, p.w, FLOOR - p.top)} fill={color} />
                </g>
              );
            }
            return (
              <g key={p.item.id}>
                <path d={path!} fill={color} stroke="rgba(39,22,23,.18)" strokeWidth={2} filter="url(#skShadow)" />
                {p.item.type === "shimmer_wall" && <path d={path!} fill="url(#skSequin)" />}
              </g>
            );
          })}
        </>
      )}

      {/* Theme graphic: a few small motifs on the board */}
      {pieces.filter((p) => p.item.graphic?.enabled && !base?.fixed && (base || piecePath(p))).map((p) => {
        // A banner in a theme with its own print (Frozen's castle, Unicorn's rainbow) carries it, as the render guide draws it.
        const print = p.item.type === "banner" ? bannerPrintTheme(p.item.graphic.assetId) : null;
        if (base && print) {
          return (
            <image key={`g${p.item.id}`} href={`${SK}/banner-print-${print}.webp`} x={p.x} y={p.top} width={p.w} height={p.h}
              preserveAspectRatio="xMidYMid slice" mask={`url(#skBoard${uid}${p.idx})`} style={{ mixBlendMode: "multiply" }} />
          );
        }
        const rnd = seeded(p.idx * 97 + 3);
        return (
          <g key={`g${p.item.id}`} opacity={base ? 0.5 : 0.75} mask={base?.boards[p.idx].mask ? `url(#skBoard${uid}${p.idx})` : undefined}>
            {/* On a photographed board, a light scatter like a print; on a drawn one, a few bold motifs. */}
            {Array.from({ length: base ? 16 : 6 }, (_, i) => {
              const cx = base ? p.x + p.w * (0.08 + rnd() * 0.8) : p.x + p.w * (0.3 + rnd() * 0.55);
              const cy = base ? p.top + p.h * (0.1 + rnd() * 0.8) : p.top + p.h * (0.5 + rnd() * 0.4);
              const s = p.w * (base ? 0.018 + rnd() * 0.012 : 0.05);
              return <path key={i} d={`M ${cx} ${cy - s} L ${cx + s * 0.3} ${cy - s * 0.3} L ${cx + s} ${cy} L ${cx + s * 0.3} ${cy + s * 0.3} L ${cx} ${cy + s} L ${cx - s * 0.3} ${cy + s * 0.3} L ${cx - s} ${cy} L ${cx - s * 0.3} ${cy - s * 0.3} Z`} fill={accent} />;
            })}
          </g>
        );
      })}

      {/* Printed lettering — staggered and tilted like the renders' script */}
      {pieces.filter((p) => p.item.text?.enabled && (p.item.text.value ?? "").trim() && (base || piecePath(p)) && p.item.type !== "open_arch_frame").map((p) => {
        if (p.item.text.lettering) {
          return (
            <SketchLettering key={`t${p.item.id}`} lettering={p.item.text.lettering} spot={(h) => textSpot(p, h)}
              fill={resolveTextColorHex(p.item.text.color, accent)} metal={METAL_TINT[p.item.text.color]} gid={`skMetal${uid}${p.idx}`} />
          );
        }
        const f = fontFor(p.item.text.fontStyle);
        const ls = lines(p.item.text.value);
        const longest = Math.max(4, ...ls.map((l) => l.length));
        const k = textSizeScale(p.item.text.size);
        const room = textSpot(p, 0);
        // As the layout guide does: fitted to the clear width, then the chosen share of that.
        const size = Math.min(p.w * 0.3, room.w / (longest * f.adv)) * k;
        // Script 1.25 -> 1.0 with Italianno (T0), as the guide's 1.34 -> 1.08.
        const gap = size * (p.item.text.fontStyle === "script" ? 1.0 : 1.12);
        const blockH = gap * (ls.length - 1) + size;
        const at = textSpot(p, blockH);
        const script = p.item.text.fontStyle === "script";
        const y0 = at.cy - ((ls.length - 1) * gap) / 2 + size * 0.32;
        // Silver, gold and rose gold are mirror acrylic: bright and dark bands, not flat grey.
        const metal = METAL_TINT[p.item.text.color];
        const gid = `skMetal${uid}${p.idx}`;
        return (
          <g key={`t${p.item.id}`} transform={script ? `rotate(-2 ${at.cx} ${at.cy})` : undefined} filter="url(#skSoft)">
            {metal && (
              <defs>
                <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={at.cx} y1={at.cy - blockH / 2} x2={at.cx + blockH * 0.25} y2={at.cy + blockH / 2}>
                  {[[0, 0.94], [0.3, 0.6], [0.47, 1], [0.6, 0.5], [0.78, 0.86], [1, 0.62]].map(([o, l]) => <stop key={o} offset={o} stopColor={tintHex(metal, l)} />)}
                </linearGradient>
              </defs>
            )}
            <text textAnchor="middle" fontFamily={f.family} fontWeight={f.weight} fontSize={size}
              fill={metal ? `url(#${gid})` : resolveTextColorHex(p.item.text.color, accent)}
              stroke={metal ? tintHex(metal, 0.42) : undefined} strokeWidth={metal ? Math.max(0.6, size * 0.012) : undefined}>
              {ls.map((l, i) => <tspan key={i} x={at.cx} y={y0 + i * gap}>{l}</tspan>)}
            </text>
          </g>
        );
      })}

      {/* The photographed garland on the round base, in the chosen colours */}
      {base && baseBalloons && <image href={baseBalloons} width={VB} height={VB} />}
      {baseFlorals.map((f, i) => (
        <g key={`bf${i}`} transform={`rotate(${f.a} ${f.x} ${f.y})`}>
          <ellipse cx={f.x - f.r * 0.7} cy={f.y} rx={f.r} ry={f.r * 0.36} fill="#7fa77a" />
          <ellipse cx={f.x + f.r * 0.7} cy={f.y} rx={f.r * 0.9} ry={f.r * 0.32} fill="#93b98c" />
          {i % 3 === 0 && <circle cx={f.x} cy={f.y} r={f.r * 0.42} fill="#fff4f7" stroke="#f3b8cc" strokeWidth={2} />}
        </g>
      ))}

      {rainbowSpots.map((r, i) => (
        <image key={`rb${i}`} href="/design/sketch/rainbow-cloud.webp" x={r.x - RAINBOW_W / 2} y={r.y - RAINBOW_W * RAINBOW_ASPECT / 2}
          width={RAINBOW_W} height={RAINBOW_W * RAINBOW_ASPECT} data-testid="sketch-rainbow" />
      ))}

      {/* Balloon garland (drawn setups), florals tucked in */}
      {balloons.map((b, i) => (
        <g key={`b${i}`}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={b.c} stroke="rgba(39,22,23,.10)" strokeWidth={1} />
          <circle cx={b.x} cy={b.y} r={b.r} fill="url(#skShine)" />
        </g>
      ))}
      {d.garlandFlorals && balloonsOn && balloons.filter((_, i) => i % 7 === 3).map((b, i) => (
        <g key={`f${i}`}>
          <ellipse cx={b.x + b.r * 0.6} cy={b.y - b.r * 0.2} rx={b.r * 0.55} ry={b.r * 0.22} fill="#7fa77a" transform={`rotate(-30 ${b.x + b.r * 0.6} ${b.y - b.r * 0.2})`} />
          <circle cx={b.x - b.r * 0.4} cy={b.y + b.r * 0.4} r={b.r * 0.3} fill="#fff4f7" stroke="#f3b8cc" strokeWidth={2} />
        </g>
      ))}

      {/* Neon sign — over the garland, so it always shows */}
      {neon && neonPiece && (() => {
        const ls = lines(neon.text);
        const isRing = neonPiece.item.type === "balloon_ring";
        // Fitted to the board's clear width like the lettering ("devasa duruyor" when it was not).
        const longest = Math.max(4, ...ls.map((l) => l.length));
        // The script face's own letter width (T0: was a fixed 0.5, Brittany's).
        const size = Math.min(neonPiece.w * 0.14, textSpot(neonPiece, 0).w / (longest * fontFor("script").adv)) * 0.85;
        const spot = textSpot(neonPiece, size * 1.05 * (ls.length - 1) + size);
        const cx = spot.cx;
        const cy = base ? spot.cy : isRing ? FLOOR - neonPiece.w * 0.62 : neonPiece.top + neonPiece.h * 0.34;
        const txt = (glow: boolean) => (
          <text x={cx} y={cy - (ls.length - 1) * size * 0.5} textAnchor="middle" fontFamily="var(--bz-signature)" fontWeight={400}
            fontSize={size} fill={glow ? "#ffb36b" : "#fffaf0"} filter={glow ? "url(#skGlow)" : undefined} opacity={glow ? 0.9 : 1}
            stroke={glow ? "#ffb36b" : "#f0b36e"} strokeWidth={glow ? 6 : 1.2}>
            {ls.map((l, i) => <tspan key={i} x={cx} dy={i === 0 ? 0 : size * 1.05}>{l}</tspan>)}
          </text>
        );
        return <g>{txt(true)}{txt(false)}</g>;
      })()}

      {/* Plinths in front of the board */}
      {plinths.map((p, i) => (
        <image key={`p${i}`} href={PLINTH_SRC} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="none" />
      ))}

      {/* Light-up number on the floor, right of the plinths */}
      {hasNumber && pieces.length > 0 && numberDigits.length > 0 && (
        <g filter="url(#skSoft)">
          {numberDigits.split("").map((g, i) => d.numberLight?.style === "foil"
            // 80cm and slimmer than the marquee.
            ? <FoilDigit key={i} uid={`skFoil${i}`} glyph={g} w={digitW * 0.78} h={numberH * 0.8} hex={foilColourFor(d.numberLight, palette)} palette={palette}
                x={numberX - numberW / 2 + i * (digitW + digitGap) + digitW * 0.11} y={floorY + (base ? 0.03 * VB : 4) - numberH * 0.8} />
            : <MarqueeDigit key={i} uid={`skMq${i}`} glyph={g} w={digitW} h={numberH}
                x={numberX - numberW / 2 + i * (digitW + digitGap)} y={floorY + (base ? 0.03 * VB : 4) - numberH} />
          )}
        </g>
      )}

      {/* Standees on the floor: the first left of the backdrop, the second right */}
      {standeeBoxes.map((s, i) => (
        <image key={`s${i}`} href={s.src} x={s.x} y={s.y} width={s.w} height={s.h} preserveAspectRatio="xMidYMax meet" />
      ))}

      {/* The piece being styled */}
      {activeId && pieces.length > 1 && pieces.filter((p) => p.item.id === activeId).map((p) => {
        const floor = base ? p.top + p.h : FLOOR;
        const path = piecePath(p, floor) ?? `M ${p.x} ${floor} V ${p.top} H ${p.x + p.w} V ${floor} Z`;
        return <path key="active" d={path} fill="none" stroke="#ff0d66" strokeWidth={6} strokeDasharray="16 10" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

/** The small clickable diagram of the setup's pieces (Style tab). */
export function PieceDiagram({
  items, activeId, onPick, labels,
}: {
  items: BackdropItem[];
  activeId: string;
  onPick: (id: string) => void;
  labels: string[];
}) {
  const { pieces } = layoutPieces(items, { maxW: 880, maxH: 700 });
  return (
    <svg viewBox={`0 120 ${VB} 880`} className="bz-piece-diagram" role="group" aria-label="Pick the piece to design">
      {pieces.map((p) => {
        const on = p.item.id === activeId;
        const path = piecePath(p);
        const cx = p.x + p.w / 2;
        const r = p.w / 2;
        return (
          <g key={p.item.id} role="button" tabIndex={0} aria-pressed={on} aria-label={labels[p.idx]}
            onClick={() => onPick(p.item.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.item.id); } }}
            style={{ cursor: "pointer", outline: "none" }}>
            {p.item.type === "balloon_ring"
              ? <circle cx={cx} cy={FLOOR - r} r={r - 14} fill="none" stroke={on ? "#ff0d66" : "#ffc6da"} strokeWidth={28} />
              : p.item.type === "open_arch_frame"
                ? <path d={path!} fill="none" stroke={on ? "#ff0d66" : "#ffc6da"} strokeWidth={Math.max(30, p.w * 0.2)} strokeLinejoin="round" />
                : <path d={path!} fill={on ? "#ff0d66" : "#ffd6e5"} stroke={on ? "#c2004b" : "#ffb3cd"} strokeWidth={6} />}
            {on && <text x={cx} y={FLOOR - Math.min(p.h, 300) * 0.45} textAnchor="middle" fontSize={64} fill="#fff" fontWeight={900}>✓</text>}
            {/* "Main", "Second", "Left"…: the first word of the piece's name. */}
            <text x={cx} y={FLOOR + 92} textAnchor="middle" fontSize={78} fontWeight={800}
              fill={on ? "#ff0d66" : "#b98aa0"} style={{ fontFamily: "var(--bz-sans)" }}>{(labels[p.idx] ?? "").split(" ")[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}
