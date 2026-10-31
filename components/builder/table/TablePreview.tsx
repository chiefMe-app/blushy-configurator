// The left-hand preview during the table part of Decor (2026-10-27): live
// drawings of every choice. 2026-10-29 (owner): first comes the top view of
// the table, stacked from photos of each piece (TablePlace), which follows
// every change at once; on a phone, where the preview sits under the choices,
// each change brings it into view ("her değişimden sonra mobilde bu view'a
// otomatik yönlendir"), with a way back to the choices. Later that day: no
// render at this step ("bu aşamada render seçeneği olmasın") — one combined
// render of the backdrop and the table comes at the end instead.
import { useRef, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { tableCounts, type TableSetup } from "@/lib/studio/tableSetup";
import { tableRenderKey } from "@/lib/studio/tableRender";
import TableSketch from "@/components/studio/table/TableSketch";
import TablePerspective from "@/components/studio/table/TablePerspective";
import TablePlace from "@/components/studio/table/TablePlace";
import { usePhoneJump } from "@/components/builder/usePhoneJump";

// 2026-10-31 (owner): one place first, then six places, a part of the table.
type View = "place" | "six" | "perspective" | "top";
/** How a table render asked for in this visit is going (kept for the builder's notes). */
export type TableRenderJob = "loading" | "ready" | "error";

export default function TablePreview({ config }: {
  config: BuilderConfig;
  setTable?: (t: TableSetup) => void;
  onSignInNeeded?: () => void;
  startNow?: boolean;
  onStarted?: () => void;
  onJob?: (job: TableRenderJob) => void;
}) {
  const [view, setView] = useState<View>("place");
  const theme = themeById(config.theme) ?? THEMES[0];
  const table = config.table;

  // On a phone, every change brings the top view into sight; a view the
  // customer picked after the change is left alone.
  const pickedAt = useRef(0);
  const changeKey = table?.enabled ? tableRenderKey(table, config.theme) : "";
  const { backTo, back } = usePhoneJump(changeKey, "table-preview-card", (changedAt) => { if (pickedAt.current < changedAt) setView("place"); });

  const tab = (v: View, name: string) => <button type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => { pickedAt.current = performance.now(); setView(v); }}>{name}</button>;
  return (
    <div className="bz-tb-preview" id="table-preview-card">
      <div className="head">
        <span className="title">✦ Your kids&apos; table</span>
        <div className="views" role="tablist" aria-label="Table view">
          {tab("place", "One place")}
          {tab("six", "Six places")}
          {tab("top", "Whole table")}
          {tab("perspective", "Perspective")}
        </div>
      </div>
      {!table?.enabled ? (
        <div className="empty">Add a kids&apos; table to see it here.</div>
      ) : (
        <>
          <div className="bz-tb-wait">
            {view === "place" || view === "six" ? <TablePlace table={table} theme={theme} mode={view === "six" ? "six" : "one"} className="bz-tb-place" />
              : view === "top" ? <TableSketch table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />
              : <TablePerspective table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />}
          </div>
          <p className="note">
            {view === "place" ? <>One place from above, made from photos of each piece — your colours and words show straight away.</>
              : view === "six" ? <>Six places, a part of the table, from above.</>
              : view === "top" ? <>From above, to scale · {tableCounts(table).tables} table{tableCounts(table).tables > 1 ? "s" : ""} · {table.kids} kids — a drawing, not a photo.</>
                : <>From the front · {table.kids} kids — a drawing, not a photo.</>}
          </p>
          {backTo !== null && (
            <button type="button" className="bz-tb-back" data-testid="table-back-to-choices"
              onClick={back}>↑ Back to your choices</button>
          )}
        </>
      )}
    </div>
  );
}
