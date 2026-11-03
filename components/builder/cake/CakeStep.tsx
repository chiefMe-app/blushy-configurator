// The Decor step's sixth part (2026-11-03, the owner: "piñatadan sonra cake studio'ya geçelim"): a yes / skip
// first, then on one page — a design to start from (four for the theme, or a plain cake), its tiers, how it is
// decorated, each tier's colour, the figures on top, the topper with the name and age, and the flavour
// (lib/studio/cake.ts).
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { PLAIN_COLOURS } from "@/lib/studio/tableCatalog";
import {
  CAKE_FLAVOURS, CAKE_SPRINKLES, CAKE_STYLES, CAKE_TIERS, FIGURE_KINDS, RAINBOW_PRICE, RAINBOW_TIERS, rainbowOf, MAX_CAKE_DECOS, MAX_CAKE_FIGURES, TOPPER_CARDS, TOPPER_COLOURS, TOPPER_PLACES, TOPPER_PRICE,
  addItem, cakeDesigns, cakeFiguresFor, cakePrice, cakeTotal, defaultCake, figureKind, figurePicture, roomFor, type Cake, type CakeSeed,
} from "@/lib/studio/cake";
import { cleanAge } from "@/lib/studio/pinata";
import { TABLE_FONTS, fontCss } from "@/lib/studio/tableFonts";
import { CakeThumb } from "./CakePreview";
import { FinishBar } from "@/components/builder/table/AdultTableStep";
import type { PieceRender } from "@/components/builder/usePieceRender";

/** What the cake starts from: the name and age the party already has, the theme and its balloon colours. */
export function cakeSeed(config: BuilderConfig): CakeSeed {
  const theme = themeById(config.theme) ?? THEMES[0];
  const board = config.welcomeBoard?.enabled ? config.welcomeBoard : undefined;
  const said = `${board?.heading ?? ""} ${board?.name ?? ""} ${board?.line ?? ""}`.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/)?.[1];
  const age = said ?? (config.pinata?.enabled && config.pinata.kind === "number" ? config.pinata.number : "");
  const name = (board?.name.replace(/['’]s$/i, "") || (config.giveaways?.enabled ? config.giveaways.name.split(/['’]s\s/i)[0] : "") || "").trim();
  const colours = theme.balloonColors.filter((h) => h.toUpperCase() !== "#FFFFFF");
  return { themeId: theme.id, themeName: theme.name, name: /\d/.test(name) ? "" : name, age, colours };
}

const TIER_NAMES: Record<number, string[]> = { 1: ["The cake"], 2: ["Bottom tier", "Top tier"], 3: ["Bottom tier", "Middle tier", "Top tier"] };

export default function CakeStep({ config, setCake, onFinish, onSkip, render, onGenerate }: {
  config: BuilderConfig;
  setCake: (k: Cake) => void;
  onFinish: () => void;
  /** No cake after all: skipped, on to Package. */
  onSkip: () => void;
  render: PieceRender;
  onGenerate: () => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const k = config.cake;

  if (!k || !k.enabled) {
    return (
      <div className="bz-tb-intro" data-testid="cake-intro">
        <h2>Add a cake?</h2>
        <p>A birthday cake for your {theme.name} theme — one to three tiers, its colours, figures on top and a topper with the name — shown on its stand. The price adds to your party.</p>
        <div className="actions">
          <button type="button" className="bz-next" onClick={() => setCake(k ? { ...k, enabled: true, done: false } : defaultCake(cakeSeed(config)))}>Yes, add a cake ✦</button>
          {!k && <button type="button" className="bz-back" onClick={() => setCake({ ...defaultCake(cakeSeed(config)), enabled: false })}>No thanks, skip</button>}
        </div>
        {k && !k.enabled && <p className="skipped">You skipped the cake — it isn&apos;t in your total.</p>}
      </div>
    );
  }

  const set = (patch: Partial<Cake>) => setCake({ ...k, ...patch });
  const card = (on: boolean, pick: () => void, art: React.ReactNode, name: string, note: string, price: string, key: string) => (
    <button key={key} type="button" role="radio" aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`} onClick={pick}>
      {on && <span className="tick">✓</span>}
      <span className="art">{art}</span>
      <b>{name}</b>{note && <small>{note}</small>}{price && <em>{price}</em>}
    </button>
  );
  const seed = cakeSeed(config);
  const designs = cakeDesigns(seed);
  // A design is where the cake starts: the name, age and lettering she typed stay, and the flavour.
  // Where the design puts the topper and on what (a card, the front) comes with it.
  const designTopper = (d: (typeof designs)[number]): Cake["topper"] => {
    const { on, at, x, up, y, s, card } = d.cake.topper;
    return { name: k.topper.name, age: k.topper.age, font: k.topper.font, colour: k.topper.colour, on, at, x, up, y, s, card };
  };
  const pickDesign = (d: (typeof designs)[number]) => set({ ...d.cake, topper: designTopper(d), flavour: k.flavour });
  const swatches = Array.from(new Set(["#FFFFFF", ...theme.balloonColors, ...theme.backdropColors, ...PLAIN_COLOURS.map((c) => c.hex)].map((h) => h.toUpperCase())));
  const full = k.figures.filter((f) => figureKind(f.id) !== "deco").length >= MAX_CAKE_FIGURES;
  const setTopper = (patch: Partial<Cake["topper"]>) => set({ topper: { ...k.topper, ...patch } });
  const fontSample = k.topper.name.trim() || "Olivia";

  return (
    <div className="bz-tb" data-testid="cake">
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      <section className="bz-tb-section" aria-label="The design">
        <h2>The design</h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>Start from one of these — then change anything below.</p>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="Cake design" data-testid="cake-design">
            {designs.map((d) => card(k.design === d.id, () => pickDesign(d), <CakeThumb k={{ ...d.cake, enabled: true, topper: designTopper(d) }} uid={`ck-d-${d.id}`} />,
              d.name, d.note, `From AED ${formatAED(cakeTotal({ ...d.cake, enabled: true, flavour: "vanilla" }))}`, d.id))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Tiers">
        <h2>Tiers</h2>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="Tiers" data-testid="cake-tiers">
            {CAKE_TIERS.map((t) => card(k.tiers === t.n, () => set({ tiers: t.n }),
              <CakeThumb k={{ ...k, tiers: t.n, figures: [], topper: { ...k.topper, on: false } }} uid={`ck-t-${t.n}`} />,
              t.name, t.note, `AED ${formatAED(cakePrice({ tiers: t.n, style: k.style }))}`, String(t.n)))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Decoration">
        <h2>Decoration</h2>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="Decoration" data-testid="cake-style">
            {CAKE_STYLES.map((s) => card(k.style === s.id, () => set({ style: s.id }),
              <CakeThumb k={{ ...k, tiers: 1, style: s.id, figures: [], topper: { ...k.topper, on: false } }} uid={`ck-s-${s.id}`} />,
              s.name, s.note, s.price ? `+AED ${formatAED(s.price)} a tier` : "Included", s.id))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Colours">
        <h2>Colours</h2>
        {TIER_NAMES[k.tiers].map((label, i) => {
          const c = k.colours[i] ?? "#FFFFFF";
          const now = rainbowOf(c) ? c : c.toUpperCase();
          const pick = (v: string) => set({ colours: [0, 1, 2].map((j) => (j === i ? v : k.colours[j] ?? "#FFFFFF")) });
          return (
            <div className="bz-tb-item" key={i}>
              <h3>{label}</h3>
              <div className="bz-ts-swatches" role="radiogroup" aria-label={`${label} colour`} data-testid={`cake-colour-${i}`}>
                {/* 2026-11-03 (the owner: "rainbow color seçenekleri de ekleyelim"). */}
                {RAINBOW_TIERS.map((r) => (
                  <button key={r.id} type="button" role="radio" aria-checked={now === r.id} aria-label={r.name} title={`${r.name} · +AED ${formatAED(RAINBOW_PRICE)}`}
                    className={now === r.id ? "on" : ""} style={{ background: `linear-gradient(135deg, ${r.hexes.join(", ")})` }}
                    onClick={() => pick(r.id)}>{now === r.id ? "✓" : ""}</button>
                ))}
                {swatches.map((hex) => (
                  <button key={hex} type="button" role="radio" aria-checked={now === hex} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
                    className={now === hex ? "on" : ""} style={{ background: hex }}
                    onClick={() => pick(hex)}>{now === hex ? "✓" : ""}</button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>The first two are rainbow buttercream — pastel patches or a bright watercolour, +AED {formatAED(RAINBOW_PRICE)} a tier.</p>
      </section>

      <section className="bz-tb-section" aria-label="Sprinkles">
        <h2>Sprinkles</h2>
        <div className="bz-tb-item">
          <div className="bz-gv-contents" role="radiogroup" aria-label="Sprinkles" data-testid="cake-sprinkles">
            {CAKE_SPRINKLES.map((s) => {
              const on = (k.sprinkles ?? "none") === s.id;
              return (
                <label key={s.id} className={on ? "on" : ""}>
                  <input type="radio" name="cake-sprinkles" checked={on} onChange={() => set({ sprinkles: s.id === "none" ? undefined : s.id })} />
                  <span><b>{s.name}</b><small>{[s.note, s.price ? `+AED ${formatAED(s.price)}` : ""].filter(Boolean).join(" · ")}</small></span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="On top">
        <h2>On top</h2>
        {/* 2026-11-03 (the owner: "sürükle bırak … duplicate … her yere yapıştırabilsin", up to 8). */}
        <p className="bz-tb-sub" style={{ fontWeight: 400 }} data-testid="cake-figures-note">
          Tap one to add it, then drag it anywhere on the cake, on top or on a tier.
          {" "}{full ? `That's the most — ${MAX_CAKE_FIGURES} figures and cutouts.` : `Up to ${MAX_CAKE_FIGURES} figures and cutouts, copies too, and ${MAX_CAKE_DECOS} balls.`}
        </p>
        {/* 2026-11-03 (the owner: "cutout topperlar da koyabilmeliyiz … kpop'ta çıkmalı, unicorn için de … sadece şeker hamuru değil"). */}
        {FIGURE_KINDS.map((kind) => (
          <div className="bz-tb-item" key={kind.id}>
            <h3>{kind.name} <small style={{ fontWeight: 400 }}>· {kind.note} · +AED {formatAED(kind.price)} each</small></h3>
            <div className="bz-tb-options" role="group" aria-label={kind.name} data-testid={{ sugar: "cake-figures", cutout: "cake-cutouts", deco: "cake-decos" }[kind.id]}>
              {cakeFiguresFor(theme.id, kind.id).map((f) => {
                const n = k.figures.filter((x) => x.id === f.id).length;
                return (
                  <button key={f.id} type="button" aria-pressed={n > 0} aria-label={`Add ${f.name}${n ? ` (${n} on the cake)` : ""}`} disabled={roomFor(k.figures, f.id) <= 0}
                    className={`bz-tb-option ${n ? "on" : ""}`} onClick={() => set({ figures: addItem(k, f.id) })}>
                    {n > 0 && <span className="tick">{n > 1 ? `×${n}` : "✓"}</span>}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <span className="art"><img className="photo cutout" style={{ objectFit: "contain" }} src={figurePicture(f.id).src} alt="" loading="lazy" /></span>
                    <b>{f.name}</b>{f.own && <small>Your {theme.name} theme</small>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {k.figures.length > 0 && <div className="bz-tb-item"><button type="button" className="bz-restart" onClick={() => set({ figures: [] })}>Take all the figures off</button></div>}
      </section>

      <section className="bz-tb-section" aria-label="Topper">
        <h2>Topper</h2>
        <div className="bz-tb-item">
          <div className="bz-gv-contents" data-testid="cake-topper">
            <label className={k.topper.on ? "on" : ""}>
              <input type="checkbox" checked={k.topper.on} onChange={() => setTopper({ on: !k.topper.on })} />
              <span><b>A topper with the name and age</b><small>Mirror acrylic letters or a printed card, on top or on the front · +AED {formatAED(TOPPER_PRICE)}</small></span>
            </label>
          </div>
        </div>
        {k.topper.on && <>
          <div className="bz-tb-item bz-ck-words">
            <label className="bz-tb-words">
              <span>Name</span>
              <input type="text" maxLength={18} value={k.topper.name} placeholder="Olivia" data-testid="cake-topper-name" aria-label="The name on the topper"
                onChange={(e) => setTopper({ name: e.target.value.replace(/[<>]/g, "").slice(0, 18) })} />
            </label>
            <label className="bz-tb-words">
              <span>Age</span>
              <input type="text" inputMode="numeric" maxLength={2} value={k.topper.age} data-testid="cake-topper-age" aria-label="The age on the topper"
                onFocus={(e) => e.target.select()} onChange={(e) => setTopper({ age: cleanAge(e.target.value) })} />
            </label>
          </div>
          {/* 2026-11-03 (the owner: "name topper pastanın önüne de yazılabilir"; her cloud-card example). */}
          <div className="bz-tb-item">
            <h3>Where it goes</h3>
            <div className="bz-gv-contents" role="radiogroup" aria-label="Where the topper goes" data-testid="cake-topper-place">
              {TOPPER_PLACES.map((p) => {
                const on = (k.topper.at ?? "top") === p.id;
                return (
                  <label key={p.id} className={on ? "on" : ""}>
                    <input type="radio" name="cake-topper-place" checked={on}
                      onChange={() => setTopper({ at: p.id === "front" ? "front" : undefined, x: undefined, up: undefined, y: p.id === "front" ? 0.5 : undefined })} />
                    <span><b>{p.name}</b><small>{p.note}</small></span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="bz-tb-item">
            <h3>Letters or a card</h3>
            <div className="bz-tb-fonts" role="radiogroup" aria-label="Topper card" data-testid="cake-topper-card">
              {TOPPER_CARDS.map((c) => {
                const on = (k.topper.card ?? "none") === c.id;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={on} className={on ? "on" : ""}
                    onClick={() => setTopper({ card: c.id === "none" ? undefined : c.id })}>
                    <span aria-hidden="true" style={{ fontSize: 20 }}>{{ none: "Aa", cloud: "☁", circle: "◯", plaque: "▭" }[c.id]}</span>
                    <small>{c.name}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bz-tb-item">
            <h3>Lettering</h3>
            <div className="bz-tb-fonts" role="radiogroup" aria-label="Topper lettering" data-testid="cake-topper-font">
              {TABLE_FONTS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={k.topper.font === f.id} className={k.topper.font === f.id ? "on" : ""} onClick={() => setTopper({ font: f.id })}>
                  <span style={{ fontFamily: `${fontCss(f)}, Georgia, serif`, fontWeight: f.weight, textTransform: f.hand ? "none" : "uppercase", "--fscale": f.scale } as React.CSSProperties}>{fontSample}</span>
                  <small>{f.name}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="bz-tb-item">
            <h3>Its colour</h3>
            <div className="bz-ts-swatches" role="radiogroup" aria-label="Topper colour" data-testid="cake-topper-colour">
              {TOPPER_COLOURS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={k.topper.colour === c.id} aria-label={c.name} title={c.name}
                  className={k.topper.colour === c.id ? "on" : ""} style={{ background: `linear-gradient(160deg, ${c.light}, ${c.hex} 60%, ${c.light})` }}
                  onClick={() => setTopper({ colour: c.id })}>{k.topper.colour === c.id ? "✓" : ""}</button>
              ))}
            </div>
          </div>
        </>}
      </section>

      <section className="bz-tb-section" aria-label="Flavour">
        <h2>Flavour</h2>
        <div className="bz-tb-item">
          <div className="bz-gv-contents" role="radiogroup" aria-label="Flavour" data-testid="cake-flavour">
            {CAKE_FLAVOURS.map((f) => (
              <label key={f.id} className={k.flavour === f.id ? "on" : ""}>
                <input type="radio" name="cake-flavour" checked={k.flavour === f.id} onChange={() => set({ flavour: f.id })} />
                <span><b>{f.name}</b><small>{f.note}{f.price ? ` · +AED ${formatAED(f.price)}` : ""}</small></span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <div className="bz-tb-sum" data-testid="cake-total">
        <span>Cake</span>
        <b>AED {formatAED(cakeTotal(k))}</b>
        <button type="button" className="bz-restart" onClick={() => setCake({ ...k, enabled: false, done: false })}>Remove the cake</button>
      </div>
      <FinishBar done={k.done} what="cake" next="Package" onFinish={onFinish} onSkip={onSkip} testId="finish-cake" render={{ ...render, onGenerate }} />
    </div>
  );
}
