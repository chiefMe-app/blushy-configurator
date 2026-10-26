"use client";
// Typography demo UI (isolated; not part of the Builder). The customer picks a
// font for the Heading and for the Name, and sets each one's size, colour and
// position; the lettering is vinyl. Every change runs the real lettering
// engine (/api/typography/layout) and its SVG is drawn on the Single Round
// photo between the board and the balloons, at the board's true scale. The
// engine's production checks stay behind the scenes.
import { useEffect, useMemo, useRef, useState } from "react";

type Role = "heading" | "name";
type Size = "small" | "medium" | "large";
interface DemoFont { id: string; family: string; category: string; bestFor: Role[]; legacyOnly: boolean; defaultWeight: number; css: string; features: string }
interface Preset { id: string; number: number; name: string; featured: boolean; headingFont: { fontId: string; weight: number }; nameFont: { fontId: string; weight: number } }
interface El { text: string; fontId: string; weight: number; size: Size; color: string; offset: { x: number; y: number } }
interface Result { svg: string; hash: string; elements: { role: Role; missing: string }[] }

interface Props {
  fonts: DemoFont[];
  categories: { id: string; label: string }[];
  presets: Preset[];
  defaultPresetId: string;
  box: { widthMm: number; heightMm: number };
  photo: { room: string; balloons: string; plinth: string; plinthBox: { x: number; y: number; w: number; h: number }; unitsPerMm: number; centre: { x: number; y: number } };
  maxText: number;
}

/** Vinyl colours (metallic vinyl for silver, gold and rose gold). */
const COLOURS = [
  { hex: "#15182E", label: "Navy" }, { hex: "#222222", label: "Black" }, { hex: "#A7ABB1", label: "Silver" },
  { hex: "#C9A24A", label: "Gold" }, { hex: "#C9907E", label: "Rose gold" }, { hex: "#F472B6", label: "Pink" }, { hex: "#FFFFFF", label: "White" },
];
const SIZES: { id: Size; label: string }[] = [{ id: "small", label: "Small" }, { id: "medium", label: "Medium" }, { id: "large", label: "Large" }];

export default function TypographyDemo(props: Props) {
  const { fonts, presets, box, photo } = props;
  const fontById = useMemo(() => Object.fromEntries(fonts.map((f) => [f.id, f])), [fonts]);
  const preset0 = presets.find((p) => p.id === props.defaultPresetId)!;
  const [presetId, setPresetId] = useState<string | null>(preset0.id);
  const [basedOn, setBasedOn] = useState(preset0.id);
  // The name leads: Large by default, the heading Medium (Blushy boards).
  const [heading, setHeading] = useState<El>({ text: "Happy 1st Birthday", ...preset0.headingFont, size: "medium", color: "#15182E", offset: { x: 0, y: 0 } });
  const [name, setName] = useState<El>({ text: "Layla", ...preset0.nameFont, size: "large", color: "#15182E", offset: { x: 0, y: 0 } });
  const [tab, setTab] = useState<Role>("name");
  const [category, setCategory] = useState<string>("recommended");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      }
    }, 120);
    return () => clearTimeout(t);
  }, [payload]);

  const applyPreset = (p: Preset) => {
    // A preset sets the two fonts only; texts, sizes, colours and positions stay.
    setHeading((e) => ({ ...e, fontId: p.headingFont.fontId, weight: p.headingFont.weight }));
    setName((e) => ({ ...e, fontId: p.nameFont.fontId, weight: p.nameFont.weight }));
    setPresetId(p.id);
    setBasedOn(p.id);
  };

  /** CSS for a font tile: the web font and its always-on features (e.g. lining figures). */
  const face = (fontId: string, weight: number) => ({ fontFamily: `"${fontById[fontId].css}"`, fontWeight: weight, fontFeatureSettings: fontById[fontId].features || undefined });
  const shownFonts = fonts.filter((f) => category === "all" ? true : category === "recommended" ? !f.legacyOnly && f.bestFor.includes(tab) : f.category === category && !f.legacyOnly);
  const inner = result?.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "") ?? "";
  const W = box.widthMm * photo.unitsPerMm, H = box.heightMm * photo.unitsPerMm;
  const bx = photo.centre.x - W / 2, by = photo.centre.y - H / 2;
  const sample = el.text.trim() || (tab === "heading" ? "Happy Birthday" : "Layla");
  const missing = result?.elements.find((e) => e.role === tab)?.missing ?? "";

  return (
    <div className="min-h-screen bg-[#fbf7f9] text-[#15182E]" style={{ fontFamily: "var(--bz-sans), system-ui, sans-serif" }}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      <header className="border-b border-[#f1d8e2] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-lg font-bold">Your lettering <span className="font-normal text-[#7f717c]">· Single Round backdrop</span></h1>
        </div>
      </header>

      {/* minmax(0, …) and min-w-0: the preset row's width must not widen the column on phones. */}
      <main className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-[#f1d8e2] bg-white shadow-sm">
            <svg viewBox="0 0 1000 1000" className="block h-auto w-full" data-testid="demo-preview" role="img" aria-label={`${heading.text} ${name.text}`}>
              <image href={photo.room} width="1000" height="1000" />
              <svg x={bx} y={by} width={W} height={H} viewBox={`0 0 ${box.widthMm} ${box.heightMm}`} data-testid="lettering" data-hash={result?.hash ?? ""} dangerouslySetInnerHTML={{ __html: inner }} />
              <image href={photo.balloons} width="1000" height="1000" />
              <image href={photo.plinth} x={photo.plinthBox.x} y={photo.plinthBox.y} width={photo.plinthBox.w} height={photo.plinthBox.h} preserveAspectRatio="none" />
            </svg>
          </div>
          {error && <p className="mt-2 text-xs text-[#b91c1c]" role="alert">Something went wrong — please try again.</p>}
        </section>

        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-[#f1d8e2] bg-white p-4">
            <h2 className="mb-2 text-sm font-bold">Choose your text style</h2>
            <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Presets">
              {[...presets].sort((a, b) => Number(b.featured) - Number(a.featured)).map((p) => {
                const on = presetId === p.id;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => applyPreset(p)}
                    className={`min-w-[150px] shrink-0 rounded-xl border p-2.5 text-left ${on ? "border-[#EC4D8D] bg-[#fff0f6]" : "border-black/10 bg-white"}`}>
                    {p.featured && <div className="text-[10px] font-semibold text-[#EC4D8D]">⭐ Blushy favourite</div>}
                    <div className="truncate text-[13px]" style={face(p.headingFont.fontId, p.headingFont.weight)}>{heading.text || "Happy Birthday"}</div>
                    <div className="truncate text-[26px] leading-tight" style={face(p.nameFont.fontId, p.nameFont.weight)}>{name.text || "Layla"}</div>
                    <div className="mt-1 text-[11px] font-semibold">{p.name}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[#7f717c]" data-testid="preset-state">
              {presetId ? <>Style: <b>{presets.find((p) => p.id === presetId)!.name}</b></> : <>Your own mix (from {presets.find((p) => p.id === basedOn)!.name}) · <button type="button" className="underline" onClick={() => applyPreset(presets.find((p) => p.id === basedOn)!)}>Back to {presets.find((p) => p.id === basedOn)!.name}</button></>}
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
            {missing && <p className="mt-1 text-xs text-[#9a3412]">This font has no “{missing}”. Try another font.</p>}

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
                    onClick={() => setEl({ fontId: f.id, weight: f.defaultWeight }, true)}
                    className={`min-h-[76px] rounded-xl border p-2 text-left ${on ? "border-[#EC4D8D] bg-[#fff0f6]" : "border-black/10"} ${f.legacyOnly ? "opacity-50" : ""}`}>
                    <div className="truncate leading-tight" style={{ ...face(f.id, f.defaultWeight), fontSize: tab === "name" ? 28 : 18 }}>{sample}</div>
                    <div className="mt-1 text-[10px] text-[#7f717c]">{f.family}{f.legacyOnly ? " · existing designs only" : ""}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold">Size</div>
                <div className="flex gap-1.5" role="group" aria-label={`${tab} size`}>
                  {SIZES.map((s) => <button key={s.id} type="button" aria-pressed={el.size === s.id} onClick={() => setEl({ size: s.id })}
                    className={`flex-1 rounded-full border px-2 py-1.5 text-xs ${el.size === s.id ? "border-[#EC4D8D] bg-[#EC4D8D] text-white" : "border-black/15"}`}>{s.label}</button>)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold">Colour <span className="font-normal text-[#7f717c]">· vinyl lettering</span></div>
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${tab} colour`}>
                  {COLOURS.map((c) => <button key={c.hex} type="button" aria-label={c.label} aria-pressed={el.color === c.hex} onClick={() => setEl({ color: c.hex })}
                    className={`h-7 w-7 rounded-full border ${el.color === c.hex ? "ring-2 ring-[#EC4D8D] ring-offset-1" : "border-black/15"}`} style={{ background: c.hex }} />)}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold">Position
                <button type="button" className="font-normal underline" onClick={() => setEl({ offset: { x: 0, y: 0 } })}>Reset</button>
              </div>
              {(["x", "y"] as const).map((axis) => (
                <label key={axis} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-[#7f717c]">{axis === "x" ? "Left – right" : "Up – down"}</span>
                  <input type="range" min={-0.45} max={0.45} step={0.01} value={el.offset[axis]} aria-label={`${tab} ${axis === "x" ? "horizontal" : "vertical"} position`}
                    onChange={(e) => setEl({ offset: { ...el.offset, [axis]: Number(e.target.value) } })} className="flex-1 accent-[#EC4D8D]" />
                </label>
              ))}
            </div>
          </div>

          <p className="px-1 text-xs text-[#7f717c]" data-testid="finish">Lettering is cut from vinyl and applied to your backdrop.</p>
        </section>
      </main>
    </div>
  );
}
