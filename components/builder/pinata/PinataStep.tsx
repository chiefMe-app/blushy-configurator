// The Decor step's fifth part (2026-11-03, the owner: "şimdi piñata studio'ya geçelim"): a yes / skip first, then
// on one page — a number piñata (the age, in up to three colours) or a theme shape, how it opens, and what goes in
// it (lib/studio/pinata.ts).
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { PLAIN_COLOURS } from "@/lib/studio/tableCatalog";
import {
  EXTRA_DIGIT_PRICE, MAX_PINATA_COLOURS, PINATA_FILLINGS, PINATA_OPENINGS, PINATA_SIZES,
  cleanAge, defaultPinata, pinataPrice, pinataShapesFor, pinataTotal, shapePicture, type Pinata,
} from "@/lib/studio/pinata";
import { PinataPiece } from "./PinataPreview";
import { FinishBar } from "@/components/builder/table/AdultTableStep";
import type { PieceRender } from "@/components/builder/usePieceRender";

/** What the piñata starts from: the age the welcome board already says, the theme's balloon colours. */
export function pinataSeed(config: BuilderConfig) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const said = `${config.welcomeBoard?.heading ?? ""} ${config.welcomeBoard?.name ?? ""} ${config.welcomeBoard?.line ?? ""}`.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/)?.[1];
  const colours = theme.balloonColors.filter((h) => h.toUpperCase() !== "#FFFFFF").slice(0, MAX_PINATA_COLOURS);
  return { themeId: theme.id, age: said ?? "", colours };
}

export default function PinataStep({ config, setPinata, onFinish, onSkip, render, onGenerate }: {
  config: BuilderConfig;
  setPinata: (p: Pinata) => void;
  onFinish: () => void;
  /** No piñata after all: skipped, on to the cake. */
  onSkip: () => void;
  render: PieceRender;
  onGenerate: () => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const p = config.pinata;

  if (!p || !p.enabled) {
    return (
      <div className="bz-tb-intro" data-testid="pinata-intro">
        <h2>Add a piñata?</h2>
        <p>A tissue-fringe piñata, medium or large — the age, or a shape for your {theme.name} theme — filled and hung on its stand. The price adds to your party.</p>
        <div className="actions">
          <button type="button" className="bz-next" onClick={() => setPinata(p ? { ...p, enabled: true, done: false } : defaultPinata(pinataSeed(config)))}>Yes, add a piñata ✦</button>
          {!p && <button type="button" className="bz-back" onClick={() => setPinata({ ...defaultPinata(pinataSeed(config)), enabled: false })}>No thanks, skip</button>}
        </div>
        {p && !p.enabled && <p className="skipped">You skipped the piñata — it isn&apos;t in your total.</p>}
      </div>
    );
  }

  const set = (patch: Partial<Pinata>) => setPinata({ ...p, ...patch });
  const card = (on: boolean, pick: () => void, art: React.ReactNode, name: string, note: string, price: string, key: string) => (
    <button key={key} type="button" role="radio" aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`} onClick={pick}>
      {on && <span className="tick">✓</span>}
      <span className="art">{art}</span>
      <b>{name}</b>{note && <small>{note}</small>}{price && <em>{price}</em>}
    </button>
  );
  const piece = (q: Pinata, uid: string) => <svg viewBox="0 0 120 90" aria-hidden="true"><PinataPiece p={q} x={60} top={6} tall={78} maxW={108} uid={uid} /></svg>;
  const swatches = Array.from(new Set([...theme.balloonColors, ...theme.backdropColors, ...PLAIN_COLOURS.map((c) => c.hex)].map((h) => h.toUpperCase())));
  const colours = p.colours.map((h) => h.toUpperCase());
  const pickColour = (hex: string) => {
    const at = colours.indexOf(hex);
    if (at >= 0) { if (colours.length > 1) set({ colours: p.colours.filter((_, i) => i !== at) }); return; }
    set({ colours: [...p.colours, hex].slice(-MAX_PINATA_COLOURS) });
  };
  const shapes = pinataShapesFor(theme.id);

  return (
    <div className="bz-tb" data-testid="pinata">
      <section className="bz-tb-section" aria-label="The piñata">
        <h2>The piñata</h2>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="Piñata" data-testid="pinata-kind">
            {card(p.kind === "number", () => set({ kind: "number" }), piece({ ...p, kind: "number" }, "pn-k-num"),
              "Number", "The age, in the colours you pick", `AED ${formatAED(pinataPrice({ ...p, kind: "number" }))}`, "number")}
            {card(p.kind === "shape", () => set({ kind: "shape" }), piece({ ...p, kind: "shape" }, "pn-k-shape"),
              "Theme shape", `A fringe shape for your ${theme.name} theme`, `AED ${formatAED(pinataPrice({ ...p, kind: "shape" }))}`, "shape")}
          </div>
        </div>
        {p.kind === "number" ? <>
          <div className="bz-tb-item">
            <h3>The age</h3>
            <label className="bz-gv-count">
              <input type="text" inputMode="numeric" maxLength={2} value={p.number} data-testid="pinata-number" aria-label="The age on the piñata"
                onFocus={(e) => e.target.select()} onChange={(e) => { const n = cleanAge(e.target.value); if (n) set({ number: n }); }} />
              <small>{p.number.length > 1 ? `Two numbers, side by side — +AED ${formatAED(EXTRA_DIGIT_PRICE[p.size])} for the second.` : "One number."}</small>
            </label>
          </div>
          <div className="bz-tb-item">
            <h3>Its colours</h3>
            <p className="bz-tb-sub" style={{ fontWeight: 400 }}>Pick up to {MAX_PINATA_COLOURS} — in bands, top to bottom, in the order you pick them.</p>
            <div className="bz-ts-swatches" role="group" aria-label="Piñata colours" data-testid="pinata-colours">
              {swatches.map((hex) => {
                const at = colours.indexOf(hex);
                return (
                  <button key={hex} type="button" aria-pressed={at >= 0} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
                    className={at >= 0 ? "on" : ""} style={{ background: hex }} onClick={() => pickColour(hex)}>{at >= 0 ? at + 1 : ""}</button>
                );
              })}
            </div>
          </div>
        </> : (
          <div className="bz-tb-item">
            <h3>The shape</h3>
            <div className="bz-tb-options" role="radiogroup" aria-label="Piñata shape" data-testid="pinata-shape">
              {shapes.map((s) => card(p.shape === s.id, () => set({ shape: s.id }),
                // eslint-disable-next-line @next/next/no-img-element
                <img className="photo cutout" style={{ objectFit: "contain" }} src={shapePicture(s.id).src} alt="" loading="lazy" />, s.name, s.own ? `Your ${theme.name} theme` : "", "", s.id))}
            </div>
          </div>
        )}
      </section>

      {/* 2026-11-03 (the owner: "size seçilsin, medium ve large iki size olsun"). */}
      <section className="bz-tb-section" aria-label="Size">
        <h2>Size</h2>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="Size" data-testid="pinata-size">
            {PINATA_SIZES.map((s) => card(p.size === s.id, () => set({ size: s.id }),
              <svg viewBox="0 0 120 90" aria-hidden="true"><PinataPiece p={p} x={60} top={84 - s.cm * 1.05} tall={s.cm * 1.05} maxW={s.cm * 1.5} uid={`pn-s-${s.id}`} /></svg>,
              s.name, s.note, `AED ${formatAED(pinataPrice({ ...p, size: s.id }))}`, s.id))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="How it opens">
        <h2>How it opens</h2>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="How it opens" data-testid="pinata-opening">
            {PINATA_OPENINGS.map((o) => card(p.opening === o.id, () => set({ opening: o.id }),
              <svg viewBox="0 0 120 90" aria-hidden="true">
                <PinataPiece p={p} x={60} top={4} tall={48} maxW={70} uid={`pn-o-${o.id}`} />
                {o.id === "pull"
                  ? Array.from({ length: 6 }, (_, i) => <path key={i} d={`M ${47 + i * 5} 50 q 3 16 0 34`} stroke={(p.colours[i % p.colours.length] ?? "#F8BBD0")} strokeWidth={2} fill="none" strokeLinecap="round" />)
                  : <><path d="M 24 86 L 98 58" stroke="#C084FC" strokeWidth={6} strokeLinecap="round" /><path d="M 70 86 q 12 -6 26 -1" stroke="#6D28D9" strokeWidth={5} fill="none" strokeLinecap="round" /></>}
              </svg>, o.name, o.note, o.price ? `+AED ${formatAED(o.price)}` : "Included", o.id))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="What's inside">
        <h2>What&apos;s inside</h2>
        <div className="bz-tb-item">
          <div className="bz-gv-contents" data-testid="pinata-fillings">
            {PINATA_FILLINGS.map((f) => {
              const on = p.fillings.includes(f.id);
              return (
                <label key={f.id} className={on ? "on" : ""}>
                  <input type="checkbox" checked={on} onChange={() => set({ fillings: on ? p.fillings.filter((x) => x !== f.id) : PINATA_FILLINGS.filter((x) => x.id === f.id || p.fillings.includes(x.id)).map((x) => x.id) })} />
                  <span><b>{f.name}</b><small>{f.id === "toys" ? `Little toys in the ${theme.name} theme` : f.note} · +AED {formatAED(f.price)}</small></span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <div className="bz-tb-sum" data-testid="pinata-total">
        <span>Piñata</span>
        <b>AED {formatAED(pinataTotal(p))}</b>
        <button type="button" className="bz-restart" onClick={() => setPinata({ ...p, enabled: false, done: false })}>Remove the piñata</button>
      </div>
      <FinishBar done={p.done} what="piñata" next="Cake & Sweets" onFinish={onFinish} onSkip={onSkip} testId="finish-pinata" render={{ ...render, onGenerate }} />
    </div>
  );
}
