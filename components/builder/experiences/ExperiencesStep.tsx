// The experiences (2026-11-04), the builder's own step between Decor and Package: the old Add-ons, each a photo, a
// price for her party and the little she has to tell us (the owner: "popcorn, cotton candy, photographer,
// entertainment, inflatables, face painting" and workshops). Nothing to render: these are services.
import { formatAED, themeById, THEMES, type BuilderConfig } from "@/lib/config";
import {
  CANDY_COLOURS, EXPERIENCES, EXPERIENCE_GROUPS, PHOTO_HOURS, THEMED_BOXES_PRICE, VIDEO_PRICE,
  defaultExperiences, experiencePrice, experiencesTotal, faceDesigns, hostCostume,
  type Experience, type Experiences,
} from "@/lib/studio/experiences";

/** Who comes: the children at the kids' table and the grown-ups at theirs, if she set them. */
export function experiencesSeed(config: BuilderConfig) {
  return {
    children: config.table?.enabled ? config.table.kids : undefined,
    adults: config.adultTable?.enabled ? config.adultTable.guests : undefined,
  };
}

/** The left-hand side while she picks: the experiences she picked, as photos, and what they come to. */
export function ExperiencesPreview({ config }: { config: BuilderConfig }) {
  const x = config.experiences ?? defaultExperiences(experiencesSeed(config));
  const picked = x.picked.map((id) => EXPERIENCES.find((e) => e.id === id)).filter((e): e is Experience => !!e);
  return (
    <div className="bz-tb-preview bz-xp-preview" data-testid="experiences-preview">
      <div className="head"><span className="title">✦ Your experiences</span></div>
      {picked.length ? <>
        <div className="bz-xp-mosaic">
          {picked.map((e) => (
            <figure key={e.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/design/experiences/${e.pic}.webp`} alt="" />
              <figcaption><b>{e.name}</b><em>AED {formatAED(experiencePrice(e, x))}</em></figcaption>
            </figure>
          ))}
        </div>
        <p className="note">{picked.length} experience{picked.length > 1 ? "s" : ""} for {x.children} children and {x.adults} grown-ups · AED {formatAED(experiencesTotal(x))}</p>
      </> : <div className="empty">Pick the experiences you&apos;d like — they gather here.</div>}
    </div>
  );
}

export default function ExperiencesStep({ config, setExperiences }: {
  config: BuilderConfig;
  setExperiences: (x: Experiences) => void;
}) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const x = config.experiences ?? defaultExperiences(experiencesSeed(config));
  const set = (patch: Partial<Experiences>) => setExperiences({ ...x, ...patch });
  const toggle = (id: Experience["id"]) => set({ picked: x.picked.includes(id) ? x.picked.filter((p) => p !== id) : [...x.picked, id] });

  const choice = (on: boolean, pick: () => void, name: string, note: string, key: string) => (
    <button key={key} type="button" role="radio" aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`} onClick={pick}>
      {on && <span className="tick">✓</span>}
      <b>{name}</b>{note && <small>{note}</small>}
    </button>
  );
  const counter = (label: string, one: string, value: number, change: (n: number) => void, testId: string, min = 0) => (
    <div className="bz-tb-item">
      <h3>{label}</h3>
      <div className="bz-hl-count" data-testid={testId}>
        <button type="button" aria-label={`One ${one} fewer`} disabled={value <= min} onClick={() => change(value - 1)}>−</button>
        <b aria-live="polite">{value}</b>
        <button type="button" aria-label={`One ${one} more`} disabled={value >= 200} onClick={() => change(value + 1)}>+</button>
      </div>
    </div>
  );

  // What each experience asks once it is picked.
  const more = (e: Experience) => {
    switch (e.id) {
      case "popcorn": return (
        <div className="bz-tb-options compact" role="radiogroup" aria-label="Popcorn boxes" data-testid="exp-popcorn-boxes">
          <button type="button" role="radio" aria-checked={x.popcornBoxes === "themed"} className={`bz-tb-option ${x.popcornBoxes === "themed" ? "on" : ""}`} onClick={() => set({ popcornBoxes: "themed" })}>
            {x.popcornBoxes === "themed" && <span className="tick">✓</span>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="art"><img className="photo" src={`/design/table/placemats/${theme.id}/pattern.webp`} alt="" loading="lazy" /></span>
            <b>Printed in your theme</b><small>Your {theme.name} print on every box</small><em>+AED {formatAED(THEMED_BOXES_PRICE)}</em>
          </button>
          <button type="button" role="radio" aria-checked={x.popcornBoxes === "plain"} className={`bz-tb-option ${x.popcornBoxes === "plain" ? "on" : ""}`} onClick={() => set({ popcornBoxes: "plain" })}>
            {x.popcornBoxes === "plain" && <span className="tick">✓</span>}
            <span className="art bz-xp-white" />
            <b>Plain white</b><small>Classic white boxes</small>
          </button>
        </div>
      );
      case "cotton_candy": return (
        <div className="bz-tb-options compact" role="radiogroup" aria-label="Cotton candy colour" data-testid="exp-candy-colour">
          {CANDY_COLOURS.map((c) => choice(x.candyColour === c.id, () => set({ candyColour: c.id }), c.name, "", c.id))}
        </div>
      );
      case "photographer": return <>
        <div className="bz-tb-options compact" role="radiogroup" aria-label="Photographer's hours" data-testid="exp-photo-hours">
          {PHOTO_HOURS.map((h) => choice(x.photoHours === h.hours, () => set({ photoHours: h.hours }), `${h.hours} hr${h.hours > 1 ? "s" : ""}`, `AED ${formatAED(h.price)}`, String(h.hours)))}
        </div>
        <label className="bz-xp-check">
          <input type="checkbox" checked={x.video} onChange={(ev) => set({ video: ev.target.checked })} data-testid="exp-video" />
          <span>A short video film of the day too <em>+AED {formatAED(VIDEO_PRICE)}</em></span>
        </label>
      </>;
      case "character_host": return <p className="bz-xp-note">Dressed as {hostCostume(theme.id)}, to go with your {theme.name} theme.</p>;
      case "face_painting": return <p className="bz-xp-note" data-testid="exp-face-designs">Designs for your {theme.name} party: {faceDesigns(theme.id).join(", ")} — and anything the kids ask for.</p>;
      default: return null;
    }
  };
  const anyInflatable = x.picked.some((id) => EXPERIENCES.find((e) => e.id === id)?.group === "inflatables");

  return (
    <div className="bz-tb" data-testid="experiences">
      <section className="bz-tb-section" aria-label="Guests">
        <h2>Who's coming</h2>
        <p className="bz-tb-sub" style={{ fontWeight: 400 }}>The carts, the face painters and the workshops are set by the number of guests.</p>
        <div className="bz-xp-guests">
          {counter("Children", "child", x.children, (n) => set({ children: n }), "exp-children", 1)}
          {counter("Grown-ups", "grown-up", x.adults, (n) => set({ adults: n }), "exp-adults")}
        </div>
      </section>

      {EXPERIENCE_GROUPS.map((g) => (
        <section key={g.id} className="bz-tb-section" aria-label={g.name}>
          <h2>{g.name}</h2>
          <p className="bz-tb-sub" style={{ fontWeight: 400 }}>{g.note}</p>
          <div className="bz-xp-cards" role="group" aria-label={g.name} data-testid={`exp-${g.id}`}>
            {EXPERIENCES.filter((e) => e.group === g.id).map((e) => {
              const on = x.picked.includes(e.id);
              return (
                <div key={e.id} className={`bz-xp-card ${on ? "on" : ""}`}>
                  <button type="button" role="checkbox" aria-checked={on} className="bz-xp-pick" onClick={() => toggle(e.id)} data-testid={`exp-${e.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/design/experiences/${e.pic}.webp`} alt="" loading="lazy" />
                    {on && <span className="tick">✓</span>}
                    <span className="txt">
                      <b>{e.name}</b>
                      <small>{e.blurb}{e.time ? ` · ${e.time}` : ""}</small>
                      <em>AED {formatAED(experiencePrice(e, x))}</em>
                    </span>
                  </button>
                  {on && more(e) && <div className="bz-xp-more">{more(e)}</div>}
                </div>
              );
            })}
          </div>
          {g.id === "inflatables" && anyInflatable && (
            <div className="bz-tb-item">
              <h3>Where they go</h3>
              <div className="bz-tb-options compact" role="radiogroup" aria-label="Indoors or outdoors" data-testid="exp-place">
                {choice(x.place === "indoor", () => set({ place: "indoor" }), "Indoors", "", "indoor")}
                {choice(x.place === "outdoor", () => set({ place: "outdoor" }), "Outdoors", "A garden or terrace", "outdoor")}
              </div>
            </div>
          )}
        </section>
      ))}

      <div className="bz-tb-sum" data-testid="experiences-total">
        <span>Experiences</span>
        <b>AED {formatAED(experiencesTotal(x))}</b>
        {x.picked.length > 0 && <button type="button" className="bz-restart" onClick={() => set({ picked: [] })}>Remove them all</button>}
      </div>
    </div>
  );
}
