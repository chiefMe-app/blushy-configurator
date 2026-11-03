// The welcome board's render (2026-11-03, the owner: "burda da rendera zorlasın, bakalım ne olacak merak
// ettim"): the live preview — a real photo of the board on its stand, the customer's print and words laid on
// it and the backdrop's own garland beside it (components/studio/WelcomeBoardArt.tsx) — made into one
// photograph. The builder draws the preview as a JPEG and sends it; the board itself comes too, for its words
// and for the key the render is kept under. Like the other renders it costs money, so it needs a signed-in
// account and counts as one of the day's renders (lib/renderAccount.ts), behind the per-IP guard
// (lib/renderGuard.ts); it is kept in the customer's folder of the private renders bucket. The answer is a
// stream (lib/ndjson.ts): the picture's line, then a line saying it is done.
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { themeById } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { renderJpeg, storeRenderJpeg } from "@/lib/renderStore";
import { ndjsonLine } from "@/lib/ndjson";
import { BOARD_STANDS, readWelcomeBoard, welcomeRenderKey } from "@/lib/studio/welcomeBoard";
import { welcomePrompt } from "@/lib/studio/welcomeRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

// Seedream 5 Lite, as the table's: the closest to real photographs in the 2026-10-27 comparison, and it keeps
// printed words. WELCOME_RENDER_MODEL switches the engine.
const MODEL = process.env.WELCOME_RENDER_MODEL || "fal-ai/bytedance/seedream/v5/lite/edit";
/** The preview JPEG the builder sends: at most this many bytes. */
const MAX_PREVIEW_BYTES = 4 * 1024 * 1024;
const HEX = /^#[0-9A-F]{6}$/i;

export async function POST(req: NextRequest) {
  let body: { board?: unknown; theme?: unknown; balloons?: unknown; preview?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const theme = typeof body?.theme === "string" ? themeById(body.theme) : undefined;
  const board = theme ? readWelcomeBoard(body.board, theme) : undefined;
  const balloons = Array.isArray(body?.balloons) ? body.balloons.filter((h): h is string => typeof h === "string" && HEX.test(h)).slice(0, 12) : [];
  const preview = typeof body?.preview === "string" ? body.preview.match(/^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined;
  if (!theme || !board?.enabled || !preview) return NextResponse.json({ error: "Missing board, theme or preview." }, { status: 400 });
  const bytes = Buffer.from(preview, "base64");
  if (bytes.length > MAX_PREVIEW_BYTES) return NextResponse.json({ error: "The preview is too big." }, { status: 413 });
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
    // A picture, and only one: re-encoded here, at most 2048 px long.
    const image = await sharp(bytes).resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
    const { width, height } = image.info;
    fal.config({ credentials: falKey });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(ndjsonLine(o));
        try {
          const stand = BOARD_STANDS.find((s) => s.id === board.stand)?.name.toLowerCase() ?? "easel";
          // Seedream wants at least 2560×1440 pixels: the preview's shape, scaled up to that.
          const k = Math.max(1, Math.sqrt((2560 * 1440) / (width * height)));
          const result = await fal.subscribe(MODEL, {
            input: {
              prompt: welcomePrompt([board.heading, board.name, board.line], stand),
              image_urls: [`data:image/jpeg;base64,${image.data.toString("base64")}`], num_images: 1, output_format: "jpeg",
              image_size: { width: Math.round(width * k), height: Math.round(height * k) },
            } as never,
            abortSignal: AbortSignal.timeout(130_000),
          });
          const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
          if (!url) throw new Error("no welcome board image");
          const jpeg = await renderJpeg(url);
          if (!jpeg) throw new Error("the welcome board render could not be read");
          send({ url: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
          const key = welcomeRenderKey(board, theme.id, balloons);
          // Without a database (local development) nothing is kept.
          let render: { key: string; path: string } | undefined;
          if (user.client && user.userId) {
            const kept = await storeRenderJpeg(user.client, user.userId, jpeg, `welcome:${key}`);
            render = kept ? { key, path: kept.path } : undefined;
            if (!render) console.warn("[welcome-render] not kept; shown only");
          }
          send({ done: true, ...(render ? { render } : {}), left: taken.left });
        } catch (err) {
          console.error("[welcome-render]", err);
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
    console.error("[welcome-render]", err);
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
