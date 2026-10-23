// Colourful sprinkle confetti, as on every screen of the design reference.
// Deterministic (the same positions on server and client, no hydration
// mismatch), decorative only, hidden from assistive tech.

const SPRINKLE_COLOURS = ["#FF4F88", "#F7BFD0", "#9FC5F8", "#28C453", "#F7D74D", "#C79AF2", "#FF7B5C"];

// Small seeded PRNG (mulberry32): random-looking but repeatable.
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Sprinkles({
  count = 60, seed = 7, keepCentreClear = true, scatter = false, className = "",
}: {
  count?: number; seed?: number; keepCentreClear?: boolean;
  /** 2026-10-23: scatter at random instead of the even grid, which lines
   *  sprinkles up in columns when there are many of them. */
  scatter?: boolean;
  className?: string;
}) {
  const items: { x: number; y: number; r: number; c: string }[] = [];
  const rnd = seeded(seed * 7919 + 1);
  for (let i = 0; i < count; i++) {
    const x = scatter ? rnd() * 100 : (i * 71 + seed * 19) % 100;
    const y = scatter ? rnd() * 96 : (i * 37 + seed * 21) % 95;
    const r = scatter ? rnd() * 150 - 75 : ((i * 43 + 19) % 155) - 70;
    // The reference leaves the middle of the screen free so sprinkles sit
    // round the edges rather than under the content.
    if (keepCentreClear && x > 23 && x < 77 && y > 22 && y < 82) continue;
    items.push({ x, y, r, c: SPRINKLE_COLOURS[(i + seed) % SPRINKLE_COLOURS.length] });
  }
  return (
    <div className={`bz-sprinkles ${className}`} aria-hidden="true">
      {items.map((s, i) => (
        <i key={i} style={{ left: `${s.x.toFixed(2)}%`, top: `${s.y.toFixed(2)}%`, ["--r" as string]: `${s.r.toFixed(1)}deg`, ["--c" as string]: s.c } as React.CSSProperties} />
      ))}
    </div>
  );
}
