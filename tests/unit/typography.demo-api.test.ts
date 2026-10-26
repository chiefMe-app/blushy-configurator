// The demo's API route: validation, engine output, and the limits that keep the
// public endpoint cheap (body size, rate limit, cache, no downloads on production).
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/typography/layout/route";
import { layoutLettering } from "@/lib/typography/layout";
import { previewSvg } from "@/lib/typography/svg";
import { DEMO_BOX, DEMO_NAME_CAP_MM } from "@/lib/typography/demo";

const call = (body: unknown, q = "", ip?: string) => POST(new NextRequest(`http://localhost/api/typography/layout${q}`, {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
  headers: { "content-type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) },
}));
const ok = { presetId: "soft-signature", heading: { text: "Happy 1st Birthday", fontId: "bellefair", weight: 400 }, name: { text: "Layla", fontId: "italianno", weight: 400 } };

afterEach(() => { delete process.env.VERCEL_ENV; });

describe("typography demo API", () => {
  it("returns exactly the engine's preview SVG", async () => {
    const json = await (await call(ok)).json();
    expect(json.svg).toBe(previewSvg(layoutLettering({ heading: ok.heading, name: ok.name, headingRatio: 0.42, box: DEMO_BOX, nameCapMm: DEMO_NAME_CAP_MM }), 1));
    expect(json.elements).toEqual([{ role: "heading", missing: "" }, { role: "name", missing: "" }]);
    // only what the pages use: no production engineering in the response
    expect(Object.keys(json).sort()).toEqual(["box", "elements", "hash", "paths", "svg"]);
    // The Builder's sketch draws `paths`: the very outlines in the SVG.
    const svgPaths = Array.from(String(json.svg).matchAll(/data-role="(\w+)" d="([^"]+)"/g)).map((m) => [m[1], m[2]]);
    expect(json.paths.map((p: { role: string; d: string }) => [p.role, p.d])).toEqual(svgPaths);
  });
  it("a heading on its own leads, at the name's size", async () => {
    // A short line, so the width does not cap it.
    const short = { ...ok, heading: { ...ok.heading, text: "Oh Baby" } };
    const one = await (await call({ ...short, name: { ...ok.name, text: "" } })).json();
    const both = await (await call(short)).json();
    expect(one.paths.map((p: { role: string }) => p.role)).toEqual(["name"]);
    expect(one.paths[0].fontId).toBe("bellefair");
    expect(one.paths[0].fontSizeMm).toBeGreaterThan(both.paths.find((p: { role: string }) => p.role === "heading").fontSizeMm * 1.5);
  });
  it.each([
    ["an unknown font", { ...ok, name: { ...ok.name, fontId: "comic-sans" } }],
    ["a legacy-only font", { ...ok, name: { ...ok.name, fontId: "archivo-black" } }],
    ["a weight the font does not have", { ...ok, name: { ...ok.name, weight: 900 } }],
    ["an optical cut the font does not have", { ...ok, name: { ...ok.name, optical: "text" } }],
    ["a bad colour", { ...ok, name: { ...ok.name, color: "red;fill:url(x)" } }],
    ["a bad size", { ...ok, name: { ...ok.name, size: "huge" } }],
    ["text over 60 characters", { ...ok, name: { ...ok.name, text: "x".repeat(61) } }],
  ])("rejects %s", async (_n, body) => {
    expect((await call(body)).status).toBe(400);
  });
  it("text never reaches the SVG as markup — only as outlines", async () => {
    const json = await (await call({ ...ok, name: { ...ok.name, text: `<script>alert(1)</script>"&` } })).json();
    expect(json.svg).not.toMatch(/<script|alert|<text/);
  });
  it("offsets are clamped", async () => {
    const json = await (await call({ ...ok, name: { ...ok.name, offset: { x: 9, y: -9 } } })).json();
    const clamped = previewSvg(layoutLettering({ heading: ok.heading, name: { ...ok.name, offset: { x: 0.45, y: -0.45 } }, headingRatio: 0.42, box: DEMO_BOX, nameCapMm: DEMO_NAME_CAP_MM }), 1);
    expect(json.svg).toBe(clamped);
  });
  it("production and cut downloads are 1:1 mm SVG files", async () => {
    for (const f of ["production", "cut"]) {
      const res = await call(ok, `?format=${f}`);
      expect(res.headers.get("content-type")).toContain("image/svg+xml");
      expect(await res.text()).toContain(`width="${DEMO_BOX.widthMm}mm" height="${DEMO_BOX.heightMm}mm"`);
    }
  });
  it("works on the production deployment; the technical downloads do not", async () => {
    process.env.VERCEL_ENV = "production";
    expect((await call(ok)).status).toBe(200);
    for (const f of ["production", "cut"]) expect((await call(ok, `?format=${f}`)).status).toBe(404);
  });
  it("the demo page renders on the production deployment", async () => {
    const { default: Page } = await import("@/app/typography-demo/page");
    process.env.VERCEL_ENV = "production";
    expect(() => Page()).not.toThrow();
  });
  it("refuses request bodies over 4 KB", async () => {
    const res = await call(JSON.stringify({ ...ok, padding: "x".repeat(5000) }));
    expect(res.status).toBe(413);
  });
  it("identical requests are answered identically (from the cache)", async () => {
    const a = await (await call(ok)).text(), b = await (await call(ok)).text();
    expect(b).toBe(a);
  });
  it("rate-limits one client after 120 layouts a minute, without affecting others", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 122; i++) statuses.push((await call(ok, "", "203.0.113.9")).status);
    expect(statuses.slice(0, 120).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(120)).toEqual([429, 429]);
    expect((await call(ok, "", "198.51.100.7")).status).toBe(200);
  });
});
