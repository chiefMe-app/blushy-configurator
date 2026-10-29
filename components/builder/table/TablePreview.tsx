// The left-hand preview during the table part of Decor (2026-10-27): live
// drawings of every choice. 2026-10-29 (owner): first comes the top view of
// the table, stacked from photos of each piece (TablePlace), which follows
// every change at once; on a phone, where the preview sits under the choices,
// each change brings it into view ("her değişimden sonra mobilde bu view'a
// otomatik yönlendir"), with a way back to the choices. Later that day: no
// render at this step ("bu aşamada render seçeneği olmasın") — one combined
// render of the backdrop and the table comes at the end instead.
import { useEffect, useRef, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { tableCounts, type TableSetup } from "@/lib/studio/tableSetup";
import { tableRenderKey } from "@/lib/studio/tableRender";
import TableSketch from "@/components/studio/table/TableSketch";
import TablePerspective from "@/components/studio/table/TablePerspective";
import TablePlace from "@/components/studio/table/TablePlace";

type View = "place" | "perspective" | "top";
/** The builder's phone layout (app/blushy.css): the preview comes after the choices. */
const PHONE = "(max-width: 860px)";
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

  // On a phone, every change brings the top view into sight (typing: once the
  // field is left), and "Back to your choices" returns to where the change was made.
  const [backTo, setBackTo] = useState<number | null>(null);
  const changeKey = table?.enabled ? tableRenderKey(table, config.theme) : "";
  const lastKey = useRef(changeKey);
  useEffect(() => {
    // Not when the table is first added (the customer is about to choose), only on a change to it.
    const before = lastKey.current;
    lastKey.current = changeKey;
    if (!changeKey || !before || changeKey === before || typeof window === "undefined" || !window.matchMedia?.(PHONE).matches) return;
    const jump = () => {
      const card = document.getElementById("table-preview-card");
      if (!card) return;
      setView("place");
      setBackTo((b) => b ?? window.scrollY);
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const field = document.activeElement;
    if (field instanceof HTMLInputElement && field.type === "text") {
      // Words: once the customer leaves the field (or presses Enter), not on every letter.
      const left = (e: Event) => { if (e.type === "focusout" || (e as KeyboardEvent).key === "Enter") { stop(); jump(); } };
      const stop = () => { document.removeEventListener("focusout", left, true); document.removeEventListener("keydown", left, true); };
      document.addEventListener("focusout", left, true);
      document.addEventListener("keydown", left, true);
      return stop;
    }
    const t = setTimeout(jump, 350);
    return () => clearTimeout(t);
  }, [changeKey]);

  const tab = (v: View, name: string) => <button type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{name}</button>;
  return (
    <div className="bz-tb-preview" id="table-preview-card">
      <div className="head">
        <span className="title">✦ Your kids&apos; table</span>
        <div className="views" role="tablist" aria-label="Table view">
          {tab("place", "Top view")}
          {tab("top", "Whole table")}
          {tab("perspective", "Perspective")}
        </div>
      </div>
      {!table?.enabled ? (
        <div className="empty">Add a kids&apos; table to see it here.</div>
      ) : (
        <>
          <div className="bz-tb-wait">
            {view === "place" ? <TablePlace table={table} theme={theme} className="bz-tb-place" />
              : view === "top" ? <TableSketch table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />
              : <TablePerspective table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />}
          </div>
          <p className="note">
            {view === "place" ? <>Two places from above, made from photos of each piece — your colours and words show straight away.</>
              : view === "top" ? <>From above, to scale · {tableCounts(table).tables} table{tableCounts(table).tables > 1 ? "s" : ""} · {table.kids} kids — a drawing, not a photo.</>
                : <>From the front · {table.kids} kids — a drawing, not a photo.</>}
          </p>
          {backTo !== null && (
            <button type="button" className="bz-tb-back" data-testid="table-back-to-choices"
              onClick={() => { window.scrollTo({ top: backTo, behavior: "smooth" }); setBackTo(null); }}>↑ Back to your choices</button>
          )}
        </>
      )}
    </div>
  );
}
