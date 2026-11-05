// The Decor step's sixth part (2026-11-03, the owner: "piñatadan sonra cake studio'ya geçelim"): a yes / skip
// first, then on one page — a design to start from (four for the theme, or a plain cake), its tiers, how it is
// decorated, each tier's colour, the figures on top, the topper with the name and age, and the flavour
// (lib/studio/cake.ts).
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { PLAIN_COLOURS } from "@/lib/studio/tableCatalog";
import {
  CAKE_FLAVOURS, CAKE_SPRINKLES, CAKE_STYLES, CAKE_TIERS, FIGURE_KINDS, RAINBOW_PRICE, RAINBOW_TIERS, rainbowOf, MAX_CAKE_DECOS, MAX_CAKE_FIGURES, TOPPER_CARDS, TOPPER_COLOURS, TOPPER_PLACES, TOPPER_PRICE,
  CAKE_FIGURES, THEME_CAKE_CUTOUTS, addItem, cakeDesigns, cakeFiguresFor, cakePrice, cakeTotal, plainCake, figureKind, figurePicture, roomFor, themeFigures, topperColour as topperLook,
  type Cake, type CakeFigure, type CakeSeed, type CakeView,
} from "@/lib/studio/cake";
import { cleanAge } from "@/lib/studio/pinata";
import {
  CAKE_SWEETS, CART_BALLOONS_PRICE, CART_PRICE, CUPCAKE_FOILS, PLINTHS_PRICE, RAINBOW_LINER, SPRINKLE_PRICE, SWEET_COUNTS, SWEET_FLAVOURS, sweetFlavour, sweetPicture, sweetPrice, type CakeSweet,
} from "@/lib/studio/cakeSweets";
import { TABLE_FONTS, fontCss } from "@/lib/studio/tableFonts";
import { CakeArt, CakeThumb } from "./CakePreview";
import { appliedCupcakeSample, cakeSamples, cupcakeSamples, sceneOf, toScene, type CakeSample, type CakeScene } from "@/lib/studio/cakeSamples";
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

export default function CakeStep({ config, setCake, onFinish, onSkip, render, onGenerate, setView }: {
  config: BuilderConfig;
  setCake: (k: Cake) => void;
  onFinish: () => void;
  /** No cake after all: skipped, on to Package. */
  onSkip: () => void;
  render: PieceRender;
  onGenerate: () => void;
  /** What the preview shows: a change to a sweet shows it close up. */
  setView?: (v: CakeView) => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const k = config.cake;

  if (!k || !k.enabled) {
    return (
      <div className="bz-tb-intro" data-testid="cake-intro">
        {/* 2026-11-04 (the owner: "pastayı sweets için kullanabilirsin"): the painted flower cake (scripts/packages). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bz-intro-art" src="/design/packages/cake.webp" alt="" />
        <h2>Add a cake?</h2>
        <p>A birthday cake for your {theme.name} theme — one to three tiers, its colours, figures on top and a topper with the name — shown on its stand, with cupcakes, cake pops, cookies, donuts or macarons beside it if you like. The price adds to your party.</p>
        <div className="actions">
          <button type="button" className="bz-next" onClick={() => setCake(k ? { ...k, enabled: true, done: false } : plainCake(cakeSeed(config)))}>Yes, add a cake ✦</button>
          {!k && <button type="button" className="bz-back" onClick={() => setCake({ ...plainCake(cakeSeed(config)), enabled: false })}>No thanks, skip</button>}
        </div>
        {k && !k.enabled && <p className="skipped">You skipped the cake — it isn&apos;t in your total.</p>}
      </div>
    );
  }

  // What she is designing is what the preview shows close up (2026-11-04, the owner: "neyin tasarımını yapıyorsa onun
  // yakın görüntüsü açılsın"): the cake for the cake, the whole scene for where it is shown; a sweet's own (setSweet).
  const set = (patch: Partial<Cake>) => {
    setCake({ ...k, ...patch });
    if ("cart" in patch || "plinths" in patch) setView?.("whole");
    else if (!("sweets" in patch) && !("flavour" in patch)) setView?.("cake");
  };
  const card = (on: boolean, pick: () => void, art: React.ReactNode, name: string, note: string, price: string, key: string) => (
    <button key={key} type="button" role="radio" aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`} onClick={pick}>
      {on && <span className="tick">✓</span>}
      <span className="art">{art}</span>
      <b>{name}</b>{note && <small>{note}</small>}{price && <em>{price}</em>}
    </button>
  );
  const seed = cakeSeed(config);
  const designs = cakeDesigns(seed);
  // The party's balloons (the backdrop's, else the theme's): a garland on the cart is in them.
  const partyBalloons = (config.decor.balloonColors?.length ? config.decor.balloonColors : theme.balloonColors).map((h) => h.toUpperCase());
  // A design is where the cake starts: the name, age and lettering she typed stay, and the flavour.
  // Where the design puts the topper and on what (a card, the front) comes with it.
  const designTopper = (d: (typeof designs)[number]): Cake["topper"] => {
    const { on, at, x, up, y, s, card } = d.cake.topper;
    const { cardColour, cardBorder } = k.topper;
    return { name: k.topper.name, age: k.topper.age, font: k.topper.font, colour: k.topper.colour, on, at, x, up, y, s, card, ...(card && cardColour ? { cardColour } : {}), ...(card && cardBorder ? { cardBorder } : {}) };
  };
  const pickDesign = (d: (typeof designs)[number]) => set({ ...d.cake, topper: designTopper(d), flavour: k.flavour });
  // A ready-made cake: its design, dressed as the sample has it (colours, sprinkles, the topper's colour or card).
  const readyCake = (sm: CakeSample): Partial<Cake> => {
    const t = designTopper(sm.design);
    return { ...sm.design.cake, ...(sm.look.colours ? { colours: sm.look.colours } : {}), sprinkles: sm.look.sprinkles ?? sm.design.cake.sprinkles,
      topper: { ...t, ...sm.look.topper }, flavour: k.flavour };
  };
  const sameLook = (sm: CakeSample) => {
    const r = readyCake(sm);
    return JSON.stringify([r.colours?.slice(0, r.tiers), r.sprinkles ?? null, r.topper?.colour, r.topper?.card ?? null])
      === JSON.stringify([k.colours.slice(0, k.tiers), k.sprinkles ?? null, k.topper.colour, k.topper.card ?? null]);
  };
  const swatches = Array.from(new Set(["#FFFFFF", ...theme.balloonColors, ...theme.backdropColors, ...PLAIN_COLOURS.map((c) => c.hex)].map((h) => h.toUpperCase())));
  const full = k.figures.filter((f) => figureKind(f.id) !== "deco").length >= MAX_CAKE_FIGURES;
  const setTopper = (patch: Partial<Cake["topper"]>) => set({ topper: { ...k.topper, ...patch } });
  const fontSample = k.topper.name.trim() || "Olivia";
  // What a cupcake can carry, or a cookie have printed on it: the theme's own figures and cutouts first.
  const pieces = Array.from(new Set<CakeFigure>([...themeFigures(theme.id), ...(THEME_CAKE_CUTOUTS[theme.id] ?? []), "star", "heart"]));

  return (
    <div className="bz-tb" data-testid="cake">
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      {/* Ready-made cakes (2026-11-05, the owner: "pastada aynı şekilde ready made pasta modelleri olsun"): three
          finished cakes, the cake alone, applied at a tap — her name, age and flavour kept, the sweets and where it is
          shown left as they are. */}
      <div className="bz-samples cakes" data-testid="cake-samples">
        <div className="bz-samples-head"><b>Ready-made cakes</b><span>Tap one to start from it — your name, age and flavour stay.</span></div>
        <div className="bz-samples-row">
          {cakeSamples(seed).map((sm) => {
            const patch = readyCake(sm);
            const look: Cake = { ...k, ...patch, sweets: [], cart: undefined, plinths: undefined };
            const on = k.design === sm.design.id && sameLook(sm);
            return (
              <button key={sm.id} type="button" className={`bz-sample ${on ? "on" : ""}`} aria-pressed={on} data-testid={`cake-sample-${sm.id}`} onClick={() => set(patch)}>
                <span className="pic"><CakeThumb k={look} uid={`cks-${sm.id}`} /></span>
                <b>{sm.name}</b><small>{sm.note}</small><em>From AED {formatAED(cakeTotal({ ...look, flavour: "vanilla" }))}</em>
              </button>
            );
          })}
        </div>
      </div>
      <section className="bz-tb-section" aria-label="The design">
        {/* 2026-11-04 (the owner: "bu yazılar çok sıkıcı … ilk sayfadaki ruhu yakala"): titles to smile at. */}
        <h2>Pick a <em>dream</em> design</h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>Start from one of these — then make every bit of it yours ✨</p>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="Cake design" data-testid="cake-design">
            {designs.map((d) => card(k.design === d.id, () => pickDesign(d), <CakeThumb k={{ ...d.cake, enabled: true, topper: designTopper(d) }} uid={`ck-d-${d.id}`} />,
              d.name, d.note, `From AED ${formatAED(cakeTotal({ ...d.cake, enabled: true, flavour: "vanilla" }))}`, d.id))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Tiers">
        <h2>How <em>tall</em>?</h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>One, two or three tiers of cake</p>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="Tiers" data-testid="cake-tiers">
            {CAKE_TIERS.map((t) => card(k.tiers === t.n, () => set({ tiers: t.n }),
              <CakeThumb k={{ ...k, tiers: t.n, figures: [], topper: { ...k.topper, on: false } }} uid={`ck-t-${t.n}`} />,
              t.name, t.note, `AED ${formatAED(cakePrice({ tiers: t.n, style: k.style }))}`, String(t.n)))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Decoration">
        <h2>Pipe it <em>pretty</em></h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>How the buttercream is finished, tier by tier</p>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="Decoration" data-testid="cake-style">
            {CAKE_STYLES.map((s) => card(k.style === s.id, () => set({ style: s.id }),
              <CakeThumb k={{ ...k, tiers: 1, style: s.id, figures: [], topper: { ...k.topper, on: false } }} uid={`ck-s-${s.id}`} />,
              s.name, s.note, s.price ? `+AED ${formatAED(s.price)} a tier` : "Included", s.id))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Colours">
        <h2>Paint the <em>tiers</em></h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>Any colour for each — or a rainbow 🌈</p>
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
        <h2>A little <em>sparkle</em></h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>Sprinkles on the cake — or none at all</p>
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
        <h2>Figures &amp; <em>fun</em></h2>
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
        <h2>Their <em>name</em>, up in lights</h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>The name and age — on top, on the front or on the board</p>
        <div className="bz-tb-item">
          <div className="bz-gv-contents" data-testid="cake-topper">
            <label className={k.topper.on ? "on" : ""}>
              <input type="checkbox" checked={k.topper.on} onChange={() => setTopper({ on: !k.topper.on })} />
              <span><b>A topper with the name and age</b><small>Mirror acrylic letters or a printed card on top, or sugar letters on the front or the board · +AED {formatAED(TOPPER_PRICE)}</small></span>
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
                      onChange={() => setTopper({ at: p.id === "top" ? undefined : p.id, x: undefined, up: undefined, y: p.id === "front" ? 0.5 : undefined, ...(p.id === "board" ? { card: undefined } : {}) })} />
                    <span><b>{p.name}</b><small>{p.note}</small></span>
                  </label>
                );
              })}
            </div>
          </div>
          {k.topper.at !== "board" && <div className="bz-tb-item">
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
            {/* 2026-11-03 (the owner: "yazının arkasındaki cloud kartın rengini seçebilsin"). */}
            {k.topper.card && <>
              <h3 style={{ marginTop: 12 }}>Card colour</h3>
              <div className="bz-ts-swatches" role="radiogroup" aria-label="Card colour" data-testid="cake-topper-card-colour">
                {swatches.map((hex) => {
                  const on = (k.topper.cardColour ?? "#FFFFFF") === hex;
                  return (
                    <button key={hex} type="button" role="radio" aria-checked={on} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? (hex === "#FFFFFF" ? "white" : hex)}
                      className={on ? "on" : ""} style={{ background: hex }} onClick={() => setTopper({ cardColour: hex === "#FFFFFF" ? undefined : hex })}>{on ? "✓" : ""}</button>
                  );
                })}
              </div>
              {/* 2026-11-03 (the owner: "card color beyaz seçtim ama dışında pembe border oldu, onu da seçtirsin"). */}
              <h3 style={{ marginTop: 12 }}>Its border</h3>
              <div className="bz-ts-swatches" role="radiogroup" aria-label="Card border" data-testid="cake-topper-card-border">
                {[{ id: undefined, name: "Like the letters" }, { id: "none", name: "No border" }, ...swatches.map((hex) => ({ id: hex, name: PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? (hex === "#FFFFFF" ? "white" : hex) }))].map((b) => {
                  const on = k.topper.cardBorder === b.id;
                  const like = topperLook(k.topper.colour);
                  return (
                    <button key={b.id ?? "letters"} type="button" role="radio" aria-checked={on} aria-label={b.name} title={b.name} className={on ? "on" : ""}
                      style={{ background: b.id === undefined ? `linear-gradient(160deg, ${like.light}, ${like.hex} 60%, ${like.light})` : b.id === "none" ? "repeating-linear-gradient(135deg, #fff 0 5px, #f1d6df 5px 7px)" : b.id }}
                      onClick={() => setTopper({ cardBorder: b.id })}>{on ? "✓" : b.id === "none" ? "∅" : ""}</button>
                  );
                })}
              </div>
            </>}
          </div>}
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
              {/* 2026-11-03 (the owner: "name text her renkte olabilsin"): or any of the party's colours. */}
              {swatches.filter((hex) => hex !== "#FFFFFF").map((hex) => (
                <button key={hex} type="button" role="radio" aria-checked={k.topper.colour === hex} aria-label={`${PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex} sugar paste`}
                  className={k.topper.colour === hex ? "on" : ""} style={{ background: hex }} onClick={() => setTopper({ colour: hex })}>{k.topper.colour === hex ? "✓" : ""}</button>
              ))}
            </div>
            <p className="bz-tb-sub" style={{ fontWeight: 400 }}>The first five shine like metal; the rest are sugar paste in that colour.</p>
          </div>
        </>}
      </section>

      <section className="bz-tb-section" aria-label="Flavour">
        <h2>The <em>yummy</em> inside</h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>What hides under the buttercream</p>
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

      {/* 2026-11-03 (the owner: "cupcake, cookie, cake pops opsiyonları da olmalı … ve donut"): on the table beside the cake. */}
      <section className="bz-tb-section" aria-label="Sweets">
        <h2>Sweet <em>treats</em></h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>{k.cart ? "On the cart's counter beside the cake" : k.plinths ? "Each on a plinth of its own beside the cake" : "On the table beside the cake"}, in your colours.</p>
        {CAKE_SWEETS.map((kind) => {
          const sw = k.sweets?.find((x) => x.id === kind.id);
          const setSweet = (next: CakeSweet | null, see = true) => {
            set({ sweets: CAKE_SWEETS.flatMap((x) => (x.id === kind.id ? (next ? [next] : []) : (k.sweets ?? []).filter((y) => y.id === x.id))) });
            // Seen close up as it changes (2026-11-04, the owner: "cupcake değişikliği yapılıyorsa cupcake'in yakın view'u açılsın").
            if (next && see) setView?.(kind.id);
          };
          const start = (count: CakeSweet["count"]): CakeSweet => ({
            id: kind.id, count, colour: seed.colours?.[0]?.toUpperCase() ?? "#F8BBD0",
            ...(kind.topper === "figure" ? { topper: pieces[0] } : kind.topper === "print" ? { print: pieces[0] } : {}),
          });
          return (
            <div className="bz-tb-item bz-ck-sweet" key={kind.id} data-testid={`cake-sweet-${kind.id}`}>
              <div className="head">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sweetPicture(kind.id).src} alt="" loading="lazy" />
                <span><b>{kind.name}</b><small>{kind.note} · AED {formatAED(kind.each)} each</small></span>
              </div>
              {/* Ready-made cupcakes (2026-11-05, the owner: "cupcake seçme yerinde aynı şekilde ready made olsun 3 seçenek"):
                  a dozen at a tap — then the count, colour, topper and liners are hers to change. */}
              {kind.id === "cupcakes" && (
                <div className="bz-samples cupcakes" data-testid="cupcake-samples">
                  <div className="bz-samples-head"><b>Ready-made cupcakes</b><span>Tap a set — then change anything below.</span></div>
                  <div className="bz-samples-row">
                    {cupcakeSamples(seed, pieces).map((cs) => {
                      const on = appliedCupcakeSample(sw, [cs]) === cs.id;
                      const art: Cake = { ...k, sweets: [cs.sweet], cart: undefined, plinths: undefined };
                      return (
                        <button key={cs.id} type="button" className={`bz-sample ${on ? "on" : ""}`} aria-pressed={on} data-testid={`cupcake-sample-${cs.id}`}
                          onClick={() => setSweet({ ...cs.sweet, count: sw?.count ?? cs.sweet.count, ...(sw?.flavour ? { flavour: sw.flavour } : {}) })}>
                          <span className="pic"><CakeArt k={art} view="cupcakes" themeId={theme.id} uid={`cps-${cs.id}`} testId={`cupcake-sample-art-${cs.id}`} /></span>
                          <b>{cs.name}</b><small>{cs.note}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="bz-ck-counts" role="radiogroup" aria-label={`How many ${kind.name.toLowerCase()}`}>
                {[0, ...SWEET_COUNTS].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={(sw?.count ?? 0) === n} className={(sw?.count ?? 0) === n ? "on" : ""}
                    onClick={() => setSweet(n === 0 ? null : sw ? { ...sw, count: n as CakeSweet["count"] } : start(n as CakeSweet["count"]))}>{n === 0 ? "None" : n}</button>
                ))}
              </div>
              {sw && <>
                <div className="bz-ts-swatches" role="radiogroup" aria-label={`${kind.name} colour`}>
                  {swatches.map((hex) => (
                    <button key={hex} type="button" role="radio" aria-checked={sw.colour === hex} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
                      className={sw.colour === hex ? "on" : ""} style={{ background: hex }} onClick={() => setSweet({ ...sw, colour: hex })}>{sw.colour === hex ? "✓" : ""}</button>
                  ))}
                </div>
                {kind.topper && (
                  <div className="bz-ck-counts" role="radiogroup" aria-label={kind.topper === "figure" ? `On each of the ${kind.name.toLowerCase()}` : "Printed on each cookie"}>
                    {[null, ...(kind.topper === "print" ? ["age" as const] : []), ...pieces].map((p) => {
                      const now = (kind.topper === "figure" ? sw.topper : sw.print) ?? null;
                      const label = p === null ? "Plain" : p === "age" ? `The age${k.topper.age ? ` (${k.topper.age})` : ""}` : CAKE_FIGURES.find((f) => f.id === p)!.name;
                      return (
                        <button key={p ?? "none"} type="button" role="radio" aria-checked={now === p} className={now === p ? "on" : ""}
                          onClick={() => setSweet(kind.topper === "figure" ? { ...sw, topper: (p as CakeFigure | null) ?? undefined } : { ...sw, print: p ?? undefined })}>{label}</button>
                      );
                    })}
                  </div>
                )}
                {/* 2026-11-03 (the owner: "cupcake kağıdının rengini de seçebilsin"): gold or silver foil, or paper in a colour. */}
                {kind.id === "cupcakes" && <>
                  <h3 style={{ marginTop: 10 }}>Liners</h3>
                  <div className="bz-ts-swatches" role="radiogroup" aria-label="Cupcake liners" data-testid="cake-cupcake-liner">
                    {[...CUPCAKE_FOILS.map((f) => ({ id: f.id, name: f.name, bg: `linear-gradient(160deg, ${f.light}, ${f.hex} 60%, ${f.light})` })),
                      { id: RAINBOW_LINER.id, name: RAINBOW_LINER.name, bg: `radial-gradient(circle at 25% 30%, ${RAINBOW_LINER.dots[0]} 2px, transparent 3px), radial-gradient(circle at 70% 25%, ${RAINBOW_LINER.dots[2]} 2px, transparent 3px), radial-gradient(circle at 45% 70%, ${RAINBOW_LINER.dots[4]} 2px, transparent 3px), radial-gradient(circle at 80% 75%, ${RAINBOW_LINER.dots[3]} 2px, transparent 3px), radial-gradient(circle at 20% 80%, ${RAINBOW_LINER.dots[5]} 2px, transparent 3px), #fff` },
                      ...swatches.map((hex) => ({ id: hex, name: `${PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? (hex === "#FFFFFF" ? "White" : hex)} paper`, bg: hex }))].map((l) => {
                      const on = (sw.liner ?? "gold") === l.id;
                      return <button key={l.id} type="button" role="radio" aria-checked={on} aria-label={l.name} title={l.name} className={on ? "on" : ""}
                        style={{ background: l.bg }} onClick={() => setSweet({ ...sw, liner: l.id === "gold" ? undefined : l.id })}>{on ? "✓" : ""}</button>;
                    })}
                  </div>
                </>}
                {/* 2026-11-03 (the owner: "flavour her sweet için ayrı seçilsin"). */}
                <div className="bz-ck-counts" role="radiogroup" aria-label={`${kind.name} flavour`} data-testid={`cake-sweet-flavour-${kind.id}`}>
                  {SWEET_FLAVOURS[kind.id].map((f) => {
                    const on = sweetFlavour(sw).id === f.id;
                    return <button key={f.id} type="button" role="radio" aria-checked={on} className={on ? "on" : ""}
                      onClick={() => setSweet({ ...sw, flavour: f.id === SWEET_FLAVOURS[kind.id][0].id ? undefined : f.id }, false)}>{f.name}</button>;
                  })}
                </div>
                <label className="bz-ck-check">
                  <input type="checkbox" checked={!!sw.sprinkles} onChange={() => setSweet({ ...sw, sprinkles: !sw.sprinkles || undefined })} />
                  <span>Rainbow sprinkles · +AED {formatAED(SPRINKLE_PRICE)} each</span>
                </label>
                <p className="bz-tb-sub" style={{ fontWeight: 400 }}>{sw.count} {sweetFlavour(sw).name.toLowerCase()} {kind.name.toLowerCase()} · AED {formatAED(sweetPrice(sw))}</p>
              </>}
            </div>
          );
        })}
      </section>

      {/* 2026-11-03 (the owner: "cake cart opsiyonu da olabilir"): the cake and the sweets on a white sweet cart. */}
      <section className="bz-tb-section" aria-label="Shown on">
        <h2>Where it <em>shines</em></h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>A table, a sweet cart or a row of plinths</p>
        <div className="bz-tb-item">
          {/* 2026-11-05 (the owner: "cart plinth table resimleri sweet cart seçme yerinin orda olsun"): each a picture of
              her own cake and sweets shown there. */}
          <div className="bz-ck-scenes" role="radiogroup" aria-label="Shown on" data-testid="cake-display">
            {([
              { id: "table", name: "On a table", note: "The cake on its stand, the sweets beside it" },
              { id: "cart", name: "On a sweet cart", note: `A white wooden cart, its roof in your colour · +AED ${formatAED(CART_PRICE)}` },
              // 2026-11-03 (the owner: "pastayı plinth üzerinde de görmek isteyebilir … diğer sweet'leri seçtiyse onlar da diğer plinth'lerde olacak").
              { id: "plinths", name: "On plinths", note: `The cake on a tall white plinth, each sweet on one of its own · +AED ${formatAED(PLINTHS_PRICE)}` },
            ] as { id: CakeScene; name: string; note: string }[]).map((o) => {
              const on = sceneOf(k) === o.id;
              return (
                <label key={o.id} className={on ? "on" : ""} data-testid={`cake-display-${o.id}`}>
                  <input type="radio" name="cake-display" checked={on} onChange={() => set(toScene(k, o.id))} />
                  <span className="pic"><CakeArt k={{ ...k, ...toScene(k, o.id) }} themeId={theme.id} uid={`ckd-${o.id}`} testId={`cake-display-art-${o.id}`} /></span>
                  <span><b>{o.name}</b><small>{o.note}</small></span>
                </label>
              );
            })}
          </div>
        </div>
        {k.cart && (
          <div className="bz-tb-item">
            <h3>The roof&apos;s colour</h3>
            <div className="bz-ts-swatches" role="radiogroup" aria-label="Roof colour" data-testid="cake-awning">
              {swatches.map((hex) => (
                <button key={hex} type="button" role="radio" aria-checked={k.cart!.roof === hex} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? (hex === "#FFFFFF" ? "white" : hex)}
                  className={k.cart!.roof === hex ? "on" : ""} style={{ background: hex }} onClick={() => set({ cart: { ...k.cart!, roof: hex } })}>{k.cart!.roof === hex ? "✓" : ""}</button>
              ))}
            </div>
            {/* 2026-11-03 (the owner: "burdaki gibi balon seçeneği olsun"): a garland up its side, in the party's balloons. */}
            <div className="bz-gv-contents" data-testid="cake-cart-balloons" style={{ marginTop: 12 }}>
              <label className={k.cart!.balloons ? "on" : ""}>
                <input type="checkbox" checked={!!k.cart!.balloons}
                  onChange={(e) => { const { balloons: _, ...rest } = k.cart!; set({ cart: e.target.checked ? { ...rest, balloons: partyBalloons } : rest }); }} />
                <span><b>A balloon garland on the cart</b><small>Up its side and over its roof, in your party&apos;s balloon colours · +AED {formatAED(CART_BALLOONS_PRICE)}</small></span>
              </label>
            </div>
          </div>
        )}
      </section>

      <div className="bz-tb-sum" data-testid="cake-total">
        <span>Cake</span>
        <b>AED {formatAED(cakeTotal(k))}</b>
        <button type="button" className="bz-restart" onClick={() => setCake({ ...k, enabled: false, done: false })}>Remove the cake</button>
      </div>
      <FinishBar done={k.done} what="cake & sweets" next="Helium balloons" onFinish={onFinish} onSkip={onSkip} testId="finish-cake" render={{ ...render, onGenerate }} />
    </div>
  );
}
