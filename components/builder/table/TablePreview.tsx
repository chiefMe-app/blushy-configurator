// The left-hand preview during the table part of Decor (2026-10-27): a front
// perspective and the to-scale top view, both live drawings of every choice —
// and, on request, the real render of both views (F3, /api/table-render; it
// needs an account, like the backdrop render). The pictures are kept in the
// customer's own storage and shown through signed links.
import { useEffect, useRef, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { tableCounts, type TableSetup } from "@/lib/studio/tableSetup";
import { tableRenderKey } from "@/lib/studio/tableRender";
import TableSketch from "@/components/studio/table/TableSketch";
import TablePerspective from "@/components/studio/table/TablePerspective";
import { accountToken, loadClient } from "@/components/account/useAccount";
import { RENDER_BUCKET } from "@/lib/renderKey";

type View = "perspective" | "top" | "close";
/** Pictures that can be shown now, and the table (tableRenderKey) they show. */
interface Shown { key: string; perspective: string; top: string; close?: string }

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
  const [shown, setShown] = useState<Shown | null>(null);
  const current = !!shown && !!table && shown.key === tableRenderKey(table) && !expired;
  const latest = useRef(table);
  latest.current = table;

  // A kept render (back on the page, or the design reopened): new signed
  // links. A link or picture that fails is tried again twice (a network that
  // drops look-ups now and then) before the render counts as gone.
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    if (attempt >= 2) { setExpired(true); return; }
    setShown(null);
    setTimeout(() => setAttempt((a) => a + 1), 2000);
  };
  useEffect(() => {
    if (!render || shown?.key === render.key) return;
    let cancelled = false;
    void (async () => {
      const sb = await loadClient();
      const paths = [render.perspective, render.top, ...(render.close ? [render.close] : [])];
      const { data } = (await sb?.storage.from(RENDER_BUCKET).createSignedUrls(paths, 3600).catch(() => null)) ?? { data: null };
      const [p, t, c] = [data?.[0]?.signedUrl, data?.[1]?.signedUrl, data?.[2]?.signedUrl];
      if (cancelled) return;
      if (p && t) { setShown({ key: render.key, perspective: p, top: t, ...(c ? { close: c } : {}) }); setExpired(false); } else retry();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render?.key, render?.perspective, render?.top, render?.close, attempt]);

  async function makeRender() {
    if (status === "loading" || !latest.current?.enabled) return;
    const token = await accountToken();
    if (token === null) { onSignInNeeded(); return; }
    setStatus("loading"); setError(null);
    const key = tableRenderKey(latest.current);
    try {
      const res = await fetch("/api/table-render", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ table: latest.current, theme: config.theme }),
      });
      const data = await res.json().catch(() => null);
      if (data?.signin) { setStatus("idle"); onSignInNeeded(); return; }
      if (!res.ok || !data?.urls?.perspective || !data?.urls?.top) throw new Error(data?.error ?? "The render didn't come out — please try again.");
      setShown({ key, perspective: data.urls.perspective, top: data.urls.top, ...(data.urls.close ? { close: data.urls.close } : {}) }); // the pictures themselves
      setAttempt(0);
      // Kept with the design when it was stored (signed in, with a database).
      if (latest.current && data.render) setTable({ ...latest.current, render: data.render });
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
  // The close-up exists only as a photo; without one, the front view shows.
  const shownView: View = view === "close" && !(photo && shown?.close) ? "perspective" : view;
  // A render of an earlier version of the table.
  const stale = !expired && !current && !!table && ((!!shown && shown.key !== tableRenderKey(table)) || (!!render && render.key !== tableRenderKey(table)));
  return (
    <div className="bz-tb-preview" id="party-preview-card">
      <div className="head">
        <span className="title">✦ Your kids&apos; table</span>
        <div className="views" role="tablist" aria-label="Table view">
          <button type="button" role="tab" aria-selected={view === "perspective"} className={view === "perspective" ? "on" : ""} onClick={() => setView("perspective")}>Perspective</button>
          <button type="button" role="tab" aria-selected={view === "top"} className={view === "top" ? "on" : ""} onClick={() => setView("top")}>Top view</button>
          {photo && shown?.close && <button type="button" role="tab" aria-selected={view === "close"} className={view === "close" ? "on" : ""} onClick={() => setView("close")}>Close-up</button>}
        </div>
      </div>
      {!table?.enabled ? (
        <div className="empty">Add a kids&apos; table to see it here.</div>
      ) : (
        <>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bz-tb-photo" data-testid="table-render" src={shownView === "top" ? shown!.top : shownView === "close" ? shown!.close : shown!.perspective}
              alt={`Your kids' table, ${shownView === "top" ? "from above" : shownView === "close" ? "one seat up close" : "from the front"}`} onError={() => (shown?.perspective.startsWith("data:") ? setExpired(true) : retry())} />
          ) : shownView === "top" ? (
            <TableSketch table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />
          ) : (
            <TablePerspective table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />
          )}
          <p className="note">
            {photo ? "Your render — the real look of your choices."
              : shownView === "top" ? <>From above, to scale · {tableCounts(table).tables} table{tableCounts(table).tables > 1 ? "s" : ""} · {table.kids} kids — a sketch, not a photo.</>
                : <>From the front · {table.kids} kids — a sketch, not a photo.</>}
            {current && <> <button type="button" className="bz-tb-link" onClick={() => setShowSketch(!showSketch)}>{showSketch ? "Show the render" : "Show the sketch"}</button></>}
          </p>
          <div className="bz-tb-render" data-testid="table-render-box">
            <div className="scene" role="radiogroup" aria-label="Where the party is">
              {(["garden", "indoor"] as const).map((sc) => (
                <button key={sc} type="button" role="radio" aria-checked={(table.scene ?? "garden") === sc} className={(table.scene ?? "garden") === sc ? "on" : ""}
                  disabled={status === "loading"} onClick={() => setTable({ ...table, scene: sc })}>{sc === "garden" ? "☀ In a garden" : "Indoors"}</button>
              ))}
            </div>
            {status === "loading" ? (
              <p className="busy" role="status">Rendering your table — from the front, from above and one seat up close… about three minutes.</p>
            ) : current ? null : (
              <>
                <button type="button" className="bz-next" onClick={() => void makeRender()}>
                  {stale ? "Update the render ✦" : "Generate table render ✦"}
                </button>
                <p className="hint">{stale ? "You changed the table since your render." : expired ? "Your last render is no longer available." : "A photo-real look at every choice — from the front, from above and one seat up close."} Needs a free account.</p>
              </>
            )}
            {status === "error" && error && <p className="error" role="alert">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
