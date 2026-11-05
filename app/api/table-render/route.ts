// The real render of the kids' table (F3). Its top view, since 2026-11-03 (the owner: "tam üstten sandalye
// gözükmesin, live sketchin birebir aynı açısının renderı olsun … çok uzun sürüyor"): the one place as the
// builder draws it, sent as a JPEG, made into a photograph by FLUX.2 [flash] in a few seconds
// (lib/studio/tableRender.ts tablePhotoPrompt). Otherwise, since 2026-10-28, one close-up of
// part of the table, made from a drawing of the exact scene
// (lib/studio/tableCloseGuide.ts) and the pictures of the options the customer
// chose (lib/studio/tableRender.ts). Like the
// backdrop render it costs money, so it needs a signed-in account and counts
// as one of the day's renders (lib/renderAccount.ts), behind the per-IP guard
// (lib/renderGuard.ts). The picture is kept in the customer's folder of the
// private renders bucket (lib/renderStore.ts), and comes back in the answer
// itself (2026-10-27: the owner's network kept failing to look up fal's and
// Supabase's picture hosts). The answer is a stream (lib/ndjson.ts): the
// picture's line, then a line saying it is done.
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { themeById } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { renderJpeg, storeRenderJpeg } from "@/lib/renderStore";
import { ndjsonLine } from "@/lib/ndjson";
import { optionPicture } from "@/lib/studio/tableOptionPicture";
import { readTableSetup } from "@/lib/studio/tableSetup";
import { optionPhoto, tableOption } from "@/lib/studio/tableCatalog";
import { referencePictures, tablePhotoPrompt, tablePrompt, tableRenderKey, type TableRender } from "@/lib/studio/tableRender";
import { tableCloseGuideSvg, type TableView } from "@/lib/studio/tableCloseGuide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150; // one Seedream picture (60–90 s); the top view takes seconds

// Seedream 5 Lite: in the 2026-10-27 comparison with flux-2-pro and
// nano-banana it came closest to the owner's reference photos, and is the
// cheapest ($0.035 a picture). TABLE_RENDER_MODEL switches the engine.
const MODEL = process.env.TABLE_RENDER_MODEL || "fal-ai/bytedance/seedream/v5/lite/edit";
const SEED = 777;
// The top view from the builder's drawing: in the 2026-11-03 test FLUX.2 [flash] kept the drawing's angle,
// framing and pieces as a real photo in 6–7 s; Seedream took 40–52 s and kept the drawing's frame, FLUX.2
// [dev] edit spread the placemat's print over the table. TABLE_TOP_MODEL switches it.
const TOP_MODEL = process.env.TABLE_TOP_MODEL || "fal-ai/flux-2/flash/edit";
/** The drawing the builder sends: at most this many bytes. */
const MAX_PREVIEW_BYTES = 4 * 1024 * 1024;

function engineInput(model: string, prompt: string, imageUrls: string[]) {
  const base = { prompt, image_urls: imageUrls, num_images: 1, output_format: "jpeg" };
  if (model.includes("nano-banana")) return { ...base, aspect_ratio: "4:3" };
  // Seedream has no seed, and wants at least 2560×1440 pixels: a named size it scales itself.
  if (model.includes("seedream")) return { ...base, image_size: "landscape_4_3" };
  return { ...base, image_size: { width: 1152, height: 864 }, seed: SEED };
}

export async function POST(req: NextRequest) {
  let body: { table?: unknown; theme?: unknown; view?: unknown; preview?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const theme = typeof body?.theme === "string" ? themeById(body.theme) : undefined;
  const table = theme ? readTableSetup(body.table, theme) : undefined;
  if (!theme || !table?.enabled) return NextResponse.json({ error: "Missing table or theme." }, { status: 400 });
  // 2026-10-29: the close-up, or one place seen straight down.
  // 2026-11-05: four places from above too ("4 places gözüksün … onun renderını alabilelim"), as the top view.
  const four = body.view === "four";
  const view: TableView = body.view === "top" || four ? "top" : "close";
  const preview = view === "top" && typeof body?.preview === "string" ? body.preview.match(/^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined;
  const previewBytes = preview ? Buffer.from(preview, "base64") : undefined;
  if (previewBytes && previewBytes.length > MAX_PREVIEW_BYTES) return NextResponse.json({ error: "The preview is too big." }, { status: 413 });
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
          // Where the time goes, in the function's log (2026-10-28: "render aşırı uzun sürüyor").
          const t0 = Date.now(), times: Record<string, number> = {};
          const lap = (k: string) => { times[k] = Date.now() - t0; };
          let model = MODEL, input: unknown;
          if (previewBytes) {
            // A picture, and only one: re-encoded here, about a megapixel, its sides in steps of 16.
            const img = await sharp(previewBytes).resize({ width: 1216, height: 1216, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
            const step = (n: number) => Math.max(512, Math.round(n / 16) * 16);
            model = TOP_MODEL;
            input = {
              prompt: tablePhotoPrompt(table, four ? 4 : 1), image_urls: [`data:image/jpeg;base64,${img.data.toString("base64")}`], num_images: 1, output_format: "jpeg",
              image_size: { width: step(img.info.width), height: step(img.info.height) }, seed: SEED,
            };
            lap("prepared");
          } else {
            const refs = referencePictures(table, theme.id);
            // Image 1: the drawing of the exact scene, the placemats wearing their own
            // design (2026-10-28 tests); then the chosen pieces' pictures — all made at once.
            const matPhoto = optionPhoto("placemats", tableOption("placemats", table.choices.placemats), theme.id);
            const [placemat, photos] = await Promise.all([
              matPhoto ? optionPicture(matPhoto, req.nextUrl.origin) : undefined,
              Promise.all(refs.map((r) => optionPicture(r.photo, req.nextUrl.origin))),
            ]);
            // A JPEG, not a PNG: the drawing with its placemat photos is a fraction of the upload.
            const guide = await sharp(Buffer.from(tableCloseGuideSvg(table, theme, { placemat }, view))).jpeg({ quality: 90 }).toBuffer();
            const pictures = [`data:image/jpeg;base64,${guide.toString("base64")}`, ...photos];
            lap("prepared");
            input = engineInput(MODEL, tablePrompt(table, theme, refs.map((r) => r.key), view), pictures);
          }
          const result = await fal.subscribe(model, {
            input: input as never,
            abortSignal: AbortSignal.timeout(130_000),
            onQueueUpdate: (u) => { if (u.status === "IN_PROGRESS" && times.started === undefined) lap("started"); },
          });
          lap("made");
          const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
          if (!url) throw new Error("no close-up image");
          const jpeg = await renderJpeg(url);
          if (!jpeg) throw new Error("the close-up could not be read");
          send({ view: four ? "four" : view, url: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
          lap("sent");
          const key = tableRenderKey(table, theme.id);
          // Without a database (local development) nothing is kept.
          let render: TableRender | undefined;
          if (user.client && user.userId) {
            const kept = await storeRenderJpeg(user.client, user.userId, jpeg, `table:${four ? "four" : view}:${key}`);
            render = kept ? { key, close: kept.path, ...(four ? { view: "four" as const } : view === "top" ? { view } : {}) } : undefined;
            if (!render) console.warn("[table-render] not kept; shown only");
          }
          lap("kept");
          // prepared: pictures ready; started: fal began (the rest was its queue); made: picture done; sent: downloaded and on its way.
          console.info("[table-render] ms", JSON.stringify({ ...times, model }));
          // As every part's render is read back (usePieceRender's KeptRender): its key and its path. It went out as
          // the stored { key, close } until 2026-11-05, so a kept table photo was never found again.
          send({ done: true, ...(render ? { render: { key: render.key, path: render.close } } : {}), left: taken.left });
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
