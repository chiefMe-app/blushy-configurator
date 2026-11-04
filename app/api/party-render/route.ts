// The whole party in one photograph (2026-11-04, lib/studio/partyRender.ts): on the Venue step, the backdrop's
// picture (its render, or its live sketch) and the kids' table's (its render, or its drawing) sent together to
// FLUX.2 [pro] edit with her setting, indoors or outdoors — as the helium balloons' render is made: an account, one of
// the day's renders, kept in the customer's folder, the answer streamed.
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { themeById } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { renderJpeg, storeRenderJpeg } from "@/lib/renderStore";
import { ndjsonLine } from "@/lib/ndjson";
import { gradePhoto } from "@/lib/photoGrade";
import { readTableSetup } from "@/lib/studio/tableSetup";
import { partyPrompt, type PartySetting } from "@/lib/studio/partyRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const MODEL = process.env.PARTY_RENDER_MODEL || "fal-ai/flux-2-pro/edit";
/** Each picture the builder sends: at most this many bytes. */
const MAX_PICTURE_BYTES = 4 * 1024 * 1024;
/** The photograph: landscape, the whole setup in it. */
const SIZE = { width: 1344, height: 896 };

const pictureOf = (v: unknown) => (typeof v === "string" ? v.match(/^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined);

export async function POST(req: NextRequest) {
  let body: { theme?: unknown; setting?: unknown; key?: unknown; table?: unknown; backdrop?: unknown; tablePicture?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const theme = typeof body?.theme === "string" ? themeById(body.theme) : undefined;
  const setting: PartySetting | undefined = body?.setting === "indoor" || body?.setting === "outdoor" ? body.setting : undefined;
  if (!theme || !setting) return NextResponse.json({ error: "Pick indoor or outdoor first." }, { status: 400 });
  const backdrop = pictureOf(body.backdrop), tablePic = pictureOf(body.tablePicture);
  const table = tablePic ? readTableSetup(body.table, theme) : undefined;
  // Nothing designed to stand there: not worth a render.
  if (!backdrop && !(table?.enabled && tablePic)) return NextResponse.json({ error: "Design a backdrop or a table first." }, { status: 400 });
  const pictures = [backdrop, table?.enabled ? tablePic : undefined].filter((p): p is string => !!p).map((p) => Buffer.from(p, "base64"));
  if (pictures.some((b) => b.length > MAX_PICTURE_BYTES)) return NextResponse.json({ error: "A picture is too big." }, { status: 413 });
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
    // Each a picture, and only one: re-encoded here, at most 1024 px long (two go in: the engine's price is by size).
    const images = await Promise.all(pictures.map((b) => sharp(b).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer()));
    const has = { backdrop: !!backdrop, table: !!table?.enabled };
    // The builder's key for what it sent (partyRenderKey): only ever a short word of letters and digits.
    const key = typeof body.key === "string" && /^[0-9a-z]{1,16}$/.test(body.key) ? body.key : undefined;
    fal.config({ credentials: falKey });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(ndjsonLine(o));
        try {
          const result = await fal.subscribe(MODEL, {
            input: {
              prompt: partyPrompt({ table }, setting, has),
              image_urls: images.map((b) => `data:image/jpeg;base64,${b.toString("base64")}`), num_images: 1, output_format: "jpeg",
              image_size: SIZE, seed: 777,
            } as never,
            abortSignal: AbortSignal.timeout(130_000),
          });
          const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
          if (!url) throw new Error("no party image");
          const made = await renderJpeg(url);
          if (!made) throw new Error("the party render could not be read");
          // A photographer's edit — white balance, exposure, shadows, contrast, vibrance (lib/photoGrade.ts).
          const jpeg = await gradePhoto(made).catch(() => made);
          send({ url: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
          let render: { key: string; path: string } | undefined;
          if (key && user.client && user.userId) {
            const kept = await storeRenderJpeg(user.client, user.userId, jpeg, `party:${key}`);
            render = kept ? { key, path: kept.path } : undefined;
            if (!render) console.warn("[party-render] not kept; shown only");
          }
          send({ done: true, ...(render ? { render } : {}), left: taken.left });
        } catch (err) {
          console.error("[party-render]", err);
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
    console.error("[party-render]", err);
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
