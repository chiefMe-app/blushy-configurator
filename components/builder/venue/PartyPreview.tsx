"use client";
// The whole party in one photograph, on the Venue step (2026-11-04, the owner: "Tasarladığımız Backdrop+table setup
// beraber görebilceğimiz bir render alsın ama bu sayfada outdoor yada indoor işaretlesin ona göre görsel üretelim"):
// she marks indoors or outdoors here, and the backdrop she designed (its render, or its live sketch) and her kids'
// table (its render, or its drawing) are made into one picture of the party in that setting (/api/party-render).
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { THEMES, themeById, type BuilderConfig, type VenueDetails } from "@/lib/config";
import { PARTY_EXTRA_NAMES, PARTY_PICKS, partyExperiences, partyPicked, partyExperienceShown, partyPieces, type PartyExtra, type PartySetting } from "@/lib/studio/partyRender";
import { experienceById, type ExperienceId } from "@/lib/studio/experiences";
import AdultTableSketch from "@/components/studio/table/AdultTableSketch";
import { imageJpeg, nodeJpeg, svgJpeg } from "@/components/builder/nodeJpeg";
import type { PieceRender } from "@/components/builder/usePieceRender";
import RenderAgain from "@/components/builder/RenderAgain";
import ZoomPhoto from "@/components/builder/ZoomPhoto";
import LiveSketch from "@/components/design/LiveSketch";
import TablePlace from "@/components/studio/table/TablePlace";
import WelcomeBoardArt from "@/components/studio/WelcomeBoardArt";
import { CakeArt } from "@/components/builder/cake/CakePreview";
import { GiveawayBoardArt } from "@/components/builder/giveaways/GiveawaysPreview";
import { HeliumArt } from "@/components/builder/helium/HeliumPreview";
import { PinataArt } from "@/components/builder/pinata/PinataPreview";

/** The pictures sent for the party's photograph, each a JPEG data URI (null: that piece isn't in the party). */
export interface PartyShot { backdrop: string | null; tablePicture: string | null; extras: { part: PartyExtra; picture: string }[] }

/** Each other part's picture: at most this wide (one piece of the picture). */
const EXTRA_WIDTH = 768;

/** Each picture sent: at most this wide (two go in, and the engine's price is by size). */
const SHOT_WIDTH = 1024;

const SETTINGS: { id: PartySetting; name: string; note: string }[] = [
  { id: "indoor", name: "Indoors", note: "A room, a hall, a restaurant" },
  { id: "outdoor", name: "Outdoors", note: "A garden, a terrace, a park" },
];

export const settingOf = (v: Pick<VenueDetails, "isOutdoor">): PartySetting | undefined =>
  v.isOutdoor === undefined ? undefined : v.isOutdoor ? "outdoor" : "indoor";

export default function PartyPreview({ config, backdropUrl, tableUrl, render, onGenerate, onVenue, shot, extras = {}, experiences = [] }: {
  config: BuilderConfig;
  /** The experiences she books: those a picture can show go in with Everything (a show or a host is a person: not). */
  experiences?: readonly string[];
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
  const stage = useRef<HTMLDivElement>(null);
  const extraParts = (Object.entries(extras) as [PartyExtra, string | null][]).filter(([p]) => !(p === "giveaways" && !extras.giveaways && config.giveaways?.place === "table"));
  const all = config.venue.partyScope === "all";
  const booked = experiences.map((id) => experienceById(id)).filter((e): e is NonNullable<ReturnType<typeof experienceById>> => !!e);
  // She picks what stands with the backdrop and table (2026-11-06, the owner: "a olsun"): PARTY_PICKS at most, the
  // first ones until she picks — in the builder's order (the parts, then the experiences' photos, then the stations).
  const showable = partyExperiences(booked.map((e) => e.id));
  const picked = partyPicked([...extraParts.map(([p]) => p), ...showable.photos, ...showable.stations], config.venue.partyPick);
  const isIn = (id: string) => picked.includes(id);
  const [full, setFull] = useState(false);
  const toggle = (id: string) => {
    if (isIn(id)) { setFull(false); onVenue({ partyPick: picked.filter((x) => x !== id) }); }
    else if (picked.length < PARTY_PICKS) { setFull(false); onVenue({ partyPick: [...picked, id] }); }
    else setFull(true);
  };
  const shownParts = extraParts.filter(([p]) => isIn(p));
  const shownXp = booked.filter((e) => isIn(e.id));

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
      // "Everything" (2026-11-05, the owner: "her şey yok bunlarda?"): every part she designed — its real photo when it
      // has a current one, its drawing otherwise.
      const extrasShot: PartyShot["extras"] = [];
      if (all) for (const [part, url] of shownParts) {
        const node = stage.current?.querySelector<HTMLElement>(`[data-extra="${part}"]`);
        const svg = node?.querySelector("svg") ?? null;
        const picture = url ? await imageJpeg(url, EXTRA_WIDTH).catch(() => null)
          : part === "welcome" && node ? await nodeJpeg(node, EXTRA_WIDTH).catch(() => null)
          : svg ? await svgJpeg(svg, EXTRA_WIDTH).catch(() => null) : null;
        if (picture) extrasShot.push({ part, picture });
      }
      return { backdrop, tablePicture, extras: extrasShot };
    };
    return () => { shot.current = null; };
  });

  const nothing = !pieces.backdrop && !pieces.table;
  const allIn = all && (shownParts.length > 0 || shownXp.length > 0);
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
      {!nothing && (extraParts.length > 0 || booked.length > 0) && (
        <div className="bz-party-where" data-testid="party-scope">
          <b>What goes in the picture?</b>
          <div className="bz-tb-options compact" role="radiogroup" aria-label="What goes in the picture">
            {([["main", "Backdrop & table", "The two main pieces"], ["all", "Everything I designed", "Every part you made, all together"]] as const).map(([id, name, note]) => {
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
            <>
              <p className="bz-party-pick" data-testid="party-pick-count">
                Your backdrop and table, and up to {PARTY_PICKS} more pieces beside them — {picked.length} of {PARTY_PICKS} picked. Tap one to take it out or put it in.
              </p>
              <ul className="bz-party-parts" data-testid="party-scope-parts">
                {extraParts.map(([p, url]) => (
                  <li key={p} className={isIn(p) ? "in" : "off"}>
                    <button type="button" aria-pressed={isIn(p)} onClick={() => toggle(p)} data-testid={`party-part-${p}`}>
                      {isIn(p) ? "✓" : "○"} {PARTY_EXTRA_NAMES[p]}<small>{!isIn(p) ? " · not in the picture" : url ? " · its real photo" : " · its drawing"}</small>
                    </button>
                  </li>
                ))}
                {booked.map((e) => partyExperienceShown(e.id as ExperienceId)
                  ? <li key={e.id} className={isIn(e.id) ? "in" : "off"}>
                      <button type="button" aria-pressed={isIn(e.id)} onClick={() => toggle(e.id)} data-testid={`party-part-${e.id}`}>
                        {isIn(e.id) ? "✓" : "○"} {e.name}<small>{isIn(e.id) ? " · experience" : " · not in the picture"}</small>
                      </button>
                    </li>
                  : <li key={e.id} className="out">{e.name}<small> · a person, not in the picture</small></li>)}
              </ul>
              {full && (
                <p className="bz-party-many" role="status" data-testid="party-pick-full">
                  {PARTY_PICKS} is the most one photo shows well with your backdrop and table — take one out first.
                </p>
              )}
            </>
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
                <span>{what} together — {allIn ? "about a minute: the backdrop and table first, then the rest around them" : "about 30 seconds"}.</span>
              </div>
            )}
          </div>
        )}
        {/* The drawings the pictures are taken from, out of sight (the backdrop's sketch, the table's six places). */}
        <div className="bz-party-stage" aria-hidden="true">
          {pieces.backdrop && !backdropUrl && <div ref={sketch}><div className="art"><LiveSketch config={config} activeId={null} /></div></div>}
          {pieces.table && !tableUrl && <div ref={table}><TablePlace table={config.table!} theme={theme} mode="six" /></div>}
          {/* The other parts' drawings, for those without a real photo (Everything). */}
          {all && <div ref={stage}>
            {extraParts.filter(([, u]) => !u).map(([p]) => (
              <div key={p} data-extra={p} className={p === "welcome" ? "bz-wb-wait" : "art"}>
                {p === "cake" && config.cake && <CakeArt k={config.cake} themeId={config.theme} uid="pty-ck" testId="party-cake-art" />}
                {p === "welcome" && config.welcomeBoard && <WelcomeBoardArt board={config.welcomeBoard} theme={theme} balloons={config.decor.balloonColors} className="bz-wb-art" />}
                {p === "giveaways" && config.giveaways && <GiveawayBoardArt g={config.giveaways} theme={theme} balloons={config.decor.balloonColors} uid="pty-gv" testId="party-giveaways-art" />}
                {p === "helium" && config.helium && <HeliumArt h={config.helium} />}
                {p === "pinata" && config.pinata && <PinataArt p={config.pinata} theme={theme} />}
                {p === "adults" && config.adultTable && <AdultTableSketch a={config.adultTable} theme={theme} />}
              </div>
            ))}
          </div>}
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
