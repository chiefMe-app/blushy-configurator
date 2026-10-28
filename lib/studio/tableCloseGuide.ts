// The layout guide for the table close-up (2026-10-28). Words alone did not
// hold the owner's layout ("saçmaladı render": one seat instead of two,
// cutlery everywhere, the napkin in the wrong colour, the placemat words
// scattered), so the close-up now starts from this drawing: one part of the
// chosen table seen through a real camera — about 50° down, two children
// facing each other, the next places carrying on out of the picture — with
// every piece where the owner wants it, and the placemat words already
// lettered (as paths: Vercel has no fonts). The render only makes it real,
// taking each piece's look from its option picture. A plain SVG string, so the
// server can rasterise it with sharp; no React.
import { NONE, onFloor } from "./tableCatalog";
import { arrangeTables, CHAIR, CUSHION, type Placed, type Seat } from "./tableShapes";
import { wordsColour, wordsOn, type TableSetup } from "./tableSetup";
import { textCommands } from "@/lib/guideFonts";

export const CLOSE_GUIDE = { width: 1152, height: 864 };

type V3 = readonly [number, number, number];
type V2 = readonly [number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const f1 = (n: number) => n.toFixed(1);

/** Mixes a colour with white (t = 0: the colour, 1: white). */
function light(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
  return `rgb(${c.join(",")})`;
}

/** Convex hull of 2D points (monotone chain). */
function hull(points: V2[]): V2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V2[] = [], upper: V2[] = [];
  for (const q of p) { while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const PLATE: Record<string, { fill: string; rim: string }> = {
  iridescent: { fill: "#EBDDF7", rim: "#A78BC9" }, holo_square: { fill: "#E2E7ED", rim: "#8C99A6" }, silver: { fill: "#E5E8EC", rim: "#8C99A6" },
};
const CUP: Record<string, string> = { white_straw: "#FFFFFF", iridescent: "#E4DDF5" };
// The kids' chair (blue_kids) is the customer's colour.
const CHAIR_FILL: Record<string, string> = { white_kids: "#FFFFFF", bow_kids: "#F5C9D7" };
const WOOD = "#D9B98C";

/**
 * The guide as an SVG string: `theme` gives the placemat colours. Every
 * measure is in centimetres; the plan (arrangeTables) is turned into a world
 * with z up (the plan's y is flipped so nothing comes out mirrored).
 */
export function tableCloseGuideSvg(t: TableSetup, theme: { balloonColors: string[]; accent: string }, art: { placemat?: string; card?: string } = {}): string {
  const { width: W, height: H } = CLOSE_GUIDE;
  const ch = t.choices;
  const floor = onFloor(ch);
  const { tables } = arrangeTables(t);
  const table: Placed = tables[0];
  const TH = table.height;
  const world = (x: number, y: number, z = 0): V3 => [x, -y, z];
  const settingAt = (s: Seat) => {
    // The child's forward (towards the table) and right, in the world.
    const fwd: V3 = [Math.cos(s.facing), -Math.sin(s.facing), 0];
    const right: V3 = [fwd[1], -fwd[0], 0];
    const edge = world(s.ex, s.ey, TH);
    const centre: V3 = [edge[0] + fwd[0] * 17, edge[1] + fwd[1] * 17, TH];
    /** A point on (or above) the table in the setting's own frame: u to the child's right, v away from the child. */
    const at = (u: number, v: number, z = 0): V3 => [centre[0] + right[0] * u + fwd[0] * v, centre[1] + right[1] * u + fwd[1] * v, TH + z];
    return { s, fwd, right, centre, at };
  };

  // The two places in focus: across the table for a long one, side by side round a round one.
  const seats = table.seats;
  const round = table.kind === "round" || table.kind === "flower";
  const cx = table.x + table.w / 2;
  let a: Seat, b: Seat;
  if (round) { a = seats[0]; b = seats[1] ?? seats[0]; }
  else {
    const far = seats.filter((s) => Math.sin(s.facing) > 0), near = seats.filter((s) => Math.sin(s.facing) <= 0);
    a = [...far].sort((p, q) => Math.abs(p.ex - cx) - Math.abs(q.ex - cx))[0] ?? seats[0];
    b = [...near].sort((p, q) => Math.abs(p.ex - a.ex) - Math.abs(q.ex - a.ex))[0] ?? seats[1] ?? a;
  }
  const A = settingAt(a), B = settingAt(b);
  const target: V3 = [(A.centre[0] + B.centre[0]) / 2, (A.centre[1] + B.centre[1]) / 2, TH];

  // The camera: about 50° down, from behind B's chair and a little to one side,
  // looking across the table at both places; the next places carry on to the sides.
  // Round the round and flower tables the two places sit side by side, so the
  // camera stands across the table from them (2026-10-28: looking along the
  // edge it left the chairs floating off the table and the render made its own scene).
  const mid = world(table.x + table.w / 2, table.y + table.h / 2, TH);
  const across = round ? norm([mid[0] - target[0], mid[1] - target[1], 0]) : norm([B.centre[0] - A.centre[0], B.centre[1] - A.centre[1], 0]);
  const along: V3 = [-across[1], across[0], 0];
  const az = ((round ? 0 : 22) * Math.PI) / 180, el = (52 * Math.PI) / 180, dist = round ? 140 : 165;
  const horiz = norm([across[0] * Math.cos(az) + along[0] * Math.sin(az), across[1] * Math.cos(az) + along[1] * Math.sin(az), 0]);
  const eye: V3 = [target[0] + horiz[0] * dist * Math.cos(el), target[1] + horiz[1] * dist * Math.cos(el), target[2] + dist * Math.sin(el)];
  const fw = norm(sub(target, eye)), rt = norm(cross(fw, [0, 0, 1])), up = cross(rt, fw);
  const F = W / 2 / Math.tan((27 * Math.PI) / 180);
  const P = (p: V3): V2 => { const v = sub(p, eye); const z = Math.max(1, dot(v, fw)); return [W / 2 + (F * dot(v, rt)) / z, H / 2 - (F * dot(v, up)) / z]; };
  const depth = (p: V3) => Math.hypot(...sub(p, eye));
  /** In front of the camera: a place under or behind it would be drawn inside out. */
  const seen = (p: V3) => dot(sub(p, eye), fw) > 40;
  const poly = (pts: V3[], fill: string, stroke = "#8A7F86", sw = 1.2, extra = "") =>
    `<polygon points="${pts.map(P).map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"${extra}/>`;
  const poly2 = (pts: V2[], fill: string, stroke = "#8A7F86", sw = 1.2) =>
    `<polygon points="${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const circle3 = (c: V3, r: number, z: number, n = 24): V3[] => Array.from({ length: n }, (_, i) => [c[0] + Math.cos((i * 2 * Math.PI) / n) * r, c[1] + Math.sin((i * 2 * Math.PI) / n) * r, z]);
  /** An upright cylinder (or cone, with r2 = 0): the side as a hull, then the top. */
  const solid = (base: V3, r1: number, r2: number, h: number, fill: string, top?: string) => {
    const low = circle3(base, r1, base[2]), high = r2 > 0 ? circle3(base, r2, base[2] + h) : [[base[0], base[1], base[2] + h] as V3];
    return poly2(hull([...low, ...high].map(P)), fill) + (r2 > 0 ? poly(high, top ?? fill) : "");
  };

  const items: { d: number; svg: string }[] = [];
  const behind: { d: number; svg: string }[] = [], before: { d: number; svg: string }[] = [];

  // Chairs (or the low table's cushions), behind the table or in front of it.
  for (const s of seats) {
    const fwd: V3 = [Math.cos(s.facing), -Math.sin(s.facing), 0];
    const right: V3 = [fwd[1], -fwd[0], 0];
    const c = world(s.x, s.y);
    if (!seen(c)) continue;
    const q = (u: number, v: number, z: number): V3 => [c[0] + right[0] * u + fwd[0] * v, c[1] + right[1] * u + fwd[1] * v, z];
    let svg: string;
    if (floor) {
      const r = CUSHION.d / 2;
      svg = poly([q(-r, -r, 10), q(r, -r, 10), q(r, r, 10), q(-r, r, 10)], "#FFFFFF") + poly([q(-r, -r, 0), q(r, -r, 0), q(r, -r, 10), q(-r, -r, 10)], "#F1ECE8");
    } else {
      const r = CHAIR.d / 2, fill = ch.chairs === "blue_kids" ? t.chairColor : CHAIR_FILL[ch.chairs] ?? "#FFFFFF";
      const legs = [[-r + 2, -r + 2], [r - 2, -r + 2], [r - 2, r - 2], [-r + 2, r - 2]].map(([u, v]) => { const [x1, y1] = P(q(u, v, 0)), [x2, y2] = P(q(u, v, 30)); return `<path d="M${f1(x1)},${f1(y1)}L${f1(x2)},${f1(y2)}" stroke="#8A7F86" stroke-width="2"/>`; }).join("");
      const seat = poly([q(-r, -r, 30), q(r, -r, 30), q(r, r, 30), q(-r, r, 30)], fill);
      // The back stands on the side away from the table.
      // The bow's loops sit on a knot and two tails down to the seat (2026-10-28: loops alone floated off the chair).
      const back = ch.chairs === "bow_kids"
        ? [-3.5, 3.5].map((u) => poly([q(u, -r, 30), q(u * 0.3, -r, 55)], "none", "#D9A3B5", 3)).join("")
          + [-8, 8].map((u) => poly(Array.from({ length: 16 }, (_, i) => { const a2 = (i * 2 * Math.PI) / 16; return q(u + Math.cos(a2) * 7, -r, 58 + Math.sin(a2) * 9); }), "none", "#D9A3B5", 3)).join("")
          + poly(Array.from({ length: 12 }, (_, i) => { const a2 = (i * 2 * Math.PI) / 12; return q(Math.cos(a2) * 2.5, -r, 57 + Math.sin(a2) * 3); }), fill, "#D9A3B5", 2)
        : ch.chairs === "white_kids"
          ? poly(Array.from({ length: 20 }, (_, i) => { const a2 = (i * 2 * Math.PI) / 20; return q(Math.cos(a2) * 13, -r, 50 + Math.sin(a2) * 17); }), fill)
          // 2026-10-28: a solid panel came out as a solid back. The owner's blue
          // chair has open spindles under a curved top rail, with gaps between them.
          : (() => {
            const bar = (u1: number, u2: number, z1: number, z2: number) => poly([q(u1, -r, z1), q(u2, -r, z1), q(u2, -r, z2), q(u1, -r, z2)], fill, "#0E7490", 0.8);
            const rail = poly([...Array.from({ length: 9 }, (_, i) => { const u = -r + 1 + (i * (2 * r - 2)) / 8; return q(u, -r, 60 + 3 * Math.cos((u / r) * 1.3)); }),
              ...Array.from({ length: 9 }, (_, i) => { const u = r - 1 - (i * (2 * r - 2)) / 8; return q(u, -r, 66 + 3 * Math.cos((u / r) * 1.3)); })], fill, "#0E7490", 0.8);
            return bar(-r + 1, -r + 3, 30, 64) + bar(r - 3, r - 1, 30, 64) + bar(-r + 3, r - 3, 41, 43.5)
              + [-9, -4.5, 0, 4.5, 9].map((u) => bar(u - 0.8, u + 0.8, 43.5, 61)).join("") + rail;
          })();
      svg = legs + seat + back;
    }
    const d = depth(c);
    (d > depth(world(s.ex, s.ey, TH)) ? behind : before).push({ d, svg });
  }

  // The table: its sides facing us, then the top (or the cloth over it).
  const cloth = ch.tablecloth !== NONE;
  const top = table.outline.map(([x, y]) => world(x, y, TH));
  const turning = Math.sign(top.reduce((acc, p, i) => { const n = top[(i + 1) % top.length]; return acc + p[0] * n[1] - n[0] * p[1]; }, 0)) || 1;
  let tableSvg = "";
  top.forEach((p, i) => {
    const n = top[(i + 1) % top.length];
    const out: V3 = [turning * (n[1] - p[1]), -turning * (n[0] - p[0]), 0];
    const mid: V3 = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2, TH];
    if (dot(out, sub(eye, mid)) <= 0) return;
    const drop = cloth ? TH : 4;
    tableSvg += poly([p, n, [n[0], n[1], TH - drop], [p[0], p[1], TH - drop]], cloth ? t.clothColor : "#ECE7E2", cloth ? t.clothColor : "#B9AFA8", 1);
  });
  tableSvg += poly(top, cloth ? t.clothColor : "#F8F6F3", "#A79C95", 1.4);

  // Every place setting on the table, as the owner set it out (lib/studio/tableRender.ts).
  const pal = theme.balloonColors.filter((c) => !/^#F[0-9A-F]F[0-9A-F]F[0-9A-F]$/i.test(c));
  const mat1 = light(pal[0] ?? theme.accent, 0.62), mat2 = light(pal[1] ?? pal[0] ?? theme.accent, 0.7);
  const matWords = wordsOn(t, "placemats");
  const plate = ch.plates === "plain" ? { fill: t.plateColor, rim: "#8A7F86" } : PLATE[ch.plates] ?? { fill: "#FFFFFF", rim: "#8A7F86" };
  // The plate card's design: the placemats' own picture when it is the same one.
  const cardArt = art.card ? (art.card === art.placemat ? "mat-art" : "card-art") : "";
  let cards = 0;
  const napkin = ch.napkins === "plain" ? t.napkinColor : ch.napkins === "striped" ? "#FBD5E5" : ch.napkins === "foil" ? "#D5E6F5" : light(pal[0] ?? theme.accent, 0.55);
  for (const seat of seats) {
    const S = settingAt(seat);
    if (!seen(S.centre)) continue;
    const { at } = S;
    const parts: { d: number; svg: string }[] = [];
    const add = (anchor: V3, svg: string) => parts.push({ d: depth(anchor), svg });
    let flat = "";
    if (ch.placemats !== NONE) {
      flat += poly([at(-21, -15, 0.1), at(21, -15, 0.1), at(21, 15, 0.1), at(-21, 15, 0.1)], "url(#mat)", "#9AA3C7", 1);
      if (art.placemat) {
        // The placemat's own design laid on it: its top away from the child, its left on the child's left.
        const [o, x, y] = [P(at(-21, 15, 0.1)), P(at(21, 15, 0.1)), P(at(-21, -15, 0.1))];
        flat += `<use href="#mat-art" xlink:href="#mat-art" transform="matrix(${[x[0] - o[0], x[1] - o[1], y[0] - o[0], y[1] - o[1], o[0], o[1]].map(f1).join(" ")})"/>`;
      }
    }
    // The plate in the middle.
    const plateShape = ch.plates === "holo_square" ? [at(-11, -11, 0.4), at(11, -11, 0.4), at(11, 11, 0.4), at(-11, 11, 0.4)]
      : ((n) => Array.from({ length: n }, (_, i) => { const a2 = Math.PI / n + (i * 2 * Math.PI) / n; return at(Math.cos(a2) * 11.5, Math.sin(a2) * 11.5, 0.4); }))(ch.plates === "iridescent" ? 8 : 28);
    const shrink = (k: number, z: number) => plateShape.map((p) => [S.centre[0] + (p[0] - S.centre[0]) * k, S.centre[1] + (p[1] - S.centre[1]) * k, TH + z] as V3);
    flat += poly(plateShape, plate.fill, plate.rim, 1.4) + poly(shrink(0.82, 0.4), "none", plate.rim, 0.8);
    // 2026-10-28 (owner): a small plate on the big one, and in it a round card in the theme's design.
    flat += poly(shrink(0.68, 1), plate.fill, plate.rim, 1.8);
    const card = circle3(at(0, 0, 1.3), 6, TH + 1.3, 28); // PLATE_CARD_MM across
    if (cardArt) {
      const id = `card-${cards++}`, [o, x, y] = [P(at(-6, 6, 1.3)), P(at(6, 6, 1.3)), P(at(-6, -6, 1.3))];
      flat += `<clipPath id="${id}"><polygon points="${card.map(P).map(([a, b]) => `${f1(a)},${f1(b)}`).join(" ")}"/></clipPath>`
        + `<g clip-path="url(#${id})"><use href="#${cardArt}" xlink:href="#${cardArt}" transform="matrix(${[x[0] - o[0], x[1] - o[1], y[0] - o[0], y[1] - o[1], o[0], o[1]].map(f1).join(" ")})"/></g>`
        + poly(card, "none", "#8A7F86", 0.8);
    } else flat += poly(card, light(pal[0] ?? theme.accent, 0.35), "#8A7F86", 0.8);
    if (ch.placemats !== NONE && matWords) {
      // In the bottom-right corner beside the plate, one word a line, right-aligned (the owner's reference).
      const lines = matWords.toUpperCase().split(/\s+/), size = 3, gap = 3.3;
      lines.forEach((line, i) => {
        const { commands, width } = textCommands(line, "elegant", size);
        const u0 = 20 - width, v0 = -14 + (lines.length - 1 - i) * gap;
        const pt = (x: number, y: number) => P(at(u0 + x, v0 - y, 0.5));
        const d = commands.map((cmd) => {
          if (cmd.type === "Z") return "Z";
          const end = pt(cmd.x, cmd.y);
          if (cmd.type === "C") { const c1 = pt(cmd.x1, cmd.y1), c2 = pt(cmd.x2, cmd.y2); return `C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(end[0])},${f1(end[1])}`; }
          if (cmd.type === "Q") { const c1 = pt(cmd.x1, cmd.y1); return `Q${f1(c1[0])},${f1(c1[1])} ${f1(end[0])},${f1(end[1])}`; }
          return `${cmd.type}${f1(end[0])},${f1(end[1])}`;
        }).join("");
        flat += `<path d="${d}" fill="${wordsColour(t, theme)}"/>`;
      });
    }
    // On the left: the napkin and the cutlery, in the holder if one is chosen.
    if (ch.cutleryHolder === "band") {
      flat += poly([at(-19.5, -10, 2.5), at(-13.5, -10, 2.5), at(-13.5, 10, 2.5), at(-19.5, 10, 2.5)], napkin, "#8A7F86", 1);
      flat += poly([at(-19.8, -2.5, 2.8), at(-13.2, -2.5, 2.8), at(-13.2, 2.5, 2.8), at(-19.8, 2.5, 2.8)], t.holderColor, "#8A7F86", 0.8);
      flat += [-18, -16.5, -15].map((u) => poly([at(u - 0.5, 10, 2.5), at(u + 0.5, 10, 2.5), at(u + 0.5, 14, 2.5), at(u - 0.5, 14, 2.5)], WOOD, "#8A7F86", 0.6)).join("");
    } else {
      flat += poly([at(-20, -11, 0.3), at(-12, -11, 0.3), at(-12, 11, 0.3), at(-20, 11, 0.3)], napkin, "#8A7F86", 1);
      const tip = ch.cutlery === "dipped" ? "#F9A8D4" : ch.cutlery === "glitter" ? "#C9CED6" : WOOD;
      flat += [-18, -16, -14].map((u) => poly([at(u - 0.6, -9, 0.8), at(u + 0.6, -9, 0.8), at(u + 0.6, 10, 0.8), at(u - 0.6, 10, 0.8)], WOOD, "#8A7F86", 0.6) + poly([at(u - 0.6, -9, 0.9), at(u + 0.6, -9, 0.9), at(u + 0.6, -4, 0.9), at(u - 0.6, -4, 0.9)], tip, "#8A7F86", 0.4)).join("");
    }
    add(S.centre, flat);
    // Standing pieces: the cup on the top-right corner, the bottle beside it, the hat top-left.
    if (ch.cups !== NONE) {
      const base = at(17, 12, 0);
      add(base, solid(base, 3.4, 4, 9, ch.cups === "plain" ? t.cupColor : CUP[ch.cups] ?? "#FFFFFF", ch.cups === "plain" ? t.cupColor : "#FFFFFF") + (ch.cups !== "plain" ? `<path d="M${P(at(17, 12, 6)).map(f1).join(",")}L${P(at(18.5, 13.5, 16)).map(f1).join(",")}" stroke="#9AA6B2" stroke-width="2.4"/>` : ""));
    }
    if (ch.bottleLabel !== NONE) {
      const base = at(25, 12, 0);
      add(base, solid(base, 3.2, 3.2, 14, "#E8F2F9") + solid(at(25, 12, 5), 3.3, 3.3, 5, mat1) + solid(at(25, 12, 14), 3.2, 1.4, 4, "#E8F2F9") + solid(at(25, 12, 18), 1.4, 1.4, 2, "#93C5FD"));
    }
    if (ch.partyHats !== NONE) {
      const base = at(-17, 12, 0);
      add(base, ch.partyHats === "cone" ? solid(base, 5.5, 0, 15, "#D8DEF5") : solid(base, 5, 5, 4, ch.partyHats === "crown" ? "#E8D27A" : light(pal[0] ?? theme.accent, 0.4)));
    }
    items.push(...parts);
  }

  // Centrepieces between the places.
  if (ch.centrepiece !== NONE) {
    for (const [x, y] of table.centres) {
      const c = world(x, y, TH);
      if (!seen(c)) continue;
      const flowers = ch.centrepiece === "florals" ? ["#C4B5FD", "#FBCFE8", "#FDF2E9", "#BFDBFE", "#FBCFE8", "#DDD6FE", "#FFFFFF"]
        : ch.centrepiece === "balloons" ? (theme.balloonColors.length ? theme.balloonColors : ["#BFDBFE"]) : [theme.accent];
      const tall = ch.centrepiece === "balloons" ? 30 : 12;
      const blobs = flowers.map((col, i) => {
        const a2 = (i * 2 * Math.PI) / flowers.length;
        const p = P([c[0] + Math.cos(a2) * 5, c[1] + Math.sin(a2) * 5, c[2] + tall + (i % 3) * 3]);
        const r = (ch.centrepiece === "balloons" ? 6 : 3.4) * (F / depth(c));
        return `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(r)}" fill="${col}" stroke="#8A7F86" stroke-width="1"/>`;
      }).join("");
      const stem = ch.centrepiece === "florals" ? solid(c, 6, 5, 6, "#E7F0E2") : `<path d="M${P(c).map(f1).join(",")}L${P([c[0], c[1], c[2] + tall]).map(f1).join(",")}" stroke="#8A7F86" stroke-width="1.4"/>`;
      items.push({ d: depth(c), svg: stem + blobs });
    }
  }

  const sortFar = (l: { d: number; svg: string }[]) => [...l].sort((p, q) => q.d - p.d).map((x) => x.svg).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<defs>${art.placemat ? `<image id="mat-art" href="${art.placemat}" xlink:href="${art.placemat}" x="0" y="0" width="1" height="1" preserveAspectRatio="none"/>` : ""}${cardArt === "card-art" ? `<image id="card-art" href="${art.card}" xlink:href="${art.card}" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice"/>` : ""}<linearGradient id="mat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mat1}"/><stop offset="1" stop-color="${mat2}"/></linearGradient></defs>`
    + `<rect width="${W}" height="${H}" fill="#EEF0EA"/>`
    + sortFar(behind) + tableSvg + sortFar(items) + sortFar(before)
    + "</svg>";
}
