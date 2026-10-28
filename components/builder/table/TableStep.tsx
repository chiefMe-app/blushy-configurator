// The Decor step's second part (2026-10-27, F2): the kids' table. First a
// yes / skip; then every item on one page (2026-10-28: "aynı sayfada olsun,
// next next diye geçmeyelim"), in four sections, each with picture options
// (plus "None" for the optional ones) from lib/studio/tableCatalog.ts, the
// cloth's colour and the words on the placemats. Prices add to the party total.
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { NONE, TABLE_SECTIONS, onFloor, optionPhoto, tableItem, type TableItem, type TableItemKey, type TableOption } from "@/lib/studio/tableCatalog";
import { MAX_KIDS, MAX_PLACEMAT_TEXT, MIN_KIDS, WORDS_ITEMS, clampKids, cleanPlacematText, defaultTableSetup, tableCounts, tableTotal, type TableSetup, type WordsKey } from "@/lib/studio/tableSetup";
import { GlyphDefs, glyph, type GlyphColours } from "@/components/studio/table/glyphs";

const COLOUR_OF: Partial<Record<TableItemKey, keyof Pick<TableSetup, "clothColor" | "napkinColor">>> = {
  tablecloth: "clothColor", napkins: "napkinColor",
};

function OptionArt({ item, option, colours, themeId, words }: { item: TableItem; option: TableOption | null; colours: GlyphColours; themeId: string; words?: string }) {
  const photo = optionPhoto(item.key, option ?? undefined, themeId);
  if (option && photo) {
    // A coloured option shows the chosen colour on its picture; a placemat or label, the customer's words.
    const swatch = item.key === "tablecloth" ? colours.cloth : option.coloured ? colours.napkin : null;
    return <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="photo" src={photo} alt="" loading="lazy" />
      {swatch && <i className="swatch" style={{ background: swatch }} aria-hidden="true" />}
      {words && <span className={`words ${item.key} ${option.id}`} aria-hidden="true">{item.key === "placemats" ? stacked(words) : words}</span>}
    </>;
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
  const swatches = Array.from(new Set(["#FFFFFF", ...theme.backdropColors, ...theme.balloonColors].map((h) => h.toUpperCase())));

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
  const colours: GlyphColours = { palette: theme.balloonColors, accent: theme.accent, cloth: table.clothColor, runner: table.runnerColor, napkin: table.napkinColor };

  const item = (key: TableItemKey) => {
    const it = tableItem(key);
    // The cloth always takes a colour; of the napkins, only the plain one.
    const chosen = it.options.find((o) => o.id === table.choices[key]);
    const colourKey = it.coloured || chosen?.coloured ? COLOUR_OF[key] : undefined;
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
          {it.options.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={table.choices[key] === o.id} className={`bz-tb-option ${table.choices[key] === o.id ? "on" : ""}`} onClick={() => choose(key, o.id)}>
              {table.choices[key] === o.id && <span className="tick">✓</span>}
              <span className="art"><OptionArt item={it} option={o} colours={colours} themeId={theme.id} words={words} /></span>
              <b>{o.name}</b>
              <small>{o.note}</small>
              <em>{unitLabel(o)}</em>
            </button>
          ))}
        </div>
        {colourKey && table.choices[key] !== NONE && (
          <div className="bz-ts-swatches" role="radiogroup" aria-label={`${it.label} colour`}>
            {swatches.map((hex) => (
              <button key={hex} type="button" role="radio" aria-checked={hex === table[colourKey].toUpperCase()} aria-label={hex}
                className={hex === table[colourKey].toUpperCase() ? "on" : ""} style={{ background: hex }} onClick={() => set({ [colourKey]: hex })} />
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
        {(key === "bottleLabel" || key === "placemats") && chosen && (
          // The finished design, flat, as it is printed: the label (20.5 × 5 cm), or the
          // A3 placemat with the words bottom-right, like the owner's reference.
          <div className={key === "bottleLabel" ? "bz-tb-label" : "bz-tb-label placemat"} data-testid={key === "bottleLabel" ? "bottle-label-preview" : "placemat-preview"}
            style={{ backgroundImage: `url(${optionPhoto(key, chosen, theme.id)})` }}>
            <span>{key === "placemats" ? stacked(table.words?.placemats || "Your words here") : table.words?.bottleLabel || "Your words here"}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bz-tb">
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
