// The real render of the welcome board (2026-10-31, the owner: "bu seçeneklerin
// renderını alıp preview'a koyalım"). Image 1 is the board as the builder
// draws it — made into a JPEG in the customer's browser, which has the
// lettering's fonts (the server has none: see lib/guideFonts.ts) — with the
// balloons and flowers asked for in words (lib/studio/welcomeRender.ts).
// Like the table's render (app/api/table-render) it costs money, so it needs a
// signed-in account and counts as one of the day's renders, behind the per-IP
// guard; the picture is kept in the customer's folder of the private renders
// bucket and comes back in the answer itself, as a stream (lib/ndjson.ts).
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { themeById } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { renderJpeg, storeRenderJpeg } from "@/lib/renderStore";
import { ndjsonLine } from "@/lib/ndjson";
import { readWelcomeBoard } from "@/lib/studio/welcomeBoard";
import { welcomePrompt, welcomeRenderKey, type WelcomeRender } from "@/lib/studio/welcomeRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150; // one Seedream picture (60–90 s)

// Seedream 5 Lite, as the table's render ($0.035 a picture). WELCOME_RENDER_MODEL switches the engine.
const MODEL = process.env.WELCOME_RENDER_MODEL || "fal-ai/bytedance/seedream/v5/lite/edit";
/** The drawing's JPEG as sent: at most this long as a data URI (about 1.5 MB). */
const MAX_DRAWING = 2_000_000;
const HEX = /^#[0-9A-F]{6}$/i;

/** The customer's drawing, checked and made again here: a JPEG of sensible size, nothing else. */
async function drawingPicture(raw: unknown): Promise<string | null> {
  if (typeof raw !== "string" || raw.length > MAX_DRAWING || !raw.startsWith("data:image/jpeg;base64,")) return null;
  try {
    const img = sharp(Buffer.from(raw.slice("data:image/jpeg;base64,".length), "base64"));
    const meta = await img.metadata();
    if (meta.format !== "jpeg" || !meta.width || !meta.height || meta.width > 2400 || meta.height > 2400 || meta.width < 200 || meta.height < 200) return null;
    const jpeg = await img.flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  let body: { board?: unknown; theme?: unknown; balloons?: unknown; drawing?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const theme = typeof body?.theme === "string" ? themeById(body.theme) : undefined;
  const board = theme ? readWelcomeBoard(body.board, theme) : undefined;
  if (!theme || !board?.enabled) return NextResponse.json({ error: "Missing board or theme." }, { status: 400 });
  const balloons = Array.isArray(body.balloons) ? body.balloons.filter((c): c is string => typeof c === "string" && HEX.test(c)).slice(0, 6) : [];
  const drawing = await drawingPicture(body.drawing);
  if (!drawing) return NextResponse.json({ error: "Missing the board's drawing." }, { status: 400 });
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
          const t0 = Date.now();
          const result = await fal.subscribe(MODEL, {
            input: { prompt: welcomePrompt(board, balloons), image_urls: [drawing], num_images: 1, output_format: "jpeg", image_size: "portrait_4_3" } as never,
            abortSignal: AbortSignal.timeout(130_000),
          });
          const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
          if (!url) throw new Error("no picture");
          const jpeg = await renderJpeg(url);
          if (!jpeg) throw new Error("the picture could not be read");
          send({ url: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
          const key = welcomeRenderKey(board, theme.id, balloons);
          // Without a database (local development) nothing is kept.
          let render: WelcomeRender | undefined;
          if (user.client && user.userId) {
            const kept = await storeRenderJpeg(user.client, user.userId, jpeg, `welcome:${key}`);
            render = kept ? { key, path: kept.path } : undefined;
            if (!render) console.warn("[welcome-render] not kept; shown only");
          }
          console.info("[welcome-render] ms", Date.now() - t0);
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
