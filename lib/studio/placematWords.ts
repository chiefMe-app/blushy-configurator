// The placemat words' size, shared by the layout guide (server) and the
// builder's top view (browser), which measure the letters each their own way.
/**
 * The placemat words' size (cm): as big as fits in the bottom-right corner
 * without touching the plate (radius 11.5 cm) — 2026-10-29: at 3 cm the render
 * misspelled them. Lines stack upwards from the bottom, one word a line.
 * widthOf: a line's width at a size, in the elegant face (the guide measures it
 * in its embedded font; the builder in the page's own Playfair Display).
 */
export function fitPlacematWords(lines: string[], widthOf: (line: string, size: number) => number): number {
  for (let size = 4.4; size > 2.4; size -= 0.2) {
    const gap = size * 1.12;
    const clear = lines.every((line, i) => {
      const left = 20 - widthOf(line, size), base = -14 + (lines.length - 1 - i) * gap, cap = base + size * 0.72;
      // The line's corner nearest the plate's centre.
      return left >= 0 && Math.hypot(left, cap < 0 ? cap : base > 0 ? base : 0) > 12.5;
    });
    if (clear) return size;
  }
  return 2.4;
}
