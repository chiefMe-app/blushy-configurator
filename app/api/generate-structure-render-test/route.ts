/**
 * EXPERIMENTAL — isolated test route for structure-guided render validation.
 *
 * Phase 1: Returns a deterministic SVG silhouette + debug info only.
 * No fal.ai calls. No production side-effects.
 *
 * Use to verify:
 *   - Arch is rendered taller than wide (portrait aspect ratio)
 *   - Plinth is a tall slim rectangle (height >> width)
 *   - Half garland occupies one side only and reaches the floor
 *   - Canvas aspect ratio matches the fal image_size for this setup
 *
 * This route never affects /api/generate-controlled-render or SetupPreview.tsx.
 * Can be deleted with zero production impact.
 */

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import type { BackdropItem, PlinthSize, BalloonStyleId } from "@/lib/config";
import { generateStructureSilhouette } from "@/lib/generateStructureSilhouette";
import { calculateExactLayout } from "@/lib/calculateExactLayout";
import { calculateRenderAspectRatio } from "@/lib/calculateRenderAspectRatio";

// Canny ControlNet model — verified from fal docs
// Docs: https://fal.ai/models/fal-ai/flux-control-lora-canny/api
// SDK model ID (used by fal.subscribe / fal.queue.*):
const CANNY_MODEL_ID = "fal-ai/flux-control-lora-canny";
// Raw REST endpoint (used by fal-test mode blocking fetch):
const CANNY_ENDPOINT = `https://fal.run/${CANNY_MODEL_ID}`;
const TEST_SEED      = 42424242;

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 200; // fal-queue-test needs up to 180s + buffer

function checkAccess(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.STRUCTURE_TEST_SECRET;
  if (!secret) return false;
  return req.headers.get("x-test-key") === secret;
}

interface TestRequestBody {
  testId?:        string;
  backdropItems:  BackdropItem[];
  plinthSizes:    PlinthSize[];
  balloonStyle:   BalloonStyleId;
  balloonColors?: string[];
  /**
   * "svg-only"       — default, returns SVG string + layout debug (no fal call).
   * "png-debug"      — converts SVG → PNG and returns size/mime info (no fal call).
   * "fal-test"       — blocking raw fetch to fal REST endpoint (legacy, may time out).
   * "fal-queue-test" — fal.subscribe queue/poll pattern, 180s max wait (preferred).
   */
  mode?:          "svg-only" | "png-debug" | "fal-test" | "fal-queue-test";
}

export async function POST(req: NextRequest) {
  if (!checkAccess(req)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: TestRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { testId, backdropItems, plinthSizes, balloonStyle, balloonColors, mode = "svg-only" } = body;
  const tId = testId ?? "unnamed";

  if (!backdropItems || !Array.isArray(backdropItems) || backdropItems.length === 0) {
    return NextResponse.json({ error: "backdropItems is required and must be a non-empty array." }, { status: 400 });
  }
  if (!plinthSizes || !Array.isArray(plinthSizes)) {
    return NextResponse.json({ error: "plinthSizes is required (pass [] for no plinths)." }, { status: 400 });
  }
  if (!balloonStyle) {
    return NextResponse.json({ error: "balloonStyle is required (none | half | full | premium)." }, { status: 400 });
  }

  // Generate the SVG silhouette
  const result = generateStructureSilhouette(
    backdropItems,
    plinthSizes,
    balloonStyle,
    balloonColors,
  );

  // Compute layout details for debug inspection
  const { falImageSize: computedSize } = calculateRenderAspectRatio(backdropItems);
  const layout = calculateExactLayout(backdropItems, plinthSizes, result.viewBoxW, result.viewBoxH);

  const debugPanels = layout.panels.map((p) => {
    const item = backdropItems[p.idx];
    return {
      idx:         p.idx,
      type:        item?.type ?? "unknown",
      widthCm:     p.widthCm,
      heightCm:    p.heightCm,
      aspectRatio: +(p.widthCm / p.heightCm).toFixed(3),
      cx:          Math.round(p.cx),
      pw:          Math.round(p.pw),
      ph:          Math.round(p.floorY - p.apexY),
      apexY:       Math.round(p.apexY),
      floorY:      Math.round(p.floorY),
      svgTallerThanWide: p.floorY - p.apexY > p.pw,   // key check: panel is portrait in SVG
    };
  });

  const debugPlinths = layout.plinths.map((p) => ({
    idx:           p.idx,
    cx:            Math.round(p.cx),
    heightPx:      Math.round(p.heightPx),
    diameterPx:    Math.round(p.diameterPx),
    heightRatio:   +(p.heightPx / p.diameterPx).toFixed(2),  // key check: should be >> 1
    tallerThanWide: p.heightPx > p.diameterPx,
  }));

  const svgDebug = {
    testId:      testId ?? "unnamed",
    phase:       "1-svg-only",
    falImageSize: computedSize,
    viewBox:     `0 0 ${result.viewBoxW} ${result.viewBoxH}`,
    svg:         result.svg,
    debug: {
      panelCount:    layout.panels.length,
      plinthCount:   layout.plinths.length,
      balloonStyle,
      balloonColors: balloonColors ?? [],
      floorY:        Math.round(layout.floorY),
      panels:        debugPanels,
      plinths:       debugPlinths,
      checks: {
        allPanelsTallerThanWide: debugPanels.every((p) => p.svgTallerThanWide),
        allPlinthsTallerThanWide: debugPlinths.every((p) => p.tallerThanWide),
        hasGarland: balloonStyle !== "none",
      },
    },
  };

  if (mode === "svg-only") {
    return NextResponse.json({ ok: true, mode: "svg-only", ...svgDebug });
  }

  // ── PNG conversion (shared by png-debug and fal-test) ────────────────────
  // Requires `sharp` (not currently installed). Dynamic import so the route
  // compiles and runs without sharp — it reports the limitation gracefully.
  // Once `npm install sharp` is run, this code works with zero further changes.
  let pngBuffer: Buffer | null = null;
  let pngError: string | null  = null;

  try {
    // new Function bypasses both webpack static bundling and TypeScript type checking.
    // sharp is optional — if not installed, the outer catch reports pngError.
    // eslint-disable-next-line no-new-func
    const sharpMod = await (new Function("m", "return import(m)"))("sharp")
      .then((m: { default?: unknown }) => m.default ?? m) as (buf: Buffer) => { png(): { toBuffer(): Promise<Buffer> } };
    const svgBuffer = Buffer.from(result.svg, "utf8");
    pngBuffer = await sharpMod(svgBuffer).png().toBuffer() as Buffer;
  } catch (err) {
    pngError = String(err);
    console.error("[structure-test] SVG → PNG conversion failed:", pngError);
  }

  const pngBase64   = pngBuffer?.toString("base64") ?? null;
  const pngDataUri  = pngBase64 ? `data:image/png;base64,${pngBase64}` : null;
  const sharpAvailable = pngBuffer !== null;

  // ── png-debug: verify PNG conversion without calling fal ─────────────────
  if (mode === "png-debug") {
    return NextResponse.json({
      ok:                  sharpAvailable,
      mode:                "png-debug",
      testId:              tId,
      sharpAvailable,
      controlImageMime:    sharpAvailable ? "image/png" : null,
      controlImageSizeBytes: pngBuffer?.length ?? null,
      svgSizeBytes:        result.svg.length,
      falImageSize:        computedSize,
      svgChecks:           svgDebug.debug.checks,
      error:               pngError,
      // Only include the data URI if it's small enough to be useful (< 200 KB)
      controlImageDataUri: (pngBuffer && pngBuffer.length < 200_000) ? pngDataUri : null,
      note: sharpAvailable
        ? "PNG ready — use mode: fal-test to run the fal generation."
        : "sharp is not installed. Run `npm install sharp` then redeploy. clientSvgToPng.ts is browser-only and cannot be used server-side.",
    });
  }

  // Shared variables for any fal call — computed once, used by both fal-test and fal-queue-test
  const controlDataUri = pngDataUri ?? "";
  const promptSummary =
    "Photorealistic premium event setup. Tall narrow arch backdrop (100×200cm), " +
    "tall slim white cylindrical plinth on the open left side, " +
    "half balloon garland on the right side reaching the floor in a compact base cluster. " +
    "Frozen palette: icy blue, white, silver latex balloons. " +
    "Luxury minimalist indoor studio, soft natural light from the left. " +
    "No text, no lettering, no signage on the backdrop.";
  const falPayloadForSize = {
    prompt:                  promptSummary,
    control_lora_image_url:  controlDataUri,
    image_size:              computedSize,
    num_inference_steps:     28,
    guidance_scale:          3.5,
    seed:                    TEST_SEED,
    num_images:              1,
    control_lora_strength:   0.80,
    output_format:           "jpeg",
  };
  const payloadApproxSizeBytes = Buffer.byteLength(JSON.stringify(falPayloadForSize), "utf8");

  // ── fal-queue-test: SDK subscribe/queue pattern ──────────────────────────
  if (mode === "fal-queue-test") {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({
        ok: false, mode: "fal-queue-test", testId: tId,
        endpoint: CANNY_MODEL_ID, imageUrl: null, requestId: null,
        error: "FAL_KEY not configured", latencyMs: null,
        controlImageMime: pngBuffer ? "image/png" : null,
        controlImageSizeBytes: pngBuffer?.length ?? null,
        payloadApproxSizeBytes,
        hasFalKey: false,
        svgChecks: svgDebug.debug.checks,
        queueStatusHistory: [],
      }, { status: 500 });
    }
    if (!pngDataUri || !pngBuffer) {
      return NextResponse.json({
        ok: false, mode: "fal-queue-test", testId: tId,
        endpoint: CANNY_MODEL_ID, imageUrl: null, requestId: null,
        error: `PNG conversion required. ${pngError ?? "sharp not available."}`,
        latencyMs: null, controlImageMime: null, controlImageSizeBytes: null,
        payloadApproxSizeBytes, hasFalKey: true,
        svgChecks: svgDebug.debug.checks, queueStatusHistory: [],
      }, { status: 500 });
    }
    return handleFalQueueTest(
      tId, falKey, pngDataUri, pngBuffer, promptSummary,
      computedSize, payloadApproxSizeBytes, svgDebug.debug.checks,
    );
  }

  // If we reach fal-test mode but PNG conversion failed, stop safely
  if (!pngDataUri) {
    return NextResponse.json({
      ok: false, mode: "fal-test", testId: tId,
      endpoint: CANNY_ENDPOINT, imageUrl: null,
      error: `PNG conversion required for fal-test. ${pngError ?? "sharp not available."}`,
      latencyMs: null, controlImageUsed: null,
      svgChecks: svgDebug.debug.checks,
      note: "Install sharp (`npm install sharp`) to enable PNG conversion server-side.",
    }, { status: 500 });
  }

  // ── fal-test mode: one experimental Canny ControlNet generation ────────────
  // SVG is NOT included in this response to keep the body small and parseable.
  // Use mode: "svg-only" first to inspect the silhouette.

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.error("[structure-test] FAL_KEY not configured");
    return NextResponse.json({
      ok: false, mode: "fal-test", testId: testId ?? "unnamed",
      endpoint: CANNY_ENDPOINT, imageUrl: null,
      error: "FAL_KEY not configured", latencyMs: null,
      controlImageUsed: null, svgChecks: svgDebug.debug.checks,
    }, { status: 500 });
  }

  // All shared vars (controlDataUri, promptSummary, payloadApproxSizeBytes) hoisted above.
  // Build JSON for the blocking fal-test fetch.
  const falPayloadJson = JSON.stringify(falPayloadForSize);

  const controlImageMime      = "image/png";
  const controlImageSizeBytes = pngBuffer!.length;

  console.log("[structure-test] fal-test start");
  console.log("[structure-test] endpoint:", CANNY_ENDPOINT);
  console.log("[structure-test] falImageSize:", computedSize);
  console.log("[structure-test] controlImageMime:", controlImageMime, "controlImageSizeBytes:", controlImageSizeBytes);
  console.log("[structure-test] payloadApproxSizeBytes:", payloadApproxSizeBytes);
  console.log("[structure-test] hasFalKey:", !!falKey);

  fal.config({ credentials: falKey });
  const t0 = Date.now();

  // Type as unknown so we can inspect any shape defensively
  let rawFalResult: unknown = null;
  let falError: string | null = null;
  let falHttpStatus: number | null = null;

  const abortController = new AbortController();
  const timeoutMs = 120_000;
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const res = await fetch(CANNY_ENDPOINT, {
      method:  "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: falPayloadJson,
      signal: abortController.signal,
    });

    falHttpStatus = res.status;

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      falError = `fal HTTP ${res.status}: ${body.slice(0, 400)}`;
      console.error("[structure-test] fal error:", falError);
    } else {
      rawFalResult = await res.json().catch((e: unknown) => {
        falError = `fal response not valid JSON: ${String(e)}`;
        return null;
      });
    }
  } catch (err) {
    const latencyMsCatch = Date.now() - t0;

    // Extract Node.js network error fields from the thrown error and its cause
    const e  = err as Record<string, unknown>;
    const ca = (e["cause"] ?? {}) as Record<string, unknown>;

    const errName            = String(e["name"]    ?? "unknown");
    const errMessage         = String(e["message"] ?? String(err));
    const errStackFirstLine  = typeof e["stack"] === "string" ? e["stack"].split("\n")[0] ?? null : null;
    const causeName          = ca["name"]    != null ? String(ca["name"])    : null;
    const causeMessage       = ca["message"] != null ? String(ca["message"]) : null;
    const causeCode          = ca["code"]    != null ? String(ca["code"])    : null;  // e.g. ECONNREFUSED, ENOTFOUND
    const causeErrno         = ca["errno"]   != null ? String(ca["errno"])   : null;
    const causeSyscall       = ca["syscall"] != null ? String(ca["syscall"]) : null;

    const fetchErrorDiag = {
      errorName:           errName,
      errorMessage:        errMessage,
      errorStackFirstLine: errStackFirstLine,
      errorCauseName:      causeName,
      errorCauseMessage:   causeMessage,
      errorCauseCode:      causeCode,   // most useful: ENOTFOUND = DNS failure, ECONNREFUSED = refused, etc.
      errorCauseErrno:     causeErrno,
      errorCauseSyscall:   causeSyscall,
    };

    // Distinguish a timeout abort from other network errors
    const isTimeout = abortController.signal.aborted;

    console.error("[structure-test] fetch threw:", errName, errMessage, isTimeout ? "(TIMEOUT)" : "");
    console.error("[structure-test] cause:", causeCode, causeSyscall, causeMessage);

    return NextResponse.json({
      ok:                  false,
      mode:                "fal-test",
      testId:              tId,
      endpoint:            CANNY_ENDPOINT,
      imageUrl:            null,
      error:               isTimeout
                             ? `fal request timed out after ${timeoutMs / 1000}s`
                             : `fetch threw: ${errName}: ${errMessage}`,
      latencyMs:           latencyMsCatch,
      falHttpStatus:       null,
      hasFalKey:           !!falKey,
      controlImageMime,
      controlImageSizeBytes,
      payloadApproxSizeBytes,
      svgChecks:           svgDebug.debug.checks,
      ...fetchErrorDiag,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }

  const latencyMs = Date.now() - t0;
  console.log("[structure-test] fal-test done — latencyMs:", latencyMs, "error:", falError ?? "none");

  // Defensive inspection: examine every known output shape
  const r = rawFalResult as Record<string, unknown> | null;
  const falResponseType    = rawFalResult === null ? "null" : typeof rawFalResult;
  const falResponseKeys    = r ? Object.keys(r) : [];
  const imagesArr          = Array.isArray(r?.["images"]) ? (r!["images"] as unknown[]) : null;
  const falImagesCount     = imagesArr?.length ?? 0;
  const firstImage         = imagesArr?.[0] as Record<string, unknown> | undefined;
  const falFirstImageKeys  = firstImage ? Object.keys(firstImage) : [];

  // Extract imageUrl from all documented + plausible paths
  const imageUrl: string | null =
    (firstImage?.["url"] as string | undefined) ??
    (r?.["image"] as Record<string, unknown> | undefined)?.["url"] as string | undefined ??
    (r?.["url"] as string | undefined) ??
    null;

  console.log("[structure-test] imageUrl found:", imageUrl ? "YES" : "NO", imageUrl ?? "");

  if (!falError && imageUrl === null) {
    falError = "fal returned no image url";
    console.warn("[structure-test] no image url in response. keys:", falResponseKeys);
  }

  return NextResponse.json({
    ok:                  imageUrl !== null,
    mode:                "fal-test",
    testId:              testId ?? "unnamed",
    phase:               "2a-fal-test",
    endpoint:            CANNY_ENDPOINT,
    imageUrl,
    error:               falError,
    controlImageUsed:    `data:image/png;base64 (PNG rasterized from SVG, ${pngBuffer!.length} bytes)`,
    falImageSize:        computedSize,
    seed:                TEST_SEED,
    controlLoraStrength: 0.80,
    latencyMs,
    falHttpStatus,
    promptSummary,
    svgChecks:           svgDebug.debug.checks,
    svgSizeBytes:        result.svg.length,
    falResponseType,
    falResponseKeys,
    falImagesCount,
    falFirstImageKeys,
  });
}

// Isolated fal-queue-test handler — extracted for clarity
async function handleFalQueueTest(
  tId: string,
  falKey: string,
  controlDataUri: string,
  pngBuffer: Buffer,
  promptSummary: string,
  computedSize: string,
  payloadApproxSizeBytes: number,
  svgChecks: Record<string, unknown>,
): Promise<NextResponse> {
  const controlImageMime      = "image/png";
  const controlImageSizeBytes = pngBuffer.length;
  const maxWaitMs             = 180_000;

  fal.config({ credentials: falKey });

  const queueStatusHistory: string[] = [];
  const t0                           = Date.now();
  const abortController              = new AbortController();
  const timeoutHandle                = setTimeout(() => abortController.abort(), maxWaitMs);

  let requestId: string | null  = null;
  let imageUrl: string | null   = null;
  let queueError: string | null = null;
  let rawData: unknown          = null;

  console.log("[structure-test-queue] start — model:", CANNY_MODEL_ID);
  console.log("[structure-test-queue] controlImageSizeBytes:", controlImageSizeBytes, "payloadApproxSizeBytes:", payloadApproxSizeBytes);
  console.log("[structure-test-queue] maxWaitMs:", maxWaitMs, "hasFalKey:", !!falKey);

  try {
    const falResult = await fal.subscribe(CANNY_MODEL_ID, {
      // Cast input to Record<string,unknown> — computedSize is a valid FalImageSize string
      // but the SDK's generated type union doesn't include all valid string literals.
      input: {
        prompt:                  promptSummary,
        control_lora_image_url:  controlDataUri,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        image_size:              computedSize as any,
        num_inference_steps:     28,
        guidance_scale:          3.5,
        seed:                    TEST_SEED,
        num_images:              1,
        control_lora_strength:   0.80,
        output_format:           "jpeg",
      },
      logs:        true,
      abortSignal: abortController.signal,
      onQueueUpdate: (status) => {
        const ts  = new Date().toISOString();
        const pos = status.status === "IN_QUEUE" ? ` queue_pos=${status.queue_position}` : "";
        const entry = `[${ts}] ${status.status}${pos}`;
        queueStatusHistory.push(entry);
        console.log("[structure-test-queue]", entry);
        if (!requestId && status.request_id) {
          requestId = status.request_id;
          console.log("[structure-test-queue] requestId:", requestId);
        }
      },
    });

    // Result<any> → { data: any; requestId: string }
    requestId = falResult.requestId ?? requestId;
    rawData   = falResult.data;

    const d         = falResult.data as Record<string, unknown>;
    const imagesArr = Array.isArray(d?.["images"]) ? (d["images"] as Record<string, unknown>[]) : null;
    imageUrl =
      (imagesArr?.[0]?.["url"] as string | undefined) ??
      ((d?.["image"] as Record<string, unknown> | undefined)?.["url"] as string | undefined) ??
      (d?.["url"] as string | undefined) ??
      null;

    if (!imageUrl) {
      queueError = "fal returned no image url";
      console.warn("[structure-test-queue] no imageUrl. response keys:", Object.keys(d ?? {}));
    } else {
      console.log("[structure-test-queue] imageUrl:", imageUrl);
    }
  } catch (err) {
    const isTimeout = abortController.signal.aborted;
    queueError      = isTimeout
      ? `fal queue timed out after ${maxWaitMs / 1000}s`
      : String(err);
    console.error("[structure-test-queue] error:", queueError);
  } finally {
    clearTimeout(timeoutHandle);
  }

  const latencyMs = Date.now() - t0;
  console.log("[structure-test-queue] done. latencyMs:", latencyMs, "imageUrl:", imageUrl ?? "null");

  const d               = rawData as Record<string, unknown> | null;
  const falResponseKeys = d ? Object.keys(d) : [];
  const imagesArr       = Array.isArray(d?.["images"]) ? (d!["images"] as unknown[]) : null;

  return NextResponse.json({
    ok:                     imageUrl !== null,
    mode:                   "fal-queue-test",
    testId:                 tId,
    endpoint:               CANNY_MODEL_ID,
    requestId,
    imageUrl,
    error:                  queueError,
    latencyMs,
    queueStatusHistory,
    controlImageMime,
    controlImageSizeBytes,
    payloadApproxSizeBytes,
    hasFalKey:              true,
    svgChecks,
    falResponseKeys,
    falImagesCount:         imagesArr?.length ?? 0,
  });
}
