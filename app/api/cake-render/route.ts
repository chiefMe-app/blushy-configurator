// The cake's render (2026-11-03): the live preview — the cake on its stand, close up
// (components/builder/cake/CakePreview.tsx) — made into one photograph, as the welcome board's
// (app/api/welcome-render/route.ts): an account, one of the day's renders, kept in the customer's folder, the
// answer streamed.
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { themeById } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { renderJpeg, storeRenderJpeg } from "@/lib/renderStore";
import { ndjsonLine } from "@/lib/ndjson";
import { finishSketchRender } from "@/lib/sketchRenderFinish";
import { cakeRenderKey, cakeViews, isCakeView, readCake } from "@/lib/studio/cake";
import { cakePrompt } from "@/lib/studio/cakeRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

// FLUX.2 [pro] edit at the preview's own size (2026-11-03, the owner: "kötü bir render ışığı var, çok sarı, kaliteli
// durmuyor hiç": side by side on her cart [dev] turned a tier's colour and the stands, [pro] kept every piece, in clean
// white light; ≈ $0.045 a render); CAKE_RENDER_MODEL switches it.
// 2026-11-04 (the owner: "gene karanlık ve kasvet çıktı … fal.ai'de başka render motorunu dene"): Seedream 4.5 — side
// by side on her unicorn cake [pro] came out dim and greyed, Seedream bright, candy-coloured and real in 23 s (≈ $0.04);
// nano-banana-pro kept every piece as bright but left the cupcakes as drawn, in 43 s (≈ $0.15).
const MODEL = process.env.CAKE_RENDER_MODEL || "fal-ai/bytedance/seedream/v4.5/edit";
/** The preview JPEG the builder sends: at most this many bytes. */
const MAX_PREVIEW_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let body: { cake?: unknown; theme?: unknown; preview?: unknown; view?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const theme = typeof body?.theme === "string" ? themeById(body.theme) : undefined;
  const p = readCake(body?.cake);
  const preview = typeof body?.preview === "string" ? body.preview.match(/^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined;
  if (!theme || !p?.enabled || !preview) return NextResponse.json({ error: "Missing cake, theme or preview." }, { status: 400 });
  // What the picture shows (2026-11-03): the whole table or cart, or a close-up of the cake or one of its sweets.
  const view = isCakeView(body.view) && cakeViews(p).includes(body.view) ? body.view : "whole";
  const bytes = Buffer.from(preview, "base64");
  if (bytes.length > MAX_PREVIEW_BYTES) return NextResponse.json({ error: "The preview is too big." }, { status: 413 });
  // A preview whose photos did not paint (2026-11-04: on the owner's iPhone the close-ups came with only their
  // lettering, and the engine made up a cake) is mostly bare white: never paid for.
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
          // 16: 1728×2160 for the 4:5 close-up, as tested); FLUX its own size, the sides in steps of 16.
          const seedream = MODEL.includes("seedream");
          const k = seedream ? Math.max(1, Math.sqrt((2560 * 1440) / (width * height))) : 1;
          const side = (n: number) => (seedream ? Math.ceil((n * k) / 16) * 16 : Math.max(512, Math.round(n / 16) * 16));
          const result = await fal.subscribe(MODEL, {
            input: {
              prompt: cakePrompt(p, view),
              image_urls: [`data:image/jpeg;base64,${image.data.toString("base64")}`], num_images: 1, output_format: "jpeg",
              image_size: { width: side(width), height: side(height) }, ...(seedream ? {} : { seed: 777 }),
            } as never,
            abortSignal: AbortSignal.timeout(130_000),
          });
          const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
          if (!url) throw new Error("no cake image");
          const made = await renderJpeg(url);
          if (!made) throw new Error("the cake render could not be read");
          // Its colours brought back to the preview's, as the backdrop's (lib/sketchRenderFinish.ts); a failed colour
          // step never loses the paid render.
          const jpeg = await finishSketchRender(made, image.data).catch(() => made);
          send({ url: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
          const key = cakeRenderKey(p, theme.id, view);
          // Without a database (local development) nothing is kept.
          let render: { key: string; path: string } | undefined;
          if (user.client && user.userId) {
            const kept = await storeRenderJpeg(user.client, user.userId, jpeg, `cake:${key}`);
            render = kept ? { key, path: kept.path } : undefined;
            if (!render) console.warn("[cake-render] not kept; shown only");
          }
          send({ done: true, ...(render ? { render } : {}), left: taken.left });
        } catch (err) {
          console.error("[cake-render]", err);
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
    console.error("[cake-render]", err);
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
