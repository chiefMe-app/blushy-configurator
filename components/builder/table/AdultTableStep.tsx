// The grown-ups' table (2026-10-31): asked once the kids' table is finished or
// skipped (the owner: "kids kısmının bütün seçimleri yapıldıktan sonra
// sorulsun"). A yes / skip first, then every item on one page, like the kids'
// table, with drawn pictures (lib/studio/adultTable.ts).
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { NONE, PLAIN_COLOURS } from "@/lib/studio/tableCatalog";
import { ADULT_COLOUR_OF, ADULT_SECTIONS, MAX_GUESTS, MIN_GUESTS, adultCounts, adultItem, adultTotal, clampGuests, defaultAdultTable, type AdultItemKey, type AdultOption, type AdultTable } from "@/lib/studio/adultTable";
import { adultColours, AdultGlyph } from "@/components/studio/table/AdultTableSketch";

const unitLabel = (o: AdultOption) => `AED ${formatAED(o.price)} ${o.unit === "per_guest" ? "each" : "a table"}`;

export default function AdultTableStep({ config, setAdultTable, onFinish, onSkip }: {
  config: BuilderConfig;
  setAdultTable: (a: AdultTable) => void;
  onFinish: () => void;
  /** 2026-11-02 (owner: "adult table setup skip edemiyorum"): no grown-ups' table, on to the welcome board — asked or not. */
  onSkip: () => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const a = config.adultTable;
  const swatches = Array.from(new Set(["#FFFFFF", ...theme.backdropColors, ...theme.balloonColors, ...PLAIN_COLOURS.map((c) => c.hex)].map((h) => h.toUpperCase())));

  if (!a || !a.enabled) {
    return (
      <div className="bz-tb-intro" data-testid="adult-intro">
        <h2>Add a grown-ups&apos; table?</h2>
        <p>A dressed table for the parents and guests — charger plates, glasses, a runner and flowers, in your {theme.name} colours. The price adds to your party.</p>
        <div className="actions">
          <button type="button" className="bz-next" onClick={() => setAdultTable({ ...defaultAdultTable(theme), ...(a ? { ...a, enabled: true, done: false } : {}) })}>Yes, design it ✦</button>
          <button type="button" className="bz-back" data-testid="skip-adult-table" onClick={onSkip}>No thanks, skip →</button>
        </div>
        {a && !a.enabled && <p className="skipped">You skipped the grown-ups&apos; table — it isn&apos;t in your total.</p>}
      </div>
    );
  }

  const set = (patch: Partial<AdultTable>) => setAdultTable({ ...a, ...patch });
  const colours = adultColours(a, theme);
  const counts = adultCounts(a);

  const item = (key: AdultItemKey) => {
    const it = adultItem(key);
    const field = (ADULT_COLOUR_OF as Partial<Record<AdultItemKey, "clothColor" | "runnerColor" | "napkinColor">>)[key];
    const chosen = it.options.find((o) => o.id === a.choices[key]);
    const option = (o: AdultOption | null) => {
      const id = o?.id ?? NONE, on = a.choices[key] === id;
      return (
        <button key={id} type="button" role="radio" aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`} onClick={() => set({ choices: { ...a.choices, [key]: id } })}>
          {on && <span className="tick">✓</span>}
          <span className="art"><AdultGlyph itemKey={key} id={id} colours={colours} /></span>
          <b>{o?.name ?? "None"}</b>
          {o && <small>{o.note}</small>}
          {o && <em>{unitLabel(o)}</em>}
        </button>
      );
    };
    return (
      <div key={key} className="bz-tb-item">
        <h3>{it.label}</h3>
        <div className="bz-tb-options" role="radiogroup" aria-label={it.label}>
          {it.optional && option(null)}
          {it.options.map(option)}
        </div>
        {field && chosen?.coloured && (
          <div className="bz-ts-swatches" role="radiogroup" aria-label={`${it.label} colour`} data-testid={`adult-${key}-colour`}>
            {swatches.map((hex) => (
              <button key={hex} type="button" role="radio" aria-checked={a[field].toUpperCase() === hex} aria-label={PLAIN_COLOURS.find((c) => c.hex === hex)?.name ?? hex}
                className={a[field].toUpperCase() === hex ? "on" : ""} style={{ background: hex }} onClick={() => set({ [field]: hex })} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bz-tb" data-testid="adult-table">
      <div className="bz-tb-jump">
        <span>Changed your mind?</span>
        <button type="button" className="bz-back" data-testid="skip-adult-table" onClick={onSkip}>Skip the grown-ups&apos; table →</button>
      </div>
      <div className="bz-tb-item">
        <h3>How many grown-ups?</h3>
        <div className="bz-ts-row">
          <div className="bz-stepper" role="group" aria-label="Number of grown-ups">
            <button type="button" aria-label="One fewer guest" disabled={a.guests <= MIN_GUESTS} onClick={() => set({ guests: clampGuests(a.guests - 1) })}>−</button>
            <span data-testid="guests-count">{a.guests}</span>
            <button type="button" aria-label="One more guest" className="plus" disabled={a.guests >= MAX_GUESTS} onClick={() => set({ guests: clampGuests(a.guests + 1) })}>+</button>
          </div>
          <span className="hint">{counts.tables} table{counts.tables > 1 ? "s" : ""} · {MIN_GUESTS}–{MAX_GUESTS} guests</span>
        </div>
      </div>

      {ADULT_SECTIONS.map((section) => (
        <section key={section.name} className="bz-tb-section" aria-label={section.name}>
          <h2>{section.name}</h2>
          {section.items.map(item)}
        </section>
      ))}

      <div className="bz-tb-sum" data-testid="adult-total">
        <span>Grown-ups&apos; table · {a.guests} guests</span>
        <b>AED {formatAED(adultTotal(a))}</b>
        <button type="button" className="bz-restart" onClick={() => setAdultTable({ ...a, enabled: false, done: false })}>Remove the table</button>
      </div>
      <FinishBar done={a.done} what="grown-ups' table" next="Welcome board" onFinish={onFinish} testId="finish-adult-table" />
    </div>
  );
}

/** A part's render, which its Finalize buttons wait for (2026-11-03, the owner: "generate render yapmadan finalize
 *  … basılamasın"). */
export interface FinishRender { ready: boolean; stale: boolean; loading: boolean; error: string | null; onGenerate: () => void }

/** The end of a part: Finalize, then on to the next part (2026-10-31, the owner: "finalize etmek için bir butona basıp");
 *  and, on the kids' table, straight on to the welcome board too (`onSkipAhead`, 2026-11-02). Only here, at the
 *  end of the part (2026-11-02, later: "hep son aşamalarda olsun"). With a render, first the render ("First
 *  Generate render to see your final design"), as the backdrop's Extras tab. */
export function FinishBar({ done, what, next, onFinish, onSkipAhead, onSkip, testId, render }: { done?: boolean; what: string; next: string; onFinish: () => void; onSkipAhead?: () => void; onSkip?: () => void; testId: string; render?: FinishRender }) {
  const waiting = !!render && !render.ready;
  return (
    <div className={`bz-tb-finish ${done ? "done" : ""}`}>
      <p>{done ? <>✓ Your {what} is finished. Changes are still kept.</> : <>Happy with every choice? Finalize the {what} — next comes the {next.toLowerCase()}.</>}</p>
      {waiting && (
        <div className="render" data-testid={`${testId}-render`}>
          <span className="bz-decor-first">{render.stale
            ? <>You changed it since your render — <b>Regenerate</b> to finalize this design.</>
            : <>First <b>Generate render</b> to see your final design.</>}</span>
          <button type="button" className="bz-decor-hint" onClick={render.onGenerate} disabled={render.loading} data-testid={`${testId}-generate`}>
            {render.loading ? "Generating…" : render.stale ? "Regenerate render ✨" : "Generate render ✨"}
          </button>
          {render.error && <span className="error" role="alert">{render.error}</span>}
        </div>
      )}
      <div className="actions">
        {/* 2026-11-03 (the owner: "welcome board skip yapabilmeliyim"): on without it, no render needed. */}
        {onSkip && !done && (
          <button type="button" className="bz-back" data-testid={`${testId}-skip`} onClick={onSkip}>
            <span className="full">Skip the {what} → {next}</span><span className="short" aria-hidden="true">Skip →</span>
          </button>
        )}
        {onSkipAhead && <SkipAhead onClick={onSkipAhead} testId={`${testId}-to-welcome`} disabled={waiting} />}
        <button type="button" className="bz-next" data-testid={testId} onClick={onFinish} disabled={waiting} title={waiting ? "Generate your render first" : undefined}
          aria-label={done ? undefined : `Finalize the ${what} → ${next}`}>
          {done ? `Next: ${next} →` : <><span className="full">Finalize the {what} → {next}</span><span className="short" aria-hidden="true">Finalize → {next}</span></>}
        </button>
      </div>
    </div>
  );
}

/**
 * "Finalize the table setup → Welcome board" (2026-11-02, the owner: "sonrasında da welcome board için olmalı aynı
 * şekilde buton"): at the end of the kids' table, beside finalizing it, past the grown-ups' table.
 */
export function SkipAhead({ onClick, testId, disabled }: { onClick: () => void; testId: string; disabled?: boolean }) {
  return (
    <button type="button" className="bz-decor-cta" data-testid={testId} onClick={onClick} disabled={disabled} aria-label="Finalize the table setup → Welcome board">
      <span className="full">Finalize the table setup → Welcome board</span><span className="short" aria-hidden="true">Finalize → Welcome board</span>
    </button>
  );
}
