// The left-hand preview during the table part of Decor (2026-10-27): a front
// perspective and the to-scale top view, both live drawings of every choice —
// the layout is only ever these drawings — and, on request, one real close-up
// of a place setting (2026-10-28, F3, /api/table-render; it needs an account,
// like the backdrop render). The picture is kept in the customer's own storage
// and shown through a signed link. While it is made (about a minute), the
// drawing shows under three moving dots. 2026-10-28 ("render aşırı uzun
// sürüyor"): the builder keeps this mounted on every step, so the customer can
// carry on while it renders; onJob tells the builder how it is going.
import { useEffect, useRef, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { tableCounts, type TableSetup } from "@/lib/studio/tableSetup";
import { tableRenderKey } from "@/lib/studio/tableRender";
import TableSketch from "@/components/studio/table/TableSketch";
import TablePerspective from "@/components/studio/table/TablePerspective";
import { accountToken, loadClient } from "@/components/account/useAccount";
import { RENDER_BUCKET } from "@/lib/renderKey";
import { readNdjson } from "@/lib/ndjson";

type View = "perspective" | "top" | "close";
/** The close-up that can be shown now, and the table (tableRenderKey) it shows. */
interface Shown { key: string; close: string }
/** How a close-up asked for in this visit is going. */
export type TableRenderJob = "loading" | "ready" | "error";

export default function TablePreview({ config, setTable, onSignInNeeded, startNow, onStarted, onJob }: {
  config: BuilderConfig;
  setTable: (t: TableSetup) => void;
  onSignInNeeded: () => void;
  /** Back from signing in to see the render: start it. */
  startNow?: boolean;
  onStarted?: () => void;
  onJob?: (job: TableRenderJob) => void;
}) {
  const [view, setView] = useState<View>("perspective");
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
      const { data } = (await sb?.storage.from(RENDER_BUCKET).createSignedUrls([render.close], 3600).catch(() => null)) ?? { data: null };
      const c = data?.[0]?.signedUrl;
      if (cancelled) return;
      if (!c) { retry(); return; }
      setShown({ key: render.key, close: c }); setExpired(false);
      // Back on the page with the close-up of this very table: show it.
      if (latest.current && render.key === tableRenderKey(latest.current)) setView("close");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render?.key, render?.close, attempt]);

  async function makeRender() {
    if (status === "loading" || !latest.current?.enabled) return;
    const token = await accountToken();
    if (token === null) { onSignInNeeded(); return; }
    setStatus("loading"); setError(null); setView("close"); onJob?.("loading");
    const key = tableRenderKey(latest.current);
    const failed = "The render didn't come out — please try again.";
    try {
      const res = await fetch("/api/table-render", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ table: latest.current, theme: config.theme }),
      });
      if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
        const data = await res.json().catch(() => null);
        if (data?.signin) { setStatus("idle"); onSignInNeeded(); return; }
        throw new Error(data?.error ?? failed);
      }
      // The picture's line, then a line saying it is done.
      type End = { done?: boolean; error?: string; render?: TableSetup["render"] };
      let end: End | null = null;
      await readNdjson(res.body, (line) => {
        const l = line as { view?: View; url?: string; done?: boolean; error?: string };
        if (l.view === "close" && typeof l.url === "string") { setShown({ key, close: l.url }); setExpired(false); }
        else if (l.done || l.error) end = l;
      });
      const result = end as End | null; // set inside the callback
      if (!result?.done) throw new Error(result?.error ?? failed);
      setAttempt(0);
      // Kept with the design when it was stored (signed in, with a database).
      if (latest.current && result.render) setTable({ ...latest.current, render: result.render });
      setStatus("idle"); onJob?.("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStatus("error"); onJob?.("error");
    }
  }

  useEffect(() => {
    if (!startNow || !table?.enabled) return;
    onStarted?.();
    document.getElementById("table-preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    void makeRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNow, table?.enabled]);

  const loading = status === "loading";
  // The close-up tab shows the photo, or the drawing under the dots while it is made.
  const shownView: View = view === "close" && !(current || loading) ? "perspective" : view;
  const src = shownView === "close" && current ? shown!.close : undefined;
  // A render of an earlier version of the table.
  const stale = !expired && !current && !!table && ((!!shown && shown.key !== tableRenderKey(table)) || (!!render && render.key !== tableRenderKey(table)));
  const tab = (v: View, name: string) => <button type="button" role="tab" aria-selected={shownView === v} className={shownView === v ? "on" : ""} onClick={() => setView(v)}>{name}</button>;
  return (
    <div className="bz-tb-preview" id="table-preview-card">
      <div className="head">
        <span className="title">✦ Your kids&apos; table</span>
        <div className="views" role="tablist" aria-label="Table view">
          {tab("perspective", "Perspective")}
          {tab("top", "Top view")}
          {(current || loading) && tab("close", "Close-up")}
        </div>
      </div>
      {!table?.enabled ? (
        <div className="empty">Add a kids&apos; table to see it here.</div>
      ) : (
        <>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bz-tb-photo" data-testid="table-render" src={src}
              alt="Your kids' table, one seat up close" onError={() => (src.startsWith("data:") ? setExpired(true) : retry())} />
          ) : (
            <div className={loading && shownView === "close" ? "bz-tb-wait on" : "bz-tb-wait"}>
              {shownView === "top" ? <TableSketch table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />
                : <TablePerspective table={table} palette={theme.balloonColors} accent={theme.accent} className="bz-tb-sketch" />}
              {loading && shownView === "close" && (
                <div className="veil" role="status" data-testid="table-render-wait">
                  <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                  <b>Rendering one seat up close</b>
                  <span>From the pictures you chose — about a minute. Carry on with your party meanwhile: we&apos;ll tell you when it&apos;s ready.</span>
                </div>
              )}
            </div>
          )}
          <p className="note">
            {src ? "Your close-up — one seat, made from the pictures you chose."
              : shownView === "close" ? "Your close-up is on its way."
              : shownView === "top" ? <>From above, to scale · {tableCounts(table).tables} table{tableCounts(table).tables > 1 ? "s" : ""} · {table.kids} kids — a drawing, not a photo.</>
                : <>From the front · {table.kids} kids — a drawing, not a photo.</>}
          </p>
          <div className="bz-tb-render" data-testid="table-render-box">
            <div className="scene" role="radiogroup" aria-label="Where the party is">
              {(["garden", "indoor"] as const).map((sc) => (
                <button key={sc} type="button" role="radio" aria-checked={(table.scene ?? "garden") === sc} className={(table.scene ?? "garden") === sc ? "on" : ""}
                  disabled={status === "loading"} onClick={() => setTable({ ...table, scene: sc })}>{sc === "garden" ? "☀ In a garden" : "Indoors"}</button>
              ))}
            </div>
            {loading ? (
              <p className="busy">
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                Rendering one seat up close — about a minute. You can carry on meanwhile.
              </p>
            ) : current ? null : (
              <>
                <button type="button" className="bz-next" onClick={() => void makeRender()}>
                  {stale ? "Update the close-up ✦" : "Render a close-up ✦"}
                </button>
                <p className="hint">{stale ? "You changed the table since your close-up." : expired ? "Your last close-up is no longer available." : "A photo-real close-up of one seat, made from the pictures you chose."} Needs a free account.</p>
              </>
            )}
            {status === "error" && error && <p className="error" role="alert">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
