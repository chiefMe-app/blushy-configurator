// The giveaways' render (2026-11-03, the owner: "onları da render alıp sonra gene preview'a koymamız lazım"): the
// live preview — the boxes at the places on the kids' table, or on the shelves of the arch board in her colour
// (components/builder/giveaways/GiveawaysPreview.tsx) — made into one photograph, as the welcome board's
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
import { giveawaysRenderKey, readGiveaways } from "@/lib/studio/giveaways";
import { giveawayPrompt } from "@/lib/studio/giveawayRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

// FLUX.2 [dev] edit at the preview's own size, as the welcome board's; GIVEAWAY_RENDER_MODEL switches it.
const MODEL = process.env.GIVEAWAY_RENDER_MODEL || "fal-ai/flux-2/edit";
/** The preview JPEG the builder sends: at most this many bytes. */
const MAX_PREVIEW_BYTES = 4 * 1024 * 1024;
/** The kids' table's key (lib/studio/tableSetup.ts), for the key the render is kept under. */
const KEY = /^[0-9a-z]{1,13}$/;

export async function POST(req: NextRequest) {
  let body: { giveaways?: unknown; theme?: unknown; tableKey?: unknown; balloons?: unknown; preview?: unknown; boxes?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const theme = typeof body?.theme === "string" ? themeById(body.theme) : undefined;
  const g = readGiveaways(body?.giveaways);
  const tableKey = typeof body?.tableKey === "string" && KEY.test(body.tableKey) ? body.tableKey : "";
  // The party's balloons: the board's garland is in them (for the key it is kept under).
  const balloons = Array.isArray(body?.balloons) ? body.balloons.filter((h): h is string => typeof h === "string" && /^#[0-9A-F]{6}$/i.test(h)).slice(0, 12) : [];
  const preview = typeof body?.preview === "string" ? body.preview.match(/^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined;
  if (!theme || !g?.enabled || !preview) return NextResponse.json({ error: "Missing giveaways, theme or preview." }, { status: 400 });
  const bytes = Buffer.from(preview, "base64");
  // The boxes on their own, laid on the render afterwards (2026-11-03: the engine, given them, drew two more and
  // characters on their stickers); the preview it is given has none.
  const boxes64 = typeof body?.boxes === "string" ? body.boxes.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined;
  const boxes = boxes64 ? Buffer.from(boxes64, "base64") : undefined;
  if (bytes.length > MAX_PREVIEW_BYTES || (boxes?.length ?? 0) > MAX_PREVIEW_BYTES) return NextResponse.json({ error: "The preview is too big." }, { status: 413 });
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
          // Seedream wants at least 2560×1440 pixels: the preview's shape, scaled up to that; FLUX its own size,
          // the sides in steps of 16.
          const seedream = MODEL.includes("seedream");
          const k = seedream ? Math.max(1, Math.sqrt((2560 * 1440) / (width * height))) : 1;
          const side = (n: number) => (seedream ? Math.round(n * k) : Math.max(512, Math.round(n / 16) * 16));
          const result = await fal.subscribe(MODEL, {
            input: {
              prompt: giveawayPrompt(g, { boxesAfter: !!boxes }),
              image_urls: [`data:image/jpeg;base64,${image.data.toString("base64")}`], num_images: 1, output_format: "jpeg",
              image_size: { width: side(width), height: side(height) }, ...(seedream ? {} : { seed: 777 }),
            } as never,
            abortSignal: AbortSignal.timeout(130_000),
          });
          const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
          if (!url) throw new Error("no giveaways image");
          const made = await renderJpeg(url);
          if (!made) throw new Error("the giveaways render could not be read");
          // Its colours brought back to the preview's (2026-11-03: a Unicorn board's pastel garland came back bright
          // and sunlit), as the backdrop's (lib/sketchRenderFinish.ts).
          // A failed colour step never loses the paid render.
          const jpeg = await finishSketchRender(made, image.data, boxes, { shadow: true }).catch(() => made);
          send({ url: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
          const key = giveawaysRenderKey(g, theme.id, tableKey, balloons);
          // Without a database (local development) nothing is kept.
          let render: { key: string; path: string } | undefined;
          if (user.client && user.userId) {
            const kept = await storeRenderJpeg(user.client, user.userId, jpeg, `giveaways:${key}`);
            render = kept ? { key, path: kept.path } : undefined;
            if (!render) console.warn("[giveaway-render] not kept; shown only");
          }
          send({ done: true, ...(render ? { render } : {}), left: taken.left });
        } catch (err) {
          console.error("[giveaway-render]", err);
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
    console.error("[giveaway-render]", err);
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
