// The left-hand preview during the table part of Decor (2026-10-27): live
// drawings of every choice. 2026-10-29 (owner): first comes the top view of
// the table, stacked from photos of each piece (TablePlace), which follows
// every change at once; on a phone, where the preview sits under the choices,
// each change brings it into view ("her değişimden sonra mobilde bu view'a
// otomatik yönlendir"), with a way back to the choices. Later that day: no
// render at this step ("bu aşamada render seçeneği olmasın") — one combined
// render of the backdrop and the table comes at the end instead. 2026-11-03
// (the owner: "top view render alsın sadece … render almadan o aşamaya
// geçemesin"): one render of the top view of one place, which finalizing the
// table waits for (the builder's usePieceRender, /api/table-render).
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { tableCounts } from "@/lib/studio/tableSetup";
import { tableRenderKey } from "@/lib/studio/tableRender";
import TableSketch from "@/components/studio/table/TableSketch";
import TablePerspective from "@/components/studio/table/TablePerspective";
import TablePlace from "@/components/studio/table/TablePlace";
import { usePhoneJump } from "@/components/builder/usePhoneJump";
import type { PieceRender } from "@/components/builder/usePieceRender";
import RenderAgain from "@/components/builder/RenderAgain";
import ZoomPhoto from "@/components/builder/ZoomPhoto";

// 2026-10-31 (owner): one place first, then six places, a part of the table; the render once there is one.
type View = "place" | "four" | "perspective" | "top" | "render" | "render4";
/** How a table render asked for in this visit is going (kept for the builder's notes). */
export type TableRenderJob = "loading" | "ready" | "error";

export default function TablePreview({ config, render, onGenerate, placeShot, renderFour, onGenerateFour, fourShot }: {
  config: BuilderConfig;
  render: PieceRender;
  onGenerate: () => void;
  /** Set here: shows the one place and gives back its box, for the render to be made from (2026-11-03). */
  placeShot?: MutableRefObject<(() => Promise<SVGSVGElement | null>) | null>;
  /** 2026-11-05: the four places' own photo, made from the four places as drawn. */
  renderFour?: PieceRender;
  onGenerateFour?: () => void;
  fourShot?: MutableRefObject<(() => Promise<SVGSVGElement | null>) | null>;
}) {
  const [view, setView] = useState<View>("place");
  if (fourShot) fourShot.current = async () => {
    setView("four");
    for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
    return document.querySelector<SVGSVGElement>('#table-preview-card svg[data-mode="four"]');
  };
  // Asked for here: its wait, then the photo, on its own tab (the one place's photo stays the first one shown).
  useEffect(() => { if (renderFour?.loading) setView("render4"); }, [renderFour?.loading]);
  // 2026-11-03 (the owner: "live sketchin birebir aynı açısının renderı olsun, seçimlerin aynısının"): the render
  // is made from the one place as it is drawn here, so it is shown first, then its box is handed over.
  if (placeShot) placeShot.current = async () => {
    setView("place");
    for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
    return document.querySelector<SVGSVGElement>('#table-preview-card svg[data-mode="one"]');
  };
  // A render that comes in is shown; one asked for shows its wait on the render tab.
  useEffect(() => { if (render.loading || render.url) setView("render"); }, [render.loading, render.url]);
  const theme = themeById(config.theme) ?? THEMES[0];
  const table = config.table;

  // On a phone, every change brings the top view into sight; a view the
  // customer picked after the change is left alone. Not the table or the
  // chairs (2026-11-01, owner: "table ve chair seçince preview a inmesin").
  const pickedAt = useRef(0);
  const changeKey = table?.enabled ? tableRenderKey({ ...table, choices: { ...table.choices, table: "", chairs: "" }, chairColor: "" }, config.theme) : "";
  const { backTo, back } = usePhoneJump(changeKey, "table-preview-card", (changedAt) => { if (pickedAt.current < changedAt) setView("place"); });

  // The render tab shows the render, or its wait; with neither, the place.
  const four = renderFour && (renderFour.url || renderFour.loading);
  const shown: View = view === "render" && !(render.url || render.loading) ? "place" : view === "render4" && !four ? "four" : view;
  // The photo shown, and the one the buttons below make: the four places' on their views, else the one place's.
  const onFour = shown === "four" || shown === "render4";
  const r = onFour && renderFour ? renderFour : render;
  const make = onFour && onGenerateFour ? onGenerateFour : onGenerate;
  const tab = (v: View, name: string) => <button type="button" role="tab" aria-selected={shown === v} className={shown === v ? "on" : ""} onClick={() => { pickedAt.current = performance.now(); setView(v); }}>{name}</button>;
  return (
    <div className="bz-tb-preview" id="table-preview-card">
      <div className="head">
        <span className="title">✦ Your kids&apos; table</span>
        <div className="views" role="tablist" aria-label="Table view">
          {tab("place", "One place")}
          {tab("four", "Four places")}
          {tab("top", "Whole table")}
          {tab("perspective", "Perspective")}
          {(render.url || render.loading) && tab("render", "Real photo ✨")}
          {four && tab("render4", "Four places photo ✨")}
        </div>
      </div>
      {!table?.enabled ? (
        <div className="empty">Add a kids&apos; table to see it here.</div>
      ) : (
        <>
          {shown === "render" && render.url ? (
            <ZoomPhoto testId="table-render" src={render.url} alt="Your kids' table, one place from above" />
          ) : shown === "render4" && renderFour?.url ? (
            <ZoomPhoto testId="table-render-four" src={renderFour.url} alt="Your kids' table, four places from above" />
          ) : (
            <div className={shown === "render" || shown === "render4" ? "bz-tb-wait on" : "bz-tb-wait"}>
              {shown === "place" || shown === "four" || shown === "render" || shown === "render4" ? <TablePlace table={table} theme={theme} mode={shown === "four" || shown === "render4" ? "four" : "one"} className="bz-tb-place" />
                : shown === "top" ? <TableSketch table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />
                : <TablePerspective table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />}
              {(shown === "render" || shown === "render4") && (
                <div className="veil" role="status" data-testid="table-render-wait">
                  <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                  <b>Making a real photo of {shown === "render4" ? "four places" : "one place"} from above</b>
                  <span>From this place as you designed it — about 10 seconds.</span>
                </div>
              )}
            </div>
          )}
          <p className="note">
            {shown === "render" ? (render.url ? <>Your real photo — this place from above.</> : <>Your real photo is on its way.</>)
              : shown === "render4" ? (renderFour?.url ? <>Your real photo — four places from above.</> : <>Your real photo is on its way.</>)
              : shown === "place" ? <>One place from above, made from photos of each piece — your colours and words show straight away.</>
              : shown === "four" ? <>Four places, two facing two, and the centrepiece between them, from above.</>
              : shown === "top" ? <>From above, to scale · {tableCounts(table).tables} table{tableCounts(table).tables > 1 ? "s" : ""} · {table.kids} kids — a drawing, not a photo.</>
                : <>From the front · {table.kids} kids — a drawing, not a photo.</>}
          </p>
          {backTo !== null && (
            <button type="button" className="bz-tb-back" data-testid="table-back-to-choices"
              onClick={back}>↑ Back to your choices</button>
          )}
          {!r.ready && !r.loading && (
            <div className="bz-tb-render" data-testid={onFour ? "table-render-four-box" : "table-render-box"}>
              <button type="button" className="bz-next" onClick={make}>{r.stale ? "Make a new photo ✨" : onFour ? "Make a real photo of four places ✨" : "Make it a real photo ✨"}</button>
              <p className="hint">{r.stale ? "You changed the table since your render." : onFour ? "A photo-real top view of these four places and the centrepieces, exactly as you designed them." : "A photo-real top view of this place, exactly as you designed it."} Needs a free account.</p>
              {r.error && <p className="error" role="alert">{r.error}</p>}
            </div>
          )}
          <RenderAgain render={r} onGenerate={make} testId={onFour ? "table-render-four-again" : "table-render-again"} />
        </>
      )}
    </div>
  );
}
