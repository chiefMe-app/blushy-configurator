// The Decor step's third part (2026-10-31): the welcome board. A yes / skip
// first (the owner: "welcome board istemiyorsa skip edebilmeli"), then the
// board on one page — size and shape, its design, the words and their
// lettering, the board and its stand (lib/studio/welcomeBoard.ts).
// 2026-10-31 (owner): a round shape, painted corners, balloons or flowers.
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { PLAIN_COLOURS } from "@/lib/studio/tableCatalog";
import { TABLE_FONTS, fontCss } from "@/lib/studio/tableFonts";
import { BOARD_DESIGNS, BOARD_GARNISHES, BOARD_MATERIALS, BOARD_SHAPES, BOARD_SIZES, BOARD_STANDS, MAX_BOARD_TEXT, boardArt, boardFace, boardWordsColour, cleanBoardText, defaultWelcomeBoard, welcomeTotal, type WelcomeBoard } from "@/lib/studio/welcomeBoard";
import WelcomeBoardArt, { PaintedCorners, paintInks } from "@/components/studio/WelcomeBoardArt";
import { FinishBar } from "@/components/builder/table/AdultTableStep";

export default function WelcomeStep({ config, setWelcomeBoard, onFinish }: {
  config: BuilderConfig;
  setWelcomeBoard: (b: WelcomeBoard) => void;
  onFinish: () => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const b = config.welcomeBoard;
  const swatches = Array.from(new Set(["#FFFFFF", ...theme.backdropColors, ...theme.balloonColors, ...PLAIN_COLOURS.map((c) => c.hex)].map((h) => h.toUpperCase())));

  if (!b || !b.enabled) {
    return (
      <div className="bz-tb-intro" data-testid="welcome-intro">
        <h2>Add a welcome board?</h2>
        <p>A printed board at the entrance that greets your guests — your words, in your {theme.name} theme, on an easel. The price adds to your party.</p>
        <div className="actions">
          <button type="button" className="bz-next" onClick={() => setWelcomeBoard({ ...defaultWelcomeBoard(theme), ...(b ? { ...b, enabled: true, done: false } : {}) })}>Yes, design the board ✦</button>
          {!b && <button type="button" className="bz-back" onClick={() => setWelcomeBoard({ ...defaultWelcomeBoard(theme), enabled: false })}>No thanks, skip</button>}
        </div>
        {b && !b.enabled && <p className="skipped">You skipped the welcome board — it isn&apos;t in your total.</p>}
      </div>
    );
  }

  const set = (patch: Partial<WelcomeBoard>) => setWelcomeBoard({ ...b, ...patch });
  const ink = boardWordsColour(b, theme);
  const swatchRow = (label: string, value: string, options: string[], pick: (hex: string) => void, testId: string) => (
    <div className="bz-ts-swatches" role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((hex) => (
        <button key={hex} type="button" role="radio" aria-checked={hex === value.toUpperCase()} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
          className={hex === value.toUpperCase() ? "on" : ""} style={{ background: hex }} onClick={() => pick(hex)} />
      ))}
    </div>
  );
  const chips = <T extends string>(label: string, list: readonly { id: T; name: string }[], value: T, pick: (id: T) => void, testId: string) => (
    <div className="bz-tb-shapes" role="radiogroup" aria-label={label} data-testid={testId}>
      {list.map((o) => <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? "on" : ""} onClick={() => pick(o.id)}>{o.name}</button>)}
    </div>
  );
  const card = (on: boolean, pick: () => void, art: React.ReactNode, name: string, note: string, price: string, key: string) => (
    <button key={key} type="button" role="radio" aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`} onClick={pick}>
      {on && <span className="tick">✓</span>}
      <span className="art">{art}</span>
      <b>{name}</b><small>{note}</small>{price && <em>{price}</em>}
    </button>
  );
  const word = (field: "heading" | "name" | "line", label: string, placeholder: string) => (
    <label className="bz-tb-words">
      <span>{label}</span>
      <input type="text" value={b[field]} maxLength={MAX_BOARD_TEXT} placeholder={placeholder} data-testid={`welcome-${field}`}
        onChange={(e) => set({ [field]: cleanBoardText(e.target.value) })} />
    </label>
  );

  return (
    <div className="bz-tb" data-testid="welcome-board">
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      <section className="bz-tb-section" aria-label="Size and shape">
        <h2>Size &amp; shape</h2>
        <div className="bz-tb-item">
          <h3>Size</h3>
          <div className="bz-tb-options" role="radiogroup" aria-label="Board size">
            {BOARD_SIZES.map((s) => {
              const face = boardFace({ size: s.id, shape: b.shape });
              return card(b.size === s.id, () => set({ size: s.id }),
                <svg viewBox="0 0 100 130" aria-hidden="true">{b.shape === "round"
                  ? <circle cx={50} cy={125 - face.h * 0.475} r={face.w * 0.45} fill="#fff" stroke="#5a4950" strokeWidth={1.5} />
                  : <rect x={50 - face.w * 0.45} y={125 - face.h * 0.95} width={face.w * 0.9} height={face.h * 0.95} rx={b.shape === "arch" ? face.w * 0.45 : 2} fill="#fff" stroke="#5a4950" strokeWidth={1.5} />}</svg>,
                s.name, face.note, `AED ${formatAED(s.price)}`, s.id);
            })}
          </div>
        </div>
        <div className="bz-tb-item">
          <h3>Shape</h3>
          {chips("Board shape", BOARD_SHAPES, b.shape, (shape) => set({ shape }), "welcome-shape")}
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Design">
        <h2>Design</h2>
        <div className="bz-tb-item">
          <h3>The board&apos;s face</h3>
          <div className="bz-tb-options" role="radiogroup" aria-label="Board design">
            {BOARD_DESIGNS.map((d) => {
              const art = boardArt({ design: d.id }, theme.id);
              const look = d.id === "corners"
                ? <svg className="photo" viewBox="0 0 70 100" aria-hidden="true"><rect width={70} height={100} fill="#fff" /><PaintedCorners w={70} h={100} inks={paintInks([theme.accent, ...theme.balloonColors, ...theme.backdropColors])} motif={theme.id === "frozen" ? "flake" : "leaf"} uid="wb-design-corners" /></svg>
                // eslint-disable-next-line @next/next/no-img-element
                : art ? <img className="photo" src={art} alt="" loading="lazy" /> : <i className="swatch-big" style={{ background: b.colour }} />;
              return card(b.design === d.id, () => set({ design: d.id }), look, d.name, d.note, "", d.id);
            })}
          </div>
          {b.design === "plain" && swatchRow("Board colour", b.colour, swatches, (colour) => set({ colour }), "welcome-colour")}
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Words">
        <h2>Words</h2>
        <div className="bz-tb-item">
          {word("heading", "Small line on top", "e.g. Welcome to")}
          {word("name", "The name", "e.g. Arya's")}
          {word("line", "Line underneath", "e.g. 6th Birthday")}
          <div className="bz-tb-fonts" role="radiogroup" aria-label="Name lettering" data-testid="welcome-font">
            {TABLE_FONTS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={b.font === f.id} className={b.font === f.id ? "on" : ""} onClick={() => set({ font: f.id })}>
                <span style={{ fontFamily: `${fontCss(f)}, Georgia, serif`, fontWeight: f.weight, textTransform: f.hand ? "none" : "uppercase", "--fscale": f.scale } as React.CSSProperties}>{b.name || "Arya"}</span>
                <small>{f.name}</small>
              </button>
            ))}
          </div>
          <div className="bz-tb-words-colour">
            <span>Words colour</span>
            {swatchRow("Words colour", ink, Array.from(new Set([theme.accent.toUpperCase(), ...swatches])), (hex) => set({ textColor: hex }), "welcome-words-colour")}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Balloons and flowers">
        <h2>Balloons &amp; flowers</h2>
        <div className="bz-tb-item">
          <h3>On the board</h3>
          <div className="bz-tb-options" role="radiogroup" aria-label="Balloons and flowers" data-testid="welcome-garnish">
            {BOARD_GARNISHES.map((g) => card(b.garnish === g.id, () => set({ garnish: g.id }),
              <WelcomeBoardArt board={{ ...b, garnish: g.id, heading: "", name: "", line: "", stand: "none" }} theme={theme} balloons={config.decor.balloonColors} placeholders={false} className="photo" />,
              g.name, g.note, g.extra ? `+AED ${formatAED(g.extra)}` : "", g.id))}
          </div>
        </div>
      </section>

      <section className="bz-tb-section" aria-label="Board and stand">
        <h2>Board &amp; stand</h2>
        <div className="bz-tb-item">
          <h3>Board</h3>
          {chips("Board material", BOARD_MATERIALS, b.material, (material) => set({ material }), "welcome-material")}
          <p className="bz-tb-floor">{BOARD_MATERIALS.find((m) => m.id === b.material)!.note}{BOARD_MATERIALS.find((m) => m.id === b.material)!.extra ? ` · +AED ${BOARD_MATERIALS.find((m) => m.id === b.material)!.extra}` : ""}</p>
        </div>
        <div className="bz-tb-item">
          <h3>Stand</h3>
          {chips("Board stand", BOARD_STANDS, b.stand, (stand) => set({ stand }), "welcome-stand")}
          <p className="bz-tb-floor">{BOARD_STANDS.find((s) => s.id === b.stand)!.note}{BOARD_STANDS.find((s) => s.id === b.stand)!.extra ? ` · +AED ${BOARD_STANDS.find((s) => s.id === b.stand)!.extra}` : ""}</p>
        </div>
      </section>

      <div className="bz-tb-sum" data-testid="welcome-total">
        <span>Welcome board</span>
        <b>AED {formatAED(welcomeTotal(b))}</b>
        <button type="button" className="bz-restart" onClick={() => setWelcomeBoard({ ...b, enabled: false, done: false })}>Remove the board</button>
      </div>
      <FinishBar done={b.done} what="welcome board" next="Package" onFinish={onFinish} testId="finish-welcome" />
    </div>
  );
}
