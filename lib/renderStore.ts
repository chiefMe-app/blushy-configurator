// Keeping a finished render in the customer's account (Phase 0.5c): the
// render API uploads it, with the customer's own session, to their folder of
// the private `renders` bucket (supabase/migrations/20261027130000_render_storage.sql),
// as a JPEG of at most 1600 px wide (~300–400 KB). One file per scene: making
// the same scene again replaces it.
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RENDER_BUCKET, renderKey } from "@/lib/renderKey";

const MAX_WIDTH = 1600;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/** The render's bytes: a data URI from the compositing steps, or fal's https link. */
async function imageBytes(imageUrl: string): Promise<Buffer | null> {
  const data = imageUrl.match(/^data:image\/[a-z+]+;base64,(.+)$/i);
  if (data) return Buffer.from(data[1], "base64");
  if (!/^https:\/\//i.test(imageUrl)) return null;
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length <= MAX_SOURCE_BYTES ? buf : null;
}

/**
 * Stores the render; returns where, or null if it could not be stored (the
 * customer still sees the render — only keeping it failed, and is logged).
 */
export async function storeRender(client: SupabaseClient, userId: string, imageUrl: string, sceneHash: string): Promise<{ path: string; key: string } | null> {
  try {
    const source = await imageBytes(imageUrl);
    if (!source) { console.warn("[render] not stored: no image bytes"); return null; }
    const jpeg = await sharp(source).resize({ width: MAX_WIDTH, withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    const key = renderKey(sceneHash);
    const path = `${userId}/${key}.jpg`;
    const { error } = await client.storage.from(RENDER_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) { console.warn("[render] not stored:", error.message); return null; }
    return { path, key };
  } catch (err) {
    console.warn("[render] not stored:", err);
    return null;
  }
}
