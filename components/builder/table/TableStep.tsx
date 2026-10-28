// The Decor step's second part (2026-10-27, F2): the kids' table. First a
// yes / skip; then four tabs of items, each with picture options (plus
// "None" for the optional ones) from lib/studio/tableCatalog.ts, and the
// colours of the cloth, runner and napkins. Prices add to the party total.
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { NONE, TABLE_TABS, onFloor, tableItem, type TableItem, type TableItemKey, type TableOption } from "@/lib/studio/tableCatalog";
import { MAX_KIDS, MIN_KIDS, clampKids, defaultTableSetup, tableCounts, tableTotal, type TableSetup } from "@/lib/studio/tableSetup";
import { GlyphDefs, glyph, type GlyphColours } from "@/components/studio/table/glyphs";

const COLOUR_OF: Partial<Record<TableItemKey, keyof Pick<TableSetup, "clothColor" | "runnerColor" | "napkinColor">>> = {
  tablecloth: "clothColor", runner: "runnerColor", napkins: "napkinColor",
};

function OptionArt({ item, option, colours }: { item: TableItem; option: TableOption | null; colours: GlyphColours }) {
  if (option?.photo) {
    // A coloured item shows the chosen colour on its picture.
    const swatch = item.key === "tablecloth" ? colours.cloth : item.key === "runner" ? colours.runner : item.key === "napkins" ? colours.napkin : null;
    return <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="photo" src={option.photo} alt="" loading="lazy" />
      {swatch && !(item.key === "runner" && option.id === "greenery") && <i className="swatch" style={{ background: swatch }} aria-hidden="true" />}
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

const unitLabel = (o: TableOption) => `AED ${formatAED(o.price)} ${o.unit === "per_child" ? "each" : "a table"}`;

export default function TableStep({ config, setTable, tab, setTab }: {
  config: BuilderConfig;
  setTable: (t: TableSetup) => void;
  tab: number;
  setTab: (n: number) => void;
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
  const current = TABLE_TABS[Math.min(tab, TABLE_TABS.length - 1)];

  return (
    <div className="bz-tb">
      <div className="bz-decor-tabbar bz-tb-tabs" role="tablist" aria-label="Table setup">
        {TABLE_TABS.map((t, i) => (
          <button key={t.name} type="button" role="tab" aria-selected={i === tab} className={`bz-decor-tab ${i === tab ? "on" : ""}`} onClick={() => setTab(i)}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>{t.name}
          </button>
        ))}
      </div>

      {tab === 0 && (
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
      )}

      {current.items.map((key) => {
        const item = tableItem(key);
        const colourKey = COLOUR_OF[key];
        if (key === "chairs" && onFloor(table.choices)) {
          return (
            <div key={key} className="bz-tb-item" data-testid="floor-cushions">
              <h3>{item.label}</h3>
              <p className="bz-tb-floor">The low table comes with soft floor cushions, so there are no chairs to choose.</p>
            </div>
          );
        }
        return (
          <div key={key} className="bz-tb-item">
            <h3>{item.label}</h3>
            <div className="bz-tb-options" role="radiogroup" aria-label={item.label}>
              {item.optional && (
                <button type="button" role="radio" aria-checked={table.choices[key] === NONE} className={`bz-tb-option ${table.choices[key] === NONE ? "on" : ""}`} onClick={() => choose(key, NONE)}>
                  <span className="art"><OptionArt item={item} option={null} colours={colours} /></span>
                  <b>None</b>
                </button>
              )}
              {item.options.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={table.choices[key] === o.id} className={`bz-tb-option ${table.choices[key] === o.id ? "on" : ""}`} onClick={() => choose(key, o.id)}>
                  {table.choices[key] === o.id && <span className="tick">✓</span>}
                  <span className="art"><OptionArt item={item} option={o} colours={colours} /></span>
                  <b>{o.name}</b>
                  <small>{o.note}</small>
                  <em>{unitLabel(o)}</em>
                </button>
              ))}
            </div>
            {colourKey && table.choices[key] !== NONE && (
              <div className="bz-ts-swatches" role="radiogroup" aria-label={`${item.label} colour`}>
                {swatches.map((hex) => (
                  <button key={hex} type="button" role="radio" aria-checked={hex === table[colourKey].toUpperCase()} aria-label={hex}
                    className={hex === table[colourKey].toUpperCase() ? "on" : ""} style={{ background: hex }} onClick={() => set({ [colourKey]: hex })} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="bz-tb-sum" data-testid="table-total">
        <span>Kids&apos; table · {table.kids} kids</span>
        <b>AED {formatAED(tableTotal(table))}</b>
        <button type="button" className="bz-restart" onClick={() => setTable({ ...table, enabled: false })}>Remove the table</button>
      </div>
    </div>
  );
}
