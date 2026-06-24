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
import type { BackdropItem, PlinthSize, BalloonStyleId } from "@/lib/config";
import { generateStructureSilhouette } from "@/lib/generateStructureSilhouette";
import { calculateExactLayout } from "@/lib/calculateExactLayout";
import { calculateRenderAspectRatio } from "@/lib/calculateRenderAspectRatio";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

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

  const { testId, backdropItems, plinthSizes, balloonStyle, balloonColors } = body;

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

  return NextResponse.json({
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
  });
}
