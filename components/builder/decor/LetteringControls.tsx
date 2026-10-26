// The Style tab's lettering choices (Typography System, 2026-10-26): a preset
// for the two fonts, then the Heading and the Name each with its own font and
// size. Previews use the web fonts of the same files the render guide shapes
// (public/fonts/typography), so a tile looks like what is drawn.
import { useState } from "react";
import { TEXT_SIZES, type BoardLettering, type LetteringLine } from "@/lib/config";
import { FONTS, FONT_CATEGORIES, cssFamily, fontVariants, type RegistryFont } from "@/lib/typography/registry";
import { PRESETS, presetById } from "@/lib/typography/presets";
import { applyPreset, changeLine } from "@/lib/typography/lettering";

type Role = "heading" | "name";

const PICKER = FONTS.filter((f) => !f.legacyOnly);
const PRESET_ORDER = [...PRESETS].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));

/** CSS for a font in a weight: its web font and its always-on features (lining figures). */
export function fontFace(fontId: string, weight: number): React.CSSProperties {
  const f = FONTS.find((x) => x.id === fontId);
  if (!f) return {};
  const v = fontVariants(f).find((x) => x.weight.weight === weight && (!x.optical || x.optical.default)) ?? fontVariants(f)[0];
  return {
    fontFamily: `"${cssFamily(v)}"`,
    fontWeight: weight,
    fontFeatureSettings: f.features?.length ? f.features.map((t) => `"${t}" 1`).join(", ") : undefined,
  };
}

const familyOf = (fontId: string) => FONTS.find((f) => f.id === fontId)?.family ?? fontId;

export default function LetteringControls({ lettering, onChange, boardHex, textHex }: {
  lettering: BoardLettering;
  onChange: (l: BoardLettering) => void;
  boardHex: string;
  textHex: string;
}) {
  const [role, setRole] = useState<Role>(lettering.name.text.trim() ? "name" : "heading");
  const [category, setCategory] = useState<string>("recommended");
  const line: LetteringLine = lettering[role];
  const headingSample = lettering.heading.text.trim() || "Happy Birthday";
  const nameSample = lettering.name.text.trim() || "Arya";
  const sample = role === "heading" ? headingSample : nameSample;
  const shown = PICKER.filter((f: RegistryFont) =>
    category === "all" ? true : category === "recommended" ? f.bestFor.includes(role) : f.category === category);
  const basedOn = presetById(lettering.basedOn);
  const current = lettering.presetId ? presetById(lettering.presetId) : undefined;

  return (
    <div className="bz-lt">
      {/* Presets: the two fonts together, shown in the customer's own words. */}
      <div className="bz-lt-presets" role="radiogroup" aria-label="Lettering styles">
        {PRESET_ORDER.map((p) => {
          const on = lettering.presetId === p.id;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} aria-label={p.name}
              className={`bz-lt-preset ${on ? "on" : ""}`} onClick={() => onChange(applyPreset(lettering, p.id))}>
              {on && <span className="bz-st-tick" aria-hidden="true">✓</span>}
              <span className="sample" style={{ background: boardHex, color: textHex }}>
                <span className="h" style={fontFace(p.headingFont.fontId, p.headingFont.weight)}>{headingSample}</span>
                <span className="n" style={fontFace(p.nameFont.fontId, p.nameFont.weight)}>{nameSample}</span>
              </span>
              <strong>{p.name}</strong>
              {p.featured && <em>Blushy favourite</em>}
            </button>
          );
        })}
      </div>
      <p className="bz-lt-state" data-testid="lettering-state">
        {current ? <>Style: <b>{current.name}</b></> : (
          <>Your own mix{basedOn ? <> (from {basedOn.name}) · <button type="button" onClick={() => onChange(applyPreset(lettering, basedOn.id))}>Back to {basedOn.name}</button></> : null}</>
        )}
      </p>

      {/* One line at a time: its font and size. */}
      <div className="bz-lt-tabs" role="tablist" aria-label="Lettering line">
        {(["heading", "name"] as Role[]).map((r) => (
          <button key={r} type="button" role="tab" aria-selected={role === r} className={role === r ? "on" : ""} onClick={() => setRole(r)}>
            {r === "heading" ? "Heading" : "Name"} <span>· {familyOf(lettering[r].fontId)}</span>
          </button>
        ))}
      </div>
      <div className="bz-lt-cats" role="group" aria-label="Font categories">
        {[{ id: "recommended", label: `Best for ${role === "heading" ? "headings" : "names"}` }, ...FONT_CATEGORIES, { id: "all", label: `All fonts (${PICKER.length})` }].map((c) => (
          <button key={c.id} type="button" aria-pressed={category === c.id} className={category === c.id ? "on" : ""} onClick={() => setCategory(c.id)}>{c.label}</button>
        ))}
      </div>
      <div className="bz-lt-fonts" role="radiogroup" aria-label={`${role === "heading" ? "Heading" : "Name"} font`}>
        {shown.map((f) => {
          const on = line.fontId === f.id;
          return (
            <button key={f.id} type="button" role="radio" aria-checked={on} aria-label={f.family}
              className={`bz-lt-font ${on ? "on" : ""}`}
              onClick={() => onChange(changeLine(lettering, role, { fontId: f.id, weight: f.defaultWeight }))}>
              <span className="sample" style={{ ...fontFace(f.id, f.defaultWeight), fontSize: role === "name" ? 27 : 19 }}>{sample}</span>
              <span className="fam">{f.family}</span>
            </button>
          );
        })}
      </div>
      <div className="bz-st-size" role="group" aria-label={`${role === "heading" ? "Heading" : "Name"} size`}>
        <span className="lbl">{role === "heading" ? "Heading" : "Name"} size</span>
        {TEXT_SIZES.map((t) => {
          const on = line.size === t.id;
          return (
            <button key={t.id} type="button" aria-pressed={on} className={on ? "on" : ""}
              onClick={() => onChange(changeLine(lettering, role, { size: t.id }))}>
              <span className="aa" style={{ fontSize: 11 + 5 * t.scale }} aria-hidden="true">Aa</span>{t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
