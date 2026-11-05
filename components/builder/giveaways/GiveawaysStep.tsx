// The Decor step's fourth part (2026-11-03, the owner: "giveaways … her temaya göre bir tasarımı olsun … boxın
// içindekileri görsel olarak değil şimdilik liste olarak verelim, playdough, bubble, candy, sticker, themed items
// … bu box'ı masaya mı yoksa giveaway board mu istiyor onun seçimini yapsın … board rengi vs customizable"):
// a yes / skip first, then on one page — where the boxes go, how many and what is in them, the name on
// them, and the board's colour and words (lib/studio/giveaways.ts).
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { PLAIN_COLOURS } from "@/lib/studio/tableCatalog";
import { TABLE_FONTS, fontCss } from "@/lib/studio/tableFonts";
import { MAX_BOARD_TEXT, cleanBoardText } from "@/lib/studio/welcomeBoard";
import { BOARD_SHOWS, BOX_PRICE, BOX_PRINTS, GIVEAWAY_BOARD_PRICE, GIVEAWAY_GARLAND_PRICE, GIVEAWAY_CONTENTS, GIVEAWAY_PLACES, MAX_BOXES, clampCount, defaultGiveaways, giveawaysTotal, type Giveaways } from "@/lib/studio/giveaways";
import { clampKids } from "@/lib/studio/tableSetup";
import GiveawayBox from "@/components/studio/GiveawayBox";
import { boxLook, GiveawayBoardArt } from "./GiveawaysPreview";
import ColourWheel from "@/components/builder/ColourWheel";
import { giveawaySamples, withGiveawaySample } from "@/lib/studio/giveawaySamples";
import { FinishBar } from "@/components/builder/table/AdultTableStep";
import type { PieceRender } from "@/components/builder/usePieceRender";

/** What the boxes start from: one a child at the kids' table, the name the party already has. */
export function giveawaysSeed(config: BuilderConfig) {
  const kids = config.table?.enabled ? clampKids(config.table.kids) : 10;
  const name = (config.welcomeBoard?.enabled && config.welcomeBoard.name.replace(/['’]s$/i, "")) || "";
  return { kids, name };
}

export default function GiveawaysStep({ config, setGiveaways, onFinish, onSkip, render, onGenerate }: {
  config: BuilderConfig;
  setGiveaways: (g: Giveaways) => void;
  onFinish: () => void;
  /** No giveaways after all: skipped, on to the piñata. */
  onSkip: () => void;
  render: PieceRender;
  onGenerate: () => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const g = config.giveaways;
  const tableKept = !!config.table?.enabled;

  if (!g || !g.enabled) {
    return (
      <div className="bz-tb-intro" data-testid="giveaways-intro">
        <h2>Add giveaway boxes?</h2>
        <p>A gable box for every child, dressed in your {theme.name} theme with their name — on the table or on a giveaway board. The price adds to your party.</p>
        <div className="actions">
          <button type="button" className="bz-next" onClick={() => setGiveaways({ ...defaultGiveaways(giveawaysSeed(config)), ...(tableKept ? {} : { place: "board" as const }), ...(g ? { ...g, enabled: true, done: false } : {}) })}>Yes, add giveaways ✦</button>
          {!g && <button type="button" className="bz-back" onClick={() => setGiveaways({ ...defaultGiveaways(giveawaysSeed(config)), enabled: false })}>No thanks, skip</button>}
        </div>
        {g && !g.enabled && <p className="skipped">You skipped the giveaways — they aren&apos;t in your total.</p>}
      </div>
    );
  }

  const set = (patch: Partial<Giveaways>) => setGiveaways({ ...g, ...patch });
  const swatches = Array.from(new Set(["#FFFFFF", ...theme.backdropColors, ...theme.balloonColors, ...PLAIN_COLOURS.map((c) => c.hex)].map((h) => h.toUpperCase())));
  const card = (on: boolean, pick: () => void, art: React.ReactNode, name: string, note: string, price: string, key: string, disabled = false) => (
    <button key={key} type="button" role="radio" aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`} onClick={pick} disabled={disabled}>
      {on && <span className="tick">✓</span>}
      <span className="art">{art}</span>
      <b>{name}</b><small>{note}</small>{price && <em>{price}</em>}
    </button>
  );
  const look = boxLook(g, theme);
  const inks = Array.from(new Set(["#FFFFFF", "#2B2B2B", ...theme.balloonColors, ...PLAIN_COLOURS.map((c) => c.hex)].map((h) => h.toUpperCase())));

  return (
    <div className="bz-tb" data-testid="giveaways">
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      {/* Ready-made giveaways (2026-11-05, as the kids' table's): each its own drawing, applied at a tap. */}
      <div className="bz-samples giveaways" data-testid="giveaways-samples">
        <div className="bz-samples-head"><b>Ready-made giveaways</b><span>Tap one to start from it — your boxes, what&apos;s inside and the name stay.</span></div>
        <div className="bz-samples-row">
          {giveawaySamples(theme, tableKept).map((s) => {
            const look = withGiveawaySample(g, s);
            return (
              <button key={s.id} type="button" className="bz-sample" data-testid={`giveaways-sample-${s.id}`} onClick={() => setGiveaways(look)}>
                <span className="pic">
                  {look.place === "board"
                    ? <GiveawayBoardArt g={{ ...look, count: Math.min(look.count, 6) }} theme={theme} balloons={config.decor.balloonColors} className="bz-gv-sample" uid={`gvs-${s.id}`} testId={`giveaways-sample-art-${s.id}`} />
                    : <svg viewBox="0 0 120 130" aria-hidden="true"><GiveawayBox look={boxLook(look, theme)} x={60} y={65} h={124} uid={`gv-s-${s.id}`} /></svg>}
                </span>
                <b>{s.name}</b><small>{s.note}</small><em>AED {formatAED(giveawaysTotal(look))}</em>
              </button>
            );
          })}
        </div>
      </div>
      <section className="bz-tb-section" aria-label="The box">
        <h2>The box</h2>
        <div className="bz-tb-item">
          <h3>Your {theme.name} box</h3>
          <div className="bz-tb-options" role="radiogroup" aria-label="Giveaway box">
            {card(true, () => {}, <svg className="photo" viewBox="0 0 120 130" aria-hidden="true"><GiveawayBox look={look} x={60} y={65} h={124} uid="gv-card" /></svg>,
              "Gable box", "Your theme's print and picture, the name printed on it", `AED ${formatAED(BOX_PRICE)} a box`, "gable")}
          </div>
        </div>
        {/* 2026-11-03 (the owner: "plain box color ve bunun gibi birkaç örnek background box color ekleyelim"). */}
        <div className="bz-tb-item">
          <h3>Box design</h3>
          <div className="bz-tb-options" role="radiogroup" aria-label="Box design" data-testid="giveaways-box-print">
            {BOX_PRINTS.map((p) => card(g.boxPrint === p.id, () => set({ boxPrint: p.id }),
              <svg className="photo" viewBox="0 0 120 130" aria-hidden="true"><GiveawayBox look={boxLook({ ...g, boxPrint: p.id }, theme)} x={60} y={65} h={124} uid={`gv-print-${p.id}`} /></svg>,
              p.name, p.note, "", p.id))}
          </div>
          {g.boxPrint === "plain" && (
            <div className="bz-ts-swatches" role="radiogroup" aria-label="Box colour" data-testid="giveaways-box-colour">
              {swatches.map((hex) => (
                <button key={hex} type="button" role="radio" aria-checked={hex === g.boxColour.toUpperCase()} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
                  className={hex === g.boxColour.toUpperCase() ? "on" : ""} style={{ background: hex }} onClick={() => set({ boxColour: hex })} />
              ))}
              <ColourWheel value={g.boxColour} options={swatches} onPick={(hex) => set({ boxColour: hex })} label="Box colour" testId="giveaways-box-colour-wheel" />
            </div>
          )}
        </div>
        <div className="bz-tb-item">
          <h3>Boxes</h3>
          <label className="bz-gv-count">
            <input type="number" min={1} max={MAX_BOXES} value={g.count} data-testid="giveaways-count" aria-label="How many boxes"
              onChange={(e) => set({ count: clampCount(e.target.value) })} />
            <small>One a child{tableKept ? ` — ${clampKids(config.table!.kids)} at your kids' table` : ""}.</small>
          </label>
          {g.place === "board" && g.count > BOARD_SHOWS && (
            <p className="bz-tb-sub" data-testid="giveaways-board-full" style={{ fontWeight: 400 }}>
              A board holds {BOARD_SHOWS} boxes. The other {g.count - BOARD_SHOWS} are kept beside it, and the shelves are filled up again as they go.
            </p>
          )}
        </div>
      </section>

      <section className="bz-tb-section" aria-label="What's inside">
        <h2>What&apos;s inside</h2>
        <div className="bz-tb-item">
          <div className="bz-gv-contents" data-testid="giveaways-contents">
            {GIVEAWAY_CONTENTS.map((c) => {
              const on = g.contents.includes(c.id);
              return (
                <label key={c.id} className={on ? "on" : ""}>
                  <input type="checkbox" checked={on} onChange={() => set({ contents: on ? g.contents.filter((x) => x !== c.id) : GIVEAWAY_CONTENTS.filter((x) => x.id === c.id || g.contents.includes(x.id)).map((x) => x.id) })} />
                  <span><b>{c.name}</b><small>{c.id === "themed" ? `Little toys in the ${theme.name} theme` : c.note} · +AED {formatAED(c.price)}</small></span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Name">
        <h2>The name</h2>
        <div className="bz-tb-item">
          <label className="bz-tb-words">
            <span>The name on the box</span>
            <input type="text" value={g.name} maxLength={MAX_BOARD_TEXT} placeholder="Name" data-testid="giveaways-name" onChange={(e) => set({ name: cleanBoardText(e.target.value) })} />
          </label>
          <div className="bz-tb-fonts" role="radiogroup" aria-label="Name lettering" data-testid="giveaways-font">
            {TABLE_FONTS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={g.font === f.id} className={g.font === f.id ? "on" : ""} onClick={() => set({ font: f.id })}>
                <span style={{ fontFamily: `${fontCss(f)}, Georgia, serif`, fontWeight: f.weight, textTransform: f.hand ? "none" : "uppercase", "--fscale": f.scale } as React.CSSProperties}>{g.name || "Arya"}</span>
                <small>{f.name}</small>
              </button>
            ))}
          </div>
          {/* 2026-11-03 (the owner: "yazının rengini değiştirebilmeliyim"). */}
          <div className="bz-ts-swatches" role="radiogroup" aria-label="Name colour" data-testid="giveaways-ink">
            <button type="button" role="radio" aria-checked={!g.ink} className={`auto ${!g.ink ? "on" : ""}`} aria-label="Theme colour" title="Theme colour"
              style={{ background: theme.accent }} onClick={() => set({ ink: "" })}>A</button>
            {inks.map((hex) => (
              <button key={hex} type="button" role="radio" aria-checked={hex === g.ink.toUpperCase()} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
                className={hex === g.ink.toUpperCase() ? "on" : ""} style={{ background: hex }} onClick={() => set({ ink: hex })} />
            ))}
            <ColourWheel value={g.ink} options={inks} onPick={(hex) => set({ ink: hex })} label="Name colour" testId="giveaways-ink-wheel" />
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Where they go">
        <h2>Where they go</h2>
        <div className="bz-tb-item">
          <div className="bz-tb-options" role="radiogroup" aria-label="Where the boxes go" data-testid="giveaways-place">
            {GIVEAWAY_PLACES.map((p) => {
              const off = p.id === "table" && !tableKept;
              return card(g.place === p.id, () => set({ place: p.id }),
                // eslint-disable-next-line @next/next/no-img-element
                p.id === "board" ? <img className="photo" src="/design/giveaways/board.webp" alt="" loading="lazy" /> : <i className="swatch-big" style={{ background: "#f7f5f2" }}>🍽️</i>,
                p.name, off ? "You skipped the kids' table" : p.note, p.id === "board" ? `+AED ${formatAED(GIVEAWAY_BOARD_PRICE)}` : "", p.id, off);
            })}
          </div>
        </div>
        {g.place === "board" && <>
          <div className="bz-tb-item">
            <h3>Board colour</h3>
            <div className="bz-ts-swatches" role="radiogroup" aria-label="Board colour" data-testid="giveaways-board-colour">
              {swatches.map((hex) => (
                <button key={hex} type="button" role="radio" aria-checked={hex === g.boardColour.toUpperCase()} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
                  className={hex === g.boardColour.toUpperCase() ? "on" : ""} style={{ background: hex }} onClick={() => set({ boardColour: hex })} />
              ))}
              <ColourWheel value={g.boardColour} options={swatches} onPick={(hex) => set({ boardColour: hex })} label="Board colour" testId="giveaways-board-colour-wheel" />
            </div>
          </div>
          <div className="bz-tb-item">
            <h3>The board&apos;s words</h3>
            <label className="bz-tb-words">
              <span>Line under the name</span>
              <input type="text" value={g.boardLine} maxLength={MAX_BOARD_TEXT} placeholder="e.g. Thank you for coming" data-testid="giveaways-board-line" onChange={(e) => set({ boardLine: cleanBoardText(e.target.value) })} />
            </label>
            {/* 2026-11-03 (the owner: "board'un üstüne yazılan yazı font renk customized olsun"). */}
            <span className="bz-tb-sub">The name</span>
            <div className="bz-tb-fonts" role="radiogroup" aria-label="Board lettering" data-testid="giveaways-board-font">
              {TABLE_FONTS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={g.boardFont === f.id} className={g.boardFont === f.id ? "on" : ""} onClick={() => set({ boardFont: f.id })}>
                  <span style={{ fontFamily: `${fontCss(f)}, Georgia, serif`, fontWeight: f.weight, textTransform: f.hand ? "none" : "uppercase", "--fscale": f.scale } as React.CSSProperties}>{g.name || "Arya"}</span>
                  <small>{f.name}</small>
                </button>
              ))}
            </div>
            {/* 2026-11-03 (the owner: "thank you for coming'in fontunu seçemiyoruz"). */}
            <span className="bz-tb-sub">The line</span>
            <div className="bz-tb-fonts" role="radiogroup" aria-label="Line lettering" data-testid="giveaways-board-line-font">
              {TABLE_FONTS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={g.boardLineFont === f.id} className={g.boardLineFont === f.id ? "on" : ""} onClick={() => set({ boardLineFont: f.id })}>
                  <span style={{ fontFamily: `${fontCss(f)}, Georgia, serif`, fontWeight: f.weight, textTransform: f.hand ? "none" : "uppercase", "--fscale": f.scale } as React.CSSProperties}>{g.boardLine || "Thank you"}</span>
                  <small>{f.name}</small>
                </button>
              ))}
            </div>
            <div className="bz-ts-swatches" role="radiogroup" aria-label="Words colour" data-testid="giveaways-board-ink">
              <button type="button" role="radio" aria-checked={!g.boardInk} className={`auto ${!g.boardInk ? "on" : ""}`} aria-label="Theme colour" title="Theme colour"
                style={{ background: theme.accent }} onClick={() => set({ boardInk: "" })}>A</button>
              {inks.map((hex) => (
                <button key={hex} type="button" role="radio" aria-checked={hex === g.boardInk.toUpperCase()} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
                  className={hex === g.boardInk.toUpperCase() ? "on" : ""} style={{ background: hex }} onClick={() => set({ boardInk: hex })} />
              ))}
              <ColourWheel value={g.boardInk} options={inks} onPick={(hex) => set({ boardInk: hex })} label="Words colour" testId="giveaways-board-ink-wheel" />
            </div>
          </div>
          <div className="bz-tb-item">
            <h3>Balloons</h3>
            <div className="bz-tb-options" role="radiogroup" aria-label="Board balloons" data-testid="giveaways-board-garland">
              {card(!g.boardGarland, () => set({ boardGarland: false }),
                // eslint-disable-next-line @next/next/no-img-element
                <img className="photo" src="/design/giveaways/board.webp" alt="" loading="lazy" />, "Just the board", "No balloons", "", "plain")}
              {card(g.boardGarland, () => set({ boardGarland: true }),
                // eslint-disable-next-line @next/next/no-img-element
                <img className="photo" src="/design/welcome/garnish-balloons.webp" alt="" loading="lazy" />,
                "Balloon garland", "Up its side and over the top, in your balloon colours", `+AED ${formatAED(GIVEAWAY_GARLAND_PRICE)}`, "garland")}
            </div>
          </div>
        </>}
      </section>

      <div className="bz-tb-sum" data-testid="giveaways-total">
        <span>Giveaways</span>
        <b>AED {formatAED(giveawaysTotal(g))}</b>
        <button type="button" className="bz-restart" onClick={() => setGiveaways({ ...g, enabled: false, done: false })}>Remove the giveaways</button>
      </div>
      <FinishBar done={g.done} what="giveaways" next="Piñata" onFinish={onFinish} onSkip={onSkip} testId="finish-giveaways" render={{ ...render, onGenerate }} />
    </div>
  );
}
