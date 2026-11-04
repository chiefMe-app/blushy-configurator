// The Decor step's seventh part (2026-11-04, the owner: "oldu sanki artık geçelim diğer section'a"; her answers:
// weighted bouquets, ceiling balloons and a name bubble; theme-shape, number, letter and plain foils): a yes / skip
// first, then on one page — the balloons' colours, the bouquets and the foil on each, the age in giant foil digits,
// the name in foil letters, the ceiling and the bubble (lib/studio/helium.ts).
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { PLAIN_COLOURS } from "@/lib/studio/tableCatalog";
import {
  BOUQUET_SIZES, BUBBLE_CM, BUBBLE_FILLINGS, BUBBLE_PRICE, CEILING_COUNTS, FOIL_COLOURS, LATEX_CM, LETTER_CM, LETTER_PRICE, MAX_BOUQUETS, MAX_LATEX_COLOURS,
  MAX_FOILS, NUMBER_SIZES, PLAIN_FOIL_PRICE, THEME_FOIL_PRICE, cleanBubbleName, cleanLetters, defaultHelium, foilsFor, heliumPicture,
  heliumTotal, isPlainFoil, numberPrice, type Helium,
} from "@/lib/studio/helium";
import { cleanAge } from "@/lib/studio/pinata";
import { cakeSeed } from "@/components/builder/cake/CakeStep";
import { FinishBar } from "@/components/builder/table/AdultTableStep";
import type { PieceRender } from "@/components/builder/usePieceRender";

/** What the balloons start from: the name and age the party already has, the theme and the backdrop's balloon colours. */
export function heliumSeed(config: BuilderConfig) {
  const s = cakeSeed(config);
  const age = s.age || (config.cake?.enabled ? config.cake.topper.age : "") || "";
  const colours = (config.decor.balloonColors?.length ? config.decor.balloonColors : s.colours ?? []).filter((h) => h.toUpperCase() !== "#FFFFFF");
  return { themeId: s.themeId, age, name: s.name, colours };
}

/** The bubble's lettering colours. */
const BUBBLE_LETTERING = [
  { hex: "#FFFFFF", name: "White" }, { hex: "#D4AF37", name: "Gold" }, { hex: "#F472B6", name: "Pink" }, { hex: "#1F2937", name: "Black" },
];

export default function HeliumStep({ config, setHelium, onFinish, onSkip, render, onGenerate }: {
  config: BuilderConfig;
  setHelium: (h: Helium) => void;
  onFinish: () => void;
  /** No balloons after all: skipped, on to Package. */
  onSkip: () => void;
  render: PieceRender;
  onGenerate: () => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const h = config.helium;

  if (!h || !h.enabled) {
    return (
      <div className="bz-tb-intro" data-testid="helium-intro">
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
  const swatches = Array.from(new Set([...theme.balloonColors, ...config.decor.balloonColors, ...PLAIN_COLOURS.map((c) => c.hex)].map((x) => x.toUpperCase())));
  const colours = h.colours.map((x) => x.toUpperCase());
  const pickColour = (hex: string) => {
    const at = colours.indexOf(hex);
    if (at >= 0) { if (colours.length > 1) set({ colours: h.colours.filter((_, i) => i !== at) }); return; }
    set({ colours: [...h.colours, hex].slice(-MAX_LATEX_COLOURS) });
  };
  // eslint-disable-next-line @next/next/no-img-element
  const foilPic = (id: string) => <img className="photo cutout" style={{ objectFit: "contain" }} src={heliumPicture(id).src} alt="" loading="lazy" />;
  // Several foils (the owner, 2026-11-04: "birkaç tane foil balon seçebilsin"): a tap adds one or takes it off; a
  // fourth takes the place of the first.
  const pickFoil = (id: (typeof h.foils)[number]) =>
    set({ foils: h.foils.includes(id) ? h.foils.filter((f) => f !== id) : [...h.foils, id].slice(-MAX_FOILS) });
  const latexDot = (hex: string, i: number) => <span key={i} className="bz-hl-dot" style={{ background: hex }} />;

  return (
    <div className="bz-tb" data-testid="helium">
      <section className="bz-tb-section" aria-label="Balloon colours">
        <h2>Balloon colours</h2>
        <div className="bz-tb-item">
          <p className="bz-tb-sub" style={{ fontWeight: 400 }}>Up to {MAX_LATEX_COLOURS}, for the bouquets and the ceiling — mixed together at random.</p>
          <div className="bz-ts-swatches" role="group" aria-label="Balloon colours" data-testid="helium-colours">
            {swatches.map((hex) => {
              const at = colours.indexOf(hex);
              return (
                <button key={hex} type="button" aria-pressed={at >= 0} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
                  className={at >= 0 ? "on" : ""} style={{ background: hex }} onClick={() => pickColour(hex)}>{at >= 0 ? at + 1 : ""}</button>
              );
            })}
          </div>
        </div>
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
                <span className="bz-hl-dots">{Array.from({ length: s.balloons }, (_, i) => latexDot(h.colours[i % h.colours.length], i))}</span>,
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
      <FinishBar done={h.done} what="balloons" next="Package" onFinish={onFinish} onSkip={onSkip} testId="finish-helium" render={{ ...render, onGenerate }} />
    </div>
  );
}
