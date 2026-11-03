// One giveaway box (2026-11-03, lib/studio/giveaways.ts): the photo of a white gable box, its front panel printed
// in the theme — the placemat's print under the box's own light and shade, the theme's picture and the name
// printed straight on it, as her example box ("backgroundun direkt üstüne olsun text, ayrıca bir beyaz kısım
// olmasın"; no age: "age kısmını kaldıralım"; "daha kalın bold yazı olsun"). Drawn in whatever units the picture it
// sits in uses: `h` tall, centred on x, y.
import { BOX_PHOTO } from "@/lib/studio/giveaways";
import { fontCss, tableFont } from "@/lib/studio/tableFonts";
import FitText from "./FitText";

export interface BoxLook {
  /** The theme's print (none: a plain box, in `colour`) and its picture. */
  print?: string;
  colour?: string;
  sticker: string;
  /** The name's colour: hers, or the theme's. */
  accent: string;
  name: string;
  font: string;
}

/**
 * A long name on two lines: after the name's "'s" as her example box ("OLIVIA'S / 5TH BIRTHDAY"), or else at the
 * space nearest its middle.
 */
export function boxLines(name: string): string[] {
  const t = name.trim();
  if (t.length <= 11 || !t.includes(" ")) return t ? [t] : [];
  const own = t.search(/['’]s\s/i);
  if (own > 0) return [t.slice(0, own + 2), t.slice(own + 3).trim()];
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
  const plain = !look.print;
  // As big as the panel's lower part lets it, each line across, the lines in its height — the name's line the
  // bigger, as her example. A letter's width for its size, roughly: a script's narrow, the bold face's wide.
  const across = p.w * 0.88;
  const perChar = face.hand ? 0.36 / (face.scale ?? 1) : face.id === "archivo-black" ? 0.8 : face.id === "nunito" ? 0.72 : 0.68;
  const hand = face.hand ? face.scale ?? 1 : 1;
  const talls = lines.length > 1 ? [0.19, 0.145] : [plain ? 0.3 : 0.24];
  const sizes = lines.map((l, i) => Math.min(talls[i] * p.h * hand, across / (Math.max(4, l.length) * perChar)));
  const ys: number[] = [];
  // A plain box has no picture: the words in the middle of its front.
  const mid = p.y + p.h * (plain ? 0.52 : 0.76);
  const total = sizes.reduce((a, s) => a + s * (face.hand ? 0.78 : 1.02), 0);
  sizes.reduce((top, s) => { const lh = s * (face.hand ? 0.78 : 1.02); ys.push(top + lh / 2 + s * 0.34); return top + lh; }, mid - total / 2);
  const pic = p.h * 0.46;
  return (
    <g transform={`translate(${x - w / 2} ${y - h / 2}) scale(${k})${rot ? ` rotate(${rot} ${W / 2} ${H / 2})` : ""}`} data-part="giveaway-box">
      <defs>
        <clipPath id={`${uid}-panel`}><rect x={p.x} y={p.y} width={p.w} height={p.h} /></clipPath>
        {/* The box's own outline, for a plain box coloured all over. */}
        <mask id={`${uid}-box`} style={{ maskType: "alpha" }}><image href={BOX_PHOTO.src} width={W} height={H} /></mask>
      </defs>
      <image href={BOX_PHOTO.src} width={W} height={H} />
      <g clipPath={plain ? undefined : `url(#${uid}-panel)`} mask={plain ? `url(#${uid}-box)` : undefined}>
        {look.print ? <image href={look.print} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="xMidYMid slice" />
          : <rect width={W} height={H} fill={look.colour ?? "#FFFFFF"} data-part="box-colour" />}
        {/* The theme's picture printed on it: its white ground takes the print's colour. */}
        {!plain && <image href={look.sticker} x={p.x + p.w / 2 - pic / 2} y={p.y + p.h * 0.06} width={pic} height={pic} preserveAspectRatio="xMidYMid meet" style={{ mixBlendMode: "multiply" }} />}
        {lines.map((l, i) => (
          // Bolder: the letters drawn over with their own colour (a script's thin strokes most of all).
          <FitText key={i} x={p.x + p.w / 2} y={ys[i]} fontSize={sizes[i]} maxWidth={across} textAnchor="middle" fill={look.accent}
            stroke={look.accent} strokeWidth={sizes[i] * (face.hand ? 0.045 : 0.018)} strokeLinejoin="round" paintOrder="stroke" style={{ fontFamily: family, fontWeight: face.weight }}>{l}</FitText>
        ))}
        {/* The box's own light and shade over the print: the photo brightened so its grey panel reads white
            (scripts: sharp linear ×1.26), or the print turns muddy. */}
        <image href={BOX_PHOTO.shade} width={W} height={H} style={{ mixBlendMode: "multiply" }} />
      </g>
    </g>
  );
}
