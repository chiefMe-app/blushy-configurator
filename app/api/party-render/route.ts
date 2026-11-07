// The whole party in one photograph (2026-11-04, lib/studio/partyRender.ts): on the Venue step, the backdrop's
// picture (its render, or its live sketch) and the kids' table's (its render, or its drawing) sent together to
// FLUX.2 [pro] edit with her setting, indoors or outdoors — as the helium balloons' render is made: an account, one of
// the day's renders, kept in the customer's folder, the answer streamed.
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { fal } from "@fal-ai/client";
import { defaultConfig, themeById, type BackdropItem, type DecorConfig } from "@/lib/config";
import { acquireRender, clientIp } from "@/lib/renderGuard";
import { renderUser, takeAccountRender } from "@/lib/renderAccount";
import { renderJpeg, storeRenderJpeg } from "@/lib/renderStore";
import { ndjsonLine } from "@/lib/ndjson";
import { gradePhoto } from "@/lib/photoGrade";
import { readTableSetup } from "@/lib/studio/tableSetup";
import { MAX_PARTY_IMAGES, PARTY_EXPERIENCE_PHOTOS, PARTY_EXTRAS, PARTY_PICKS, partyAddPrompt, partyExperiences, partyMainExtras, partyPrompt, partyReferences, partySides, type PartySetting, type Side } from "@/lib/studio/partyRender";
import { experiencePhoto, sideRoom, stitchSides, wideCanvas, WIDE } from "@/lib/studio/partySheet";
import { optionPicture } from "@/lib/studio/tableOptionPicture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const MODEL = process.env.PARTY_RENDER_MODEL || "fal-ai/flux-2-pro/edit";
/** Each picture the builder sends: at most this many bytes. */
const MAX_PICTURE_BYTES = 4 * 1024 * 1024;
/** The photograph: landscape, the whole setup in it. */
const SIZE = { width: 1344, height: 896 };

/** The backdrop's pieces as told (its boards and plinths), read over the defaults: only what the words use. */
function readDecor(raw: unknown): Pick<DecorConfig, "backdropItems" | "backdropColor" | "plinths"> {
  // The board's words and their colour too (2026-11-06): told in words, they come out right.
  const text = (v: unknown) => {
    const t = (typeof v === "object" && v ? v : {}) as Record<string, unknown>;
    return t.enabled === true && typeof t.value === "string" && t.value.trim()
      ? { enabled: true, value: t.value.trim().slice(0, 60), color: typeof t.color === "string" ? t.color.slice(0, 20) : "" } : undefined;
  };
  const base = defaultConfig().decor;
  const d = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>;
  const hex = (v: unknown) => (typeof v === "string" && /^#[0-9A-F]{6}$/i.test(v) ? v : "");
  const cm = (v: unknown) => (typeof v === "number" && v > 0 && v < 1000 ? Math.round(v) : 0);
  const items = Array.isArray(d.backdropItems) ? d.backdropItems.slice(0, 8) : [];
  return {
    backdropItems: items.map((i) => {
      const r = (typeof i === "object" && i ? i : {}) as Record<string, unknown>;
      return { type: typeof r.type === "string" ? r.type.slice(0, 30) : "board", widthCm: cm(r.widthCm), heightCm: cm(r.heightCm), color: hex(r.color), text: text(r.text) } as unknown as BackdropItem;
    }),
    backdropColor: hex(d.backdropColor) || base.backdropColor,
    plinths: Number.isInteger(d.plinths) ? Math.max(0, Math.min(6, d.plinths as number)) : 0,
  };
}

const pictureOf = (v: unknown) => (typeof v === "string" ? v.match(/^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined);

export async function POST(req: NextRequest) {
  let body: { theme?: unknown; setting?: unknown; key?: unknown; table?: unknown; decor?: unknown; backdrop?: unknown; tablePicture?: unknown; extras?: unknown; experiences?: unknown; mainPhoto?: unknown; mainKey?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const theme = typeof body?.theme === "string" ? themeById(body.theme) : undefined;
  const setting: PartySetting | undefined = body?.setting === "indoor" || body?.setting === "outdoor" ? body.setting : undefined;
  if (!theme || !setting) return NextResponse.json({ error: "Pick indoor or outdoor first." }, { status: 400 });
  const backdrop = pictureOf(body.backdrop), tablePic = pictureOf(body.tablePicture);
  const table = tablePic ? readTableSetup(body.table, theme) : undefined;
  // Nothing designed to stand there: not worth a render.
  if (!backdrop && !(table?.enabled && tablePic)) return NextResponse.json({ error: "Design a backdrop or a table first." }, { status: 400 });
  const pictures = [backdrop, table?.enabled ? tablePic : undefined].filter((p): p is string => !!p).map((p) => Buffer.from(p, "base64"));
  // The backdrop-and-table photo she already has (2026-11-06, the owner: "hızlandırıp renderı"): the first of the two
  // photographs is not made again; and its key, to send back the one made here.
  const mainPhoto = pictureOf(body.mainPhoto);
  const mainKey = typeof body.mainKey === "string" && /^[0-9a-z]{1,16}$/.test(body.mainKey) ? body.mainKey : undefined;
  // "Everything" (2026-11-05): the other parts' own pictures, each once, in PARTY_EXTRAS' order.
  const sent = Array.isArray(body.extras) ? body.extras.slice(0, PARTY_EXTRAS.length) : [];
  const extras = PARTY_EXTRAS.flatMap((part) => {
    const e = sent.find((x) => (x as { part?: unknown })?.part === part) as { picture?: unknown } | undefined;
    const b64 = e ? pictureOf(e.picture) : undefined;
    return b64 ? [{ part, bytes: Buffer.from(b64, "base64") }] : [];
  }).slice(0, PARTY_PICKS);
  // Her experiences (2026-11-05): the carts and inflatables by their photos, the stations by words; no people. At most
  // PARTY_PICKS pieces with the backdrop and table in all, the parts first (2026-11-06).
  const xpAll = partyExperiences(Array.isArray(body.experiences) ? body.experiences.filter((x): x is string => typeof x === "string").slice(0, 20) : []);
  const xRoom = PARTY_PICKS - extras.length;
  const xp = { photos: xpAll.photos.slice(0, Math.max(0, xRoom)), stations: xpAll.stations.slice(0, Math.max(0, xRoom - Math.min(xRoom, xpAll.photos.length))) };
  if ([...pictures, ...extras.map((e) => e.bytes), ...(mainPhoto ? [Buffer.from(mainPhoto, "base64")] : [])].some((b) => b.length > MAX_PICTURE_BYTES)) return NextResponse.json({ error: "A picture is too big." }, { status: 413 });
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
    // The experiences' photos and the other parts' pictures, each one of its own: three at most, so the second photo
    // takes four pictures (well under fal's 9 MP).
    const xPhotos = (await Promise.all(xp.photos.map((id) => experiencePhoto(PARTY_EXPERIENCE_PHOTOS[id]!.pic, req.nextUrl.origin).then((b) => ({ id, b })).catch(() => null))))
      .filter((x): x is { id: (typeof xp.photos)[number]; b: Buffer } => !!x);
    const small = (b: Buffer) => sharp(b).resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toBuffer();
    const xImages = await Promise.all(xPhotos.map((x) => small(x.b)));
    const extraImages = await Promise.all(extras.map((e) => small(e.bytes)));
    // The cake into the first photograph when the two boards are picked too (partyMainExtras): the rest at the sides.
    const ids = [...extras.map((e) => e.part), ...xPhotos.map((x) => x.id), ...xp.stations];
    const mainIds: readonly string[] = partyMainExtras(ids);
    const rest = ids.filter((id) => !mainIds.includes(id));
    // Everything she designed in two photographs (2026-11-06, the owner: "saçmaladı render backdropta özellikle" — ten
    // pieces at once spoiled the backdrop; then "a olsun"): first the backdrop and the kids' table, kept exact; then that
    // photo in the middle of a wider canvas (wideCanvas), the setting carried on at its sides and the pieces she picked
    // added there (partyAddPrompt).
    const more = rest.length > 0;
    // Her table's and chair's own option photos (2026-11-04, the owner: "Birebir benim seçimlerim olmalı masa sandalye
    // backdrop vs"), small: the top view already shows the rest. One that can't be read is left out.
    // Room left for them (seven pictures at most): the chair first, then the table's photo.
    const room = MAX_PARTY_IMAGES - images.length - mainIds.length;
    const refs = (table?.enabled ? partyReferences(table, theme.id) : []).sort((a, b) => Number(b.key === "chairs") - Number(a.key === "chairs")).slice(0, Math.max(0, room))
      .sort((a, b) => Number(a.key === "chairs") - Number(b.key === "chairs"));
    const refPics = (await Promise.all(refs.map((r) => optionPicture(r.photo, req.nextUrl.origin, 512).then((u) => ({ key: r.key, u })).catch(() => null)))).filter((r): r is { key: (typeof refs)[number]["key"]; u: string } => !!r);
    const has = { backdrop: !!backdrop, table: !!table?.enabled };
    // The builder's key for what it sent (partyRenderKey): only ever a short word of letters and digits.
    const key = typeof body.key === "string" && /^[0-9a-z]{1,16}$/.test(body.key) ? body.key : undefined;
    fal.config({ credentials: falKey });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(ndjsonLine(o));
        const uri = (b: Buffer) => `data:image/jpeg;base64,${b.toString("base64")}`;
        const photo = async (prompt: string, image_urls: string[], ms: number, image_size: { width: number; height: number } = SIZE) => {
          const result = await fal.subscribe(MODEL, {
            input: { prompt, image_urls, num_images: 1, output_format: "jpeg", image_size, seed: 777 } as never,
            abortSignal: AbortSignal.timeout(ms),
          });
          const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
          if (!url) throw new Error("no party image");
          const made = await renderJpeg(url);
          if (!made) throw new Error("the party render could not be read");
          return made;
        };
        try {
          const until = Date.now() + 140_000;
          const mainExtras = extras.map((e, k) => ({ part: e.part, image: extraImages[k] })).filter((e) => mainIds.includes(e.part));
          const main = more && mainPhoto ? Buffer.from(mainPhoto, "base64") : await photo(
            partyPrompt({ table, decor: { ...defaultConfig().decor, ...readDecor(body.decor) }, theme: theme.id }, setting, { ...has, refs: refPics.map((r) => r.key), extras: mainExtras.map((e) => e.part) }),
            [...images.map(uri), ...mainExtras.map((e) => uri(e.image)), ...refPics.map((r) => r.u)], more ? 70_000 : 130_000);
          // The first photo made here: back to the builder for next time (her picks change; the backdrop and table don't).
          if (more && !mainPhoto && mainKey) send({ also: { key: mainKey, url: uri(await gradePhoto(main).catch(() => main)) } });
          const made = !more ? main : await (async () => {
            // The pieces she picked — all, or one side's — added to the first photo in its wider canvas: in the middle, or
            // at the far end with all the white on that side.
            const some = (keep: readonly string[], canvas: string, side?: Side) => {
              const ex = extras.map((e, k) => ({ part: e.part, image: extraImages[k] })).filter((e) => keep.includes(e.part));
              const px = xPhotos.map((x, k) => ({ id: x.id, image: xImages[k] })).filter((x) => keep.includes(x.id));
              const st = xp.stations.filter((id) => keep.includes(id));
              return photo(partyAddPrompt(setting, { extras: ex.map((e) => e.part), experiences: px.map((x) => x.id), stations: st, there: mainExtras.map((e) => e.part) }, side),
                [canvas, ...ex.map((e) => uri(e.image)), ...px.map((x) => uri(x.image))], Math.max(30_000, until - Date.now()), WIDE);
            };
            const sides = partySides(rest, mainIds);
            if (!sides) return some(rest, uri(await wideCanvas(main)));
            // Four or five pieces (2026-11-07, the owner: "table setup neden yok? pinata bozuk" — with five in one photo a
            // piece was always lost or set on another): one photograph a side, both at once, joined down the middle.
            // Both canvases first, so the two go to the engine in order (the left's first).
            const [cl, cr] = await Promise.all([wideCanvas(main, "left"), wideCanvas(main, "right")]);
            const [l, r] = await Promise.all([some(sides.left, uri(cl), "left"), some(sides.right, uri(cr), "right")]);
            return stitchSides(l, r, await sideRoom(main));
          })();
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
          // fal's own words on why (a picture refused, a timeout), for the logs.
          console.error("[party-render]", err, JSON.stringify((err as { body?: unknown })?.body ?? null).slice(0, 2000));
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
