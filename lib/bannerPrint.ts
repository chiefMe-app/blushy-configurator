// The printed face of a Frozen-themed banner, drawn as SVG.
//
// 2026-10-21, customer reference: a soft watercolour wash — periwinkle and
// lavender at the top left, fading through near-white to a blush of pink at
// the bottom right — with large detailed white snowflake crystals gathered
// at the left and right edges and a fine glitter of tiny sparkles across it.
// Drawn here rather than copied from the reference image, so the artwork is
// our own. Pure SVG with no <text>, so it rasterises the same on Vercel.

function snowflake(cx: number, cy: number, r: number, rot: number, op: number): string {
  const sw = Math.max(1, r * 0.055);
  const pt = (a: number, d: number) => `${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`;
  let d = "";
  for (let k = 0; k < 6; k++) {
    const a = rot + (k * Math.PI) / 3;
    // main arm
    d += `M${pt(a, r * 0.16)}L${pt(a, r)}`;
    // three pairs of branches, longest nearest the centre
    for (const [t, len] of [[0.34, 0.34], [0.55, 0.28], [0.75, 0.19]] as const) {
      const bx = cx + Math.cos(a) * r * t, by = cy + Math.sin(a) * r * t;
      for (const s of [-1, 1]) {
        const b = a + s * (Math.PI / 3.2);
        const ex = bx + Math.cos(b) * r * len, ey = by + Math.sin(b) * r * len;
        d += `M${bx.toFixed(1)},${by.toFixed(1)}L${ex.toFixed(1)},${ey.toFixed(1)}`;
        // small tick off each branch, for the crystal's lacy edge
        const mx = bx + Math.cos(b) * r * len * 0.55, my = by + Math.sin(b) * r * len * 0.55;
        const tb = b + s * 0.9;
        d += `M${mx.toFixed(1)},${my.toFixed(1)}L${(mx + Math.cos(tb) * r * len * 0.35).toFixed(1)},${(my + Math.sin(tb) * r * len * 0.35).toFixed(1)}`;
      }
    }
  }
  // the hexagonal heart of the crystal
  const hex = Array.from({ length: 6 }, (_, k) => pt(rot + (k * Math.PI) / 3, r * 0.16)).join(" ");
  return `<g opacity="${op.toFixed(2)}">` +
    `<path d="${d}" stroke="#FFFFFF" stroke-width="${sw.toFixed(1)}" stroke-linecap="round" fill="none"/>` +
    `<polygon points="${hex}" fill="#FFFFFF" fill-opacity="0.55" stroke="#FFFFFF" stroke-width="${(sw * 0.8).toFixed(1)}"/>` +
    `</g>`;
}

/** Full SVG document for a w x h banner face. Deterministic for a given size. */
export function frozenBannerPrintSvg(w: number, h: number): string {
  let seed = 20261021;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const s = Math.min(w, h);

  // Crystals gather at the left and right, as in the reference; the middle
  // stays open for lettering.
  const flakes: string[] = [];
  const place = (fx: number, fy: number, fr: number) =>
    flakes.push(snowflake(fx * w, fy * h, fr * s, rnd() * Math.PI, 0.78 + rnd() * 0.2));
  place(0.08, 0.40, 0.17); place(0.27, 0.68, 0.11); place(0.07, 0.90, 0.12);
  place(0.30, 0.95, 0.10); place(0.17, 0.14, 0.07);
  place(0.58, 0.05, 0.10); place(0.76, 0.10, 0.15); place(0.95, 0.12, 0.10);
  place(0.78, 0.43, 0.11); place(0.95, 0.56, 0.17); place(0.86, 0.85, 0.09);
  place(0.47, 0.88, 0.06);

  let sparkles = "";
  for (let i = 0; i < 420; i++) {
    sparkles += `<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h).toFixed(1)}" ` +
      `r="${(0.4 + rnd() * rnd() * 2.2).toFixed(2)}" fill="#FFFFFF" fill-opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    `<linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#ACA9EC"/><stop offset="30%" stop-color="#C3C4F3"/>` +
    `<stop offset="58%" stop-color="#E9EBFA"/><stop offset="80%" stop-color="#F0E4F6"/>` +
    `<stop offset="100%" stop-color="#F1CDEB"/></linearGradient>` +
    `<radialGradient id="lav" cx="0.85" cy="0.1" r="0.55"><stop offset="0%" stop-color="#C8B9F0" stop-opacity="0.75"/>` +
    `<stop offset="100%" stop-color="#C8B9F0" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="mist" cx="0.4" cy="0.62" r="0.45"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.65"/>` +
    `<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="blush" cx="0.95" cy="0.85" r="0.45"><stop offset="0%" stop-color="#F3C6E8" stop-opacity="0.8"/>` +
    `<stop offset="100%" stop-color="#F3C6E8" stop-opacity="0"/></radialGradient>` +
    // watercolour bloom: low-frequency noise, faint, so the wash is uneven
    `<filter id="paper" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${(3.2 / s).toFixed(4)}" numOctaves="3" seed="7"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 0 0 0 -0.35"/>` +
    `</filter>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#wash)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#lav)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#blush)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#mist)"/>` +
    `<rect width="${w}" height="${h}" filter="url(#paper)" opacity="0.55"/>` +
    sparkles + flakes.join("") +
    `</svg>`;
}
