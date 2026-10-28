// The real render of the kids' table (F3): since 2026-10-28 one close-up of a
// place setting, made from the pictures of the options the customer chose
// (lib/studio/tableRender.ts) — the layout stays the live drawings. Like the
// backdrop render it costs money, so it needs a signed-in account and counts
// as one of the day's renders (lib/renderAccount.ts), behind the per-IP guard
// (lib/renderGuard.ts). The picture is kept in the customer's folder of the
// private renders bucket (lib/renderStore.ts), and comes back in the answer
// itself (2026-10-27: the owner's network kept failing to look up fal's and
// Supabase's picture hosts). The answer is a stream (lib/ndjson.ts): the
// picture's line, then a line saying it is done.
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { themeById } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { renderJpeg, storeRenderJpeg } from "@/lib/renderStore";
import { ndjsonLine } from "@/lib/ndjson";
import { readTableSetup } from "@/lib/studio/tableSetup";
import { referencePictures, tablePrompt, tableRenderKey, type TableRender } from "@/lib/studio/tableRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150; // one Seedream picture (60–90 s)

// Seedream 5 Lite: in the 2026-10-27 comparison with flux-2-pro and
// nano-banana it came closest to the owner's reference photos, and is the
// cheapest ($0.035 a picture). TABLE_RENDER_MODEL switches the engine.
const MODEL = process.env.TABLE_RENDER_MODEL || "fal-ai/bytedance/seedream/v5/lite/edit";
const SEED = 777;

function engineInput(model: string, prompt: string, imageUrls: string[]) {
  const base = { prompt, image_urls: imageUrls, num_images: 1, output_format: "jpeg" };
  if (model.includes("nano-banana")) return { ...base, aspect_ratio: "4:3" };
  // Seedream has no seed, and wants at least 2560×1440 pixels: a named size it scales itself.
  if (model.includes("seedream")) return { ...base, image_size: "landscape_4_3" };
  return { ...base, image_size: { width: 1152, height: 864 }, seed: SEED };
}

/**
 * An option picture (/design/table/…) as a small JPEG data URI: from the
 * site's own files, or — where those are not bundled with the function — from
 * the site itself.
 */
async function optionPicture(photo: string, origin: string): Promise<string> {
  if (!/^\/design\/table\/(?:[\w-]+\/){0,2}[\w-]+\.(webp|png|jpe?g)$/.test(photo)) throw new Error(`not an option picture: ${photo}`);
  const bytes = await readFile(path.join(process.cwd(), "public", photo)).catch(async () => {
    const res = await fetch(new URL(photo, origin), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`option picture ${photo}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
  const jpeg = await sharp(bytes).resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  let body: { table?: unknown; theme?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const theme = typeof body?.theme === "string" ? themeById(body.theme) : undefined;
  const table = theme ? readTableSetup(body.table, theme) : undefined;
  if (!theme || !table?.enabled) return NextResponse.json({ error: "Missing table or theme." }, { status: 400 });
  const falKey = process.env.FAL_KEY;
  if (!falKey) return NextResponse.json({ error: "Renders are not available right now." }, { status: 503 });

  const user = await renderUser(req.headers);
  if (!user.ok) return NextResponse.json({ error: user.error, signin: user.signin }, { status: user.status });
  const slot = acquireRender(clientIp(req.headers));
  if (!slot.ok) {
    return NextResponse.json(slot.busy ? { error: slot.error, busy: true } : { error: slot.error, limited: true },
      { status: slot.status, headers: { "retry-after": String(slot.retryAfter) } });
  }
  let streaming = false;
  try {
    const taken = await takeAccountRender(user);
    if (!taken.ok) return NextResponse.json({ error: taken.error, signin: taken.signin, limited: taken.limited }, { status: taken.status });
    fal.config({ credentials: falKey });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(ndjsonLine(o));
        try {
          const refs = referencePictures(table, theme.id);
          const pictures = await Promise.all(refs.map((r) => optionPicture(r.photo, req.nextUrl.origin)));
          const result = await fal.subscribe(MODEL, {
            input: engineInput(MODEL, tablePrompt(table, theme, refs.map((r) => r.key)), pictures) as never,
            abortSignal: AbortSignal.timeout(130_000),
          });
          const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
          if (!url) throw new Error("no close-up image");
          const jpeg = await renderJpeg(url);
          if (!jpeg) throw new Error("the close-up could not be read");
          send({ view: "close", url: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
          const key = tableRenderKey(table);
          // Without a database (local development) nothing is kept.
          let render: TableRender | undefined;
          if (user.client && user.userId) {
            const kept = await storeRenderJpeg(user.client, user.userId, jpeg, `table:close:${key}`);
            render = kept ? { key, close: kept.path } : undefined;
            if (!render) console.warn("[table-render] not kept; shown only");
          }
          send({ done: true, ...(render ? { render } : {}), left: taken.left });
        } catch (err) {
          console.error("[table-render]", err);
          send({ error: renderError(err) });
        } finally {
          slot.release();
          controller.close();
        }
      },
    });
    streaming = true;
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  } catch (err) {
    console.error("[table-render]", err);
    return NextResponse.json({ error: renderError(err) }, { status: 502 });
  } finally {
    if (!streaming) slot.release();
  }
}

function renderError(err: unknown) {
  // fal refusing the account (no credit, bad key) is not worth retrying.
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403 ? "Renders are paused for a moment — please try again later." : "The render didn't come out — please try again.";
}
