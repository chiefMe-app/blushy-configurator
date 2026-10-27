"use client";
// My designs (Phase 0.4): every design the customer saved — as a guest on
// this device, or in their account on any device — with a sketch, Open (back
// into the Builder, where Save updates it) and Delete. 0.5c: a design saved
// with its render shows the render (from the account's private Storage, by a
// short-lived signed link) instead of the sketch.
import { useEffect, useState } from "react";
import LiveSketch from "@/components/design/LiveSketch";
import AccountMenu from "@/components/account/AccountMenu";
import SignInDialog from "@/components/account/SignInDialog";
import { loadClient } from "@/components/account/useAccount";
import { fingerprint } from "@/components/builder/useServerDraft";
import { formatAED, themeById, type BuilderConfig } from "@/lib/config";
import { DRAFT_KEY, fromDraft } from "@/lib/draft";
import { SERVER_DRAFT_KEY } from "@/lib/serverDraft";
import { SETUP_LAYOUT_TEMPLATES, inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import { RENDER_BUCKET, renderKeyOf } from "@/lib/renderKey";
import type { AccountState } from "@/lib/account";

interface Saved {
  id: string;
  party_id: string;
  updated_at: string;
  config: unknown;
  price_snapshot: { total?: number } | null;
  parties: { title: string } | null;
}

export default function MyDesigns() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [items, setItems] = useState<Saved[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [imported, setImported] = useState(0);
  const [renders, setRenders] = useState<Record<string, string>>({}); // Storage path → signed link

  async function load() {
    const sb = await loadClient();
    if (!sb) { setAccount({ kind: "none" }); setItems([]); return; }
    const { currentAccount } = await import("@/lib/account");
    const who = await currentAccount(sb);
    setAccount(who);
    if (who.kind === "none") { setItems([]); return; }
    const { data, error } = await sb.from("party_items")
      .select("id, party_id, updated_at, config, price_snapshot, parties(title)")
      .eq("owner_id", who.userId)
      .order("updated_at", { ascending: false });
    if (error) { setProblem("Your designs could not be loaded. Please try again."); setItems([]); return; }
    const list = (data ?? []) as unknown as Saved[];
    setItems(list);
    const paths = Array.from(new Set(list.map(renderPath).filter((p): p is string => !!p)));
    if (!paths.length) return;
    const { data: signed } = await sb.storage.from(RENDER_BUCKET).createSignedUrls(paths, 3600);
    setRenders(Object.fromEntries((signed ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl as string])));
  }
  useEffect(() => {
    setImported(Number(new URLSearchParams(window.location.search).get("imported") ?? 0) || 0);
    void load();
  }, []);

  function open(item: Saved, config: BuilderConfig, userId: string) {
    // Into the Builder as the device copy, linked to this saved design, so
    // Save updates it rather than making a new one.
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(item.config));
      window.localStorage.setItem(SERVER_DRAFT_KEY, JSON.stringify({ userId, partyId: item.party_id, itemId: item.id, savedPrint: fingerprint(config) }));
    } catch { /* storage blocked: the Builder opens empty */ }
    window.location.href = "/builder";
  }

  async function remove(item: Saved) {
    if (!window.confirm("Delete this design? This cannot be undone.")) return;
    const sb = await loadClient();
    if (!sb) return;
    const { error } = await sb.from("party_items").delete().eq("id", item.id);
    if (error) { setProblem("That design could not be deleted. Please try again."); return; }
    // Its render goes too, unless another saved design shows the same one.
    const path = renderPath(item);
    if (path && !(items ?? []).some((i) => i.id !== item.id && renderPath(i) === path)) {
      void sb.storage.from(RENDER_BUCKET).remove([path]);
    }
    setItems((list) => (list ?? []).filter((i) => i.id !== item.id));
  }

  return (
    <div className="bz-body bz-mydesigns">
      <header className="bz-topbar">
        <div className="bz-topbar-inner">
          <a href="/" className="bz-brand" aria-label="PartyMuse by Blushy — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/design/partymuse-logo.webp" alt="PartyMuse by Blushy" />
          </a>
          <div style={{ marginLeft: "auto" }}><AccountMenu /></div>
        </div>
      </header>
      <main className="bz-md-main">
        <div className="bz-md-head">
          <h1>My designs</h1>
          <a className="bz-next" href="/builder">+ New design</a>
        </div>
        {account?.kind === "guest" && (
          <div className="bz-tip bz-md-guest">
            <span className="icon" aria-hidden="true">✳</span>
            <span>These designs are saved on this device. <b>Sign in</b> to keep them and open them anywhere.</span>
            <button type="button" className="bz-restart" onClick={() => setSigningIn(true)}>Sign in</button>
          </div>
        )}
        {imported > 0 && (
          <div className="bz-tip bz-restored" role="status">
            <span className="icon" aria-hidden="true">✓</span>
            <span>{imported === 1 ? "Your saved design is" : `Your ${imported} saved designs are`} now in your account.</span>
          </div>
        )}
        {problem && <p className="bz-md-problem" role="alert">{problem}</p>}
        {items === null ? (
          <p className="bz-md-empty">Loading your designs…</p>
        ) : account?.kind === "none" ? (
          <div className="bz-md-empty">
            <p>Sign in to see the designs you saved.</p>
            <button type="button" className="bz-save" onClick={() => setSigningIn(true)}>Sign in</button>
          </div>
        ) : items.length === 0 ? (
          <div className="bz-md-empty">
            <p>No saved designs yet. Press <b>♡ Save my design</b> in the builder to keep one here.</p>
          </div>
        ) : (
          <ul className="bz-md-grid">
            {items.map((item) => {
              const restored = fromDraft(JSON.stringify(item.config));
              if (!restored) return null;
              const c = restored.config;
              const setupId = inferSetupLayoutTemplateIdFromBackdropItems(c.decor.backdropItems);
              const setup = SETUP_LAYOUT_TEMPLATES.find((t) => t.id === setupId)?.name ?? "Backdrop";
              const words = c.decor.backdropItems.find((i) => i.text?.enabled && i.text.value.trim())?.text.value.trim();
              return (
                <li key={item.id} className="bz-md-card" data-testid="saved-design">
                  <div className="sketch">
                    {renders[renderPath(item) ?? ""]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img className="render" src={renders[renderPath(item)!]} alt="Your render of this design" data-testid="saved-render" />
                      : <LiveSketch config={c} />}
                  </div>
                  <div className="body">
                    <strong>{themeById(c.theme)?.name ?? "Party"} · {setup}</strong>
                    {words && <span className="words">“{words}”</span>}
                    <span className="meta">
                      {item.price_snapshot?.total ? `AED ${formatAED(item.price_snapshot.total)} · ` : ""}
                      Saved {new Date(item.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      {item.parties?.title && item.parties.title !== "My party" ? ` · ${item.parties.title}` : ""}
                    </span>
                    <div className="actions">
                      <button type="button" className="bz-next" onClick={() => account && "userId" in account && open(item, c, account.userId)}>Open</button>
                      <button type="button" className="bz-back" onClick={() => { void remove(item); }}>Delete</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <SignInDialog open={signingIn} onClose={() => setSigningIn(false)} />
    </div>
  );
}

/** The stored render of a saved design, while it still matches the design. */
function renderPath(item: Saved): string | null {
  const restored = fromDraft(JSON.stringify(item.config));
  const saved = restored?.config.decor.savedRender;
  return saved && saved.key === renderKeyOf(restored.config) ? saved.path : null;
}
