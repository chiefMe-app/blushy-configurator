// The metallic-lettering pass in /api/generate-controlled-render, on a real
// render (tests/fixtures/renders/n02-editorial-gold.jpg: fixture N02, one of
// the four approved check renders of 2026-10-26). fal is mocked to return that
// picture, so nothing is paid for. The model painted the gold Bodoni "Layla"
// black; after the pass no letter stroke may stay black.
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FIXTURES } from "../fixtures/configs";
import { renderBody } from "@/scripts/golden/renderBody";

const RENDER = path.join(__dirname, "..", "fixtures", "renders", "n02-editorial-gold.jpg");
vi.mock("@fal-ai/client", () => {
  const img = "data:image/jpeg;base64," + fs.readFileSync(path.join(__dirname, "..", "fixtures", "renders", "n02-editorial-gold.jpg")).toString("base64");
  const ok = async () => ({ data: { images: [{ url: img }] }, requestId: "mock" });
  return { fal: { config: () => {}, subscribe: ok, run: ok, storage: { upload: async () => img }, queue: { submit: ok } } };
});

/** Pixels in the "Layla" box (render coordinates) that are near-black, and the mean colour of the letters. */
async function letters(buf: Buffer) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let black = 0, n = 0, r = 0, b = 0;
  for (let y = 425; y < 505; y++) for (let x = 455; x < 710; x++) {
    const i = (y * info.width + x) * info.channels;
    const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    if (l > 0.75) continue; // board
    n++; r += data[i]; b += data[i + 2];
    if (l < 0.25) black++;
  }
  return { black, n, r: r / n, b: b / n };
}

describe("metallic lettering pass", () => {
  it("gold lettering painted black comes out gold, every letter", async () => {
    process.env.FAL_KEY = "mock";
    const { POST } = await import("@/app/api/generate-controlled-render/route");
    const body = { ...(renderBody(FIXTURES.find((f) => f.id === "N02-editorial-gold")!.config) as object), force: true };
    const res = await POST(new NextRequest("http://localhost/api/generate-controlled-render", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    expect(res.status).toBe(200);
    const out = Buffer.from(String((await res.json()).imageUrl).split(",")[1], "base64");
    const before = await letters(fs.readFileSync(RENDER));
    const after = await letters(out);
    expect(before.black).toBeGreaterThan(2000); // the model's black letters
    expect(after.black).toBeLessThan(before.black * 0.05); // a few dark JPEG edge pixels may stay
    expect(after.r - after.b).toBeGreaterThan(40); // warm: gold, not grey
  }, 120_000);
});
