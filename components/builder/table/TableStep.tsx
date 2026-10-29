// The Decor step's second part (2026-10-27, F2): the kids' table. First a
// yes / skip; then every item on one page (2026-10-28: "aynı sayfada olsun,
// next next diye geçmeyelim"), in four sections, each with picture options
// (plus "None" for the optional ones) from lib/studio/tableCatalog.ts, the
// cloth's colour and the words on the placemats. Prices add to the party total.
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { CHAIR_COLOURS, NONE, PLAIN_COLOURS, PLATE_SHAPES, TABLE_SECTIONS, onFloor, optionPhoto, tableItem, type TableItem, type TableItemKey, type TableOption } from "@/lib/studio/tableCatalog";
import { TABLE_FONTS, fontCss, tableFont, type TableFont } from "@/lib/studio/tableFonts";
import { COLOUR_OF, FONT_OF, wordsColour, MAX_KIDS, MAX_PLACEMAT_TEXT, MIN_KIDS, WORDS_ITEMS, clampKids, cleanPlacematText, defaultTableSetup, tableCounts, tableTotal, type TableSetup, type WordsKey } from "@/lib/studio/tableSetup";
import { GlyphDefs, glyph, scallop, type GlyphColours } from "@/components/studio/table/glyphs";

/** The printed words in their colour, with a shadow that keeps light words readable on the design. */
export function wordsStyle(hex: string, font?: TableFont) {
  const n = parseInt(hex.slice(1), 16), lum = (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
  return { color: hex, textShadow: lum > 0.75 ? "0 1px 2px rgba(60,40,50,0.55)" : undefined, ...(font ? fontStyle(font) : {}) };
}

/** Words in a lettering face (2026-10-29): print faces in capitals, handwritten ones as typed and a little bigger. */
const fontStyle = (font: TableFont) => ({ fontFamily: `${fontCss(font)}, Georgia, serif`, fontWeight: font.weight, textTransform: font.hand ? ("none" as const) : ("uppercase" as const), letterSpacing: font.hand ? 0 : undefined, "--fscale": font.scale } as React.CSSProperties);

function OptionArt({ item, option, colours, themeId, words, colour, textColor, font }: { item: TableItem; option: TableOption | null; colours: GlyphColours; themeId: string; words?: string; colour?: string; textColor?: string; font?: TableFont }) {
  const photo = optionPhoto(item.key, option ?? undefined, themeId, colour);
  if (option && photo) {
    // A coloured option shows the chosen colour on its picture (the chair's picture is in it); a placemat or label, the customer's words.
    const swatch = colour && !option.colouredPhotos ? colour : null;
    return <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={option.colouredPhotos ? "photo cutout" : "photo"} src={photo} alt="" loading="lazy" />
      {swatch && <i className="swatch" style={{ background: swatch }} aria-hidden="true" />}
      {words && <span className={`words ${item.key} ${option.id}`} style={textColor ? wordsStyle(textColor, font) : undefined} aria-hidden="true">{item.key === "placemats" ? stacked(words) : words}</span>}
    </>;
  }
  // The plain plates: a big and a small plate in the colour.
  if (option && item.key === "plates" && option.id === "plain") {
    // In the chosen shape (2026-10-29): round, scalloped or square.
    const plate = (r: number, w: number, fill: string, extra = {}) => colours.plateShape === "square" ? <rect x={-r * 0.9} y={-r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.2} fill={fill} stroke="#5a4950" strokeWidth={w} {...extra} />
      : colours.plateShape === "scalloped" ? <path d={scallop(r, 18)} fill={fill} stroke="#5a4950" strokeWidth={w} {...extra} /> : <circle r={r} fill={fill} stroke="#5a4950" strokeWidth={w} {...extra} />;
    return <svg viewBox="-24 -24 48 48" aria-hidden="true">
      {plate(21, 0.8, colour ?? "#fff")}{plate(16.5, 0.4, "none", { opacity: 0.5 })}
      {plate(15.5, 0.7, colours.smallPlate ?? colour ?? "#fff")}
    </svg>;
  }
  if (!option) return <svg viewBox="-24 -24 48 48" aria-hidden="true"><circle r={14} fill="none" stroke="#d9c9cf" strokeWidth={2} strokeDasharray="4 3" /><path d="M-8,8L8,-8" stroke="#d9c9cf" strokeWidth={2} /></svg>;
  // Big items are drawn smaller; small ones (cups, cards, hats) larger.
  const scale: Partial<Record<TableItemKey, number>> = { chairs: 0.9, centrepiece: 0.85, chargers: 1.4, plates: 1.9, napkins: 1.9, cutlery: 2, cups: 4, nameCards: 3, partyHats: 3.6, chairDecor: 1.8 };
  if (item.key === "table") {
    return <svg viewBox="-60 -40 120 80" aria-hidden="true">
      {option.id === "round" ? <circle r={30} fill="#fff" stroke="#5a4950" strokeWidth={2} /> : option.id === "square" ? <rect x={-27} y={-27} width={54} height={54} rx={3} fill="#fff" stroke="#5a4950" strokeWidth={2} /> : <rect x={-50} y={-17} width={100} height={34} rx={3} fill="#fff" stroke="#5a4950" strokeWidth={2} />}
    </svg>;
  }
  if (item.key === "tablecloth" || item.key === "runner") {
    const fill = item.key === "tablecloth" ? colours.cloth : option.id === "tulle" ? `${colours.runner}99` : colours.runner;
    const over = option.id === "sequin" ? "url(#sequin)" : option.id === "greenery" ? "url(#leaves)" : null;
    return <svg viewBox="-30 -20 60 40" aria-hidden="true"><defs><GlyphDefs /></defs>
      {option.id === "ruffle" && <rect x={-27} y={-17} width={54} height={34} rx={6} fill={fill} stroke="#5a4950" strokeDasharray="3 2" />}
      <rect x={-24} y={-14} width={48} height={28} rx={3} fill={item.key === "runner" ? "#fff" : fill} stroke="#5a4950" strokeWidth={1} />
      {item.key === "runner" && <rect x={-24} y={-5} width={48} height={10} fill={fill} />}
      {over && <rect x={-24} y={item.key === "runner" ? -5 : -14} width={48} height={item.key === "runner" ? 10 : 28} fill={over} />}
    </svg>;
  }
  return <svg viewBox="-24 -24 48 48" aria-hidden="true"><defs><GlyphDefs /></defs><g transform={`scale(${scale[item.key] ?? 1})`}>{glyph(item.key, option.id, colours)}</g></svg>;
}

/** Placemat words stack one word a line, like the owner's reference (2026-10-28: "her kelime alt alta olsun"). */
const stacked = (words: string) => words.trim().split(/\s+/).join("\n");

const unitLabel = (o: TableOption) => `AED ${formatAED(o.price)} ${o.unit === "per_child" ? "each" : "a table"}`;

export default function TableStep({ config, setTable }: {
  config: BuilderConfig;
  setTable: (t: TableSetup) => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const table = config.table;
  // The theme's colours first, then every plain colour (2026-10-28: "her renk olsun, pastel ve ana renkler").
  const swatches = Array.from(new Set(["#FFFFFF", ...theme.backdropColors, ...theme.balloonColors, ...PLAIN_COLOURS.map((c) => c.hex)].map((h) => h.toUpperCase())));

  if (!table || !table.enabled) {
    return (
      <div className="bz-tb-intro" data-testid="table-intro">
        <h2>Add a kids&apos; table?</h2>
        <p>Seats, plates, napkins and little treats for every guest — in your {theme.name} theme. You choose every piece; the price adds to your party.</p>
        <div className="actions">
          <button type="button" className="bz-next" onClick={() => setTable({ ...defaultTableSetup(theme), ...(table ? { ...table, enabled: true } : {}) })}>Yes, design the table ✦</button>
          {!table && <button type="button" className="bz-back" onClick={() => setTable({ ...defaultTableSetup(theme), enabled: false })}>No thanks, skip</button>}
        </div>
        {table && !table.enabled && <p className="skipped">You skipped the kids&apos; table — it isn&apos;t in your total.</p>}
      </div>
    );
  }

  const set = (patch: Partial<TableSetup>) => setTable({ ...table, ...patch });
  const choose = (key: TableItemKey, id: string) => set({ choices: { ...table.choices, [key]: id } });
  const counts = tableCounts(table);
  const textColor = wordsColour(table, theme);
  const colours: GlyphColours = { palette: theme.balloonColors, accent: theme.accent, cloth: table.clothColor, runner: table.runnerColor, napkin: table.napkinColor,
    plate: table.plateColor, smallPlate: table.smallPlateColor, cup: table.cupColor, holder: table.holderColor, placemat: table.placematColor, label: table.labelColor, plateShape: table.plateShape };
  const swatchRow = (label: string, value: string, options: string[], pick: (hex: string) => void, testId?: string) => (
    <div className="bz-ts-swatches" role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((hex) => (
        <button key={hex} type="button" role="radio" aria-checked={hex === value.toUpperCase()} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
          className={hex === value.toUpperCase() ? "on" : ""} style={{ background: hex }} onClick={() => pick(hex)} />
      ))}
    </div>
  );

  const item = (key: TableItemKey) => {
    const it = tableItem(key);
    // The cloth always takes a colour; of the others, only the plain options.
    const chosen = it.options.find((o) => o.id === table.choices[key]);
    const colourKey = it.coloured || chosen?.coloured ? COLOUR_OF[key] : undefined;
    // The colour an option card shows: its item's colour, on the options that take one.
    const field = COLOUR_OF[key];
    const colourOf = (o: TableOption) => ((it.coloured || o.coloured) && field ? table[field] : undefined);
    if (key === "chairs" && onFloor(table.choices)) {
      return (
        <div key={key} className="bz-tb-item" data-testid="floor-cushions">
          <h3>{it.label}</h3>
          <p className="bz-tb-floor">The low table comes with soft floor cushions, so there are no chairs to choose.</p>
        </div>
      );
    }
    const wordsItem = WORDS_ITEMS.find((w) => w.key === key);
    // The words show on the placemat and label pictures; the holders' photos have no room for them.
    const words = key === "placemats" || key === "bottleLabel" ? table.words?.[key as WordsKey] : undefined;
    const fontField = key === "placemats" || key === "bottleLabel" ? FONT_OF[key] : undefined;
    const font = fontField ? tableFont(table[fontField]) : undefined;
    return (
      <div key={key} className="bz-tb-item">
        <h3>{it.label}</h3>
        <div className="bz-tb-options" role="radiogroup" aria-label={it.label}>
          {it.optional && (
            <button type="button" role="radio" aria-checked={table.choices[key] === NONE} className={`bz-tb-option ${table.choices[key] === NONE ? "on" : ""}`} onClick={() => choose(key, NONE)}>
              <span className="art"><OptionArt item={it} option={null} colours={colours} themeId={theme.id} /></span>
              <b>None</b>
            </button>
          )}
          {/* A themed piece is offered in the themes it has been made for (the theme cutouts: Frozen first). */}
          {it.options.filter((o) => !o.themes || o.themes.includes(theme.id) || table.choices[key] === o.id).map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={table.choices[key] === o.id} className={`bz-tb-option ${table.choices[key] === o.id ? "on" : ""}`} onClick={() => choose(key, o.id)}>
              {table.choices[key] === o.id && <span className="tick">✓</span>}
              <span className="art"><OptionArt item={it} option={o} colours={colours} themeId={theme.id} words={words} colour={colourOf(o)} textColor={textColor} font={font} /></span>
              <b>{o.name}</b>
              <small>{o.note}</small>
              <em>{unitLabel(o)}</em>
            </button>
          ))}
        </div>
        {/* The chair comes in white, pink or light blue only. */}
        {colourKey && table.choices[key] !== NONE && (key === "plates"
          // The plain plates: the big one's colour, then the small one's (2026-10-29).
          ? <div className="bz-tb-words-colour"><span>Big plate colour</span>{swatchRow("Big plate colour", table[colourKey], swatches, (hex) => set({ [colourKey]: hex }), `${key}-colour`)}</div>
          : swatchRow(`${it.label} colour`, table[colourKey], key === "chairs" ? CHAIR_COLOURS : swatches, (hex) => set({ [colourKey]: hex }), `${key}-colour`))}
        {key === "plates" && table.choices.plates === "plain" && (
          // The small plate in its own colour (2026-10-29).
          <div className="bz-tb-words-colour">
            <span>Small plate colour</span>
            {swatchRow("Small plate colour", table.smallPlateColor, swatches, (hex) => set({ smallPlateColor: hex }), "small-plate-colour")}
          </div>
        )}
        {key === "plates" && table.choices.plates === "plain" && (
          <div className="bz-tb-shapes" role="radiogroup" aria-label="Plate shape" data-testid="plate-shape">
            {PLATE_SHAPES.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={table.plateShape === p.id} className={table.plateShape === p.id ? "on" : ""} onClick={() => set({ plateShape: p.id })}>{p.name}</button>
            ))}
          </div>
        )}
        {wordsItem && table.choices[key] !== NONE && (
          <label className="bz-tb-words">
            <span>{wordsItem.label} <small>(optional)</small></span>
            <input type="text" value={table.words?.[wordsItem.key] ?? ""} maxLength={MAX_PLACEMAT_TEXT} placeholder={wordsItem.placeholder}
              onChange={(e) => set({ words: { ...table.words, [wordsItem.key]: cleanPlacematText(e.target.value) } })} />
          </label>
        )}
        {fontField && font && chosen && (
          // The words' lettering (2026-10-29): a few print faces and a few handwritten ones.
          <div className="bz-tb-fonts" role="radiogroup" aria-label={`${it.label} lettering`} data-testid={`${key}-font`}>
            {TABLE_FONTS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={font.id === f.id} className={font.id === f.id ? "on" : ""} onClick={() => set({ [fontField]: f.id })}>
                <span style={fontStyle(f)}>{words || "Arya"}</span>
                <small>{f.name}</small>
              </button>
            ))}
          </div>
        )}
        {(key === "bottleLabel" || key === "placemats") && chosen && (
          // One colour for the words on the placemats and the labels: the theme's, unless changed (2026-10-28).
          <div className="bz-tb-words-colour">
            <span>Words colour</span>
            {swatchRow("Words colour", textColor, Array.from(new Set([theme.accent.toUpperCase(), ...swatches])), (hex) => set({ textColor: hex }), `${key}-words-colour`)}
          </div>
        )}
        {(key === "bottleLabel" || key === "placemats") && chosen && (
          // The finished design, flat, as it is printed: the label (20.5 × 5 cm), or the
          // A3 placemat with the words bottom-right, like the owner's reference.
          <div className={key === "bottleLabel" ? "bz-tb-label" : "bz-tb-label placemat"} data-testid={key === "bottleLabel" ? "bottle-label-preview" : "placemat-preview"}
            style={chosen.themed ? { backgroundImage: `url(${optionPhoto(key, chosen, theme.id)})` } : { background: key === "placemats" ? table.placematColor : table.labelColor }}>
            <span style={wordsStyle(textColor, font)}>{key === "placemats" ? stacked(table.words?.placemats || "Your words here") : table.words?.bottleLabel || "Your words here"}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bz-tb">
      {/* The lettering fonts (the words' choices are shown in them). */}
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      <div className="bz-tb-item">
        <h3>How many kids?</h3>
        <div className="bz-ts-row">
          <div className="bz-stepper" role="group" aria-label="Number of kids">
            <button type="button" aria-label="One fewer child" disabled={table.kids <= MIN_KIDS} onClick={() => set({ kids: clampKids(table.kids - 1) })}>−</button>
            <span data-testid="kids-count">{table.kids}</span>
            <button type="button" aria-label="One more child" className="plus" disabled={table.kids >= MAX_KIDS} onClick={() => set({ kids: clampKids(table.kids + 1) })}>+</button>
          </div>
          <span className="hint">{counts.tables} table{counts.tables > 1 ? "s" : ""} · {MIN_KIDS}–{MAX_KIDS} kids</span>
        </div>
      </div>

      {TABLE_SECTIONS.map((section) => (
        <section key={section.name} className="bz-tb-section" aria-label={section.name}>
          <h2>{section.name}</h2>
          {section.items.map(item)}
        </section>
      ))}

      <div className="bz-tb-sum" data-testid="table-total">
        <span>Kids&apos; table · {table.kids} kids</span>
        <b>AED {formatAED(tableTotal(table))}</b>
        <button type="button" className="bz-restart" onClick={() => setTable({ ...table, enabled: false })}>Remove the table</button>
      </div>
    </div>
  );
}
