// Typography System T2: the lettering engine — shaping, millimetre layout of
// an independent Heading and Name, preview/production/cut output from the same
// outlines, and per-method production checks that never change a choice.
import { describe, expect, it } from "vitest";
import { layoutLettering, layoutNeon, type LayoutInput, type LetteringElementInput } from "@/lib/typography/layout";
import { letteringPaths, previewSvg, productionSvg } from "@/lib/typography/svg";
import { cutElements, flatten, ringArea } from "@/lib/typography/cutReady";
import { pathBox as curveBox } from "@/lib/typography/geometry";
import { loadFont } from "@/lib/typography/fontLoader";
import { shapeLine } from "@/lib/typography/shape";
import { PICKER_FONTS, fontVariants } from "@/lib/typography/registry";
import { PRESETS, presetById } from "@/lib/typography/presets";
import { FINISHES } from "@/lib/typography/production";

// Clear lettering area of today's Single Round (0.36 x 2000 mm board, 0.96 fill) and a lone arch board.
const ROUND = { widthMm: 691, heightMm: 420 };
const ARCH = { widthMm: 614, heightMm: 520 };

const fromPreset = (id: string, heading: string, name: string, box = ROUND): LayoutInput => {
  const p = presetById(id)!;
  return { heading: { text: heading, ...p.headingFont }, name: { text: name, ...p.nameFont }, headingRatio: p.headingRatio, box };
};
const el = (layout: ReturnType<typeof layoutLettering>, role: "heading" | "name") => layout.elements.find((e) => e.role === role)!;
const dAttrs = (svg: string) => Array.from(svg.matchAll(/ d="([^"]+)"/g)).map((m) => m[1]);

// An independent measure: the outline flattened at 0.005 mm.
const pathBox = (d: string) => curveBox(d, 0.005);

describe("millimetre accuracy", () => {
  const l = layoutLettering(fromPreset("soft-signature", "Happy 1st Birthday", "Layla"));
  it("the production SVG is the box size in mm", () => {
    const svg = productionSvg(l);
    expect(svg).toContain(`width="691mm" height="420mm" viewBox="0 0 691 420"`);
  });
  it.each(["heading", "name"] as const)("%s: drawn outline matches its measured ink box within 0.1 mm and fits the box", (role) => {
    const e = el(l, role);
    const b = pathBox(e.glyphs.join(""));
    for (const k of ["x0", "x1", "y0", "y1"] as const) expect(Math.abs(b[k] - e.ink[k]), k).toBeLessThan(0.1);
    expect(e.ink.x0).toBeGreaterThanOrEqual(0);
    expect(e.ink.x1).toBeLessThanOrEqual(ROUND.widthMm);
    expect(e.ink.x1 - e.ink.x0).toBeLessThanOrEqual(ROUND.widthMm * 0.96 + 0.1);
  });
  it("Medium sizes land at the reference proportions (name ~0.8 of 0.13 x width)", () => {
    expect(el(l, "name").capHeightMm).toBeCloseTo(691 * 0.13 * 0.8, 0);
    expect(el(l, "heading").capHeightMm).toBeLessThanOrEqual(691 * 0.13 * 0.42 * 0.8 + 0.01);
  });
  it("nameCapMm sets the name's base size for boards that call for it; without it nothing changes", () => {
    const base = fromPreset("soft-signature", "Happy 1st Birthday", "Layla");
    const big = layoutLettering({ ...base, name: { ...base.name!, size: "large" }, box: { widthMm: 1159, heightMm: 757 }, nameCapMm: 240 });
    expect(el(big, "name").capHeightMm).toBeCloseTo(240, 0);
    expect(el(big, "heading").capHeightMm).toBeLessThanOrEqual(240 * 0.42 * 0.8 + 0.01); // heading follows the preset ratio
    // the box's height still caps it
    expect(el(layoutLettering({ ...base, box: { widthMm: 1159, heightMm: 300 }, nameCapMm: 240 }), "name").capHeightMm).toBeLessThanOrEqual(300 * 0.35 * 0.8 + 0.01);
    // absent: identical to before
    expect(layoutLettering({ ...base, nameCapMm: undefined }).hash).toBe(layoutLettering(base).hash);
  });
  it("a long name shrinks to fit instead of overflowing", () => {
    const long = layoutLettering({ name: { text: "Alexandrina Montgomery-Fitzgerald", fontId: "italianno", weight: 400, size: "large" }, box: ROUND });
    const e = el(long, "name");
    expect(e.ink.x1 - e.ink.x0).toBeLessThanOrEqual(ROUND.widthMm * 0.96 + 0.1);
  });
});

describe("preview, production SVG and cut file come from the same outlines", () => {
  const l = layoutLettering(fromPreset("modern-editorial", "Happy 2nd Birthday", "Malek"));
  it("preview and production SVG draw identical path data; only the outer size differs", () => {
    const pv = previewSvg(l, 1.5), pr = productionSvg(l);
    expect(dAttrs(pv)).toEqual(dAttrs(pr));
    expect(dAttrs(pv)).toEqual(letteringPaths(l).map((p) => p.d));
    expect(pv).toContain(`viewBox="0 0 691 420"`);
    expect(pr).toContain(`viewBox="0 0 691 420"`);
  });
  it("the cut outline covers the same area as the drawn glyphs (within 1%)", () => {
    for (const c of cutElements(l)) {
      const e = el(l, c.role);
      // Sum of each glyph's own filled area (holes subtracted), before merging overlaps.
      const glyphArea = e.glyphs.reduce((a, d) => {
        const rings = flatten(d); const areas = rings.map(ringArea);
        const s = Math.sign(areas.reduce((x, y) => (Math.abs(y) > Math.abs(x) ? y : x), 0));
        return a + areas.reduce((t, v) => t + (Math.sign(v) === s ? Math.abs(v) : -Math.abs(v)), 0);
      }, 0);
      expect(c.areaMm2 / glyphArea, c.role).toBeGreaterThan(0.97); // merging overlaps can only shrink it a little
      expect(c.areaMm2 / glyphArea, c.role).toBeLessThanOrEqual(1.01);
    }
  });
  it("cut pieces: 'Malek' in Bodoni is five letters; dropped slivers are zero-area", () => {
    const name = cutElements(l).find((c) => c.role === "name")!;
    expect(name.pieces).toBe(5);
    const heading = cutElements(layoutLettering(fromPreset("soft-signature", "Happy 1st Birthday", "Layla"))).find((c) => c.role === "heading")!;
    expect(heading.pieces).toBe(17); // H a p p y 1 s t B ı(stem) i-dot r t h d a y
  });
  it("merged cut rings do not cross themselves", () => {
    const name = cutElements(layoutLettering(fromPreset("soft-signature", "Happy Birthday", "Ayşe Gül"))).find((c) => c.role === "name")!;
    const cross = (a: number[], b: number[], c: number[], d: number[]) => {
      const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    };
    let found = 0;
    for (const poly of name.polygons) for (const ring of poly) {
      const n = ring.length;
      for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        if (cross(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) found++;
      }
    }
    expect(found).toBe(0);
  });
});

describe("Heading and Name are independent", () => {
  const base = fromPreset("soft-signature", "Happy 1st Birthday", "Layla");
  const l0 = layoutLettering(base);
  const same = (a: ReturnType<typeof layoutLettering>, b: ReturnType<typeof layoutLettering>, role: "heading" | "name") => {
    const x = el(a, role), y = el(b, role);
    return JSON.stringify([x.glyphs, x.fontSizeMm, x.originMm]) === JSON.stringify([y.glyphs, y.fontSizeMm, y.originMm]);
  };
  it("changing the heading's font, weight, size or colour leaves the name untouched", () => {
    for (const heading of [
      { ...base.heading!, fontId: "cormorant-garamond", weight: 600 },
      { ...base.heading!, fontId: "libre-caslon-text", weight: 700 },
      { ...base.heading!, size: "large" as const },
      { ...base.heading!, color: "#D4AF37" },
    ]) expect(same(l0, layoutLettering({ ...base, heading }), "name")).toBe(true);
  });
  it("changing the name's colour, or its font when no overlap forces a move, leaves the heading untouched", () => {
    expect(same(l0, layoutLettering({ ...base, name: { ...base.name!, color: "#F472B6" } }), "heading")).toBe(true);
    const other = layoutLettering({ ...base, name: { ...base.name!, fontId: "bodoni-moda", weight: 700 } });
    if (!el(other, "heading").adjusted) expect(same(l0, other, "heading")).toBe(true);
    // the heading's size never depends on the name's font
    expect(el(other, "heading").fontSizeMm).toBe(el(l0, "heading").fontSizeMm);
  });
  it("when a tall name would touch the heading, only the heading moves up, and says so", () => {
    const tall = layoutLettering({ ...base, name: { ...base.name!, fontId: "windsong", weight: 500, size: "large" } });
    const h = el(tall, "heading"), n = el(tall, "name");
    expect(h.ink.y1).toBeLessThanOrEqual(n.ink.y0 + 1e-6);
    if (h.adjusted) expect(h.originMm.y).toBeLessThan(el(l0, "heading").originMm.y);
    expect(h.fontSizeMm).toBe(el(l0, "heading").fontSizeMm);
  });
  it("offsets move only their own element", () => {
    const moved = layoutLettering({ ...base, heading: { ...base.heading!, offset: { x: 0.1, y: -0.05 } } });
    expect(el(moved, "heading").originMm.x - el(l0, "heading").originMm.x).toBeCloseTo(69.1, 1);
    expect(same(l0, moved, "name")).toBe(true);
  });
  it("either element can be left empty", () => {
    expect(layoutLettering({ ...base, heading: { ...base.heading!, text: "" } }).elements.map((e) => e.role)).toEqual(["name"]);
    expect(layoutLettering({ ...base, name: { ...base.name!, text: " " } }).elements.map((e) => e.role)).toEqual(["heading"]);
  });
});

describe("letters", () => {
  it.each(PICKER_FONTS.flatMap((f) => fontVariants(f).map((v) => [`${f.id}@${v.key}`, f.id, v.weight.weight, v.optical?.id] as const)))("%s draws Turkish heading and name with nothing missing", (_k, fontId, weight, optical) => {
    const l = layoutLettering({ heading: { text: "İyi ki doğdun", fontId, weight, optical }, name: { text: "Ayşe Gül Çağla Işıl Öykü Ümit", fontId, weight, optical }, box: ROUND });
    expect(l.elements.map((e) => e.missing)).toEqual(["", ""]);
  });
  it.each(["1st", "2nd", "3rd", "4th", "21st", "22nd", "11th"])("ordinal %s: the suffix is set smaller and raised", (ord) => {
    const lf = loadFont("bellefair", 400);
    const digits = ord.replace(/\D/g, "");
    const d = shapeLine(lf, digits, 100), all = shapeLine(lf, ord, 100);
    expect(all.glyphs.length).toBe(ord.length);
    const suffix = all.glyphs.slice(digits.length).map(pathBox);
    const digitH = d.ink.y1 - d.ink.y0;
    for (const s of suffix) {
      expect(s.y1 - s.y0).toBeLessThan(digitH * 0.75);
      expect(s.y1).toBeLessThan(0); // above the baseline
    }
  });
  it("a missing letter is reported and left out, never drawn as an empty box", () => {
    const lf = loadFont("italianno", 400);
    const r = shapeLine(lf, "Arya 字", 50);
    expect(r.missing).toBe("字");
    expect(r.glyphs.length).toBe(4); // A r y a — no .notdef box
  });
});

describe("production methods are assessed separately and never change a choice", () => {
  it("every element carries all five methods, each provisional", () => {
    const l = layoutLettering(fromPreset("soft-signature", "Happy Birthday", "Layla"));
    for (const e of l.elements) {
      expect(Object.keys(e.finishes).sort()).toEqual(FINISHES.map((f) => f.id).sort());
      expect(Object.values(e.finishes).every((a) => a.provisional)).toBe(true);
    }
  });
  it("Printed is always ok; the same Italianno name can be fine for vinyl and a concern for mirror acrylic", () => {
    const name = el(layoutLettering(fromPreset("soft-signature", "Happy Birthday", "Layla")), "name");
    expect(name.finishes.printed.status).toBe("ok");
    expect(name.finishes.vinyl.status).toBe("ok");
    expect(name.finishes.mirror_acrylic.status).toBe("check");
    expect(name.finishes.mirror_acrylic.notes[0]).toMatchObject({ kind: "thin_strokes", minMm: 2.5 });
  });
  it("Bodoni Moda keeps its fine display cut; the sturdy cut is offered as an option to confirm in the preview", () => {
    const input = fromPreset("modern-editorial", "Happy Birthday", "Malek");
    const l = layoutLettering(input);
    const name = el(l, "name");
    expect(name.input).toEqual(input.name); // the choice is exactly what was asked for
    const a = name.finishes.mirror_acrylic;
    expect(a.status).toBe("check");
    const optical = a.alternatives.find((x) => x.kind === "optical");
    expect(optical).toMatchObject({ kind: "optical", optical: "text", confirm: "preview" });
    expect(optical && optical.kind === "optical" && optical.thinMm).toBeGreaterThan(a.thinMm * 1.25);
    expect(a.alternatives.every((x) => x.confirm === "preview")).toBe(true);
    // and the sturdy cut really is a different drawing the customer would see
    const sturdy = el(layoutLettering({ ...input, name: { ...input.name!, optical: "text" } }), "name");
    expect(sturdy.glyphs).not.toEqual(name.glyphs);
    expect(sturdy.finishes.mirror_acrylic.thinMm).toBeGreaterThan(a.thinMm);
  });
  it("each option changes one thing: Bodoni 700 Display is offered its Sturdy cut, not a weight that is just as thin", () => {
    const name = el(layoutLettering(fromPreset("modern-editorial", "Happy Birthday", "Malek")), "name");
    const alts = name.finishes.vinyl.alternatives;
    expect(alts.filter((a) => a.kind === "weight")).toEqual([]); // 500 Display has the same hairlines
    expect(alts.find((a) => a.kind === "optical")).toMatchObject({ optical: "text", meetsLimit: true });
  });
  it("neon judges the stroke only: monoline scripts pass, letters need not join", () => {
    const n = el(layoutNeon({ text: "Let's Party", fontId: "sacramento", weight: 400 }, { widthMm: 420, heightMm: 300 }), "name").finishes.neon;
    expect(n.status).toBe("ok");
  });
  it("a minimum size option is offered where a bigger size would pass", () => {
    const name = el(layoutLettering(fromPreset("soft-signature", "Happy Birthday", "Layla")), "name");
    const size = name.finishes.mirror_acrylic.alternatives.find((x) => x.kind === "size");
    expect(size && size.kind === "size" && size.minCapHeightMm).toBeGreaterThan(name.capHeightMm);
  });
  it("LED neon: Italianno gets a note, Sacramento does not; neon has its own font, independent of the board", () => {
    const neon = (fontId: string): LetteringElementInput => ({ text: "Let's Party", fontId, weight: 400 });
    expect(el(layoutNeon(neon("italianno"), { widthMm: 420, heightMm: 300 }), "name").finishes.neon.notes.map((n) => n.kind)).toContain("not_monoline");
    expect(el(layoutNeon(neon("sacramento"), { widthMm: 420, heightMm: 300 }), "name").finishes.neon.notes.map((n) => n.kind)).not.toContain("not_monoline");
  });
});

describe("golden layouts (drift guard)", () => {
  const texts: [string, string][] = [["Happy 1st Birthday", "Layla"], ["Happy Birthday", "Ayşe Gül"], ["Welcome to", "Malek"], ["İyi ki doğdun", "Çağla"]];
  for (const p of PRESETS) for (const [h, n] of texts) for (const [bn, box] of [["round", ROUND], ["arch", ARCH]] as const) {
    it(`${p.id} · ${h} / ${n} · ${bn}`, () => {
      const l = layoutLettering(fromPreset(p.id, h, n, box));
      expect({ hash: l.hash, elements: l.elements.map((e) => ({ role: e.role, cap: e.capHeightMm, size: e.fontSizeMm, origin: e.originMm, adjusted: e.adjusted })) }).toMatchSnapshot();
    });
  }
});
