// The party's finished designs, one by one (2026-11-02, the owner: "biyerde finalize olmuş table setup
// dizaynı, backdrop vs tek tek çıkmalı. Jpeg şeklinde"): which pieces there are to show and save — a piece
// the customer skipped isn't one. Pure; the pictures are made in components/builder/FinishedDesigns.tsx.
import type { BuilderConfig } from "./config";

export type FinishedPieceId = "backdrop" | "kids" | "adults" | "welcome" | "giveaways" | "pinata";
export interface FinishedPiece {
  id: FinishedPieceId;
  title: string;
  /** The JPEG's file name. */
  file: string;
  /** The customer pressed Finish on it (the backdrop is finished once she moves on from it). */
  finished: boolean;
}

export function finishedPieces(config: Pick<BuilderConfig, "decor" | "table" | "adultTable" | "welcomeBoard" | "giveaways" | "pinata">): FinishedPiece[] {
  const out: FinishedPiece[] = [];
  if (config.decor.backdropChoice !== "skip" && config.decor.backdropItems.length > 0)
    out.push({ id: "backdrop", title: "Backdrop", file: "partymuse-backdrop.jpg", finished: true });
  if (config.table?.enabled) out.push({ id: "kids", title: "Kids' table", file: "partymuse-kids-table.jpg", finished: !!config.table.done });
  if (config.adultTable?.enabled) out.push({ id: "adults", title: "Grown-ups' table", file: "partymuse-grown-ups-table.jpg", finished: !!config.adultTable.done });
  if (config.welcomeBoard?.enabled) out.push({ id: "welcome", title: "Welcome board", file: "partymuse-welcome-board.jpg", finished: !!config.welcomeBoard.done });
  if (config.giveaways?.enabled) out.push({ id: "giveaways", title: "Giveaways", file: "partymuse-giveaways.jpg", finished: !!config.giveaways.done });
  if (config.pinata?.enabled) out.push({ id: "pinata", title: "Piñata", file: "partymuse-pinata.jpg", finished: !!config.pinata.done });
  return out;
}

/** How wide the JPEGs are, in pixels. */
export const JPEG_WIDTH = 1600;
