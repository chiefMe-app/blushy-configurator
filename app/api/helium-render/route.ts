// The helium balloons' render (2026-11-04): the live preview — the bouquets, foils, ceiling balloons and bubble in
// the empty pastel room (components/builder/helium/HeliumPreview.tsx) — made into one photograph, as the cake's
// (app/api/cake-render/route.ts, the light the owner signed off on): an account, one of the day's renders, kept in
// the customer's folder, the answer streamed.
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { themeById } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { renderJpeg, storeRenderJpeg } from "@/lib/renderStore";
import { ndjsonLine } from "@/lib/ndjson";
import { finishSketchRender } from "@/lib/sketchRenderFinish";
import { gradePhoto } from "@/lib/photoGrade";
import { heliumEmpty, heliumRenderKey, readHelium } from "@/lib/studio/helium";
import { heliumPrompt } from "@/lib/studio/heliumRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

// FLUX.2 [pro] edit (2026-11-04, the owner: "neden gerçek balon gibi durmuyor şu pembe ve morlar?" — Seedream 4.5, the
// cake's, kept the drawn latex discs nearly as drawn; FLUX.2 [pro] made them real rubber, in half the time);
// HELIUM_RENDER_MODEL switches it.
const MODEL = process.env.HELIUM_RENDER_MODEL || "fal-ai/flux-2-pro/edit";
/** The preview JPEG the builder sends: at most this many bytes. */
const MAX_PREVIEW_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let body: { helium?: unknown; theme?: unknown; preview?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const theme = typeof body?.theme === "string" ? themeById(body.theme) : undefined;
  const h = readHelium(body?.helium);
  const preview = typeof body?.preview === "string" ? body.preview.match(/^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined;
  if (!theme || !h?.enabled || !preview) return NextResponse.json({ error: "Missing balloons, theme or preview." }, { status: 400 });
  // An empty room is not worth a render.
  if (heliumEmpty(h)) return NextResponse.json({ error: "Pick some balloons first." }, { status: 400 });
  const bytes = Buffer.from(preview, "base64");
  if (bytes.length > MAX_PREVIEW_BYTES) return NextResponse.json({ error: "The preview is too big." }, { status: 413 });
  // A preview whose photos did not paint (as the cake's on the owner's iPhone) is mostly bare white: never paid for.
  if (await bareWhite(bytes) > 0.5) return NextResponse.json({ error: "The preview didn't come through — please try again." }, { status: 422 });
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
    // A picture, and only one: re-encoded here, at most 1408 px long.
    const image = await sharp(bytes).resize({ width: 1408, height: 1408, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
    const { width, height } = image.info;
    fal.config({ credentials: falKey });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(ndjsonLine(o));
        try {
          // Seedream wants at least 2560×1440 pixels: the preview's shape, scaled up to that (the sides up to a step of
          // 16); FLUX its own size, the sides in steps of 16.
          const seedream = MODEL.includes("seedream");
          const k = seedream ? Math.max(1, Math.sqrt((2560 * 1440) / (width * height))) : 1;
          const side = (n: number) => (seedream ? Math.ceil((n * k) / 16) * 16 : Math.max(512, Math.round(n / 16) * 16));
          const result = await fal.subscribe(MODEL, {
            input: {
              prompt: heliumPrompt(h),
              image_urls: [`data:image/jpeg;base64,${image.data.toString("base64")}`], num_images: 1, output_format: "jpeg",
              image_size: { width: side(width), height: side(height) }, ...(seedream ? {} : { seed: 777 }),
            } as never,
            abortSignal: AbortSignal.timeout(130_000),
          });
          const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
          if (!url) throw new Error("no balloons image");
          const made = await renderJpeg(url);
          if (!made) throw new Error("the balloons render could not be read");
          // Its colours' cast brought back to the preview's, as the backdrop's (lib/sketchRenderFinish.ts) but keeping its
          // own exposure; a failed colour step never loses the paid render.
          const finished = await finishSketchRender(made, image.data, undefined, { cast: true }).catch(() => made);
          // Then a photographer's edit — white balance, exposure, shadows, contrast, vibrance (lib/photoGrade.ts).
          const jpeg = await gradePhoto(finished).catch(() => finished);
          send({ url: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
          const key = heliumRenderKey(h, theme.id);
          // Without a database (local development) nothing is kept.
          let render: { key: string; path: string } | undefined;
          if (user.client && user.userId) {
            const kept = await storeRenderJpeg(user.client, user.userId, jpeg, `helium:${key}`);
            render = kept ? { key, path: kept.path } : undefined;
            if (!render) console.warn("[helium-render] not kept; shown only");
          }
          send({ done: true, ...(render ? { render } : {}), left: taken.left });
        } catch (err) {
          console.error("[helium-render]", err);
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
    console.error("[helium-render]", err);
    return NextResponse.json({ error: renderError(err) }, { status: 502 });
  } finally {
    if (!streaming) slot.release();
  }
}

/** How much of the picture is bare white, on a small copy (0 when it cannot be read: refused further on). */
async function bareWhite(bytes: Buffer): Promise<number> {
  const small = await sharp(bytes).resize(48).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer().catch(() => null);
  if (!small) return 0;
  let white = 0;
  for (let i = 0; i < small.length; i += 3) if (small[i] > 251 && small[i + 1] > 251 && small[i + 2] > 251) white++;
  return white / (small.length / 3);
}

function renderError(err: unknown) {
  // fal refusing the account (no credit, bad key) is not worth retrying.
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403 ? "Renders are paused for a moment — please try again later." : "The render didn't come out — please try again.";
}
