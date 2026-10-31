// The left-hand preview during the welcome board part of Decor (2026-10-31):
// the board drawn live. On a phone, where it sits under the choices, each
// change brings it into view, with a way back (as the kids' table does).
// Later that day (owner: "bu seçeneklerin renderını alıp preview'a koyalım,
// table setup ve backdrop'ta yaptığımız gibi"): on request, a real photo of the
// board made from the drawing (/api/welcome-render). Like the other renders it
// needs an account; the picture is kept in the customer's own storage and shown
// through a signed link. The builder keeps this mounted on every step, so a
// render carries on while the customer moves on.
import { useEffect, useRef, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import type { WelcomeBoard } from "@/lib/studio/welcomeBoard";
import { welcomeRenderKey } from "@/lib/studio/welcomeRender";
import WelcomeBoardArt from "@/components/studio/WelcomeBoardArt";
import { usePhoneJump } from "@/components/builder/usePhoneJump";
import { accountToken, loadClient } from "@/components/account/useAccount";
import { RENDER_BUCKET } from "@/lib/renderKey";
import { readNdjson } from "@/lib/ndjson";
import { boardPicture } from "./boardPicture";

type View = "drawing" | "photo";

export default function WelcomePreview({ config, setWelcomeBoard, onSignInNeeded, startNow, onStarted }: {
  config: BuilderConfig;
  setWelcomeBoard: (b: WelcomeBoard) => void;
  onSignInNeeded: () => void;
  /** Back from signing in to see the render: start it. */
  startNow?: boolean;
  onStarted?: () => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const b = config.welcomeBoard;
  const balloons = config.decor.balloonColors ?? [];
  const key = b?.enabled ? welcomeRenderKey(b, config.theme, balloons) : "";
  const latest = useRef(b);
  latest.current = b;
  const art = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<View>("drawing");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // The photo that can be shown now, and the board it shows.
  const [shown, setShown] = useState<{ key: string; src: string } | null>(null);
  const [expired, setExpired] = useState(false);
  const render = b?.render;
  const current = !!shown && shown.key === key && !expired;
  const loading = status === "loading";

  // Pressing Finish, or a render arriving, is not a change to the board.
  const changeKey = b?.enabled ? key : "";
  const { backTo, back } = usePhoneJump(changeKey, "welcome-preview-card", () => setView("drawing"));

  // A kept render (back on the page, or the design reopened): a new signed link.
  useEffect(() => {
    if (!render || shown?.key === render.key) return;
    let cancelled = false;
    void (async () => {
      const sb = await loadClient();
      const { data } = (await sb?.storage.from(RENDER_BUCKET).createSignedUrls([render.path], 3600).catch(() => null)) ?? { data: null };
      const src = data?.[0]?.signedUrl;
      if (cancelled) return;
      if (!src) { setExpired(true); return; }
      setShown({ key: render.key, src }); setExpired(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render?.key, render?.path]);

  async function makeRender() {
    const board = latest.current;
    const svg = art.current?.querySelector("svg");
    if (loading || !board?.enabled || !svg) return;
    const token = await accountToken();
    if (token === null) { onSignInNeeded(); return; }
    setStatus("loading"); setError(null); setView("photo");
    const forKey = welcomeRenderKey(board, config.theme, balloons);
    const failed = "The render didn't come out — please try again.";
    try {
      const drawing = await boardPicture(svg);
      const res = await fetch("/api/welcome-render", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ board, theme: config.theme, balloons, drawing }),
      });
      if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
        const data = await res.json().catch(() => null);
        if (data?.signin) { setStatus("idle"); setView("drawing"); onSignInNeeded(); return; }
        throw new Error(data?.error ?? failed);
      }
      // The picture's line, then a line saying it is done.
      type End = { done?: boolean; error?: string; render?: WelcomeBoard["render"] };
      let end: End | null = null;
      await readNdjson(res.body, (line) => {
        const l = line as { url?: string } & End;
        if (typeof l.url === "string") { setShown({ key: forKey, src: l.url }); setExpired(false); }
        else if (l.done || l.error) end = l;
      });
      const result = end as End | null; // set inside the callback
      if (!result?.done) throw new Error(result?.error ?? failed);
      // Kept with the design when it was stored (signed in, with a database).
      if (latest.current && result.render) setWelcomeBoard({ ...latest.current, render: result.render });
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStatus("error"); setView("drawing");
    }
  }

  useEffect(() => {
    if (!startNow || !b?.enabled) return;
    onStarted?.();
    document.getElementById("welcome-preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    void makeRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNow, b?.enabled]);

  const shownView: View = view === "photo" && (current || loading) ? "photo" : "drawing";
  const stale = !current && !loading && (!!shown || (!!render && !expired));
  const tab = (v: View, name: string) => <button type="button" role="tab" aria-selected={shownView === v} className={shownView === v ? "on" : ""} onClick={() => setView(v)}>{name}</button>;
  return (
    <div className="bz-tb-preview" data-testid="welcome-preview" id="welcome-preview-card">
      <div className="head">
        <span className="title">✦ Your welcome board</span>
        {b?.enabled && (current || loading) && (
          <div className="views" role="tablist" aria-label="Board view">
            {tab("drawing", "Drawing")}
            {tab("photo", "Photo")}
          </div>
        )}
      </div>
      {b?.enabled ? <>
        <link rel="stylesheet" href="/fonts/typography/fonts.css" />
        {shownView === "photo" && current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bz-tb-photo" data-testid="welcome-render" src={shown!.src} alt="Your welcome board, as a photo" onError={() => setExpired(true)} />
        ) : null}
        {/* The drawing stays in the page (the render is made from it), under the dots while the photo is made. */}
        <div ref={art} className={loading && shownView === "photo" ? "bz-wb-wait bz-tb-wait on" : "bz-wb-wait"} hidden={shownView === "photo" && current}>
          <WelcomeBoardArt board={b} theme={theme} balloons={balloons} className="bz-wb-art" />
          {loading && shownView === "photo" && (
            <div className="veil" role="status" data-testid="welcome-render-wait">
              <span className="dots" aria-hidden="true"><i /><i /><i /></span>
              <b>Rendering your board</b>
              <span>A real photo of it, made from your drawing — about a minute. Carry on meanwhile.</span>
            </div>
          )}
        </div>
        <p className="note">{shownView === "photo" && current ? "Your board as a photo, made from your drawing." : "To scale, on its stand — your words show as you type. A drawing, not a photo."}</p>
        {backTo !== null && <button type="button" className="bz-tb-back" data-testid="welcome-back-to-choices" onClick={back}>↑ Back to your choices</button>}
        <div className="bz-tb-render" data-testid="welcome-render-box">
          {loading ? (
            <p className="busy"><span className="dots" aria-hidden="true"><i /><i /><i /></span> Rendering your board — about a minute. You can carry on meanwhile.</p>
          ) : current ? null : (
            <>
              <button type="button" className="bz-next" data-testid="welcome-render-button" onClick={() => void makeRender()}>{stale ? "Update the photo ✦" : "Render my board ✦"}</button>
              <p className="hint">{stale ? "You changed the board since your photo." : "A photo-real picture of your board, made from your drawing."} Needs a free account.</p>
            </>
          )}
          {status === "error" && error && <p className="error" role="alert">{error}</p>}
        </div>
      </> : <div className="empty">Add a welcome board to see it here.</div>}
    </div>
  );
}
