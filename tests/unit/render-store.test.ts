// Phase 0.5c: the render key (lib/renderKey.ts) and keeping a finished render
// in the customer's folder of the private `renders` bucket (lib/renderStore.ts).
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSceneHash, renderKey, renderKeyOf } from "@/lib/renderKey";
import { storeRender } from "@/lib/renderStore";
import { fixtureById } from "../fixtures/configs";

const config = fixtureById("N01-soft-signature-round").config;

describe("render key", () => {
  it("is short, file-name safe and the same for the same scene", () => {
    const k = renderKeyOf(config);
    expect(k).toMatch(/^[0-9a-z]{6,30}$/);
    expect(renderKeyOf(structuredClone(config))).toBe(k);
  });
  it("changes with the scene, not with a stored render or the customer's details", () => {
    const k = renderKeyOf(config);
    expect(renderKeyOf({ ...config, theme: "unicorn" })).not.toBe(k);
    expect(renderKeyOf({ ...config, decor: { ...config.decor, savedRender: { path: "u/x.jpg", key: "x" } } })).toBe(k);
    expect(renderKeyOf({ ...config, customer: { name: "Someone", whatsapp: "+971500000001" } })).toBe(k);
  });
  it("matches what the render API computes from the body's currentSceneHash", () => {
    expect(renderKey(computeSceneHash(config))).toBe(renderKeyOf(config));
  });
});

function fakeClient(answer: { error: { message: string } | null } = { error: null }) {
  const upload = vi.fn().mockResolvedValue({ data: {}, ...answer });
  const from = vi.fn(() => ({ upload }));
  return { client: { storage: { from } } as unknown as SupabaseClient, from, upload };
}
const png = (w: number) => sharp({ create: { width: w, height: Math.round(w * 0.75), channels: 3, background: "#f3c" } }).png().toBuffer();

describe("storing a render", () => {
  it("a data URI render goes to the customer's folder as a JPEG, at most 1600 px wide", async () => {
    const f = fakeClient();
    const uri = `data:image/png;base64,${(await png(2400)).toString("base64")}`;
    const saved = await storeRender(f.client, "user-1", uri, computeSceneHash(config));
    expect(saved).toEqual({ path: `user-1/${renderKeyOf(config)}.jpg`, key: renderKeyOf(config) });
    expect(f.from).toHaveBeenCalledWith("renders");
    const [path, bytes, opts] = f.upload.mock.calls[0];
    expect(path).toBe(saved!.path);
    expect(opts).toEqual({ contentType: "image/jpeg", upsert: true });
    const meta = await sharp(bytes as Buffer).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: 1600 });
  });
  it("fal's https link is fetched; anything else is not stored", async () => {
    const f = fakeClient();
    const bytes = await png(800);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array(bytes)));
    expect(await storeRender(f.client, "user-1", "https://v3.fal.media/files/x.png", "scene")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(await storeRender(f.client, "user-1", "/design/local.webp", "scene")).toBeNull();
    expect(await storeRender(f.client, "user-1", "http://insecure.example/x.png", "scene")).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockRestore();
  });
  it("a refused upload is logged, not thrown: the customer still has the render", async () => {
    const f = fakeClient({ error: { message: "new row violates row-level security policy" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await storeRender(f.client, "user-1", `data:image/png;base64,${(await png(100)).toString("base64")}`, "scene")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
