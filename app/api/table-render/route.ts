// The real render of the kids' table (2026-10-27, F3): a front three-quarter
// photo and a top-down photo, made from the live drawings as layout guides
// (lib/studio/tableGuide.ts) and every choice in words (lib/studio/tableRender.ts).
// Like the backdrop render it costs money, so it needs a signed-in account and
// counts as one of the day's renders (lib/renderAccount.ts), behind the
// per-IP guard (lib/renderGuard.ts).
import { NextResponse, type NextRequest } from "next/server";
import { fal } from "@fal-ai/client";
import { themeById } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { readTableSetup } from "@/lib/studio/tableSetup";
import { tablePrompt, tableRenderKey, type TableRender, type TableView } from "@/lib/studio/tableRender";
import { GUIDE_SIZE, tableGuide } from "@/lib/studio/tableGuide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

// flux-2-pro/edit keeps the drawn layout (the chair count) far better than
// flash/edit did in testing.
const MODEL = "fal-ai/flux-2-pro/edit";
const SEED = 777;

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
  try {
    const taken = await takeAccountRender(user);
    if (!taken.ok) return NextResponse.json({ error: taken.error, signin: taken.signin, limited: taken.limited }, { status: taken.status });
    fal.config({ credentials: falKey });
    const one = async (view: TableView) => {
      const guide = await tableGuide(table, theme, view);
      const result = await fal.subscribe(MODEL, {
        input: {
          prompt: tablePrompt(table, theme, view),
          image_urls: [`data:image/png;base64,${guide.toString("base64")}`],
          image_size: GUIDE_SIZE[view],
          seed: SEED,
          output_format: "jpeg",
        } as never,
        abortSignal: AbortSignal.timeout(80_000),
      });
      const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
      if (!url) throw new Error("no image");
      return url;
    };
    const [perspective, top] = await Promise.all([one("perspective"), one("top")]);
    const render: TableRender = { key: tableRenderKey(table), perspective, top };
    return NextResponse.json({ render, left: taken.left });
  } catch (err) {
    console.error("[table-render]", err);
    return NextResponse.json({ error: "The render didn't come out — please try again." }, { status: 502 });
  } finally {
    slot.release();
  }
}
