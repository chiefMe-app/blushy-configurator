// The demo's API route: validation, engine output, and closed on production.
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/typography/layout/route";
import { layoutLettering } from "@/lib/typography/layout";
import { previewSvg } from "@/lib/typography/svg";
import { DEMO_BOX } from "@/lib/typography/demo";

const call = (body: unknown, q = "") => POST(new NextRequest(`http://localhost/api/typography/layout${q}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
const ok = { presetId: "soft-signature", heading: { text: "Happy 1st Birthday", fontId: "bellefair", weight: 400 }, name: { text: "Layla", fontId: "italianno", weight: 400 } };

afterEach(() => { delete process.env.VERCEL_ENV; });

describe("typography demo API", () => {
  it("returns exactly the engine's preview SVG", async () => {
    const json = await (await call(ok)).json();
    expect(json.svg).toBe(previewSvg(layoutLettering({ heading: ok.heading, name: ok.name, headingRatio: 0.42, box: DEMO_BOX }), 1));
    expect(json.elements.map((e: { role: string }) => e.role)).toEqual(["heading", "name"]);
    expect(Object.keys(json.elements[1].finishes).sort()).toEqual(["acrylic", "mirror_acrylic", "neon", "printed", "vinyl"]);
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
    const clamped = previewSvg(layoutLettering({ heading: ok.heading, name: { ...ok.name, offset: { x: 0.45, y: -0.45 } }, headingRatio: 0.42, box: DEMO_BOX }), 1);
    expect(json.svg).toBe(clamped);
  });
  it("production and cut downloads are 1:1 mm SVG files", async () => {
    for (const f of ["production", "cut"]) {
      const res = await call(ok, `?format=${f}`);
      expect(res.headers.get("content-type")).toContain("image/svg+xml");
      expect(await res.text()).toContain('width="691mm" height="420mm"');
    }
  });
  it("is closed on the production deployment", async () => {
    process.env.VERCEL_ENV = "production";
    expect((await call(ok)).status).toBe(404);
  });
  it("the demo page is closed on the production deployment too, open on previews", async () => {
    const { default: Page } = await import("@/app/typography-demo/page");
    process.env.VERCEL_ENV = "production";
    expect(() => Page()).toThrow(/NEXT_NOT_FOUND/);
    process.env.VERCEL_ENV = "preview";
    expect(() => Page()).not.toThrow();
  });
});
