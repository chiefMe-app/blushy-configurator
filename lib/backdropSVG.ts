function darkenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.max(0, ((n >> 16) & 255) - amount);
  const g = Math.max(0, ((n >> 8) & 255) - amount);
  const b = Math.max(0, (n & 255) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function drawPanel(
  shape: string,
  px: number,
  floor: number,
  w: number,
  h: number,
  color: string,
  idx: number
): string {
  const top = floor - h;
  const cx = px + w / 2;
  const r = w / 2;
  const stroke = darkenHex(color, 20);
  const sa = `stroke="${stroke}" stroke-width="1.5"`;

  switch (shape) {
    case "arch": {
      const sideH = h - r;
      const sideTop = floor - sideH;
      const d = [
        `M ${px},${floor}`,
        `L ${px},${sideTop}`,
        `A ${r},${r} 0 0 1 ${px + w},${sideTop}`,
        `L ${px + w},${floor}`,
        "Z",
      ].join(" ");
      return `<path d="${d}" fill="${color}" ${sa}/>`;
    }

    case "half_arch": {
      const rightH = Math.round(h * 0.55);
      const rightTop = floor - rightH;
      const cp1x = px + w * 0.08;
      const cp1y = top + (rightTop - top) * 0.25;
      const cp2x = px + w * 0.88;
      const cp2y = rightTop + (top - rightTop) * 0.08;
      const d = [
        `M ${px},${floor}`,
        `L ${px},${top}`,
        `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${px + w},${rightTop}`,
        `L ${px + w},${floor}`,
        "Z",
      ].join(" ");
      return `<path d="${d}" fill="${color}" ${sa}/>`;
    }

    case "round": {
      const cy = floor - r;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" ${sa}/>`;
    }

    case "rect": {
      return `<rect x="${px}" y="${top}" width="${w}" height="${h}" fill="${color}" ${sa}/>`;
    }

    case "shimmer_wall": {
      const patId = `shimmer_${idx}`;
      const shimmerColor = darkenHex(color, 30);
      return [
        `<pattern id="${patId}" patternUnits="userSpaceOnUse" width="10" height="10">`,
        `  <rect width="10" height="10" fill="${color}"/>`,
        `  <line x1="0" y1="5" x2="10" y2="0" stroke="${shimmerColor}" stroke-width="0.8" opacity="0.5"/>`,
        `  <line x1="0" y1="10" x2="10" y2="5" stroke="${shimmerColor}" stroke-width="0.8" opacity="0.5"/>`,
        `  <line x1="5" y1="0" x2="5" y2="10" stroke="rgba(255,255,255,0.3)" stroke-width="0.6" opacity="0.4"/>`,
        `</pattern>`,
        `<rect x="${px}" y="${top}" width="${w}" height="${h}" fill="url(#${patId})" ${sa}/>`,
      ].join("\n");
    }

    case "wavy": {
      const amp = 12;
      const segments = 3;
      const segW = w / segments;
      const pts = [`M ${px},${floor}`, `L ${px},${top + amp}`];
      for (let i = 0; i < segments; i++) {
        const x1 = px + (i + 0.5) * segW;
        const x2 = Math.min(px + (i + 1) * segW, px + w);
        const y1 = i % 2 === 0 ? top - amp : top + amp * 2;
        pts.push(`Q ${x1},${y1} ${x2},${top + amp}`);
      }
      pts.push(`L ${px + w},${floor}`, "Z");
      return `<path d="${pts.join(" ")}" fill="${color}" ${sa}/>`;
    }

    default:
      return `<rect x="${px}" y="${top}" width="${w}" height="${h}" fill="${color}" ${sa}/>`;
  }
}

export function generateBackdropSVG(
  shapes: string[],
  backdropColor: string,
  width = 800,
  height = 600
): string {
  const floor = height - 60;
  const panelW = 160;
  const panelH = 320;
  const gap = 20;
  const count = Math.max(1, Math.min(3, shapes.length));
  const totalW = count * panelW + (count - 1) * gap;
  const startX = (width - totalW) / 2;

  const panels = shapes.slice(0, count).map((shape, i) => {
    const px = startX + i * (panelW + gap);
    return drawPanel(shape, px, floor, panelW, panelH, backdropColor, i);
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <defs>`,
    `    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">`,
    `      <stop offset="0%" stop-color="#EDEAE6"/>`,
    `      <stop offset="100%" stop-color="#F5F2EE"/>`,
    `    </linearGradient>`,
    `  </defs>`,
    `  <rect width="${width}" height="${floor}" fill="url(#bgGrad)"/>`,
    `  <rect x="0" y="${floor}" width="${width}" height="${height - floor}" fill="#DDD9D4"/>`,
    `  <line x1="0" y1="${floor}" x2="${width}" y2="${floor}" stroke="#C8C4C0" stroke-width="1.5"/>`,
    ...panels.map((p) => `  ${p}`),
    `</svg>`,
  ].join("\n");
}
