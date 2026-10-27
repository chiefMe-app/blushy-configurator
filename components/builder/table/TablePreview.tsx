// The left-hand preview during the table part of Decor (2026-10-27): a front
// perspective and the to-scale top view, both live drawings of every choice —
// and, on request, the real render of both views (F3, /api/table-render; it
// needs an account, like the backdrop render).
import { useEffect, useRef, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { tableCounts, type TableSetup } from "@/lib/studio/tableSetup";
import { tableRenderKey } from "@/lib/studio/tableRender";
import TableSketch from "@/components/studio/table/TableSketch";
import TablePerspective from "@/components/studio/table/TablePerspective";
import { accountToken } from "@/components/account/useAccount";

type View = "perspective" | "top";

export default function TablePreview({ config, setTable, onSignInNeeded, startNow, onStarted }: {
  config: BuilderConfig;
  setTable: (t: TableSetup) => void;
  onSignInNeeded: () => void;
  /** Back from signing in to see the render: start it. */
  startNow?: boolean;
  onStarted?: () => void;
}) {
  const [view, setView] = useState<View>("perspective");
  const [showSketch, setShowSketch] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const theme = themeById(config.theme) ?? THEMES[0];
  const table = config.table;
  const render = table?.render;
  const current = !!render && !!table && render.key === tableRenderKey(table) && !expired;
  const latest = useRef(table);
  latest.current = table;

  async function makeRender() {
    if (status === "loading" || !latest.current?.enabled) return;
    const token = await accountToken();
    if (token === null) { onSignInNeeded(); return; }
    setStatus("loading"); setError(null);
    try {
      const res = await fetch("/api/table-render", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ table: latest.current, theme: config.theme }),
      });
      const data = await res.json().catch(() => null);
      if (data?.signin) { setStatus("idle"); onSignInNeeded(); return; }
      if (!res.ok || !data?.render) throw new Error(data?.error ?? "The render didn't come out — please try again.");
      if (latest.current) setTable({ ...latest.current, render: data.render });
      setExpired(false); setShowSketch(false); setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStatus("error");
    }
  }

  useEffect(() => {
    if (!startNow || !table?.enabled) return;
    onStarted?.();
    document.getElementById("party-preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    void makeRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNow, table?.enabled]);

  const photo = current && !showSketch;
  return (
    <div className="bz-tb-preview" id="party-preview-card">
      <div className="head">
        <span className="title">✦ Your kids&apos; table</span>
        <div className="views" role="tablist" aria-label="Table view">
          <button type="button" role="tab" aria-selected={view === "perspective"} className={view === "perspective" ? "on" : ""} onClick={() => setView("perspective")}>Perspective</button>
          <button type="button" role="tab" aria-selected={view === "top"} className={view === "top" ? "on" : ""} onClick={() => setView("top")}>Top view</button>
        </div>
      </div>
      {!table?.enabled ? (
        <div className="empty">Add a kids&apos; table to see it here.</div>
      ) : (
        <>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bz-tb-photo" data-testid="table-render" src={view === "top" ? render!.top : render!.perspective}
              alt={`Your kids' table, ${view === "top" ? "from above" : "from the front"}`} onError={() => setExpired(true)} />
          ) : view === "top" ? (
            <TableSketch table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />
          ) : (
            <TablePerspective table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />
          )}
          <p className="note">
            {photo ? "Your render — the real look of your choices."
              : view === "top" ? <>From above, to scale · {tableCounts(table).tables} table{tableCounts(table).tables > 1 ? "s" : ""} · {table.kids} kids — a sketch, not a photo.</>
                : <>From the front · {table.kids} kids — a sketch, not a photo.</>}
            {current && <> <button type="button" className="bz-tb-link" onClick={() => setShowSketch(!showSketch)}>{showSketch ? "Show the render" : "Show the sketch"}</button></>}
          </p>
          <div className="bz-tb-render" data-testid="table-render-box">
            {status === "loading" ? (
              <p className="busy" role="status">Rendering your table from the front and from above… about half a minute.</p>
            ) : current ? null : (
              <>
                <button type="button" className="bz-next" onClick={() => void makeRender()}>
                  {render && !expired ? "Update the render ✦" : "Generate table render ✦"}
                </button>
                <p className="hint">{render && !expired ? "You changed the table since your render." : expired ? "Your last render is no longer available." : "A photo-real look at every choice — from the front and from above."} Needs a free account.</p>
              </>
            )}
            {status === "error" && error && <p className="error" role="alert">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
