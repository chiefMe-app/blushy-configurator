"use client";
// Table Setup studio (Phase 3, 2026-10-27): the kids' guest table. Options on
// the right, the live top-view drawing on the left, an estimate below. The
// design is kept on this device (TABLE_DRAFT_KEY); it starts in the theme of
// the backdrop being designed, when there is one.
import { useEffect, useMemo, useState } from "react";
import AccountMenu from "@/components/account/AccountMenu";
import TableSketch from "@/components/studio/table/TableSketch";
import { THEMES, formatAED, type ThemeId } from "@/lib/config";
import { DRAFT_KEY } from "@/lib/draft";
import {
  CENTREPIECES, CHAIRS, MAX_KIDS, MIN_KIDS, RUNNERS, TABLES, TABLEWARE, TABLE_DRAFT_KEY, TABLE_PRICES,
  clampKids, defaultTableDesign, readTableDesign, tableLayout, tablePrice, tableSwatches,
  type TableDesign,
} from "@/lib/studio/table";

function startingDesign(): TableDesign {
  try {
    const saved = readTableDesign(JSON.parse(window.localStorage.getItem(TABLE_DRAFT_KEY) ?? "null"));
    if (saved) return saved;
    const backdrop = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "null") as { config?: { theme?: string; themeSelected?: boolean } } | null;
    if (backdrop?.config?.themeSelected && THEMES.some((t) => t.id === backdrop.config!.theme)) return defaultTableDesign(backdrop.config.theme as ThemeId);
  } catch { /* storage blocked */ }
  return defaultTableDesign();
}

function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="bz-ts-pills" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value} className={o.id === value ? "on" : ""} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

function Swatches({ value, colours, onChange, label }: { value: string; colours: string[]; onChange: (hex: string) => void; label: string }) {
  return (
    <div className="bz-ts-swatches" role="radiogroup" aria-label={label}>
      {colours.map((hex) => (
        <button key={hex} type="button" role="radio" aria-checked={hex.toUpperCase() === value.toUpperCase()} aria-label={hex}
          className={hex.toUpperCase() === value.toUpperCase() ? "on" : ""} style={{ background: hex }} onClick={() => onChange(hex)} />
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label, note }: { on: boolean; onChange: (v: boolean) => void; label: string; note: string }) {
  return (
    <label className="bz-ts-toggle">
      <span><b>{label}</b><small>{note}</small></span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={`bz-switch ${on ? "on" : ""}`} onClick={() => onChange(!on)}><span /></button>
    </label>
  );
}

export default function TableStudio() {
  const [design, setDesign] = useState<TableDesign | null>(null);
  useEffect(() => { setDesign(startingDesign()); }, []);
  useEffect(() => {
    if (!design) return;
    const t = setTimeout(() => { try { window.localStorage.setItem(TABLE_DRAFT_KEY, JSON.stringify(design)); } catch { /* storage blocked */ } }, 300);
    return () => clearTimeout(t);
  }, [design]);
  const price = useMemo(() => (design ? tablePrice(design) : null), [design]);
  if (!design || !price) return <div className="bz-body bz-ts" />;

  const set = (patch: Partial<TableDesign>) => setDesign((d) => (d ? { ...d, ...patch } : d));
  const layout = tableLayout(design);
  const swatches = tableSwatches(design.theme);
  const P = TABLE_PRICES;

  return (
    <div className="bz-body bz-ts">
      <header className="bz-topbar">
        <div className="bz-topbar-inner">
          <a href="/" className="bz-brand" aria-label="PartyMuse by Blushy — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/design/partymuse-logo.webp" alt="PartyMuse by Blushy" />
          </a>
          <nav className="bz-ts-nav" aria-label="Studios">
            <a href="/builder">Backdrop</a>
            <a href="/studio/table" aria-current="page" className="on">Table setup</a>
          </nav>
          <div style={{ marginLeft: "auto" }}><AccountMenu /></div>
        </div>
      </header>

      <main className="bz-ts-main">
        <div className="bz-ts-head">
          <span className="eyebrow">TABLE SETUP STUDIO</span>
          <h1>Set the <em>party table</em></h1>
          <p>Seats, colours and little touches for every guest — see it laid out as you choose.</p>
        </div>

        <div className="bz-ts-grid">
          <section className="bz-ts-preview" aria-label="Your table, from above">
            <div className="card">
              <div className="cap"><b>From above</b> · {layout.tables} {design.shape === "round" ? "round" : "long"} table{layout.tables > 1 ? "s" : ""} · {design.kids} kids</div>
              <TableSketch design={design} className="bz-ts-sketch" />
              <p className="note">A live sketch of your choices, to scale — not a photo.</p>
            </div>
          </section>

          <section className="bz-ts-options" aria-label="Your table">
            <div className="bz-ts-group">
              <h2>1. Theme</h2>
              <div className="bz-ts-pills wrap" role="radiogroup" aria-label="Theme">
                {THEMES.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={t.id === design.theme} className={t.id === design.theme ? "on" : ""}
                    onClick={() => setDesign((d) => d && { ...d, theme: t.id, runnerColor: t.balloonColors[1] ?? t.accent })}>{t.name}</button>
                ))}
              </div>
            </div>

            <div className="bz-ts-group">
              <h2>2. How many kids?</h2>
              <div className="bz-ts-row">
                <div className="bz-stepper" role="group" aria-label="Number of kids">
                  <button type="button" aria-label="One fewer child" disabled={design.kids <= MIN_KIDS} onClick={() => set({ kids: clampKids(design.kids - 1) })}>−</button>
                  <span data-testid="kids-count">{design.kids}</span>
                  <button type="button" aria-label="One more child" className="plus" disabled={design.kids >= MAX_KIDS} onClick={() => set({ kids: clampKids(design.kids + 1) })}>+</button>
                </div>
                <span className="hint">{layout.tables} table{layout.tables > 1 ? "s" : ""}, {layout.seats} seats · {MIN_KIDS}–{MAX_KIDS} kids</span>
              </div>
            </div>

            <div className="bz-ts-group">
              <h2>3. Tables</h2>
              <div className="bz-ts-cards">
                {(Object.keys(TABLES) as (keyof typeof TABLES)[]).map((id) => (
                  <button key={id} type="button" className={`bz-choice ${design.shape === id ? "selected" : ""}`} aria-pressed={design.shape === id} onClick={() => set({ shape: id })}>
                    {design.shape === id && <span className="tick">✓</span>}
                    <h3>{TABLES[id].label}</h3>
                    <p>{TABLES[id].desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bz-ts-group">
              <h2>4. Chairs</h2>
              <Pills label="Chairs" value={design.chairs} onChange={(chairs) => set({ chairs })}
                options={CHAIRS.map((c) => ({ id: c.id, label: P.chairUpgrade[c.id] ? `${c.label} +${P.chairUpgrade[c.id]}` : c.label }))} />
            </div>

            <div className="bz-ts-group">
              <h2>5. Tablecloth & runner</h2>
              <span className="sub">Tablecloth</span>
              <Swatches label="Tablecloth colour" value={design.clothColor} colours={swatches} onChange={(clothColor) => set({ clothColor })} />
              <span className="sub">Runner</span>
              <Pills label="Runner" value={design.runner} onChange={(runner) => set({ runner })} options={RUNNERS} />
              {design.runner !== "none" && <Swatches label="Runner colour" value={design.runnerColor} colours={swatches} onChange={(runnerColor) => set({ runnerColor })} />}
            </div>

            <div className="bz-ts-group">
              <h2>6. Tableware</h2>
              <div className="bz-ts-cards three">
                {TABLEWARE.map((t) => (
                  <button key={t.id} type="button" className={`bz-choice ${design.tableware === t.id ? "selected" : ""}`} aria-pressed={design.tableware === t.id} onClick={() => set({ tableware: t.id })}>
                    {design.tableware === t.id && <span className="tick">✓</span>}
                    <h3>{t.label}</h3>
                    <p>{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bz-ts-group">
              <h2>7. Centrepiece</h2>
              <Pills label="Centrepiece" value={design.centrepiece} onChange={(centrepiece) => set({ centrepiece })} options={CENTREPIECES} />
            </div>

            <div className="bz-ts-group">
              <h2>8. At every seat</h2>
              <Toggle label="Name cards" note={`Each child's name · AED ${P.placeCard} each`} on={design.placeCards} onChange={(placeCards) => set({ placeCards })} />
              <Toggle label="Party favour boxes" note={`A little gift to take home · AED ${P.favourBox} each`} on={design.favourBoxes} onChange={(favourBoxes) => set({ favourBoxes })} />
              <Toggle label="Party hats" note={`In the theme's colours · AED ${P.partyHat} each`} on={design.partyHats} onChange={(partyHats) => set({ partyHats })} />
            </div>

            <div className="bz-ts-group bz-ts-total" data-testid="table-total">
              <h2>Your table so far</h2>
              <ul>{price.lines.map((l) => <li key={l.label}><span>{l.label}</span><b>AED {formatAED(l.amount)}</b></li>)}</ul>
              <div className="sum"><span>Estimate</span><b>AED {formatAED(price.total)}</b></div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
