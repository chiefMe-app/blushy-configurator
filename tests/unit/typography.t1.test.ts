// Typography System T1: the font collection, its measurements and presets.
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { FONTS, PICKER_FONTS, fontById } from "@/lib/typography/registry";
import { PRESETS, DEFAULT_PRESET_ID, presetById } from "@/lib/typography/presets";
import { FINISHES } from "@/lib/typography/production";
import { measured, neonFriendly, preliminaryCheck } from "@/lib/typography/check";
import generated from "@/lib/typography/fonts.generated.json";

const ASSETS = path.resolve(__dirname, "../../assets/fonts");
const lock = JSON.parse(fs.readFileSync(path.join(ASSETS, "fonts.lock.json"), "utf8")) as { commit: string; files: Record<string, string> };
const sha = (p: string) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");

describe("font files", () => {
  it("are pinned to one google/fonts commit", () => {
    expect(lock.commit).toMatch(/^[0-9a-f]{40}$/);
  });
  it.each(FONTS.map((f) => [f.id, f] as const))("%s: every weight file and OFL.txt is present and matches the lock", (_id, f) => {
    const meta = fs.readFileSync(path.join(ASSETS, f.dir, "METADATA.pb"), "utf8");
    expect(meta).toMatch(/license: "OFL"/);
    for (const rel of [...Array.from(new Set(f.weights.map((w) => w.file))), "OFL.txt"].map((n) => `${f.dir}/${n}`)) {
      expect(lock.files[rel], rel).toBeTruthy();
      expect(sha(path.join(ASSETS, rel)), rel).toBe(lock.files[rel]);
    }
  });
  it("the Italianno the app ships is the vendored one", () => {
    expect(sha(path.resolve(__dirname, "../../app/fonts/Italianno-Regular.ttf"))).toBe(lock.files["italianno/Italianno-Regular.ttf"]);
  });
});

describe("registry and measurements", () => {
  const gen = generated.fonts as Record<string, { licence: { ofl: boolean; lockMatch: boolean }; weights: Record<string, { coverage: { ok: boolean }; shaping: { pass: boolean } | null }> }>;
  it("ids are unique, the picker offers 24 families and keeps the legacy Bold out", () => {
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length);
    expect(PICKER_FONTS).toHaveLength(24);
    expect(PICKER_FONTS.some((f) => f.id === "archivo-black")).toBe(false);
  });
  it("measurements exist for exactly the registry's fonts and weights (not stale)", () => {
    expect(Object.keys(gen).sort()).toEqual(FONTS.map((f) => f.id).sort());
    for (const f of FONTS) expect(Object.keys(gen[f.id].weights).sort(), f.id).toEqual(f.weights.map((w) => String(w.weight)).sort());
  });
  it.each(FONTS.flatMap((f) => f.weights.map((w) => [`${f.id}@${w.weight}`, f.id, w.weight] as const)))("%s: OFL, full English + Turkish coverage, shaping matches the browser", (_k, id, weight) => {
    expect(gen[id].licence).toEqual({ ofl: true, lockMatch: true });
    const w = gen[id].weights[String(weight)];
    expect(w.coverage.ok).toBe(true);
    expect(w.shaping?.pass).toBe(true);
  });
  it("measurement table (drift guard)", () => {
    const table = FONTS.flatMap((f) => f.weights.map((w) => {
      const m = measured(f.id, w.weight)!;
      return `${f.id}@${w.weight} thin/cap=${m.stroke.thinOfCap} median/cap=${m.stroke.medianOfCap} mono=${m.stroke.monoline} neon=${neonFriendly(f.id, w.weight)}`;
    }));
    expect(table).toMatchSnapshot();
  });
});

describe("web fonts", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../../public/fonts/typography/fonts.css"), "utf8");
  it.each(FONTS.flatMap((f) => f.weights.map((w) => [`${f.id}-${w.weight}.woff2`, f, w.weight] as const)))("%s exists, is WOFF2, under 50 KB, and has an @font-face", (file, f, weight) => {
    const buf = fs.readFileSync(path.resolve(__dirname, "../../public/fonts/typography", file));
    expect(buf.subarray(0, 4).toString("latin1")).toBe("wOF2");
    expect(buf.length).toBeLessThan(50 * 1024);
    expect(css).toContain(`font-family:"PM ${f.family}";src:url("/fonts/typography/${file}") format("woff2");font-weight:${weight};`);
  });
  it("nothing in the app loads them yet (T1 changes no page)", () => {
    const appFiles = ["app/layout.tsx", "app/blushy.css", "app/globals.css"].map((p) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8")).join("\n");
    expect(appFiles).not.toContain("fonts/typography");
  });
});

describe("presets", () => {
  it("#5 Soft Signature is the default: Bellefair heading, Italianno name", () => {
    expect(DEFAULT_PRESET_ID).toBe("soft-signature");
    const p = presetById(DEFAULT_PRESET_ID)!;
    expect({ n: p.number, def: p.default, h: p.headingFont, nm: p.nameFont }).toEqual({ n: 5, def: true, h: { fontId: "bellefair", weight: 400 }, nm: { fontId: "italianno", weight: 400 } });
  });
  it("#9 Modern Editorial is featured: Cormorant Garamond 600 heading, Bodoni Moda 700 name", () => {
    const p = presetById("modern-editorial")!;
    expect({ n: p.number, f: p.featured, h: p.headingFont, nm: p.nameFont }).toEqual({ n: 9, f: true, h: { fontId: "cormorant-garamond", weight: 600 }, nm: { fontId: "bodoni-moda", weight: 700 } });
    expect(PRESETS.filter((x) => x.default)).toHaveLength(1);
  });
  it.each(PRESETS.map((p) => [p.name, p] as const))("%s uses picker fonts at weights that exist", (_n, p) => {
    for (const el of [p.headingFont, p.nameFont]) {
      const f = fontById(el.fontId)!;
      expect(f, el.fontId).toBeTruthy();
      expect(f.legacyOnly).toBeFalsy();
      expect(f.weights.some((w) => w.weight === el.weight), `${el.fontId}@${el.weight}`).toBe(true);
    }
  });
});

describe("preliminary production check (provisional, never swaps a font)", () => {
  it("every finish limit is marked provisional until the producer confirms it", () => {
    expect(FINISHES.every((f) => f.provisional)).toBe(true);
  });
  it("printed lettering has no stroke limit", () => {
    expect(preliminaryCheck("italianno", 400, 30, "printed").status).toBe("ok");
  });
  it("thin Italianno strokes on mirror acrylic are flagged for a producer check, with the measured mm", () => {
    const r = preliminaryCheck("italianno", 400, 40, "mirror_acrylic");
    expect(r.status).toBe("check");
    expect(r.provisional).toBe(true);
    expect(r.notes.find((n) => n.kind === "thin_strokes")).toMatchObject({ kind: "thin_strokes", minMm: 2.5 });
    expect(Object.keys(r).sort()).toEqual(["notes", "provisional", "status", "thinMm"]); // no replacement font is ever proposed here
  });
  it("neon: monoline faces are recommended, others only get an informational note", () => {
    expect(neonFriendly("sacramento", 400)).toBe(true);
    expect(neonFriendly("italianno", 400)).toBe(false);
    expect(preliminaryCheck("italianno", 400, 60, "neon").notes.map((n) => n.kind)).toContain("not_monoline");
    expect(preliminaryCheck("sacramento", 400, 60, "neon").notes.map((n) => n.kind)).not.toContain("not_monoline");
  });
});
