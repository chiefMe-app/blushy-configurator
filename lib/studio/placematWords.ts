// The placemat words' size, shared by the layout guide (server) and the
// builder's top view (browser), which measure the letters each their own way.
/**
 * The placemat words' size (cm): 3 cm, as they first were (2026-10-29, the
 * owner: "placemat'a eklenen yazı daha küçülmeli, eskisi gibi gözükmeli"),
 * times the face's scale (a script's small letters are set bigger), smaller
 * only when the corner beside the plate (radius 11.5 cm) is too small. Lines
 * stack upwards from the bottom, one word a line.
 * widthOf: a line's width at a size, in the chosen face (the guide measures it
 * in the font file; the builder in the page's web font).
 */
export const PLACEMAT_WORDS_SIZE = 3;

export function fitPlacematWords(lines: string[], widthOf: (line: string, size: number) => number, face: Face = PRINT): number {
  const { scale } = face, max = PLACEMAT_WORDS_SIZE * scale, min = max * 0.55;
  for (let size = max; size > min; size -= 0.1 * scale) {
    const gap = placematWordsGap(size, scale);
    const clear = lines.every((line, i) => {
      const left = 20 - widthOf(line, size), base = -placematWordsBottom(size, face) + (lines.length - 1 - i) * gap, cap = base + (size / scale) * 0.72;
      // The line's corner nearest the plate's centre.
      return left >= 0 && Math.hypot(left, cap < 0 ? cap : base > 0 ? base : 0) > 12.5;
    });
    if (clear) return size;
  }
  return min;
}

type Face = { scale: number; hand: boolean };
const PRINT: Face = { scale: 1, hand: false };

/** The last line's baseline (cm below the placemat's middle): a handwritten face's tails stay on the paper (it ends at 14.85). */
export const placematWordsBottom = (size: number, face: Face = PRINT) => 14 - (face.hand ? size * 0.28 : 0);

/** From one line's baseline to the next (cm): a script's tall letters need no more room than a print face's capitals. */
export const placematWordsGap = (size: number, scale = 1) => (size / scale) * 1.12;
