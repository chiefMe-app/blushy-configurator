// Server only: the layout guides for the table render (lib/studio/tableRender.ts)
// — the same live drawings the customer sees, rasterised and set on a plain
// canvas of the render's size. No <text> in them (Vercel has no fonts).
import { createElement } from "react";
// The Node build of react-dom/server: Next.js refuses the plain name in
// app-router server code (it expects pages to render as Server Components),
// but here the markup is an SVG for sharp, never a page.
import { renderToStaticMarkup } from "react-dom/server.node";
import sharp from "sharp";
import TablePerspective from "@/components/studio/table/TablePerspective";
import TableSketch from "@/components/studio/table/TableSketch";
import type { TableSetup } from "./tableSetup";
import type { TableView } from "./tableRender";

export const GUIDE_SIZE: Record<TableView, { width: number; height: number }> = {
  perspective: { width: 1280, height: 720 },
  top: { width: 1024, height: 768 },
};

const BG = { r: 251, g: 247, b: 244, alpha: 1 }; // the drawings' own background

export async function tableGuide(t: TableSetup, theme: { balloonColors: string[]; accent: string }, view: TableView): Promise<Buffer> {
  const props = { table: t, palette: theme.balloonColors, accent: theme.accent };
  const svg = renderToStaticMarkup(createElement(view === "top" ? TableSketch : TablePerspective, props))
    .replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const { width, height } = GUIDE_SIZE[view];
  const pad = Math.round(width * 0.04);
  const drawing = await sharp(Buffer.from(svg), { density: 220 })
    .resize(width - 2 * pad, height - 2 * pad, { fit: "inside" }).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: BG } })
    .composite([{ input: drawing, gravity: "center" }]).flatten({ background: BG }).png().toBuffer();
}
