// One giveaway box (2026-11-03, lib/studio/giveaways.ts): the photo of a white gable box, its front panel dressed in
// the theme — the placemat's print under the box's own light and shade, the theme's picture as a round sticker,
// the name on a white plate and the age on a badge in the theme's colour (her example boxes: "name plate, age,
// layered themed decoration"). Drawn in whatever units the picture it sits in uses: `h` tall, centred on x, y.
import { BOX_PHOTO } from "@/lib/studio/giveaways";
import { fontCss, tableFont } from "@/lib/studio/tableFonts";

export interface BoxLook {
  /** The theme's print and its picture. */
  print: string;
  sticker: string;
  accent: string;
  name: string;
  age: string;
  font: string;
}

export default function GiveawayBox({ look, x, y, h, rot = 0, uid }: { look: BoxLook; x: number; y: number; h: number; rot?: number; uid: string }) {
  const { w: W, h: H, panel: p } = BOX_PHOTO;
  const k = h / H, w = W * k;
  const face = tableFont(look.font);
  const family = `${fontCss(face)}, Georgia, serif`;
  const name = look.name.trim();
  // The plate's words fitted to it: a handwritten face runs wider.
  const nameSize = Math.min(p.h * 0.13, (p.w * 0.7) / Math.max(4, name.length * 0.5)) * (face.scale ?? 1);
  return (
    <g transform={`translate(${x - w / 2} ${y - h / 2}) scale(${k})${rot ? ` rotate(${rot} ${W / 2} ${H / 2})` : ""}`} data-part="giveaway-box">
      <defs>
        <clipPath id={`${uid}-panel`}><rect x={p.x} y={p.y} width={p.w} height={p.h} /></clipPath>
        <clipPath id={`${uid}-sticker`}><circle cx={p.x + p.w / 2} cy={p.y + p.h * 0.36} r={p.h * 0.25} /></clipPath>
      </defs>
      <image href={BOX_PHOTO.src} width={W} height={H} />
      <g clipPath={`url(#${uid}-panel)`}>
        <image href={look.print} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="xMidYMid slice" />
        {/* The box's own light and shade over the print: the photo brightened so its grey panel reads white
            (scripts: sharp linear ×1.26), or the print turns muddy. */}
        <image href={BOX_PHOTO.shade} width={W} height={H} style={{ mixBlendMode: "multiply" }} />
      </g>
      {/* The layered decoration: the theme's picture on a white sticker. */}
      <circle cx={p.x + p.w / 2} cy={p.y + p.h * 0.36} r={p.h * 0.275} fill="#fff" />
      <image href={look.sticker} x={p.x + p.w / 2 - p.h * 0.25} y={p.y + p.h * 0.11} width={p.h * 0.5} height={p.h * 0.5} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uid}-sticker)`} />
      {/* The name plate. */}
      <rect x={p.x + p.w * 0.12} y={p.y + p.h * 0.67} width={p.w * 0.76} height={p.h * 0.2} rx={p.h * 0.06} fill="#fff" stroke={look.accent} strokeWidth={4} />
      {name && <text x={p.x + p.w / 2} y={p.y + p.h * 0.77 + nameSize * 0.32} fontSize={nameSize} textAnchor="middle" fill={look.accent}
        style={{ fontFamily: family, fontWeight: face.weight }}>{face.hand ? name : name.toUpperCase()}</text>}
      {/* The age, on a badge at the top corner. */}
      {look.age && <>
        <circle cx={p.x + p.w * 0.16} cy={p.y + p.h * 0.15} r={p.h * 0.11} fill={look.accent} stroke="#fff" strokeWidth={6} />
        <text x={p.x + p.w * 0.16} y={p.y + p.h * 0.15 + p.h * 0.05} fontSize={p.h * 0.14} textAnchor="middle" fill="#fff" style={{ fontFamily: "var(--font-sans), Arial, sans-serif", fontWeight: 800 }}>{look.age}</text>
      </>}
    </g>
  );
}
