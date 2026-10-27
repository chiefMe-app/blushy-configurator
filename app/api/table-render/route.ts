// The real render of the kids' table (2026-10-27, F3): a down-the-table photo,
// a top-down photo and a close-up of one place setting, made from the live
// drawings as layout guides
// (lib/studio/tableGuide.ts) and every choice in words (lib/studio/tableRender.ts).
// Like the backdrop render it costs money, so it needs a signed-in account and
// counts as one of the day's renders (lib/renderAccount.ts), behind the
// per-IP guard (lib/renderGuard.ts). The two pictures are kept in the
// customer's folder of the private renders bucket (lib/renderStore.ts), and
// come back in the answer itself, as pictures: the browser needs no other
// address to show them (2026-10-27: the owner's network kept failing to look
// up fal's and Supabase's picture hosts). The answer is a stream, one picture
// per line as each is made (lib/ndjson.ts).
import { NextResponse, type NextRequest } from "next/server";
import { fal } from "@fal-ai/client";
import { themeById } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { renderJpeg, storeRenderJpeg } from "@/lib/renderStore";
import { ndjsonLine } from "@/lib/ndjson";
import { readTableSetup } from "@/lib/studio/tableSetup";
import { tablePrompt, tableRenderKey, type TableRender, type TableView } from "@/lib/studio/tableRender";
import { GUIDE_SIZE, tableGuide } from "@/lib/studio/tableGuide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // two rounds of Seedream pictures (60–90 s each), one after the other

// Seedream 5 Lite: in the 2026-10-27 comparison with flux-2-pro and
// nano-banana (same guide and prompt) it came closest to the owner's reference
// photos, and is the cheapest ($0.035 a picture) — "A olsun": its front view
// is free to make a magazine shot, the top view keeps the exact layout.
// TABLE_RENDER_MODEL switches the engine; each takes its picture size in its own way.
const MODEL = process.env.TABLE_RENDER_MODEL || "fal-ai/bytedance/seedream/v5/lite/edit";
const SEED = 777;

function engineInput(model: string, prompt: string, imageUrls: string[], size: { width: number; height: number }) {
  const base = { prompt, image_urls: imageUrls, num_images: 1, output_format: "jpeg" };
  const upright = size.width < size.height, wide = size.width > size.height;
  if (model.includes("nano-banana")) return { ...base, aspect_ratio: wide ? "4:3" : upright ? "3:4" : "1:1" };
  // Seedream has no seed, and wants at least 2560×1440 pixels: a named size it scales itself.
  if (model.includes("seedream")) return { ...base, image_size: wide ? "landscape_4_3" : upright ? "portrait_4_3" : "square_hd" };
  return { ...base, image_size: size, seed: SEED };
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
    const edit = async (view: TableView, imageUrls: string[]) => {
      const result = await fal.subscribe(MODEL, {
        input: engineInput(MODEL, tablePrompt(table, theme, view), imageUrls, GUIDE_SIZE[view]) as never,
        abortSignal: AbortSignal.timeout(130_000),
      });
      const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
      if (!url) throw new Error(`no ${view} image`);
      return url;
    };
    const dataUri = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;
    const picture = (j: Buffer) => `data:image/jpeg;base64,${j.toString("base64")}`;
    // Each picture goes out the moment it is made (one JSON line each), so
    // the front view shows after about a minute; the last line says it is
    // done (with where the pictures are kept) or what went wrong.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(ndjsonLine(o));
        try {
          const jpegs: Partial<Record<TableView, Buffer>> = {};
          const made = async (view: TableView, url: string) => {
            const jpeg = await renderJpeg(url);
            if (!jpeg) throw new Error(`the ${view} picture could not be read`);
            jpegs[view] = jpeg;
            send({ view, url: picture(jpeg) });
          };
          const [perspectiveGuide, topGuide] = await Promise.all([tableGuide(table, theme, "perspective"), tableGuide(table, theme, "top")]);
          // The front view first, from the drawing; then the top view (the drawing
          // for the layout, the front photo for the look) and the close-up (from
          // the front photo), so all three show the same things.
          const perspective = await edit("perspective", [dataUri(perspectiveGuide)]);
          await Promise.all([
            made("perspective", perspective),
            edit("top", [dataUri(topGuide), perspective]).then((u) => made("top", u)),
            edit("close", [perspective]).then((u) => made("close", u)),
          ]);
          const key = tableRenderKey(table);
          // Without a database (local development) nothing is kept.
          let render: TableRender | undefined;
          if (user.client && user.userId) {
            const [p, t, c] = await Promise.all((["perspective", "top", "close"] as const).map((v) =>
              storeRenderJpeg(user.client!, user.userId!, jpegs[v]!, `table:${v}:${key}`)));
            render = p && t && c ? { key, perspective: p.path, top: t.path, close: c.path } : undefined;
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
