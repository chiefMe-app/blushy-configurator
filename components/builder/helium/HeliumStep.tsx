// The Decor step's seventh part (2026-11-04, the owner: "oldu sanki artık geçelim diğer section'a"; her answers:
// weighted bouquets, ceiling balloons and a name bubble; theme-shape, number, letter and plain foils): a yes / skip
// first, then on one page — the balloons' colours, the bouquets and the foil on each, the age in giant foil digits,
// the name in foil letters, the ceiling and the bubble (lib/studio/helium.ts).
import { useState } from "react";
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { SEMPERTEX_CATALOG, type SempertexColor } from "@/lib/sempertexCatalog";
import { themeBalloonSets } from "@/lib/balloonSets";
import {
  BOUQUET_SIZES, BUBBLE_CM, BUBBLE_FILLINGS, BUBBLE_PRICE, CEILING_COUNTS, FOIL_COLOURS, LATEX_CM, LETTER_CM, LETTER_PRICE, MAX_BOUQUETS, MAX_LATEX_COLOURS,
  MAX_FOILS, NUMBER_SIZES, PLAIN_FOIL_PRICE, THEME_FOIL_PRICE, cleanBubbleName, cleanLetters, defaultHelium, foilsFor, heliumPicture,
  heliumTotal, isPlainFoil, latexHex, numberPrice, sempertexBalloon, type Helium,
} from "@/lib/studio/helium";
import { cleanAge } from "@/lib/studio/pinata";
import { cakeSeed } from "@/components/builder/cake/CakeStep";
import { FinishBar } from "@/components/builder/table/AdultTableStep";
import type { PieceRender } from "@/components/builder/usePieceRender";

/** The backdrop's Sempertex balloons, by id (its pick is kept by code and finish). */
function backdropBalloons(config: BuilderConfig): string[] {
  return (config.decor.sempertexSelection ?? [])
    .map((p) => SEMPERTEX_CATALOG.find((c) => c.code === p.code && c.finish === p.finish)?.id)
    .filter((id): id is string => !!id);
}

/** What the balloons start from: the name and age the party already has, and the backdrop's Sempertex balloons or the theme's. */
export function heliumSeed(config: BuilderConfig) {
  const s = cakeSeed(config);
  const age = s.age || (config.cake?.enabled ? config.cake.topper.age : "") || "";
  const own = backdropBalloons(config);
  const balloons = (own.length ? own : themeBalloonSets(config.theme ?? "").pastel).filter((id) => !/clear/i.test(sempertexBalloon(id)?.colorName ?? ""));
  return { themeId: s.themeId, age, name: s.name, balloons };
}

/** The catalogue's finishes, to narrow it down. */
const FINISH_FILTERS = ["All", "Pastel Matte", "Fashion", "Satin", "Silk", "Metallic", "Reflex", "Neon", "Pastel Dusk"];

/** A Sempertex balloon as the backdrop shows one: a little balloon in its colour and finish, its code and name. */
function BalloonChip({ c, on, onClick, label }: { c: SempertexColor; on?: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`bz-bl-chip bz-hl-pick ${on ? "on" : ""}`} aria-pressed={on} aria-label={label} title={label}>
      <span className={`ball ${/reflex|chrome|metallic/i.test(c.finish) ? "chrome" : ""} ${/clear/i.test(c.colorName) ? "clear" : ""}`} style={{ ["--c" as string]: c.hex } as React.CSSProperties} aria-hidden="true" />
      <span className="txt"><strong>{c.code}</strong><small>{c.colorName}</small><small>{c.finish}</small></span>
    </button>
  );
}

/** The bubble's lettering colours. */
const BUBBLE_LETTERING = [
  { hex: "#FFFFFF", name: "White" }, { hex: "#D4AF37", name: "Gold" }, { hex: "#F472B6", name: "Pink" }, { hex: "#1F2937", name: "Black" },
];

export default function HeliumStep({ config, setHelium, onFinish, onSkip, render, onGenerate }: {
  config: BuilderConfig;
  setHelium: (h: Helium) => void;
  onFinish: () => void;
  /** No balloons after all: skipped, on to the experiences. */
  onSkip: () => void;
  render: PieceRender;
  onGenerate: () => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const h = config.helium;
  const [browse, setBrowse] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  if (!h || !h.enabled) {
    return (
      <div className="bz-tb-intro" data-testid="helium-intro">
        {/* 2026-11-04 (the owner: "helyum balonlar vibe'ı için buket balon"): the painted bouquet (scripts/packages). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bz-intro-art" src="/design/packages/helium-bouquet.webp" alt="" />
        <h2>Add helium balloons?</h2>
        <p>Bouquets on their weights, the age in giant foil numbers, the name in foil letters, balloons on the ceiling or a clear bubble with the name on it — in your {theme.name} colours. The price adds to your party.</p>
        <div className="actions">
          <button type="button" className="bz-next" onClick={() => setHelium(h ? { ...h, enabled: true, done: false } : defaultHelium(heliumSeed(config)))}>Yes, add balloons ✦</button>
          {!h && <button type="button" className="bz-back" onClick={() => setHelium({ ...defaultHelium(heliumSeed(config)), enabled: false })}>No thanks, skip</button>}
        </div>
        {h && !h.enabled && <p className="skipped">You skipped the helium balloons — they aren&apos;t in your total.</p>}
      </div>
    );
  }

  const set = (patch: Partial<Helium>) => setHelium({ ...h, ...patch });
  const card = (on: boolean, pick: () => void, art: React.ReactNode, name: string, note: string, price: string, key: string, role: "radio" | "checkbox" = "radio") => (
    <button key={key} type="button" role={role} aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`} onClick={pick}>
      {on && <span className="tick">✓</span>}
      {art && <span className="art">{art}</span>}
      <b>{name}</b>{note && <small>{note}</small>}{price && <em>{price}</em>}
    </button>
  );
  const yesNo = (on: boolean, flip: (on: boolean) => void, label: string, testId: string) => (
    <div className="bz-tb-options compact" role="radiogroup" aria-label={label} data-testid={testId}>
      {card(on, () => flip(true), null, "Yes", "", "", "yes")}
      {card(!on, () => flip(false), null, "No", "", "", "no")}
    </div>
  );
  const foilSwatches = (value: string, pick: (hex: string) => void, label: string, testId: string) => (
    <div className="bz-ts-swatches" role="radiogroup" aria-label={label} data-testid={testId}>
      {FOIL_COLOURS.map((c) => (
        <button key={c.hex} type="button" role="radio" aria-checked={value === c.hex} aria-label={c.name} className={value === c.hex ? "on" : ""}
          style={{ background: c.hex }} onClick={() => pick(c.hex)}>{value === c.hex ? "✓" : ""}</button>
      ))}
    </div>
  );
  // Her Sempertex balloons (the owner, 2026-11-04: "Sempertex kataloğundaki gerçek balonlar olmalı, kodları çıkmalı …
  // metalikler de, kataloğun hepsi"): a tap adds one or takes it off (never the last); a fifth takes the first's place.
  const pickBalloon = (id: string) => {
    if (h.balloons.includes(id)) { if (h.balloons.length > 1) set({ balloons: h.balloons.filter((b) => b !== id) }); return; }
    set({ balloons: [...h.balloons, id].slice(-MAX_LATEX_COLOURS) });
  };
  const sets = themeBalloonSets(theme.id);
  const suggested = Array.from(new Set([...backdropBalloons(config), ...sets.pastel, ...sets.bright]))
    .map(sempertexBalloon).filter((c): c is SempertexColor => !!c);
  const q = query.trim().toLowerCase();
  const catalogue = SEMPERTEX_CATALOG.filter((c) => (filter === "All" || c.finish === filter)
    && (!q || c.code.includes(q) || `${c.colorName} ${c.finish} ${c.family}`.toLowerCase().includes(q)));
  // eslint-disable-next-line @next/next/no-img-element
  const foilPic = (id: string) => <img className="photo cutout" style={{ objectFit: "contain" }} src={heliumPicture(id).src} alt="" loading="lazy" />;
  // Several foils (the owner, 2026-11-04: "birkaç tane foil balon seçebilsin"): a tap adds one or takes it off; a
  // fourth takes the place of the first.
  const pickFoil = (id: (typeof h.foils)[number]) =>
    set({ foils: h.foils.includes(id) ? h.foils.filter((f) => f !== id) : [...h.foils, id].slice(-MAX_FOILS) });
  const latexDot = (id: string, i: number) => <span key={i} className="bz-hl-dot" style={{ background: latexHex(id) }} />;

  return (
    <div className="bz-tb" data-testid="helium">
      <section className="bz-tb-section" aria-label="Balloon colours">
        <h2>Sempertex balloons</h2>
        <div className="bz-tb-item">
          <p className="bz-tb-sub" style={{ fontWeight: 400 }}>Up to {MAX_LATEX_COLOURS} real Sempertex balloons, by their code, for the bouquets and the ceiling — mixed together at random.</p>
          <div className="bz-bl-chips bz-hl-chips" role="group" aria-label="Your balloons" data-testid="helium-colours">
            {h.balloons.map(sempertexBalloon).filter((c): c is SempertexColor => !!c).map((c) => (
              <BalloonChip key={c.id} c={c} on onClick={() => pickBalloon(c.id)} label={`Remove ${c.code} ${c.finish} ${c.colorName}`} />
            ))}
          </div>
        </div>
        <div className="bz-tb-item">
          <h3>For your {theme.name} theme</h3>
          <div className="bz-bl-chips bz-hl-chips" role="group" aria-label="Balloons for your theme" data-testid="helium-theme-balloons">
            {suggested.map((c) => <BalloonChip key={c.id} c={c} on={h.balloons.includes(c.id)} onClick={() => pickBalloon(c.id)} label={`${c.code} ${c.finish} ${c.colorName}`} />)}
          </div>
          <button type="button" className={`bz-st-chip ${browse ? "on" : ""}`} style={{ marginTop: 10 }} data-testid="helium-sempertex-open" onClick={() => setBrowse((v) => !v)}>
            {browse ? "Done" : "All Sempertex balloons"}
          </button>
        </div>
        {browse && (
          <div className="bz-tb-item" data-testid="helium-sempertex">
            <input type="text" className="bz-hl-search" aria-label="Search Sempertex balloons" placeholder="Search a code or colour, e.g. 609, Reflex Gold, Metallic"
              value={query} onChange={(e) => setQuery(e.target.value)} data-testid="helium-sempertex-search" />
            <div className="bz-hl-filters" role="group" aria-label="Finish">
              {FINISH_FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
            <div className="bz-bl-chips bz-hl-chips" role="group" aria-label="The Sempertex catalogue">
              {catalogue.map((c) => <BalloonChip key={c.id} c={c} on={h.balloons.includes(c.id)} onClick={() => pickBalloon(c.id)} label={`${c.code} ${c.finish} ${c.colorName}`} />)}
              {!catalogue.length && <p className="bz-tb-sub">No Sempertex balloon by that name or code.</p>}
            </div>
          </div>
        )}
      </section>

      <section className="bz-tb-section" aria-label="Bouquets">
        <h2>Bouquets</h2>
        <div className="bz-tb-item">
          <h3>How many</h3>
          <div className="bz-hl-count" data-testid="helium-bouquets">
            <button type="button" aria-label="One bouquet less" disabled={h.bouquets <= 0} onClick={() => set({ bouquets: h.bouquets - 1 })}>−</button>
            <b aria-live="polite">{h.bouquets}</b>
            <button type="button" aria-label="One bouquet more" disabled={h.bouquets >= MAX_BOUQUETS} onClick={() => set({ bouquets: h.bouquets + 1 })}>+</button>
            <small>{h.bouquets ? "Each on its own weight, standing on the floor." : "No bouquets."}</small>
          </div>
        </div>
        {h.bouquets > 0 && <>
          <div className="bz-tb-item">
            <h3>Their size</h3>
            <div className="bz-tb-options" role="radiogroup" aria-label="Bouquet size" data-testid="helium-size">
              {BOUQUET_SIZES.map((s) => card(h.size === s.id, () => set({ size: s.id }),
                <span className="bz-hl-dots">{Array.from({ length: s.balloons }, (_, i) => latexDot(h.balloons[i % h.balloons.length], i))}</span>,
                s.name, `${s.balloons} balloons, ${LATEX_CM} cm`, `AED ${formatAED(s.price)} each`, s.id))}
            </div>
          </div>
          <div className="bz-tb-item">
            <h3>The foils on top</h3>
            <p className="bz-tb-sub" style={{ fontWeight: 400 }}>Up to {MAX_FOILS} on each bouquet — the first you pick is the big one in the middle.</p>
            <div className="bz-tb-options" role="group" aria-label="Foils on top" data-testid="helium-topper">
              {card(!h.foils.length, () => set({ foils: [] }), null, "No foil", "Latex only", "", "none", "checkbox")}
              {foilsFor(theme.id).map((f) => card(h.foils.includes(f.id), () => pickFoil(f.id), foilPic(f.id), f.name,
                f.own ? `${f.cm} cm · your ${theme.name} theme` : f.plain ? `${f.cm} cm · in your colour` : `${f.cm} cm`, `+AED ${formatAED(f.plain ? PLAIN_FOIL_PRICE : THEME_FOIL_PRICE)}`, f.id, "checkbox"))}
            </div>
          </div>
          {h.foils.some(isPlainFoil) && (
            <div className="bz-tb-item">
              <h3>The plain foils&apos; colour</h3>
              {foilSwatches(h.topperColour, (hex) => set({ topperColour: hex }), "Foil colour", "helium-topper-colour")}
            </div>
          )}
        </>}
      </section>

      <section className="bz-tb-section" aria-label="The age">
        <h2>The age in foil numbers</h2>
        <div className="bz-tb-item">
          {yesNo(h.number.on, (on) => set({ number: { ...h.number, on } }), "Foil number", "helium-number-on")}
        </div>
        {h.number.on && <>
          <div className="bz-tb-item">
            <label className="bz-gv-count">
              <input type="text" inputMode="numeric" maxLength={2} value={h.number.value} data-testid="helium-number" aria-label="The age in foil numbers"
                onFocus={(e) => e.target.select()} onChange={(e) => { const n = cleanAge(e.target.value); if (n) set({ number: { ...h.number, value: n } }); }} />
              <small>{h.number.value.length > 1 ? "Two numbers, side by side, priced each." : "One number."}</small>
            </label>
          </div>
          <div className="bz-tb-item">
            <h3>How tall</h3>
            <div className="bz-tb-options compact" role="radiogroup" aria-label="Number size" data-testid="helium-number-size">
              {NUMBER_SIZES.map((s) => card(h.number.size === s.id, () => set({ number: { ...h.number, size: s.id } }), null, s.name, "",
                `AED ${formatAED(numberPrice({ ...h.number, size: s.id }))}`, s.id))}
            </div>
          </div>
          <div className="bz-tb-item">
            <h3>Its colour</h3>
            {foilSwatches(h.number.colour, (hex) => set({ number: { ...h.number, colour: hex } }), "Number colour", "helium-number-colour")}
          </div>
        </>}
      </section>

      <section className="bz-tb-section" aria-label="The name">
        <h2>The name in foil letters</h2>
        <div className="bz-tb-item">
          {yesNo(h.letters.on, (on) => set({ letters: { ...h.letters, on } }), "Foil letters", "helium-letters-on")}
        </div>
        {h.letters.on && <>
          <div className="bz-tb-item">
            <label className="bz-gv-count">
              <input type="text" maxLength={10} value={h.letters.text} data-testid="helium-letters" aria-label="The name in foil letters" placeholder="ARYA"
                onChange={(e) => set({ letters: { ...h.letters, text: cleanLetters(e.target.value) } })} />
              <small>{LETTER_CM} cm letters on the wall · AED {formatAED(LETTER_PRICE)} a letter</small>
            </label>
          </div>
          <div className="bz-tb-item">
            <h3>Their colour</h3>
            {foilSwatches(h.letters.colour, (hex) => set({ letters: { ...h.letters, colour: hex } }), "Letters colour", "helium-letters-colour")}
          </div>
        </>}
      </section>

      <section className="bz-tb-section" aria-label="Ceiling balloons">
        <h2>Ceiling balloons</h2>
        <div className="bz-tb-item">
          <div className="bz-tb-options compact" role="radiogroup" aria-label="Ceiling balloons" data-testid="helium-ceiling">
            {CEILING_COUNTS.map((c) => card(h.ceiling === c.count, () => set({ ceiling: c.count }), null, c.count ? `${c.count} balloons` : "None",
              c.count ? `${LATEX_CM} cm, floating, ribbons hanging` : "", c.count ? `AED ${formatAED(c.price)}` : "", String(c.count)))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Name bubble">
        <h2>A bubble with the name</h2>
        <div className="bz-tb-item">
          <p className="bz-tb-sub" style={{ fontWeight: 400 }}>A big {BUBBLE_CM} cm clear bubble balloon, filled, the name on it · AED {formatAED(BUBBLE_PRICE)}</p>
          {yesNo(h.bubble.on, (on) => set({ bubble: { ...h.bubble, on } }), "Name bubble", "helium-bubble-on")}
        </div>
        {h.bubble.on && <>
          <div className="bz-tb-item">
            <label className="bz-gv-count">
              <input type="text" maxLength={12} value={h.bubble.name} data-testid="helium-bubble-name" aria-label="The name on the bubble" placeholder="Arya"
                onChange={(e) => set({ bubble: { ...h.bubble, name: cleanBubbleName(e.target.value) } })} />
            </label>
          </div>
          <div className="bz-tb-item">
            <h3>Inside it</h3>
            <div className="bz-tb-options compact" role="radiogroup" aria-label="Inside the bubble" data-testid="helium-bubble-filling">
              {BUBBLE_FILLINGS.map((f) => card(h.bubble.filling === f.id, () => set({ bubble: { ...h.bubble, filling: f.id } }), null, f.name, "",
                f.price ? `+AED ${formatAED(f.price)}` : "Included", f.id))}
            </div>
          </div>
          <div className="bz-tb-item">
            <h3>The lettering</h3>
            <div className="bz-ts-swatches" role="radiogroup" aria-label="Bubble lettering" data-testid="helium-bubble-colour">
              {BUBBLE_LETTERING.map((c) => (
                <button key={c.hex} type="button" role="radio" aria-checked={h.bubble.colour === c.hex} aria-label={c.name} className={h.bubble.colour === c.hex ? "on" : ""}
                  style={{ background: c.hex }} onClick={() => set({ bubble: { ...h.bubble, colour: c.hex } })}>{h.bubble.colour === c.hex ? "✓" : ""}</button>
              ))}
            </div>
          </div>
        </>}
      </section>

      <div className="bz-tb-sum" data-testid="helium-total">
        <span>Helium balloons</span>
        <b>AED {formatAED(heliumTotal(h))}</b>
        <button type="button" className="bz-restart" onClick={() => setHelium({ ...h, enabled: false, done: false })}>Remove the balloons</button>
      </div>
      <FinishBar done={h.done} what="balloons" next="Experiences" onFinish={onFinish} onSkip={onSkip} testId="finish-helium" render={{ ...render, onGenerate }} />
    </div>
  );
}
