// The rainbow balloon the sketch tucks into the garland (2026-11-02, the owner: "burdaki rainbow balonlar da
// eklenebilsin"): a foil rainbow on two cloud puffs, drawn here (free, no photo) and saved as
// public/design/sketch/rainbow-cloud.webp. Run: node scripts/sketch/rainbow-sprite.mjs
import sharp from "sharp";

const W = 520, H = 360, cx = 260, cy = 300;
const STRIPES = ["#f6a5c0", "#f9c49a", "#fbe38e", "#b5e8c6", "#a9d8f5", "#cdb8f2"];
const band = 26, outer = 220;
const arcs = STRIPES.map((c, i) => {
  const r = outer - band / 2 - i * band;
  return `<path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${c}" stroke-width="${band + 1}"/>`;
}).join("");
const rIn = outer - STRIPES.length * band;
const puff = (x, y, s) => [[-46, 10, 40], [-12, -14, 50], [30, -4, 44], [58, 16, 32], [10, 22, 42], [-34, 28, 30]]
  .map(([dx, dy, r]) => `<circle cx="${x + dx * s}" cy="${y + dy * s}" r="${r * s}" fill="url(#cloud)"/>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <radialGradient id="cloud" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#f7f8fb"/><stop offset="1" stop-color="#d9dde6"/></radialGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.08"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="arcMask"><path d="M ${cx - outer} ${cy} A ${outer} ${outer} 0 0 1 ${cx + outer} ${cy} L ${cx + rIn} ${cy} A ${rIn} ${rIn} 0 0 0 ${cx - rIn} ${cy} Z" fill="#fff"/></mask>
</defs>
<path d="M ${cx - outer} ${cy} A ${outer} ${outer} 0 0 1 ${cx + outer} ${cy} L ${cx + rIn} ${cy} A ${rIn} ${rIn} 0 0 0 ${cx - rIn} ${cy} Z" fill="none" stroke="rgba(80,60,90,0.25)" stroke-width="5"/>
${arcs}
<rect x="0" y="0" width="${W}" height="${H}" fill="url(#sheen)" mask="url(#arcMask)"/>
<g stroke="rgba(120,125,140,0.18)" stroke-width="2">${puff(cx - outer + 60, cy - 6, 1.05)}${puff(cx + outer - 60, cy - 6, 1.05)}</g>
</svg>`;
await sharp(Buffer.from(svg)).trim().resize(260).webp({ quality: 90, alphaQuality: 90 }).toFile("public/design/sketch/rainbow-cloud.webp");
console.log("public/design/sketch/rainbow-cloud.webp");
