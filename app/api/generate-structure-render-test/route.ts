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
import { getPlinthDimensions } from "@/lib/layoutDimensions";

// Canny ControlNet model — verified from fal docs
// Docs: https://fal.ai/models/fal-ai/flux-control-lora-canny/api
// SDK model ID (used by fal.subscribe / fal.queue.*):
const CANNY_MODEL_ID = "fal-ai/flux-control-lora-canny";
// Raw REST endpoint (used by fal-test mode blocking fetch):
const CANNY_ENDPOINT = `https://fal.run/${CANNY_MODEL_ID}`;

// EasyControl Canny — fal-ai/flux-general with easycontrols array
// Docs: https://fal.ai/models/fal-ai/flux-general/api
const EASYCONTROL_MODEL_ID = "fal-ai/flux-general";

// Layout reference edit — fal-ai/flux-2-pro/edit
// Docs: https://fal.ai/models/fal-ai/flux-2-pro/edit/api
// Verified schema: image_urls (array, accepts base64 data URIs), prompt, image_size, seed, output_format
const LAYOUT_REF_MODEL_ID = "fal-ai/flux-2-pro/edit";

// Replicate Canny ControlNet model
// Docs: https://replicate.com/black-forest-labs/flux-canny-pro
// Endpoint: POST https://api.replicate.com/v1/models/{owner}/{name}/predictions
const REPLICATE_MODEL_ID    = "black-forest-labs/flux-canny-pro";
const REPLICATE_PREDICT_URL = `https://api.replicate.com/v1/models/${REPLICATE_MODEL_ID}/predictions`;

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
   * "svg-only"                — default, returns SVG + layout debug (no generation).
   * "png-debug"               — converts SVG → PNG, returns size/mime (no generation).
   * "fal-test"                — blocking raw fetch to fal REST (legacy, may time out).
   * "fal-queue-test"          — fal.subscribe flux-control-lora-canny, 180s max.
   * "fal-easycontrol-test"    — fal.subscribe flux-general + EasyControl Canny, 120s max.
   * "replicate-canny-dry-run" — builds Replicate payload but does NOT call API (no generation).
   * "replicate-canny-test"    — Replicate flux-canny-pro with PNG control image, 120s max.
   */
  mode?:
    | "svg-only"
    | "png-debug"
    | "fal-test"
    | "fal-queue-test"
    | "fal-easycontrol-test"
    | "replicate-canny-dry-run"
    | "replicate-canny-test"
    | "fal-layout-reference-dry-run"
    | "fal-layout-reference-test";
}

export async function POST(req: NextRequest) {
  // ── Production guard ──────────────────────────────────────────────────────
  // Test-only route: several modes call fal-ai/flux-2-pro/edit and other paid
  // models. Disabled unless explicitly enabled, so it is never publicly callable
  // in production and cannot cause accidental Pro usage.
  if (process.env.ENABLE_STRUCTURE_RENDER_TEST !== "true") {
    console.warn(
      "[api/generate-structure-render-test] BLOCKED: test route is disabled. " +
      "Set ENABLE_STRUCTURE_RENDER_TEST=true to re-enable."
    );
    return NextResponse.json({ error: "structure_render_test_disabled" }, { status: 410 });
  }

  if (!checkAccess(req)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Top-level guard — this route must never return an uncaught 500.
  // All branches are wrapped; this outer catch is the last safety net.
  try {

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

  // Resolve exact plinth dimensions from the first configured plinth size (if any)
  const firstPlinthSize   = plinthSizes?.[0] as PlinthSize | undefined;
  const resolvedPlinthDims: PlinthDims | null = firstPlinthSize
    ? getPlinthDimensions(firstPlinthSize)
    : null;

  // Shared variables for any fal call — computed once, used by both fal-test and fal-queue-test
  const controlDataUri = pngDataUri ?? "";
  const promptSummary =
    "Photorealistic premium event setup. Tall narrow arch backdrop (medium: 100cm wide × 200cm tall), " +
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

  // ── fal-easycontrol-test: flux-general + EasyControl Canny ───────────────
  if (mode === "fal-easycontrol-test") {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({
        ok: false, mode: "fal-easycontrol-test", testId: tId,
        modelId: EASYCONTROL_MODEL_ID, requestId: null,
        imageUrl: null, error: "FAL_KEY not configured", latencyMs: null,
        controlImageMime: pngBuffer ? "image/png" : null,
        controlImageSizeBytes: pngBuffer?.length ?? null,
        payloadApproxSizeBytes, hasFalKey: false,
        svgChecks: svgDebug.debug.checks, queueStatusHistory: [],
      }, { status: 500 });
    }
    if (!pngDataUri || !pngBuffer) {
      return NextResponse.json({
        ok: false, mode: "fal-easycontrol-test", testId: tId,
        modelId: EASYCONTROL_MODEL_ID, requestId: null,
        imageUrl: null, error: `PNG conversion required. ${pngError ?? "sharp not available."}`,
        latencyMs: null, controlImageMime: null, controlImageSizeBytes: null,
        payloadApproxSizeBytes, hasFalKey: true,
        svgChecks: svgDebug.debug.checks, queueStatusHistory: [],
      }, { status: 500 });
    }
    return handleFalEasyControlTest(
      tId, falKey, pngDataUri, pngBuffer, promptSummary,
      payloadApproxSizeBytes, svgDebug.debug.checks,
    );
  }

  // ── replicate-canny-test: Replicate flux-canny-pro + PNG control image ──────
  // ── replicate-canny-dry-run: build payload only, do NOT call Replicate ──────
  if (mode === "replicate-canny-dry-run") {
    const replicateKey = process.env.REPLICATE_API_TOKEN;
    const replicateInput = {
      prompt:
        "Professional event photography, photorealistic studio render. " +
        "Single tall cream-white arch backdrop, 100cm wide by 200cm tall (medium size: 100 x 200 cm), narrow and portrait-oriented. " +
        "One slim freestanding white cylindrical display plinth on the open left side, " +
        "clearly visible from base to top, tall and narrow, not a podium or cake stand. " +
        "Organic half balloon garland on the right side only, reaching from the top corner continuously down to the floor. " +
        "Frozen theme palette: icy blue, pale blue, white, and metallic silver latex balloons. " +
        "Luxury minimalist indoor event studio. Soft natural light from the left. " +
        "No text on backdrop. No people. No cake. No table. No stage. No podium. No floor balloons on the open side.",
      control_image: pngDataUri ?? "(not available — PNG conversion failed)",
      seed:          42424242,
      steps:         35,
      guidance:      25,
      output_format: "jpg",
    };
    const dryRunPayloadBytes = Buffer.byteLength(JSON.stringify({ input: replicateInput }), "utf8");

    return NextResponse.json({
      ok:                    true,
      mode:                  "replicate-canny-dry-run",
      testId:                tId,
      modelId:               REPLICATE_MODEL_ID,
      predictUrl:            REPLICATE_PREDICT_URL,
      hasReplicateKey:       !!replicateKey,
      controlImageMime:      pngBuffer ? "image/png" : null,
      controlImageSizeBytes: pngBuffer?.length ?? null,
      payloadApproxSizeBytes: dryRunPayloadBytes,
      inputKeys:             Object.keys(replicateInput),
      promptPreview:         replicateInput.prompt.slice(0, 120) + "…",
      controlImagePrefix:    typeof replicateInput.control_image === "string"
        ? replicateInput.control_image.slice(0, 40)
        : null,
      guideVersion:          "v4-minimal-edge-map",
      guideChanges:          [
        "pure white background — no fills, no color signals, edge map only",
        "arch: open-bottom outline only, no fill, no base line, no panel thickness",
        "plinth: two faint vertical lines + prominent top ellipse + faint bottom ellipse, no fill",
        "garland: individual overlapping circles with organic jitter, no filled blob slab",
        "all shapes: edge strokes only, no solid fills that create slab signals",
      ],
      replicateSettings: { seed: 42424242, steps: 35, guidance: 18, output_format: "jpg" },
      note:                  "Dry-run only — no Replicate call was made.",
    });
  }

  // ── fal-layout-reference-dry-run: build payload, do NOT call fal ────────────
  if (mode === "fal-layout-reference-dry-run") {
    const falKey         = process.env.FAL_KEY;
    const refPrompt      = buildLayoutRefPrompt(resolvedPlinthDims);
    const refPayload     = buildLayoutRefInput(pngDataUri ?? "", computedSize, refPrompt);
    const dryRunBytes    = Buffer.byteLength(JSON.stringify({ input: refPayload }), "utf8");

    return NextResponse.json({
      ok:                     true,
      mode:                   "fal-layout-reference-dry-run",
      testId:                 tId,
      modelId:                LAYOUT_REF_MODEL_ID,
      hasFalKey:              !!falKey,
      referenceImageMime:     pngBuffer ? "image/png" : null,
      referenceImageSizeBytes: pngBuffer?.length ?? null,
      payloadApproxSizeBytes: dryRunBytes,
      promptPreview:          refPrompt.slice(0, 120) + "…",
      referenceImagePrefix:   (pngDataUri ?? "").slice(0, 80),
      inputKeys:              Object.keys(refPayload),
      selectedPlinthSize:     firstPlinthSize ?? null,
      resolvedPlinthHeightCm:   resolvedPlinthDims?.heightCm ?? null,
      resolvedPlinthDiameterCm: resolvedPlinthDims?.diameterCm ?? null,
      referenceVersion:       "clean-layout-reference-v3-exact-plinth-sizes",
      note:                   "Dry-run only — no fal call was made.",
    });
  }

  // ── fal-layout-reference-test: fal-ai/flux-2-pro/edit with layout PNG ref ──
  if (mode === "fal-layout-reference-test") {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({
        ok: false, mode: "fal-layout-reference-test", testId: tId,
        modelId: LAYOUT_REF_MODEL_ID, requestId: null,
        imageUrl: null, error: "FAL_KEY not configured", latencyMs: null,
        hasFalKey: false,
        referenceImageMime: pngBuffer ? "image/png" : null,
        referenceImageSizeBytes: pngBuffer?.length ?? null,
        payloadApproxSizeBytes,
      }, { status: 500 });
    }
    if (!pngDataUri || !pngBuffer) {
      return NextResponse.json({
        ok: false, mode: "fal-layout-reference-test", testId: tId,
        modelId: LAYOUT_REF_MODEL_ID, requestId: null,
        imageUrl: null, error: `PNG required. ${pngError ?? "sharp not available."}`,
        latencyMs: null, hasFalKey: true,
        referenceImageMime: null, referenceImageSizeBytes: null,
        payloadApproxSizeBytes,
      }, { status: 500 });
    }
    try {
      return await handleFalLayoutReferenceTest(
        tId, falKey, pngDataUri, pngBuffer, computedSize,
        payloadApproxSizeBytes, svgDebug.debug.checks, resolvedPlinthDims,
      );
    } catch (fatal) {
      const fe = fatal as Record<string, unknown>;
      console.error("[structure-test-fal-layout-ref] fatal:", String(fatal));
      return NextResponse.json({
        ok: false, mode: "fal-layout-reference-test", testId: tId,
        modelId: LAYOUT_REF_MODEL_ID, requestId: null,
        imageUrl: null, error: `fatal: ${String(fatal)}`,
        errorName: String(fe["name"] ?? "unknown"),
        errorMessage: String(fe["message"] ?? String(fatal)),
        latencyMs: null, hasFalKey: true,
        referenceImageMime: "image/png",
        referenceImageSizeBytes: pngBuffer.length,
        payloadApproxSizeBytes,
      });
    }
  }

  if (mode === "replicate-canny-test") {
    const replicateKey = process.env.REPLICATE_API_TOKEN;
    if (!replicateKey) {
      return NextResponse.json({
        ok: false, mode: "replicate-canny-test", testId: tId,
        modelId: REPLICATE_MODEL_ID, predictionId: null,
        imageUrl: null, error: "REPLICATE_API_TOKEN missing",
        latencyMs: null, hasReplicateKey: false,
        controlImageMime: pngBuffer ? "image/png" : null,
        controlImageSizeBytes: pngBuffer?.length ?? null,
        payloadApproxSizeBytes,
      }, { status: 500 });
    }
    if (!pngDataUri || !pngBuffer) {
      return NextResponse.json({
        ok: false, mode: "replicate-canny-test", testId: tId,
        modelId: REPLICATE_MODEL_ID, predictionId: null,
        imageUrl: null, error: `PNG required. ${pngError ?? "sharp not available."}`,
        latencyMs: null, hasReplicateKey: true,
        controlImageMime: null, controlImageSizeBytes: null,
        payloadApproxSizeBytes,
      }, { status: 500 });
    }
    try {
      return await handleReplicateCannyTest(
        tId, replicateKey, pngDataUri, pngBuffer,
        payloadApproxSizeBytes, svgDebug.debug.checks,
      );
    } catch (fatal) {
      const fe = fatal as Record<string, unknown>;
      console.error("[structure-test-replicate-canny] fatal (call site):", String(fatal));
      return NextResponse.json({
        ok: false, mode: "replicate-canny-test", testId: tId,
        modelId: REPLICATE_MODEL_ID, predictionId: null,
        imageUrl: null,
        error:            `fatal: ${String(fatal)}`,
        errorName:        String(fe["name"]    ?? "unknown"),
        errorMessage:     String(fe["message"] ?? String(fatal)),
        errorStackFirstLines: typeof fe["stack"] === "string"
          ? fe["stack"].split("\n").slice(0, 3).join(" | ")
          : null,
        hasReplicateKey:       true,
        controlImageMime:      "image/png",
        controlImageSizeBytes: pngBuffer.length,
        payloadApproxSizeBytes,
        latencyMs: null,
      });
    }
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

  } catch (topLevelErr) {
    // Last-resort catch — returns HTTP 200 with diagnostic JSON, never 500.
    const e = topLevelErr as Record<string, unknown>;
    console.error("[structure-test-route] top-level fatal:", String(topLevelErr));
    return NextResponse.json({
      ok:                  false,
      mode:                "unknown",
      error:               `top-level fatal: ${String(topLevelErr)}`,
      errorName:           String(e["name"]    ?? "unknown"),
      errorMessage:        String(e["message"] ?? String(topLevelErr)),
      errorStackFirstLines: typeof e["stack"] === "string"
        ? e["stack"].split("\n").slice(0, 3).join(" | ")
        : null,
    });
  }
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

// ── EasyControl Canny handler ─────────────────────────────────────────────────
// Uses fal-ai/flux-general with easycontrols[].control_method_url: "canny"
// Verified schema: https://fal.ai/models/fal-ai/flux-general/api
async function handleFalEasyControlTest(
  tId: string,
  falKey: string,
  controlDataUri: string,
  pngBuffer: Buffer,
  promptSummary: string,
  payloadApproxSizeBytes: number,
  svgChecks: Record<string, unknown>,
): Promise<NextResponse> {
  const controlImageMime      = "image/png";
  const controlImageSizeBytes = pngBuffer.length;
  const maxWaitMs             = 120_000;

  fal.config({ credentials: falKey });

  const queueStatusHistory: string[] = [];
  const t0                           = Date.now();
  const abortController              = new AbortController();
  const timeoutHandle                = setTimeout(() => abortController.abort(), maxWaitMs);

  let requestId: string | null  = null;
  let imageUrl: string | null   = null;
  let queueError: string | null = null;
  let rawData: unknown          = null;

  console.log("[structure-test-easycontrol] start — model:", EASYCONTROL_MODEL_ID);
  console.log("[structure-test-easycontrol] controlImageSizeBytes:", controlImageSizeBytes);
  console.log("[structure-test-easycontrol] payloadApproxSizeBytes:", payloadApproxSizeBytes);
  console.log("[structure-test-easycontrol] maxWaitMs:", maxWaitMs, "hasFalKey:", !!falKey);

  try {
    // easycontrols is not in the SDK's generated EndpointTypeMap for flux-general,
    // so we cast input to Record<string,unknown> to avoid strict type rejection.
    // This cast is scoped to this experimental function only.
    const easyControlInput: Record<string, unknown> = {
      prompt:              promptSummary,
      image_size:          "portrait_16_9",
      num_inference_steps: 28,
      guidance_scale:      3.5,
      seed:                TEST_SEED,
      num_images:          1,
      output_format:       "jpeg",
      easycontrols: [
        {
          control_method_url:  "canny",
          image_url:           controlDataUri,
          image_control_type:  "spatial",
          scale:               0.80,
        },
      ],
    };

    const falResult = await fal.subscribe(EASYCONTROL_MODEL_ID, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: easyControlInput as any,
      logs:        true,
      abortSignal: abortController.signal,
      onQueueUpdate: (status) => {
        const ts  = new Date().toISOString();
        const pos = status.status === "IN_QUEUE" ? ` queue_pos=${status.queue_position}` : "";
        const entry = `[${ts}] ${status.status}${pos}`;
        queueStatusHistory.push(entry);
        console.log("[structure-test-easycontrol]", entry);
        if (!requestId && status.request_id) {
          requestId = status.request_id;
          console.log("[structure-test-easycontrol] requestId:", requestId);
        }
      },
    });

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
      console.warn("[structure-test-easycontrol] no imageUrl. response keys:", Object.keys(d ?? {}));
    } else {
      console.log("[structure-test-easycontrol] imageUrl:", imageUrl);
    }
  } catch (err) {
    const isTimeout = abortController.signal.aborted;
    queueError      = isTimeout
      ? `fal easycontrol timed out after ${maxWaitMs / 1000}s`
      : String(err);
    console.error("[structure-test-easycontrol] error:", queueError);
  } finally {
    clearTimeout(timeoutHandle);
  }

  const latencyMs = Date.now() - t0;
  console.log("[structure-test-easycontrol] done. latencyMs:", latencyMs, "imageUrl:", imageUrl ?? "null");

  const d               = rawData as Record<string, unknown> | null;
  const falResponseKeys = d ? Object.keys(d) : [];
  const imagesArr       = Array.isArray(d?.["images"]) ? (d!["images"] as unknown[]) : null;
  const firstImage      = imagesArr?.[0] as Record<string, unknown> | undefined;
  const falFirstImageKeys = firstImage ? Object.keys(firstImage) : [];

  return NextResponse.json({
    ok:                     imageUrl !== null,
    mode:                   "fal-easycontrol-test",
    testId:                 tId,
    modelId:                EASYCONTROL_MODEL_ID,
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
    falFirstImageKeys,
  });
}

// ── Replicate Canny handler ───────────────────────────────────────────────────
// Uses Replicate black-forest-labs/flux-canny-pro with PNG data URI control image.
// Sends Prefer: wait=60 for a synchronous first response, then polls up to 120s total.
function extractReplicateImageUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output) && typeof output[0] === "string" && (output[0] as string).startsWith("http")) return output[0] as string;
  return null;
}

async function handleReplicateCannyTest(
  tId: string,
  replicateKey: string,
  controlDataUri: string,
  pngBuffer: Buffer,
  payloadApproxSizeBytes: number,
  svgChecks: Record<string, unknown>,
): Promise<NextResponse> {
  const controlImageMime      = "image/png";
  const controlImageSizeBytes = pngBuffer.length;
  const maxWaitMs             = 120_000;
  const t0                    = Date.now();

  const prompt =
    "Wide full-body professional event photography, entire setup fully visible, nothing cropped. " +
    "Premium indoor children's birthday event, luxury minimalist studio with soft warm directional lighting. " +
    "Single tall narrow cream-white rounded arch backdrop, seamless smooth matte surface standing freely, " +
    "no visible outline or border on the arch, no black edge, no rectangular wall shape, no extra side panel, no extra slab. " +
    "One slim freestanding white cylindrical display column on the open left side, " +
    "fully visible from polished floor to rounded top, top circular, height much greater than diameter, " +
    "not a box, not a flat block, not a podium, not a cake stand, not a stage base. " +
    "Organic half balloon garland made of individual round latex balloons on the right side only, " +
    "in front of the arch, fully visible within frame, cascading from top-right corner down the right side to the floor. " +
    "Frozen theme palette: icy blue, pale blue, white, metallic silver latex balloons. " +
    "No base platform. No stage. No podium. No floor riser. No rectangular plinth. No extra side wall or slab. " +
    "No text. No people. No cake. No table.";

  const input = {
    prompt,
    control_image: controlDataUri,
    seed:          42424242,
    steps:         35,
    guidance:      18,
    output_format: "jpg",
  };

  console.log("[structure-test-replicate-canny] start — model:", REPLICATE_MODEL_ID);
  console.log("[structure-test-replicate-canny] controlImageSizeBytes:", controlImageSizeBytes);
  console.log("[structure-test-replicate-canny] payloadApproxSizeBytes:", payloadApproxSizeBytes);
  console.log("[structure-test-replicate-canny] hasReplicateKey: true");

  let predictionId: string | null   = null;
  let finalStatus:  string | null   = null;
  let rawOutput:    unknown         = null;
  let replicateError: string | null = null;
  let rawResponseKeys: string[]     = [];
  let replicateStatus: number | null    = null;
  let replicateStatusText: string | null = null;
  let replicateErrorBody: string | null  = null;

  // Outer guard — ensures handleReplicateCannyTest never propagates an uncaught rejection
  try {

  try {
    // Step 1: create prediction — Prefer: wait=60 (safe Replicate synchronous limit)
    console.log("[structure-test-replicate-canny] predictUrl:", REPLICATE_PREDICT_URL);
    const createRes  = await fetch(REPLICATE_PREDICT_URL, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${replicateKey}`,
        "Content-Type":  "application/json",
        "Prefer":        "wait=60",
      },
      body:   JSON.stringify({ input }),
      signal: AbortSignal.timeout(65_000),
    });

    const createBody = await createRes.json() as Record<string, unknown>;
    rawResponseKeys  = Object.keys(createBody);
    predictionId     = createBody["id"]     as string | null ?? null;
    finalStatus      = createBody["status"] as string | null ?? null;
    rawOutput        = createBody["output"] ?? null;

    console.log("[structure-test-replicate-canny] create HTTP:", createRes.status, "prediction status:", finalStatus);

    if (!createRes.ok) {
      replicateStatus     = createRes.status;
      replicateStatusText = createRes.statusText;
      replicateErrorBody  = JSON.stringify(createBody).slice(0, 500);
      replicateError = `Replicate API ${createRes.status} ${createRes.statusText}`;
      console.error("[structure-test-replicate-canny] create failed:", replicateStatus, replicateErrorBody);

    } else if (finalStatus === "succeeded") {
      console.log("[structure-test-replicate-canny] succeeded immediately. imageUrl:", extractReplicateImageUrl(rawOutput) ?? "null");

    } else if (finalStatus === "failed" || finalStatus === "canceled") {
      replicateError = `prediction ${finalStatus}: ${String(createBody["error"] ?? "unknown")}`;
      console.error("[structure-test-replicate-canny] terminal:", replicateError);

    } else if (predictionId) {
      // Step 2: poll until terminal or 120s total timeout
      console.log("[structure-test-replicate-canny] polling predictionId:", predictionId, "current status:", finalStatus);
      while (true) {
        const elapsed = Date.now() - t0;
        if (elapsed >= maxWaitMs) {
          replicateError = `timed out after ${maxWaitMs / 1000}s (last status: ${finalStatus})`;
          console.warn("[structure-test-replicate-canny] timeout. elapsed:", elapsed);
          break;
        }
        await new Promise<void>((r) => setTimeout(r, 2500));

        const pollRes  = await fetch(
          `https://api.replicate.com/v1/predictions/${predictionId}`,
          { headers: { "Authorization": `Bearer ${replicateKey}` }, signal: AbortSignal.timeout(10_000) },
        );
        const pollBody = await pollRes.json() as Record<string, unknown>;
        finalStatus    = pollBody["status"] as string | null ?? finalStatus;
        rawOutput      = pollBody["output"] ?? rawOutput;

        console.log("[structure-test-replicate-canny] poll status:", finalStatus, "elapsed:", Date.now() - t0, "ms");

        if (finalStatus === "succeeded") {
          console.log("[structure-test-replicate-canny] succeeded. imageUrl:", extractReplicateImageUrl(rawOutput) ?? "null");
          break;
        } else if (finalStatus === "failed" || finalStatus === "canceled") {
          replicateError = `prediction ${finalStatus}: ${String(pollBody["error"] ?? "unknown")}`;
          console.error("[structure-test-replicate-canny] terminal:", replicateError);
          break;
        }
      }
    }
  } catch (innerErr) {
    replicateError = String(innerErr);
    console.error("[structure-test-replicate-canny] error:", replicateError);
  }

  // Outer catch — captures any exception that escaped the inner block
  } catch (fatal) {
    const fe = fatal as Record<string, unknown>;
    const latencyMsFatal = Date.now() - t0;
    console.error("[structure-test-replicate-canny] fatal:", String(fatal));
    return NextResponse.json({
      ok:                    false,
      mode:                  "replicate-canny-test",
      testId:                tId,
      modelId:               REPLICATE_MODEL_ID,
      predictionId,
      imageUrl:              null,
      error:                 `fatal: ${String(fatal)}`,
      errorName:             String(fe["name"]    ?? "unknown"),
      errorMessage:          String(fe["message"] ?? String(fatal)),
      errorStackFirstLines:  typeof fe["stack"] === "string"
        ? fe["stack"].split("\n").slice(0, 3).join(" | ")
        : null,
      latencyMs:             latencyMsFatal,
      hasReplicateKey:       true,
      controlImageMime,
      controlImageSizeBytes,
      payloadApproxSizeBytes,
      replicateResponseKeys: rawResponseKeys,
      replicateOutputType:   "unknown",
      svgChecks,
    });
  }

  const imageUrl            = extractReplicateImageUrl(rawOutput);
  const latencyMs           = Date.now() - t0;
  const replicateOutputType = rawOutput === null ? "null" : Array.isArray(rawOutput) ? "array" : typeof rawOutput;

  if (!imageUrl && !replicateError && finalStatus === "succeeded") {
    replicateError = "prediction succeeded but no image URL found in output";
    console.warn("[structure-test-replicate-canny] no imageUrl. raw output:", JSON.stringify(rawOutput).slice(0, 200));
  }

  console.log("[structure-test-replicate-canny] done. latencyMs:", latencyMs, "imageUrl:", imageUrl ?? "null");

  return NextResponse.json({
    ok:                    imageUrl !== null,
    mode:                  "replicate-canny-test",
    testId:                tId,
    modelId:               REPLICATE_MODEL_ID,
    predictionId,
    status:                finalStatus,
    imageUrl,
    output:                rawOutput,
    error:                 replicateError,
    errorName:             null,
    errorMessage:          null,
    errorStackFirstLines:  null,
    latencyMs,
    controlImageMime,
    controlImageSizeBytes,
    payloadApproxSizeBytes,
    hasReplicateKey:       true,
    replicateStatus,
    replicateStatusText,
    replicateErrorBody,
    replicateResponseKeys: rawResponseKeys,
    replicateOutputType,
    svgChecks,
  });
}

// ── fal-layout-reference helpers ─────────────────────────────────────────────

interface PlinthDims { heightCm: number; diameterCm: number; }

function buildLayoutRefPrompt(plinthDims?: PlinthDims | null): string {
  const plinthDesc = plinthDims
    ? `one slim freestanding white cylindrical plinth, ${plinthDims.heightCm}cm tall and ${plinthDims.diameterCm}cm diameter`
    : "one slim freestanding white cylindrical plinth";
  return (
    "Transform this clean layout reference into a premium photorealistic indoor children's birthday event setup. " +
    "Wide full-body event photography shot — camera pulled back so the entire setup has breathing room on all sides. " +
    "Arch fully visible from base to the very top, with clear space above and around it. " +
    "Preserve the tall rounded-arch proportions and its exact position. " +
    `Plinth is ${plinthDesc} on the open left side, ` +
    "slightly smaller in the scene and positioned closer to the backdrop rather than oversized in the foreground, " +
    "fully visible from polished floor to rounded top, height clearly greater than diameter. " +
    "Right-side organic half balloon garland remains dense and premium — full volume, " +
    "individual latex balloons cascading from the top corner down to the floor. " +
    "Full setup clearly visible with breathing room, nothing cropped. " +
    "Frozen palette: icy blue, white, pearl and metallic silver latex balloons. " +
    "Luxury indoor event photography, soft natural studio lighting, polished reflective floor, " +
    "cream-white matte seamless arch backdrop. " +
    "No text on backdrop. No people. No cake. No table. No stage. No podium. No base platform. " +
    "No extra side panel. No extra wall. No rectangular box plinth. No black outline around arch. " +
    "No low podium. No cake stand. No floor riser."
  );
}

function buildLayoutRefInput(
  pngDataUri: string,
  imageSize: string,
  prompt: string,
): Record<string, unknown> {
  return {
    prompt,
    image_urls:     [pngDataUri],
    image_size:     imageSize,
    seed:           42424242,
    output_format:  "jpeg",
  };
}

async function handleFalLayoutReferenceTest(
  tId: string,
  falKey: string,
  pngDataUri: string,
  pngBuffer: Buffer,
  computedSize: string,
  payloadApproxSizeBytes: number,
  svgChecks: Record<string, unknown>,
  plinthDims?: PlinthDims | null,
): Promise<NextResponse> {
  const referenceImageMime      = "image/png";
  const referenceImageSizeBytes = pngBuffer.length;
  const maxWaitMs               = 120_000;
  const refPrompt               = buildLayoutRefPrompt(plinthDims);
  const promptPreview           = refPrompt.slice(0, 120) + "…";

  fal.config({ credentials: falKey });

  const queueStatusHistory: string[] = [];
  const t0                           = Date.now();
  const abortController              = new AbortController();
  const timeoutHandle                = setTimeout(() => abortController.abort(), maxWaitMs);

  let requestId: string | null  = null;
  let imageUrl:  string | null  = null;
  let queueError: string | null = null;
  let rawData:   unknown        = null;

  console.log("[structure-test-fal-layout-ref] start — model:", LAYOUT_REF_MODEL_ID);
  console.log("[structure-test-fal-layout-ref] referenceImageSizeBytes:", referenceImageSizeBytes);
  console.log("[structure-test-fal-layout-ref] payloadApproxSizeBytes:", payloadApproxSizeBytes);
  console.log("[structure-test-fal-layout-ref] imageSize:", computedSize);

  try {
    const refInput = buildLayoutRefInput(pngDataUri, computedSize, refPrompt);

    const falResult = await fal.subscribe(LAYOUT_REF_MODEL_ID, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: refInput as any,
      logs:  true,
      abortSignal: abortController.signal,
      onQueueUpdate: (status) => {
        const ts    = new Date().toISOString();
        const pos   = status.status === "IN_QUEUE" ? ` queue_pos=${status.queue_position}` : "";
        const entry = `[${ts}] ${status.status}${pos}`;
        queueStatusHistory.push(entry);
        console.log("[structure-test-fal-layout-ref]", entry);
        if (!requestId && status.request_id) {
          requestId = status.request_id;
          console.log("[structure-test-fal-layout-ref] requestId:", requestId);
        }
      },
    });

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
      console.warn("[structure-test-fal-layout-ref] no imageUrl. response keys:", Object.keys(d ?? {}));
    } else {
      console.log("[structure-test-fal-layout-ref] imageUrl:", imageUrl);
    }
  } catch (err) {
    const isTimeout = abortController.signal.aborted;
    queueError = isTimeout
      ? `fal layout-ref timed out after ${maxWaitMs / 1000}s`
      : String(err);
    console.error("[structure-test-fal-layout-ref] error:", queueError);
  } finally {
    clearTimeout(timeoutHandle);
  }

  const latencyMs = Date.now() - t0;
  console.log("[structure-test-fal-layout-ref] done. latencyMs:", latencyMs, "imageUrl:", imageUrl ?? "null");

  const d               = rawData as Record<string, unknown> | null;
  const falResponseKeys = d ? Object.keys(d) : [];
  const imagesArr       = Array.isArray(d?.["images"]) ? (d!["images"] as unknown[]) : null;
  const firstImage      = imagesArr?.[0] as Record<string, unknown> | undefined;
  const falFirstImageKeys = firstImage ? Object.keys(firstImage) : [];

  return NextResponse.json({
    ok:                      imageUrl !== null,
    mode:                    "fal-layout-reference-test",
    testId:                  tId,
    modelId:                 LAYOUT_REF_MODEL_ID,
    requestId,
    imageUrl,
    error:                   queueError,
    latencyMs,
    queueStatusHistory,
    referenceImageMime,
    referenceImageSizeBytes,
    payloadApproxSizeBytes,
    hasFalKey:               true,
    promptPreview,
    referenceVersion:        "clean-layout-reference-v3-exact-plinth-sizes",
    svgChecks,
    falResponseKeys,
    falImagesCount:          imagesArr?.length ?? 0,
    falFirstImageKeys,
  });
}
