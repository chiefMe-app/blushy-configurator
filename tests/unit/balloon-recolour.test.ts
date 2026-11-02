// A set photo's balloon family repainted in another colour keeps its light and shade (2026-11-02: Unicorn
// Bright's fuchsia family turned Pastel Dusk 110 Rose went flat, "boyanmış gibi duruyor").
import { describe, expect, it } from "vitest";
import { labToRgb, recolourPixel, rgbToLab } from "@/lib/balloonRecolour";

const hexLab = (h: string) => rgbToLab(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16));
const ROSE = hexLab("#FDA4AF"), FUCHSIA = hexLab("#E4007C"), LILAC = hexLab("#DDD6FE");
/** The Unicorn Bright fuchsia family's mean lightness and its 5th / 95th percentiles in the Wavy shot. */
const FUCHSIA_FAM = { L: 51.7, p5: 35.9, p95: 73.9 };
const at = (L: number) => [L, 60, 9] as [number, number, number];

describe("balloon recolour", () => {
  it("round-trips sRGB through Lab", () => {
    for (const c of [[0, 0, 0], [255, 255, 255], [228, 0, 124], [253, 164, 175], [30, 60, 200]] as [number, number, number][]) {
      expect(labToRgb(...rgbToLab(...c))).toEqual(c);
    }
  });

  it("puts the family's mean light on the target colour", () => {
    const o = labToRgb(...recolourPixel(at(FUCHSIA_FAM.L), FUCHSIA_FAM.L, ROSE));
    expect(o.map((v, i) => Math.abs(v - [253, 164, 175][i]))).toSatisfy((d: number[]) => d.every((x) => x <= 1));
  });

  it("keeps a dark family's shading when it is turned pale, without clipping its sheen", () => {
    const shade = recolourPixel(at(FUCHSIA_FAM.p5), FUCHSIA_FAM.L, ROSE)[0];
    const sheen = recolourPixel(at(FUCHSIA_FAM.p95), FUCHSIA_FAM.L, ROSE)[0];
    expect(sheen - shade).toBeGreaterThan(25);
    expect(sheen).toBeLessThan(98);
    expect(shade).toBeLessThan(ROSE[0] - 10);
    // Royal blue (dark, wide light) turned pastel lilac: still modelled, never white.
    const lo = recolourPixel(at(8), 30, LILAC)[0], hi = recolourPixel(at(64), 30, LILAC)[0];
    expect(hi - lo).toBeGreaterThan(25);
    expect(hi).toBeLessThan(98);
  });

  it("is smooth and in order: lighter in the photo, lighter repainted", () => {
    for (const t of [ROSE, FUCHSIA, LILAC]) {
      let prev = -Infinity;
      for (let L = 2; L <= 98; L += 2) {
        const o = recolourPixel(at(L), 55, t)[0];
        expect(o).toBeGreaterThan(prev);
        prev = o;
      }
    }
  });

  it("dims colour in shadow and whitens it in a sheen", () => {
    const C = (lab: number[]) => Math.hypot(lab[1], lab[2]);
    expect(C(recolourPixel(at(30), 51.7, ROSE))).toBeLessThan(C(ROSE));
    expect(C(recolourPixel(at(80), 51.7, ROSE))).toBeLessThan(C(ROSE));
  });
});
