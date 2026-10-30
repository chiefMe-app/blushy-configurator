"use client";
// My designs (Phase 0.4): every design the customer saved — as a guest on
// this device, or in their account on any device — with a sketch, Open (back
// into the Builder, where Save updates it) and Delete. 0.5c: a design saved
// with its render shows the render (from the account's private Storage, by a
// short-lived signed link) instead of the sketch. 2026-10-30: the backdrop and
// the kids' table are separate designs, each its own card (lib/savedDesigns.ts).
import { useEffect, useState } from "react";
import LiveSketch from "@/components/design/LiveSketch";
import AccountMenu from "@/components/account/AccountMenu";
import SignInDialog from "@/components/account/SignInDialog";
import { loadClient } from "@/components/account/useAccount";
import { fingerprint } from "@/components/builder/useServerDraft";
import { THEMES, formatAED, priceBreakdown, themeById } from "@/lib/config";
import { DRAFT_KEY, fromDraft, toDraft } from "@/lib/draft";
import TablePlace from "@/components/studio/table/TablePlace";
import { TABLE_ITEM, designCards, joinParty, splitDesign, type DesignCard, type SavedItem } from "@/lib/savedDesigns";
import { SERVER_DRAFT_KEY } from "@/lib/serverDraft";
import { SETUP_LAYOUT_TEMPLATES, inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import { RENDER_BUCKET, renderKeyOf } from "@/lib/renderKey";
import type { AccountState } from "@/lib/account";

type Saved = SavedItem;

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
      .select("id, party_id, ref_id, updated_at, config, price_snapshot, parties(title)")
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

  function open(card: DesignCard, userId: string) {
    // Into the Builder as the device copy (the party's backdrop and table
    // together), linked to the saved items, so Save updates them rather than
    // making new ones. A table opens on the table.
    const joined = joinParty(items ?? [], card.partyId);
    if (!joined) return;
    const config = fromDraft(JSON.stringify(joined.draft))!.config;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(joined.draft));
      window.localStorage.setItem(SERVER_DRAFT_KEY, JSON.stringify({ userId, partyId: card.partyId, itemId: joined.itemId, tableItemId: joined.tableItemId, savedPrint: fingerprint(config) }));
    } catch { /* storage blocked: the Builder opens empty */ }
    window.location.href = card.kind === "table" ? "/builder?part=table" : "/builder";
  }

  async function remove(card: DesignCard) {
    if (!window.confirm(`Delete this ${card.kind === "table" ? "kids' table" : "backdrop"} design? This cannot be undone.`)) return;
    const sb = await loadClient();
    if (!sb) return;
    const item = card.item;
    const fail = () => setProblem("That design could not be deleted. Please try again.");
    if (item.ref_id === TABLE_ITEM) {
      const { error } = await sb.from("party_items").delete().eq("id", item.id);
      if (error) return fail();
    } else {
      // A design saved before 2026-10-30 holds its table inside the backdrop item.
      const restored = fromDraft(JSON.stringify(item.config));
      const tableInside = designCards(items ?? []).some((c) => c.kind === "table" && c.item.id === item.id);
      if (card.kind === "table") {
        const c = { ...restored!.config, table: undefined };
        const { error } = await sb.from("party_items").update({ config: toDraft(c, restored!.step, restored!.decorTab), price_snapshot: { total: priceBreakdown(c).total, currency: "AED", confidence: "estimate" } }).eq("id", item.id);
        if (error) return fail();
      } else {
        if (tableInside) {
          // The table stays: into its own item first.
          const { table } = splitDesign(restored!.config, restored!.step, restored!.decorTab);
          const { error } = await sb.from("party_items").insert({ party_id: item.party_id, kind: "product", ref_id: TABLE_ITEM, ...table! });
          if (error) return fail();
        }
        const { error } = await sb.from("party_items").delete().eq("id", item.id);
        if (error) return fail();
        // Its render goes too, unless another saved design shows the same one.
        const path = renderPath(item);
        if (path && !(items ?? []).some((i) => i.id !== item.id && renderPath(i) === path)) {
          void sb.storage.from(RENDER_BUCKET).remove([path]);
        }
      }
    }
    await load();
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
        {/* 2026-10-27: what a Design Pack holds, next to the designs it will be made from. */}
        <a className="bz-sample-pack bz-md-pack" href="/api/packs/sample" download data-testid="my-designs-sample-pack">
          <span className="icon" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3.5-3.5M8 10l3.5-3.5M3 13.5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
          <span><b>Design Pack:</b> the specification, cut files and lists for a design. See what one looks like — download a free sample.</span>
        </a>
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
            {designCards(items).map((card) => {
              const c = card.config;
              const theme = themeById(c.theme) ?? THEMES[0];
              const isTable = card.kind === "table";
              const setupId = inferSetupLayoutTemplateIdFromBackdropItems(c.decor.backdropItems);
              const setup = isTable ? "Kids' table" : SETUP_LAYOUT_TEMPLATES.find((t) => t.id === setupId)?.name ?? "Backdrop";
              const words = isTable ? undefined : c.decor.backdropItems.find((i) => i.text?.enabled && i.text.value.trim())?.text.value.trim();
              const render = isTable ? undefined : renders[renderPath(card.item) ?? ""];
              return (
                <li key={card.key} className={`bz-md-card ${isTable ? "table" : ""}`} data-testid="saved-design" data-kind={card.kind}>
                  <div className="sketch">
                    {isTable
                      ? <TablePlace table={c.table!} theme={theme} fill />
                      : render
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img className="render" src={render} alt="Your render of this design" data-testid="saved-render" />
                        : <LiveSketch config={c} />}
                  </div>
                  <div className="body">
                    <span className="kind">{isTable ? "Table setup" : "Backdrop"}</span>
                    <strong>{theme.name} · {setup}</strong>
                    {words && <span className="words">“{words}”</span>}
                    {isTable && <span className="words">{c.table!.kids} children</span>}
                    <span className="meta">
                      {card.total ? `AED ${formatAED(card.total)} · ` : ""}
                      Saved {new Date(card.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      {card.item.parties?.title && card.item.parties.title !== "My party" ? ` · ${card.item.parties.title}` : ""}
                    </span>
                    <div className="actions">
                      <button type="button" className="bz-next" onClick={() => account && "userId" in account && open(card, account.userId)}>Open</button>
                      <button type="button" className="bz-back" onClick={() => { void remove(card); }}>Delete</button>
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
