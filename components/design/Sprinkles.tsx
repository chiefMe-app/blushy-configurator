// Colourful sprinkle confetti, as on every screen of the design reference.
// Deterministic (the same positions on server and client, no hydration
// mismatch), decorative only, hidden from assistive tech.

const SPRINKLE_COLOURS = ["#FF4F88", "#F7BFD0", "#9FC5F8", "#28C453", "#F7D74D", "#C79AF2", "#FF7B5C"];

export default function Sprinkles({
  count = 60, seed = 7, keepCentreClear = true, className = "",
}: { count?: number; seed?: number; keepCentreClear?: boolean; className?: string }) {
  const items: { x: number; y: number; r: number; c: string }[] = [];
  for (let i = 0; i < count; i++) {
    const x = (i * 71 + seed * 19) % 100;
    const y = (i * 37 + seed * 21) % 95;
    // The reference leaves the middle of the screen free so sprinkles sit
    // round the edges rather than under the content.
    if (keepCentreClear && x > 23 && x < 77 && y > 22 && y < 82) continue;
    items.push({ x, y, r: ((i * 43 + 19) % 155) - 70, c: SPRINKLE_COLOURS[(i + seed) % SPRINKLE_COLOURS.length] });
  }
  return (
    <div className={`bz-sprinkles ${className}`} aria-hidden="true">
      {items.map((s, i) => (
        <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, ["--r" as string]: `${s.r}deg`, ["--c" as string]: s.c } as React.CSSProperties} />
      ))}
    </div>
  );
}
