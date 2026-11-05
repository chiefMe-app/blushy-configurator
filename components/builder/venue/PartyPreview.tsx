"use client";
// The whole party in one photograph, on the Venue step (2026-11-04, the owner: "Tasarladığımız Backdrop+table setup
// beraber görebilceğimiz bir render alsın ama bu sayfada outdoor yada indoor işaretlesin ona göre görsel üretelim"):
// she marks indoors or outdoors here, and the backdrop she designed (its render, or its live sketch) and her kids'
// table (its render, or its drawing) are made into one picture of the party in that setting (/api/party-render).
import { useEffect, useRef, type MutableRefObject } from "react";
import { THEMES, themeById, type BuilderConfig, type VenueDetails } from "@/lib/config";
import { PARTY_EXTRA_NAMES, partyPieces, type PartyExtra, type PartySetting } from "@/lib/studio/partyRender";
import { imageJpeg, nodeJpeg, svgJpeg } from "@/components/builder/nodeJpeg";
import type { PieceRender } from "@/components/builder/usePieceRender";
import RenderAgain from "@/components/builder/RenderAgain";
import ZoomPhoto from "@/components/builder/ZoomPhoto";
import LiveSketch from "@/components/design/LiveSketch";
import TablePlace from "@/components/studio/table/TablePlace";

/** The pictures sent for the party's photograph, each a JPEG data URI (null: that piece isn't in the party). */
export interface PartyShot { backdrop: string | null; tablePicture: string | null }

/** Each picture sent: at most this wide (two go in, and the engine's price is by size). */
const SHOT_WIDTH = 1024;

const SETTINGS: { id: PartySetting; name: string; note: string }[] = [
  { id: "indoor", name: "Indoors", note: "A room, a hall, a restaurant" },
  { id: "outdoor", name: "Outdoors", note: "A garden, a terrace, a park" },
];

export const settingOf = (v: Pick<VenueDetails, "isOutdoor">): PartySetting | undefined =>
  v.isOutdoor === undefined ? undefined : v.isOutdoor ? "outdoor" : "indoor";

export default function PartyPreview({ config, backdropUrl, tableUrl, render, onGenerate, onVenue, shot, extras = {} }: {
  config: BuilderConfig;
  /** The other parts she designed, each with its real photo's address (null: no photo of it yet). */
  extras?: Partial<Record<PartyExtra, string | null>>;
  /** The backdrop's render, when it has a current one: its sketch otherwise. */
  backdropUrl: string | null;
  /** The kids' table's render, when it has one: its drawing otherwise. */
  tableUrl: string | null;
  render: PieceRender;
  onGenerate: () => void;
  onVenue: (patch: Partial<VenueDetails>) => void;
  /** Filled here: takes the pictures to send. */
  shot: MutableRefObject<(() => Promise<PartyShot>) | null>;
}) {
  const pieces = partyPieces(config);
  const setting = settingOf(config.venue);
  const theme = themeById(config.theme) ?? THEMES[0];
  const sketch = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLDivElement>(null);

  useEffect(() => {
    shot.current = async () => {
      // The sketch as an SVG picture of its own, at its square (html-to-image copied only a corner of it here).
      const backdropNode = sketch.current?.querySelector<SVGSVGElement>("svg.bz-sketch") ?? null;
      const tableNode = table.current?.querySelector("svg") ?? null;
      const backdrop = !pieces.backdrop ? null
        : backdropUrl ? await imageJpeg(backdropUrl, SHOT_WIDTH).catch(() => null)
        : backdropNode ? await svgJpeg(backdropNode, SHOT_WIDTH).catch(() => null) : null;
      const tablePicture = !pieces.table ? null
        : tableUrl ? await imageJpeg(tableUrl, SHOT_WIDTH).catch(() => null)
        : tableNode ? await nodeJpeg(tableNode, SHOT_WIDTH).catch(() => null) : null;
      return { backdrop, tablePicture };
    };
    return () => { shot.current = null; };
  });

  const nothing = !pieces.backdrop && !pieces.table;
  const extraParts = Object.entries(extras) as [PartyExtra, string | null][];
  const all = config.venue.partyScope === "all";
  const allIn = all && extraParts.some(([, u]) => u);
  const what = allIn ? "Everything you designed" : "Your backdrop and table";
  const word = setting === "outdoor" ? "outdoors" : "indoors";
  return (
    <div className="bz-tb-preview bz-party" data-testid="party-preview" id="party-preview-card">
      {/* The lettering fonts (the backdrop's words, the placemats'). */}
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      <div className="head"><span className="title">✦ Your party, all together</span></div>

      <div className="bz-party-where">
        <b>Is your party indoors or outdoors?</b>
        <div className="bz-tb-options compact" role="radiogroup" aria-label="Indoors or outdoors" data-testid="party-setting">
          {SETTINGS.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={setting === s.id} className={`bz-tb-option ${setting === s.id ? "on" : ""}`}
              onClick={() => onVenue({ isOutdoor: s.id === "outdoor" })} data-testid={`party-setting-${s.id}`}>
              {setting === s.id && <span className="tick">✓</span>}
              <b>{s.name}</b><small>{s.note}</small>
            </button>
          ))}
        </div>
      </div>

      {/* 2026-11-05 (the owner: "tasarladığım her şey tek render'da seçeneğini de yapalım"): the backdrop and the table,
          or everything she designed, each other part by its own real photo. */}
      {!nothing && extraParts.length > 0 && (
        <div className="bz-party-where" data-testid="party-scope">
          <b>What goes in the picture?</b>
          <div className="bz-tb-options compact" role="radiogroup" aria-label="What goes in the picture">
            {([["main", "Backdrop & table", "The two main pieces"], ["all", "Everything I designed", "Every part with its real photo"]] as const).map(([id, name, note]) => {
              const on = (config.venue.partyScope ?? "main") === id;
              return (
                <button key={id} type="button" role="radio" aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`}
                  onClick={() => onVenue({ partyScope: id })} data-testid={`party-scope-${id}`}>
                  {on && <span className="tick">✓</span>}<b>{name}</b><small>{note}</small>
                </button>
              );
            })}
          </div>
          {all && (
            <ul className="bz-party-parts" data-testid="party-scope-parts">
              {extraParts.map(([p, url]) => (
                <li key={p} className={url ? "in" : "out"}>{url ? "✓" : "○"} {PARTY_EXTRA_NAMES[p]}{url ? "" : " — make its real photo first to add it"}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {nothing ? <div className="empty">Design a backdrop or a kids&apos; table to see your party here.</div> : <>
        {render.url ? (
          <>
            <ZoomPhoto testId="party-render" src={render.url} alt={`Your party ${word}, as a real photo`} />
            {/* 2026-11-05, the owner: "bu illustrasyon amaclidir belirtelim gercek masa sandalye sayisini vermeyebilir" —
                the engine can't be held to the count. */}
            <p className="bz-party-disclaimer" data-testid="party-render-disclaimer">For illustration only — the number of tables and chairs, and some details, may differ from your real party.</p>
          </>
        ) : (
          <div className={`bz-party-pieces ${render.loading ? "on" : ""}`}>
            {/* What goes in: the backdrop and the table as they are now. */}
            {pieces.backdrop && <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {backdropUrl ? <img src={backdropUrl} alt="Your backdrop" /> : <div className="art"><LiveSketch config={config} activeId={null} /></div>}
              <figcaption>Your backdrop</figcaption>
            </figure>}
            {pieces.table && <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {tableUrl ? <img src={tableUrl} alt="Your kids' table" /> : <div className="art"><TablePlace table={config.table!} theme={theme} mode="six" /></div>}
              <figcaption>Your kids&apos; table</figcaption>
            </figure>}
            {render.loading && (
              <div className="veil" role="status" data-testid="party-render-wait">
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                <b>Setting up your party {word}</b>
                <span>{what} together — about 30 seconds.</span>
              </div>
            )}
          </div>
        )}
        {/* The drawings the pictures are taken from, out of sight (the backdrop's sketch, the table's six places). */}
        <div className="bz-party-stage" aria-hidden="true">
          {pieces.backdrop && !backdropUrl && <div ref={sketch}><div className="art"><LiveSketch config={config} activeId={null} /></div></div>}
          {pieces.table && !tableUrl && <div ref={table}><TablePlace table={config.table!} theme={theme} mode="six" /></div>}
        </div>
        <p className="note">{render.url ? `Your party ${word} — ${allIn ? "everything you designed" : "your own backdrop and table"}, made real.` : setting ? `${what}, stood together ${word}.` : "Mark indoors or outdoors, then see your party there."}</p>
        {!render.ready && !render.loading && (
          <div className="bz-tb-render" data-testid="party-render-box">
            <button type="button" className="bz-next" onClick={onGenerate} disabled={!setting} data-testid="party-render-make">
              {setting ? `See my party ${word} ✨` : "See my party ✨"}
            </button>
            <p className="hint">{render.stale ? "You changed something since your picture." : `${what} made into one photo of the party, for illustration.`} Needs a free account.</p>
            {render.error && <p className="error" role="alert">{render.error}</p>}
          </div>
        )}
        <RenderAgain render={render} onGenerate={onGenerate} testId="party-render-again" />
      </>}
    </div>
  );
}
