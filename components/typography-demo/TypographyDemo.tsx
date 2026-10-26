"use client";
// Typography demo UI (isolated; not part of the Builder). Every change is sent
// to /api/typography/layout, which runs the real lettering engine; the SVG it
// returns is drawn on the Single Round photo between the board and the
// balloons, at the board's true scale. Font tiles are set in the web fonts
// (public/fonts/typography) with the customer's own text. Options from the
// per-method check are only applied when the customer clicks them.
import { useEffect, useMemo, useRef, useState } from "react";

type Role = "heading" | "name";
type Size = "small" | "medium" | "large";
interface DemoFont {
  id: string; family: string; category: string; bestFor: Role[]; legacyOnly: boolean; defaultWeight: number;
  weights: number[]; optical: { id: string; label: string; default: boolean }[]; css: Record<string, string>;
}
interface Preset { id: string; number: number; name: string; featured: boolean; headingFont: { fontId: string; weight: number }; nameFont: { fontId: string; weight: number } }
interface El { text: string; fontId: string; weight: number; optical?: string; size: Size; color: string; offset: { x: number; y: number } }
type Alt = { kind: "weight"; weight: number; thinMm: number; meetsLimit: boolean } | { kind: "optical"; optical: string; label: string; thinMm: number; meetsLimit: boolean } | { kind: "size"; minCapHeightMm: number } | { kind: "finish"; finish: string };
type Note = { kind: "thin_strokes"; thinMm: number; minMm: number } | { kind: "not_monoline"; monoline: number } | { kind: "separate_letters"; word: string; pieces: number } | { kind: "missing_letters"; letters: string };
interface Assessment { finish: string; status: "ok" | "check"; thinMm: number; notes: Note[]; alternatives: Alt[]; provisional: boolean }
interface LaidOut { role: Role; fontId: string; weight: number; optical: string | null; capHeightMm: number; fontSizeMm: number; adjusted: boolean; missing: string; finishes: Record<string, Assessment> }
interface Result { svg: string; elements: LaidOut[]; hash: string }

interface Props {
  fonts: DemoFont[];
  categories: { id: string; label: string }[];
  presets: Preset[];
  defaultPresetId: string;
  finishes: { id: string; label: string }[];
  box: { widthMm: number; heightMm: number };
  photo: { room: string; balloons: string; plinth: string; plinthBox: { x: number; y: number; w: number; h: number }; unitsPerMm: number; centre: { x: number; y: number } };
  maxText: number;
}

const COLOURS = [
  { hex: "#A7ABB1", label: "Silver" }, { hex: "#D4AF37", label: "Gold" }, { hex: "#C9907E", label: "Rose gold" },
  { hex: "#15182E", label: "Navy" }, { hex: "#222222", label: "Black" }, { hex: "#F472B6", label: "Pink" }, { hex: "#FFFFFF", label: "White" },
];
const BOARDS = [{ hex: "#FFFFFF", label: "White" }, { hex: "#F8D7E3", label: "Blush" }, { hex: "#DCD7F2", label: "Lilac" }, { hex: "#D6E8F7", label: "Sky" }];
const SIZES: { id: Size; label: string }[] = [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }];
const FINISH_HELP: Record<string, string> = {
  printed: "Printed on the board", vinyl: "Cut vinyl", acrylic: "Cut acrylic", mirror_acrylic: "Cut mirror acrylic", neon: "LED neon",
};

const variantKey = (f: DemoFont, weight: number, optical?: string) => {
  const def = f.optical.find((o) => o.default)?.id;
  return optical && optical !== def ? `${weight}/${optical}` : String(weight);
};

function noteText(n: Note) {
  switch (n.kind) {
    case "thin_strokes": return `thinnest stroke ${n.thinMm} mm (limit ${n.minMm} mm)`;
    case "not_monoline": return "strong thick–thin contrast (neon reads best as an even line)";
    case "separate_letters": return `letters cut as separate pieces ("${n.word}": ${n.pieces})`;
    case "missing_letters": return `no glyph for "${n.letters}"`;
  }
}

export default function TypographyDemo(props: Props) {
  const { fonts, presets, box, photo } = props;
  const fontById = useMemo(() => Object.fromEntries(fonts.map((f) => [f.id, f])), [fonts]);
  const preset0 = presets.find((p) => p.id === props.defaultPresetId)!;
  const [presetId, setPresetId] = useState<string | null>(preset0.id);
  const [basedOn, setBasedOn] = useState(preset0.id);
  const [heading, setHeading] = useState<El>({ text: "Happy 1st Birthday", ...preset0.headingFont, size: "medium", color: "#15182E", offset: { x: 0, y: 0 } });
  const [name, setName] = useState<El>({ text: "Layla", ...preset0.nameFont, size: "medium", color: "#15182E", offset: { x: 0, y: 0 } });
  const [tab, setTab] = useState<Role>("name");
  const [category, setCategory] = useState<string>("recommended");
  const [board, setBoard] = useState("#FFFFFF");
  const [showBox, setShowBox] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const el = tab === "heading" ? heading : name;
  const setEl = (patch: Partial<El>, fontChange = false) => {
    (tab === "heading" ? setHeading : setName)((e) => ({ ...e, ...patch }));
    if (fontChange && presetId) setPresetId(null);
  };

  // Lay out with the real engine on every change (debounced; stale answers ignored).
  const payload = useMemo(() => JSON.stringify({ presetId: presetId ?? basedOn, heading, name }), [presetId, basedOn, heading, name]);
  useEffect(() => {
    const id = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/typography/layout", { method: "POST", headers: { "content-type": "application/json" }, body: payload });
        const json = await res.json();
        if (id !== seq.current) return;
        if (!res.ok) { setError(json.error ?? `Error ${res.status}`); return; }
        setError(null);
        setResult(json);
      } catch (e) {
        if (id === seq.current) setError(String(e));
      } finally {
        if (id === seq.current) setBusy(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [payload]);

  const applyPreset = (p: Preset) => {
    // A preset sets the two fonts only; texts, sizes, colours and positions stay.
    setHeading((e) => ({ ...e, fontId: p.headingFont.fontId, weight: p.headingFont.weight, optical: undefined }));
    setName((e) => ({ ...e, fontId: p.nameFont.fontId, weight: p.nameFont.weight, optical: undefined }));
    setPresetId(p.id);
    setBasedOn(p.id);
  };

  const download = async (format: "production" | "cut") => {
    const res = await fetch(`/api/typography/layout?format=${format}`, { method: "POST", headers: { "content-type": "application/json" }, body: payload });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = `lettering-${format}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  const shownFonts = fonts.filter((f) => category === "all" ? true : category === "recommended" ? !f.legacyOnly && f.bestFor.includes(tab) : f.category === category && !f.legacyOnly);
  const current = fontById[el.fontId];
  const laid = result?.elements.find((e) => e.role === tab);
  const inner = result?.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "") ?? "";
  const W = box.widthMm * photo.unitsPerMm, H = box.heightMm * photo.unitsPerMm;
  const bx = photo.centre.x - W / 2, by = photo.centre.y - H / 2;
  const sample = el.text.trim() || (tab === "heading" ? "Happy Birthday" : "Layla");

  return (
    <div className="min-h-screen bg-[#fbf7f9] text-[#15182E]" style={{ fontFamily: "var(--bz-sans), system-ui, sans-serif" }}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      <header className="border-b border-[#f1d8e2] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold">Typography demo <span className="font-normal text-[#7f717c]">· Heading + Name · real lettering engine</span></h1>
          <p className="text-xs text-[#7f717c]">Single Round 2 m · lettering area {box.widthMm} × {box.heightMm} mm · not the live Builder</p>
        </div>
      </header>

      {/* minmax(0, …) and min-w-0: the preset carousel's width must not widen the column on phones. */}
      <main className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Preview */}
        <section className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="relative overflow-hidden rounded-2xl border border-[#f1d8e2] bg-white shadow-sm">
            <svg viewBox="0 0 1000 1000" className="block h-auto w-full" data-testid="demo-preview" role="img" aria-label={`${heading.text} ${name.text}`}>
              <defs><mask id="demoBoard" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><image href="/design/sketch/round-board-mask.png" width="1000" height="1000" /></mask></defs>
              <image href={photo.room} width="1000" height="1000" />
              {board !== "#FFFFFF" && <rect width="1000" height="1000" fill={board} mask="url(#demoBoard)" style={{ mixBlendMode: "multiply" }} />}
              <svg x={bx} y={by} width={W} height={H} viewBox={`0 0 ${box.widthMm} ${box.heightMm}`} data-testid="lettering" data-hash={result?.hash ?? ""} dangerouslySetInnerHTML={{ __html: inner }} />
              {showBox && <rect x={bx} y={by} width={W} height={H} fill="none" stroke="#EC4D8D" strokeDasharray="6 5" strokeWidth="2" />}
              <image href={photo.balloons} width="1000" height="1000" />
              <image href={photo.plinth} x={photo.plinthBox.x} y={photo.plinthBox.y} width={photo.plinthBox.w} height={photo.plinthBox.h} preserveAspectRatio="none" />
            </svg>
            {busy && <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-[#7f717c]">updating…</span>}
          </div>
          {/* The same engine SVG, magnified: at true scale a 7 cm name is small on a 2 m board. */}
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#f1d8e2]" style={{ background: board }}>
            <div className="flex items-center justify-between px-3 pt-2 text-[11px] text-[#7f717c]"><span>Zoom · lettering area {box.widthMm} × {box.heightMm} mm</span><span>same SVG as above</span></div>
            <svg viewBox={`0 0 ${box.widthMm} ${box.heightMm}`} className="block h-auto w-full" data-testid="lettering-zoom" dangerouslySetInnerHTML={{ __html: inner }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#7f717c]">Board</span>
            {BOARDS.map((b) => (
              <button key={b.hex} type="button" aria-label={`Board ${b.label}`} aria-pressed={board === b.hex} onClick={() => setBoard(b.hex)}
                className={`h-7 w-7 rounded-full border ${board === b.hex ? "ring-2 ring-[#EC4D8D] ring-offset-1" : "border-black/15"}`} style={{ background: b.hex }} />
            ))}
            <label className="ml-auto flex items-center gap-1.5"><input type="checkbox" checked={showBox} onChange={(e) => setShowBox(e.target.checked)} /> Show lettering area</label>
          </div>
          {result && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs" data-testid="measurements">
              {result.elements.map((e) => (
                <div key={e.role} className="rounded-xl border border-[#f1d8e2] bg-white p-2.5">
                  <div className="font-semibold capitalize">{e.role}</div>
                  <div className="text-[#7f717c]">{fontById[e.fontId]?.family} {e.weight}{e.optical ? ` · ${e.optical}` : ""}</div>
                  <div>Cap height <b>{e.capHeightMm.toFixed(1)} mm</b></div>
                  {e.adjusted && <div className="text-[#b45309]">Moved up to clear the name</div>}
                  {e.missing && <div className="text-[#b91c1c]">No glyph for “{e.missing}” — not drawn</div>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => download("production")} className="rounded-full border border-[#15182E] px-3 py-1.5 text-xs font-semibold">Download production SVG (mm)</button>
            <button type="button" onClick={() => download("cut")} className="rounded-full border border-[#15182E] px-3 py-1.5 text-xs font-semibold">Download cut file (SVG)</button>
          </div>
          {error && <p className="mt-2 text-xs text-[#b91c1c]" role="alert">{error}</p>}
        </section>

        {/* Controls */}
        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-[#f1d8e2] bg-white p-4">
            <h2 className="mb-2 text-sm font-bold">Choose your text style</h2>
            <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Presets">
              {[...presets].sort((a, b) => Number(b.featured) - Number(a.featured)).map((p) => {
                const on = presetId === p.id;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => applyPreset(p)}
                    className={`min-w-[150px] shrink-0 rounded-xl border p-2.5 text-left ${on ? "border-[#EC4D8D] bg-[#fff0f6]" : "border-black/10 bg-white"}`}>
                    <div className="text-[10px] font-semibold text-[#7f717c]">#{p.number}{p.featured ? " · ⭐ Blushy favourite" : ""}</div>
                    <div className="truncate text-[13px]" style={{ fontFamily: `"${fontById[p.headingFont.fontId].css[String(p.headingFont.weight)]}"`, fontWeight: p.headingFont.weight }}>{heading.text || "Happy Birthday"}</div>
                    <div className="truncate text-[24px] leading-tight" style={{ fontFamily: `"${fontById[p.nameFont.fontId].css[String(p.nameFont.weight)]}"`, fontWeight: p.nameFont.weight }}>{name.text || "Layla"}</div>
                    <div className="mt-1 text-[11px] font-semibold">{p.name}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[#7f717c]" data-testid="preset-state">
              {presetId ? <>Preset: <b>{presets.find((p) => p.id === presetId)!.name}</b></> : <>Custom (based on {presets.find((p) => p.id === basedOn)!.name}) · <button type="button" className="underline" onClick={() => applyPreset(presets.find((p) => p.id === basedOn)!)}>Reset to preset</button></>}
            </p>
          </div>

          <div className="rounded-2xl border border-[#f1d8e2] bg-white p-4">
            <div className="mb-3 grid grid-cols-2 rounded-full bg-[#f6eef2] p-1 text-sm" role="tablist">
              {(["heading", "name"] as Role[]).map((r) => (
                <button key={r} type="button" role="tab" aria-selected={tab === r} onClick={() => setTab(r)}
                  className={`rounded-full py-1.5 font-semibold capitalize ${tab === r ? "bg-white shadow-sm" : "text-[#7f717c]"}`}>
                  {r} <span className="font-normal text-[#7f717c]">· {fontById[(r === "heading" ? heading : name).fontId].family}</span>
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold">{tab === "heading" ? "Heading" : "Name"}
              <input value={el.text} maxLength={props.maxText} onChange={(e) => setEl({ text: e.target.value })} aria-label={tab === "heading" ? "Heading text" : "Name text"}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-base font-normal" />
            </label>

            <div className="mt-3 flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Font categories">
              {[{ id: "recommended", label: `Recommended for ${tab}s` }, ...props.categories, { id: "all", label: `All fonts (${fonts.length})` }].map((c) => (
                <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}
                  className={`rounded-full border px-2.5 py-1 ${category === c.id ? "border-[#15182E] bg-[#15182E] text-white" : "border-black/15"}`}>{c.label}</button>
              ))}
            </div>

            <div className="mt-3 grid max-h-[340px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3" role="radiogroup" aria-label={`${tab} font`}>
              {shownFonts.map((f) => {
                const on = el.fontId === f.id;
                return (
                  <button key={f.id} type="button" role="radio" aria-checked={on} aria-label={f.family} disabled={f.legacyOnly}
                    onClick={() => setEl({ fontId: f.id, weight: f.defaultWeight, optical: undefined }, true)}
                    className={`min-h-[76px] rounded-xl border p-2 text-left ${on ? "border-[#EC4D8D] bg-[#fff0f6]" : "border-black/10"} ${f.legacyOnly ? "opacity-50" : ""}`}>
                    <div className="truncate leading-tight" style={{ fontFamily: `"${f.css[String(f.defaultWeight)]}"`, fontWeight: f.defaultWeight, fontSize: tab === "name" ? 28 : 18 }}>{sample}</div>
                    <div className="mt-1 text-[10px] text-[#7f717c]">{f.family}{f.legacyOnly ? " · existing designs only" : ""}</div>
                  </button>
                );
              })}
            </div>

            {(current.weights.length > 1 || current.optical.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {current.weights.length > 1 && <>
                  <span className="text-[#7f717c]">Weight</span>
                  {current.weights.map((w) => (
                    <button key={w} type="button" aria-pressed={el.weight === w} onClick={() => setEl({ weight: w }, true)}
                      className={`rounded-full border px-2.5 py-1 ${el.weight === w ? "border-[#15182E] bg-[#15182E] text-white" : "border-black/15"}`} style={{ fontFamily: `"${current.css[variantKey(current, w, el.optical)]}"`, fontWeight: w }}>{w}</button>
                  ))}
                </>}
                {current.optical.length > 0 && <>
                  <span className="ml-2 text-[#7f717c]">Cut</span>
                  {current.optical.map((o) => {
                    const on = (el.optical ?? current.optical.find((x) => x.default)?.id) === o.id;
                    return <button key={o.id} type="button" aria-pressed={on} onClick={() => setEl({ optical: o.default ? undefined : o.id }, true)}
                      className={`rounded-full border px-2.5 py-1 ${on ? "border-[#15182E] bg-[#15182E] text-white" : "border-black/15"}`}>{o.label}</button>;
                  })}
                </>}
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold">Size</div>
                <div className="flex gap-1.5" role="group" aria-label={`${tab} size`}>
                  {SIZES.map((s) => <button key={s.id} type="button" aria-pressed={el.size === s.id} onClick={() => setEl({ size: s.id })}
                    className={`flex-1 rounded-full border px-2 py-1.5 text-xs ${el.size === s.id ? "border-[#EC4D8D] bg-[#EC4D8D] text-white" : "border-black/15"}`}>{s.label}</button>)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold">Colour</div>
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${tab} colour`}>
                  {COLOURS.map((c) => <button key={c.hex} type="button" aria-label={c.label} aria-pressed={el.color === c.hex} onClick={() => setEl({ color: c.hex })}
                    className={`h-7 w-7 rounded-full border ${el.color === c.hex ? "ring-2 ring-[#EC4D8D] ring-offset-1" : "border-black/15"}`} style={{ background: c.hex }} />)}
                  <input type="color" aria-label="Custom colour" value={el.color} onChange={(e) => setEl({ color: e.target.value.toUpperCase() })} className="h-7 w-9 cursor-pointer rounded border border-black/15" />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold">Position
                <button type="button" className="font-normal underline" onClick={() => setEl({ offset: { x: 0, y: 0 } })}>Reset</button>
              </div>
              {(["x", "y"] as const).map((axis) => (
                <label key={axis} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-[#7f717c]">{axis === "x" ? "Left–right" : "Up–down"}</span>
                  <input type="range" min={-0.45} max={0.45} step={0.01} value={el.offset[axis]} aria-label={`${tab} ${axis === "x" ? "horizontal" : "vertical"} position`}
                    onChange={(e) => setEl({ offset: { ...el.offset, [axis]: Number(e.target.value) } })} className="flex-1 accent-[#EC4D8D]" />
                  <span className="w-12 text-right tabular-nums">{Math.round(el.offset[axis] * (axis === "x" ? box.widthMm : box.heightMm))} mm</span>
                </label>
              ))}
            </div>
          </div>

          {laid && (
            <div className="rounded-2xl border border-[#f1d8e2] bg-white p-4" data-testid="assessment">
              <h2 className="text-sm font-bold">Material &amp; Finish — preliminary check <span className="font-normal text-[#7f717c]">({tab})</span></h2>
              <p className="mt-0.5 text-[11px] text-[#7f717c]">Limits are provisional until your producer confirms them. Nothing is changed for you — tap an option to preview it.</p>
              <ul className="mt-2 space-y-2 text-xs">
                {props.finishes.map((f) => {
                  const a = laid.finishes[f.id];
                  return (
                    <li key={f.id} className="rounded-lg border border-black/10 p-2" data-finish={f.id} data-status={a.status}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{f.label} <span className="font-normal text-[#7f717c]">· {FINISH_HELP[f.id]}</span></span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.status === "ok" ? "bg-[#e7f6ec] text-[#166534]" : "bg-[#fff4e5] text-[#9a3412]"}`}>{a.status === "ok" ? "OK" : "Needs producer check"}</span>
                      </div>
                      {a.notes.length > 0 && <div className="mt-1 text-[#7f717c]">{a.notes.map(noteText).join(" · ")}</div>}
                      {a.alternatives.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {a.alternatives.map((alt, i) => {
                            if (alt.kind === "weight") return <button key={i} type="button" onClick={() => setEl({ weight: alt.weight }, true)} className="rounded-full border border-[#EC4D8D] px-2 py-0.5 text-[#EC4D8D]">Preview weight {alt.weight} ({alt.thinMm} mm{alt.meetsLimit ? " ✓" : ""})</button>;
                            if (alt.kind === "optical") return <button key={i} type="button" onClick={() => setEl({ optical: alt.optical }, true)} className="rounded-full border border-[#EC4D8D] px-2 py-0.5 text-[#EC4D8D]">Preview {alt.label} ({alt.thinMm} mm{alt.meetsLimit ? " ✓" : ""})</button>;
                            if (alt.kind === "size") return <span key={i} className="rounded-full bg-[#f6eef2] px-2 py-0.5">Passes from {alt.minCapHeightMm} mm cap height</span>;
                            return <span key={i} className="rounded-full bg-[#f6eef2] px-2 py-0.5">Fine as {props.finishes.find((x) => x.id === alt.finish)?.label}</span>;
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
