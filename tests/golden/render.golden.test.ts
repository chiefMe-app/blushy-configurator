// Render guide + prompt golden. Every fixture goes through the real
// /api/generate-controlled-render handler with debugLayoutReferenceOnly, which
// returns the layout guide PNG and the prompt before any fal call — no cost.
// Baselines live in tests/golden/render/<fixture>/; guide.png is written next
// to them for the contact sheet (GOLDEN_UPDATE=1 rewrites the baselines).
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FIXTURES } from "../fixtures/configs";
import { renderBody } from "@/scripts/golden/renderBody";
import { POST } from "@/app/api/generate-controlled-render/route";

// Belt and braces: the debug path never calls fal; make sure it cannot.
vi.mock("@fal-ai/client", () => {
  const refuse = () => { throw new Error("fal called from a golden test"); };
  return { fal: { config: () => {}, subscribe: refuse, run: refuse, storage: { upload: refuse }, queue: { submit: refuse } } };
});
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (/fal\.(run|ai|media)|replicate|supabase/.test(url)) throw new Error(`network call from a golden test: ${url}`);
  return realFetch(input, init);
}) as typeof fetch;

const ROOT = path.join(__dirname, "render");
const OUT = path.join(__dirname, "..", "..", "test-results", "golden-render");
const UPDATE = process.env.GOLDEN_UPDATE === "1";

async function guideFor(id: string, body: unknown) {
  const res = await POST(new NextRequest("http://localhost/api/generate-controlled-render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...(body as object), debugLayoutReferenceOnly: true }),
  }));
  const json = await res.json();
  if (!res.ok || !json.layoutReferenceDataUri) throw new Error(`${id}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  const png = Buffer.from(String(json.layoutReferenceDataUri).split(",")[1], "base64");
  return { png, prompt: String(json.debugPrompt ?? "") };
}

describe("render golden", () => {
  for (const f of FIXTURES) {
    it(f.id, async () => {
      const { png, prompt } = await guideFor(f.id, renderBody(f.config));
      const sha = createHash("sha256").update(png).digest("hex");
      fs.mkdirSync(path.join(OUT, f.id), { recursive: true });
      fs.writeFileSync(path.join(OUT, f.id, "guide.png"), png);
      fs.writeFileSync(path.join(OUT, f.id, "prompt.txt"), prompt);
      const dir = path.join(ROOT, f.id);
      if (UPDATE || !fs.existsSync(path.join(dir, "guide.sha256"))) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "guide.sha256"), sha + "\n");
        fs.writeFileSync(path.join(dir, "guide.png"), png);
        fs.writeFileSync(path.join(dir, "prompt.txt"), prompt);
        return;
      }
      const lf = (s: string) => s.replace(/\r\n/g, "\n");
      expect(lf(prompt), `${f.id} prompt`).toBe(lf(fs.readFileSync(path.join(dir, "prompt.txt"), "utf8")));
      expect(sha, `${f.id} guide`).toBe(fs.readFileSync(path.join(dir, "guide.sha256"), "utf8").trim());
    });
  }
});
