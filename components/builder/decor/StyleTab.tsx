// Decor step · Style tab (tab 02), moved unchanged from DecorStep in
// app/builder/page.tsx (Phase 0.1). Everything it reads comes from the
// step's shared state (useDecorStep).
import {
  ARCH_SIZES,
  RECT_SIZES,
  BACKDROP_PRINTS,
  FONT_STYLES,
  TEXT_SIZES,
  TEXT_COLORS,
  DEFAULT_TEXT_VALUE,
  themeTextColor,
  resolveTextColorHex,
  isCustomTextColor,
  type BackdropItem,
  type FontStyle,
  type TextColor,
  SHIMMER_COLORS,
  SHIMMER_COLOR_HEX,
  backdropSwatchesForTheme,
  BALLOON_RING_STYLES,
} from "@/lib/config";
import { getThemeCatalogEntry, FALLBACK_GRAPHIC_PRESETS } from "@/lib/themeCatalog";
import { PieceDiagram } from "@/components/design/LiveSketch";
import type { DecorCtx } from "@/components/builder/decor/useDecorStep";
import LetteringControls from "@/components/builder/decor/LetteringControls";
import { changeLine, letteringFromLegacy, letteringPatch, MAX_LETTERING_TEXT } from "@/lib/typography/lettering";
import { presetById } from "@/lib/typography/presets";
import type { BoardLettering } from "@/lib/config";

export default function StyleTab({ ctx }: { ctx: DecorCtx }) {
  const {
    config, patchDecor, setDecorTab, stylePieceId, setStylePieceId, setOpenCustomizeIds, d, theme,
    t, print, patchItem, patchItemText, patchItemGraphic, accent, card, chip, TYPE_LABEL,
  } = ctx;
  const items = d.backdropItems;
  if (items.length === 0) {
    return (
      <div className="bz-st-empty">
        <p>Pick a backdrop first — then we&apos;ll style it together.</p>
        <button type="button" className="bz-decor-hint" onClick={() => setDecorTab(0)}>← Go to Backdrop</button>
      </div>
    );
  }

  const archCount = items.filter((i) => i.type === "arch").length;
  const hasHalf = items.some((i) => i.type === "half_arch");
  const isPrintable = (it: BackdropItem) => !["shimmer_wall", "balloon_ring", "open_arch_frame"].includes(it.type);
  const pieceName = (it: BackdropItem, idx: number) => {
    if (it.type === "arch") {
      const n = items.filter((i, k) => i.type === "arch" && k <= idx).length;
      return archCount > 1 ? (n === 1 ? "Main arch" : "Second arch") : hasHalf ? "Centre arch" : "Arch backdrop";
    }
    if (it.type === "half_arch") {
      return items.filter((i, k) => i.type === "half_arch" && k < idx).length === 0 ? "Left half arch" : "Right half arch";
    }
    return TYPE_LABEL[it.type] ?? it.type;
  };

  // The piece being styled: the one picked above, else the one carrying
  // the lettering (where the setup puts "Happy Birthday"), else the first.
  const picked = items.findIndex((i) => i.id === stylePieceId);
  const itemIdx = picked >= 0 ? picked : Math.max(0, items.findIndex((i) => isPrintable(i) && i.text.enabled));
  const item = items[itemIdx];
  const printable = isPrintable(item);

  // Sizes come from ARCH_SIZES / RECT_SIZES; which of them this setup
  // sells is the same rule as before — Triple Arch's centre is Medium,
  // Double Arch is Large then Medium, a lone arch is Large.
  type SizeOpt = { id: string; name: string; w: number; h: number; available: boolean };
  let sizeOpts: SizeOpt[];
  if (item.type === "arch") {
    const n = items.filter((i, k) => i.type === "arch" && k <= itemIdx).length;
    const allowed = hasHalf ? ["medium"] : archCount > 1 ? [n === 1 ? "large" : "medium"] : ["large"];
    sizeOpts = ARCH_SIZES.map((s) => ({ id: s.id, name: s.label.replace(" / Standard", ""), w: s.widthCm, h: s.heightCm, available: allowed.includes(s.id) }));
  } else if (item.type === "rect") {
    sizeOpts = RECT_SIZES.map((s) => ({ id: s.id, name: "Rectangle", w: s.widthCm, h: s.heightCm, available: true }));
  } else {
    sizeOpts = [{ id: "__fixed", name: "One size", w: item.widthCm, h: item.heightCm, available: true }];
  }
  const isSizeOn = (o: SizeOpt) => o.id === "__fixed" || item.sizeId === o.id;
  const pickSize = (o: SizeOpt) => {
    if (!o.available || o.id === "__fixed") return;
    patchItem(itemIdx, { sizeId: o.id as BackdropItem["sizeId"], widthCm: o.w, heightCm: o.h });
    setOpenCustomizeIds((prev) => { const s = new Set(prev); s.add(item.id); return s; });
  };
  const needsSize = item.type === "arch" && !item.sizeId;
  const maxH = Math.max(...sizeOpts.map((o) => o.h));
  const maxW = Math.max(...sizeOpts.map((o) => o.w));
  const sizeIcon = (o: SizeOpt) => {
    const on = isSizeOn(o);
    const fill = !o.available ? "#EFE5EA" : on ? "#FF5C93" : "#F8B6CD";
    const w = 30 * (o.w / maxW), h = 44 * (o.h / maxH), x = 22 - w / 2, top = 50 - h;
    switch (item.type) {
      case "round": case "balloon_ring": return <circle cx="22" cy="28" r="19" fill={item.type === "round" ? fill : "none"} stroke={fill} strokeWidth={item.type === "round" ? 0 : 5} />;
      case "rect": case "banner": case "shimmer_wall": return <rect x={x} y={top} width={w} height={h} rx="3" fill={fill} />;
      case "half_arch": return <path d={`M ${x},50 L ${x},${top + w} A ${w},${w} 0 0 1 ${x + w},${top} L ${x + w},50 Z`} fill={fill} />;
      case "open_arch_frame": return <path d={`M ${x},50 L ${x},${top + w / 2} A ${w / 2},${w / 2} 0 0 1 ${x + w},${top + w / 2} L ${x + w},50`} fill="none" stroke={fill} strokeWidth="5" />;
      default: return <path d={`M ${x},50 L ${x},${top + w / 2} A ${w / 2},${w / 2} 0 0 1 ${x + w},${top + w / 2} L ${x + w},50 Z`} fill={fill} />;
    }
  };

  // Prices are read from the product data, never typed in here.
  const textPrice = BACKDROP_PRINTS.find((p) => p.id === "name_only")?.price;
  const graphicPrice = BACKDROP_PRINTS.find((p) => p.id === "theme_print")?.price;
  const presets = getThemeCatalogEntry(config.theme)?.graphicPresets ?? FALLBACK_GRAPHIC_PRESETS;
  const textHex = resolveTextColorHex(item.text.color, theme.accent);
  const boardHex = item.color || d.backdropColor || "#FFFFFF";
  const boardSwatches = backdropSwatchesForTheme(theme);
  const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const boardInList = boardSwatches.some((hex) => sameHex(hex, boardHex));
  const sampleText = item.text.value.trim() || DEFAULT_TEXT_VALUE;
  // 2026-10-26: the board's lettering — a Heading over a Name, each in its
  // own font and size (useDecorStep gives every board one).
  const lettering = item.text.lettering ?? letteringFromLegacy(item.text);
  const setLettering = (l: BoardLettering) => patchItemText(itemIdx, letteringPatch(l));
  const letteringStyleName = lettering.presetId ? presetById(lettering.presetId)?.name ?? "" : "Your own mix";
  const FONT_FACE: Record<string, { family: string; weight: number; size: number; short: string }> = {
    // The faces the render prints (app/layout.tsx). 2026-10-25 (T0):
    // Italianno replaces Brittany Signature; a narrower script, so a
    // larger size shows it at the same width.
    script:  { family: "var(--bz-signature)", weight: 400, size: 28, short: "Script" },
    block:   { family: "var(--bz-bold)", weight: 400, size: 19, short: "Bold" },
    // 21 -> 18: Playfair's "Birthday" is wider than Georgia's and broke
    // as "Birthda / y" in the narrow phone card.
    elegant: { family: "var(--bz-serif)", weight: 400, size: 18, short: "Serif" },
  };
  const textColorName = isCustomTextColor(item.text.color)
    ? "Custom"
    : TEXT_COLORS.find((c) => c.id === item.text.color)?.label ?? "";

  const showMsg = printable && !needsSize;
  const showFont = showMsg && item.text.enabled;
  const showColors = !needsSize;
  const showGraphic = printable && !needsSize;
  let k = 1;
  const nMsg = showMsg ? ++k : 0;
  const nFont = showFont ? ++k : 0;
  const nColors = showColors ? ++k : 0;
  const nGraphic = showGraphic ? ++k : 0;
  // In the two-column grid only an odd last card spans both columns, so
  // a hidden step never leaves a hole beside the colours.
  // The lettering card (3) always spans both columns, so it counts twice.
  const lastWide = (k + (showFont ? 1 : 0)) % 2 === 1;

  const sizeChip = (() => {
    const o = sizeOpts.find(isSizeOn);
    if (!o) return "Pick a size";
    return o.id === "__fixed" ? `${o.w} × ${o.h} cm` : o.name === "Rectangle" ? `${o.w} × ${o.h} cm` : o.name;
  })();

  const Head = ({ n, title, sub, optional }: { n: number; title: string; sub: string; optional?: boolean }) => (
    <div className="bz-st-head">
      <span className="num">{n}</span>
      <div>
        <h3>{title}{optional && <span className="opt"> (optional)</span>}</h3>
        <p>{sub}</p>
      </div>
    </div>
  );
  const Tick = () => <span className="bz-st-tick" aria-hidden="true">✓</span>;

  return (
    <div className="bz-st">
      {/* The lettering fonts (Typography System web fonts); each file loads when first shown. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      {items.length > 1 && (
        // 2026-10-24: a small drawing of the setup instead of name pills —
        // the piece being designed is the dark one; tap another to switch.
        <div className="bz-st-pieces diagram">
          <PieceDiagram items={items} activeId={item.id} onPick={setStylePieceId}
            labels={items.map((it, i) => pieceName(it, i))} />
          <div className="txt">
            <span className="lbl">Now designing:</span>
            <b className="name">{pieceName(item, itemIdx)}</b>
            <p className="hint">Your setup has {items.length} pieces. Tap a shape to design it — the dark one is the piece you’re changing.</p>
          </div>
        </div>
      )}

      <div className="bz-st-grid">
      {/* 1 — Size */}
      <section className={`bz-st-sec c-pink ${needsSize ? "attn" : ""}`}>
        <Head n={1} title="Pick your size"
          sub={sizeOpts.length === 1 ? "Our standard size looks perfect for most celebrations." : "Choose the size that fits your space."} />
        <div className={`bz-st-opts sizes ${sizeOpts.length === 1 ? "single" : ""}`}>
          {sizeOpts.map((o) => {
            const on = isSizeOn(o);
            return (
              <button key={o.id} type="button" disabled={!o.available} aria-pressed={on}
                className={`bz-st-card size ${on ? "on" : ""}`} onClick={() => pickSize(o)}
                title={o.available ? undefined : "Not part of this setup"}>
                {on && <Tick />}
                <svg viewBox="0 0 44 52" aria-hidden="true">{sizeIcon(o)}</svg>
                <strong>{o.name}</strong>
                <span>{o.w} × {o.h} cm</span>
                {!o.available && <em>Not in this setup</em>}
              </button>
            );
          })}
        </div>
        {needsSize && <div className="bz-st-cue">Choose a size to unlock text, colours and graphics ✦</div>}
      </section>

      {/* 2 — Message */}
      {showMsg && (
        <section className="bz-st-sec c-yellow">
          <Head n={nMsg} title="Add your message" sub="Make it personal with a special message." />
          <div className="bz-st-body">
            <div className="bz-st-opts yn">
              <button type="button" aria-pressed={item.text.enabled}
                className={`bz-st-yn ${item.text.enabled ? "on" : ""}`}
                onClick={() => { if (!item.text.enabled) patchItemText(itemIdx, { enabled: true, ...(!item.text.value.trim() ? { color: themeTextColor(config.theme), ...letteringPatch(changeLine(lettering, "heading", { text: DEFAULT_TEXT_VALUE })) } : {}) }); }}>
                <span className="radio" aria-hidden="true">{item.text.enabled ? "✓" : ""}</span>
                Yes, add text
                {textPrice != null && <span className="price">+AED {textPrice}</span>}
              </button>
              <button type="button" aria-pressed={!item.text.enabled}
                className={`bz-st-yn ${!item.text.enabled ? "on" : ""}`}
                onClick={() => { if (item.text.enabled) patchItemText(itemIdx, { enabled: false }); }}>
                <span className="radio" aria-hidden="true">{!item.text.enabled ? "✓" : ""}</span>
                No, keep it clean
              </button>
            </div>
            {item.text.enabled && (
              // 2026-10-26: two lines, each set in its own font (step 3).
              <div className="bz-st-lines">
                <label className="bz-st-input">
                  <span className="lbl">Heading</span>
                  <input value={lettering.heading.text} aria-label="Heading text" maxLength={MAX_LETTERING_TEXT}
                    onChange={(e) => setLettering(changeLine(lettering, "heading", { text: e.target.value }))}
                    placeholder="Happy Birthday" />
                  <span className="count">{lettering.heading.text.length}</span>
                </label>
                <label className="bz-st-input">
                  <span className="lbl">Name</span>
                  <input value={lettering.name.text} aria-label="Name text" maxLength={MAX_LETTERING_TEXT}
                    onChange={(e) => setLettering(changeLine(lettering, "name", { text: e.target.value }))}
                    placeholder="Add a name, e.g. Arya" />
                  <span className="count">{lettering.name.text.length}</span>
                </label>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3 — Lettering: presets, then each line's font and size, shown in the
           customer's words, colour and backdrop colour (2026-10-26). */}
      {showFont && (
        <section className="bz-st-sec c-green wide">
          <Head n={nFont} title="Pick your lettering" sub="Choose a style, then fine-tune the heading and the name." />
          <LetteringControls lettering={lettering} onChange={setLettering} boardHex={boardHex} textHex={textHex} />
        </section>
      )}

      {/* 4 — Colours */}
      {showColors && (
        <section className={`bz-st-sec c-lilac ${lastWide && !showGraphic ? "wide" : ""}`}>
          <Head n={nColors} title={item.type === "balloon_ring" ? "Pick your ring style" : "Pick your colors"}
            sub={item.type === "shimmer_wall" ? "Choose the sequin finish."
              : item.type === "balloon_ring" ? "Choose how the hoop is dressed."
              : showFont ? "Choose a backdrop color and text color." : "Choose a backdrop color."} />
          <div className="bz-st-colors">
            {item.type === "balloon_ring" ? (
              <div className="bz-st-opts rings">
                {BALLOON_RING_STYLES.map((rs) => {
                  const on = (d.balloonRingStyle ?? "full") === rs.id;
                  return (
                    <button key={rs.id} type="button" aria-pressed={on} className={`bz-st-card ring ${on ? "on" : ""}`}
                      // Same coupling as before: the bare hoop drops the balloon tier, a wrapped hoop puts a garland back.
                      onClick={() => patchDecor(rs.id === "none"
                        ? { balloonRingStyle: rs.id, balloonStyle: "none" }
                        : { balloonRingStyle: rs.id, balloonStyle: d.balloonStyle === "none" ? "full" : d.balloonStyle })}>
                      {on && <Tick />}
                      <strong>{rs.label}</strong>
                      <span>{rs.desc}</span>
                    </button>
                  );
                })}
              </div>
            ) : item.type === "shimmer_wall" ? (
              <div className="bz-st-group">
                <span className="lbl">Shimmer color · <b>{SHIMMER_COLORS.find((sc) => sc.id === (d.shimmerColor ?? "silver"))?.label}</b></span>
                <div className="bz-st-swatches">
                  {SHIMMER_COLORS.map((sc) => {
                    const on = (d.shimmerColor ?? "silver") === sc.id;
                    return (
                      <button key={sc.id} type="button" aria-pressed={on} aria-label={sc.label} title={sc.label}
                        className={`bz-st-sw ${on ? "on" : ""}`} style={{ background: SHIMMER_COLOR_HEX[sc.id] }}
                        onClick={() => patchDecor({ shimmerColor: sc.id })} />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bz-st-group">
                <span className="lbl">Backdrop color</span>
                <div className="bz-st-swatches">
                  {boardSwatches.map((hex) => (
                    <button key={hex} type="button" aria-pressed={sameHex(hex, boardHex)} aria-label={`Backdrop ${hex}`} title={hex}
                      className={`bz-st-sw ${sameHex(hex, boardHex) ? "on" : ""}`} style={{ background: hex }}
                      onClick={() => patchItem(itemIdx, { color: hex })} />
                  ))}
                  {/* The current colour, when it is not one of the theme swatches, shows here. */}
                  <label className={`bz-st-sw custom ${!boardInList ? "on" : ""}`} title={boardInList ? "Custom colour" : `Current colour ${boardHex}`}
                    style={!boardInList ? { background: boardHex } : undefined}>
                    <span aria-hidden="true">+</span>
                    <input type="color" aria-label="Custom backdrop colour" value={item.color || d.backdropColor || "#FFFFFF"}
                      onChange={(e) => patchItem(itemIdx, { color: e.target.value })} />
                  </label>
                </div>
              </div>
            )}
            {showFont && (
              <div className="bz-st-group text">
                <span className="lbl">Text color · <b>{textColorName}</b></span>
                <div className="bz-st-swatches">
                  {TEXT_COLORS.map((c) => {
                    const on = item.text.color === c.id;
                    return (
                      <button key={c.id} type="button" aria-pressed={on} aria-label={c.label} title={c.label}
                        className={`bz-st-sw ${on ? "on" : ""}`}
                        style={{ background: c.id === "accent" ? theme.accent : c.swatch }}
                        onClick={() => patchItemText(itemIdx, { color: c.id as TextColor })} />
                    );
                  })}
                  <label className={`bz-st-sw custom ${isCustomTextColor(item.text.color) ? "on" : ""}`} title="Custom colour"
                    style={isCustomTextColor(item.text.color) ? { background: textHex } : undefined}>
                    <span aria-hidden="true">+</span>
                    <input type="color" aria-label="Custom text colour" value={textHex}
                      onChange={(e) => patchItemText(itemIdx, { color: e.target.value.toUpperCase() })} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5 — Theme graphic */}
      {showGraphic && (
        <section className={`bz-st-sec c-blue ${lastWide ? "wide" : ""}`}>
          <Head n={nGraphic} title="Add a theme graphic" optional sub="Includes a printed illustration to make it extra special." />
          <div className="bz-st-body">
            <div className="bz-st-opts yn">
              <button type="button" aria-pressed={!item.graphic.enabled}
                className={`bz-st-card graphic ${!item.graphic.enabled ? "on" : ""}`}
                onClick={() => { if (item.graphic.enabled) patchItemGraphic(itemIdx, { enabled: false }); }}>
                {!item.graphic.enabled && <Tick />}
                <span className="ico" aria-hidden="true">⊘</span>
                <strong>No graphic</strong>
              </button>
              <button type="button" aria-pressed={item.graphic.enabled}
                className={`bz-st-card graphic ${item.graphic.enabled ? "on" : ""}`}
                onClick={() => {
                  if (item.graphic.enabled) return;
                  if (!item.graphic.assetId) {
                    const first = presets[0];
                    patchItemGraphic(itemIdx, { enabled: true, theme: first.id, source: "preset", assetId: first.assetId });
                  } else {
                    patchItemGraphic(itemIdx, { enabled: true });
                  }
                }}>
                {item.graphic.enabled && <Tick />}
                <span className="ico" aria-hidden="true">🎉</span>
                <span>
                  <strong>Add graphic</strong>
                  {graphicPrice != null && <span className="price">+AED {graphicPrice}</span>}
                </span>
              </button>
            </div>
            {item.graphic.enabled && (
              <div className="bz-st-presets" role="group" aria-label="Choose the print">
                {presets.map((p) => (
                  <button key={p.id} type="button" title={p.desc} aria-pressed={item.graphic.assetId === p.assetId}
                    className={`bz-st-chip ${item.graphic.assetId === p.assetId ? "on" : ""}`}
                    onClick={() => patchItemGraphic(itemIdx, { theme: p.id, source: "preset", assetId: p.assetId })}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      </div>{/* end bz-st-grid */}

      {/* Live summary of the real selections */}
      <div className="bz-st-summary" aria-live="polite">
        <span className="lead"><span aria-hidden="true">♥</span> Your style{items.length > 1 ? ` · ${pieceName(item, itemIdx)}` : ""}:</span>
        <span className="bz-st-pill">{sizeChip}</span>
        {printable && (
          <span className="bz-st-pill">{item.text.enabled ? <>Tт {sampleText.length > 22 ? `${sampleText.slice(0, 21)}…` : sampleText}</> : "No text"}</span>
        )}
        {printable && item.text.enabled && <span className="bz-st-pill">✎ {letteringStyleName}</span>}
        {printable && item.text.enabled && (
          <span className="bz-st-pill"><i style={{ background: textHex }} />{textColorName}</span>
        )}
        {item.type === "shimmer_wall" && (
          <span className="bz-st-pill"><i style={{ background: SHIMMER_COLOR_HEX[d.shimmerColor ?? "silver"] }} />{SHIMMER_COLORS.find((sc) => sc.id === (d.shimmerColor ?? "silver"))?.label}</span>
        )}
        {item.type === "balloon_ring" && (
          <span className="bz-st-pill">{BALLOON_RING_STYLES.find((rs) => rs.id === (d.balloonRingStyle ?? "full"))?.label}</span>
        )}
        {printable && item.graphic.enabled && (
          <span className="bz-st-pill">🎉 {presets.find((p) => p.assetId === item.graphic.assetId)?.label ?? "Theme graphic"}</span>
        )}
        <button type="button" className="go" onClick={() => setDecorTab(2)}>Looks great! ›</button>
      </div>
    </div>
  );
}
