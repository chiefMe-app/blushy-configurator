// One giveaway box (2026-11-03, lib/studio/giveaways.ts): the photo of a white gable box, its front panel printed
// in the theme — the placemat's print under the box's own light and shade, the theme's picture and the name
// printed straight on it, as her example box ("backgroundun direkt üstüne olsun text, ayrıca bir beyaz kısım
// olmasın"; no age: "age kısmını kaldıralım"; "daha kalın bold yazı olsun"). Drawn in whatever units the picture it
// sits in uses: `h` tall, centred on x, y.
import { BOX_PHOTO } from "@/lib/studio/giveaways";
import { fontCss, tableFont } from "@/lib/studio/tableFonts";

export interface BoxLook {
  /** The theme's print and its picture. */
  print: string;
  sticker: string;
  accent: string;
  name: string;
  font: string;
}

/** A long name on two lines, broken at the space nearest its middle. */
export function boxLines(name: string): string[] {
  const t = name.trim();
  if (t.length <= 11 || !t.includes(" ")) return t ? [t] : [];
  const mid = t.length / 2;
  const at = t.split("").map((c, i) => (c === " " ? i : -1)).filter((i) => i > 0).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))[0];
  return [t.slice(0, at), t.slice(at + 1)];
}

export default function GiveawayBox({ look, x, y, h, rot = 0, uid }: { look: BoxLook; x: number; y: number; h: number; rot?: number; uid: string }) {
  const { w: W, h: H, panel: p } = BOX_PHOTO;
  const k = h / H, w = W * k;
  const face = tableFont(look.font);
  const family = `${fontCss(face)}, Georgia, serif`;
  const lines = boxLines(face.hand ? look.name : look.name.toUpperCase());
  // As big as the panel's lower part lets it: the longest line across, the lines in its height. A letter's width
  // for its size, roughly: a script's narrow, the bold face's wide.
  const across = p.w * 0.88, longest = Math.max(4, ...lines.map((l) => l.length));
  const perChar = face.hand ? 0.36 / (face.scale ?? 1) : face.id === "archivo-black" ? 0.8 : 0.68;
  const tall = (lines.length > 1 ? 0.165 : 0.24) * p.h * (face.hand ? face.scale ?? 1 : 1);
  const size = Math.min(tall, across / (longest * perChar));
  const gap = size * (face.hand ? 0.78 : 1.02);
  const mid = p.y + p.h * 0.76;
  // Bolder: the letters drawn over with their own colour (a script's thin strokes most of all).
  const stroke = size * (face.hand ? 0.045 : 0.018);
  const pic = p.h * 0.46;
  return (
    <g transform={`translate(${x - w / 2} ${y - h / 2}) scale(${k})${rot ? ` rotate(${rot} ${W / 2} ${H / 2})` : ""}`} data-part="giveaway-box">
      <defs>
        <clipPath id={`${uid}-panel`}><rect x={p.x} y={p.y} width={p.w} height={p.h} /></clipPath>
      </defs>
      <image href={BOX_PHOTO.src} width={W} height={H} />
      <g clipPath={`url(#${uid}-panel)`}>
        <image href={look.print} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="xMidYMid slice" />
        {/* The theme's picture printed on it: its white ground takes the print's colour. */}
        <image href={look.sticker} x={p.x + p.w / 2 - pic / 2} y={p.y + p.h * 0.06} width={pic} height={pic} preserveAspectRatio="xMidYMid meet" style={{ mixBlendMode: "multiply" }} />
        {lines.map((l, i) => (
          <text key={i} x={p.x + p.w / 2} y={mid + (i - (lines.length - 1) / 2) * gap + size * 0.34} fontSize={size} textAnchor="middle" fill={look.accent}
            stroke={look.accent} strokeWidth={stroke} strokeLinejoin="round" paintOrder="stroke" style={{ fontFamily: family, fontWeight: face.weight }}>{l}</text>
        ))}
        {/* The box's own light and shade over the print: the photo brightened so its grey panel reads white
            (scripts: sharp linear ×1.26), or the print turns muddy. */}
        <image href={BOX_PHOTO.shade} width={W} height={H} style={{ mixBlendMode: "multiply" }} />
      </g>
    </g>
  );
}
