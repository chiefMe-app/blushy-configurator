// The left-hand preview during the table part of Decor (2026-10-27, F2): the
// to-scale top view of every choice. The perspective view (an AI render of the
// table, F3) joins it as a second tab.
import { useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { tableCounts } from "@/lib/studio/tableSetup";
import TableSketch from "@/components/studio/table/TableSketch";

export default function TablePreview({ config }: { config: BuilderConfig }) {
  const [view, setView] = useState<"top" | "perspective">("top");
  const theme = themeById(config.theme) ?? THEMES[0];
  const table = config.table;
  return (
    <div className="bz-tb-preview" id="party-preview-card">
      <div className="head">
        <span className="title">✦ Your kids&apos; table</span>
        <div className="views" role="tablist" aria-label="Table view">
          <button type="button" role="tab" aria-selected={view === "top"} className={view === "top" ? "on" : ""} onClick={() => setView("top")}>Top view</button>
          <button type="button" role="tab" aria-selected={view === "perspective"} className={view === "perspective" ? "on" : ""} onClick={() => setView("perspective")}>Perspective</button>
        </div>
      </div>
      {!table?.enabled ? (
        <div className="empty">Add a kids&apos; table to see it here.</div>
      ) : view === "top" ? (
        <>
          <TableSketch table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />
          <p className="note">From above, to scale · {tableCounts(table).tables} table{tableCounts(table).tables > 1 ? "s" : ""} · {table.kids} kids — a sketch, not a photo.</p>
        </>
      ) : (
        <div className="empty" data-testid="table-perspective">The perspective render of your table — with every piece you chose — is coming next.</div>
      )}
    </div>
  );
}
