// A free sample Design Pack (Phase 1.3): a fixed demo design (lib/pack/sampleDesign.json,
// the Frozen Single Round with "Happy Birthday" / "Arya"), its example photo as
// the visual reference, SAMPLE across it, and no cut files. Built once per
// server instance and kept; anyone may download it.
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { fromDraft } from "@/lib/draft";
import { buildDesignPack } from "@/lib/pack/designPack";
import sampleDesign from "@/lib/pack/sampleDesign.json";

export const runtime = "nodejs";
export const maxDuration = 60;

let built: Promise<{ zip: Uint8Array; fileName: string }> | null = null;

async function build() {
  const restored = fromDraft(JSON.stringify(sampleDesign));
  if (!restored) throw new Error("sample design does not read back");
  const render = fs.readFileSync(path.join(process.cwd(), "public", "design", "theme-previews", "frozen", "single-round.webp"));
  const pack = await buildDesignPack({ config: restored.config, packId: "SAMPLE", render, sample: true, createdAt: new Date("2026-10-27T00:00:00Z") });
  return { zip: pack.zip, fileName: pack.fileName };
}

export async function GET() {
  built ??= build().catch((err) => { built = null; throw err; });
  try {
    const { zip, fileName } = await built;
    return new NextResponse(Buffer.from(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[packs/sample] could not build the sample pack", err);
    return NextResponse.json({ error: "The sample pack is not available right now." }, { status: 500 });
  }
}
