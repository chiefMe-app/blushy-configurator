// Step 1 · Event, moved unchanged from app/builder/page.tsx (Phase 0.1c).
import { EVENT_TYPES, type BuilderConfig, type EventTypeId } from "@/lib/config";
import { COMING_SOON_EVENTS } from "@/components/builder/constants";

export default function EventStep({ config, setEventType }: { config: BuilderConfig; setEventType: (id: EventTypeId) => void }) {
  return (
    <div>
      <div className="bz-tip"><span className="icon">✳</span><span>Psst... tap Birthday to start the fun!</span><span className="arrow">↙</span></div>
      <div className="bz-choice-grid">
        {EVENT_TYPES.filter((e) => e.id === "birthday").map((e) => {
          const sel = config.eventType === e.id;
          return (
            <button key={e.id} type="button" onClick={() => setEventType(e.id)} aria-pressed={sel}
              className={`bz-choice bz-birthday ${sel ? "selected" : ""}`}>
              <span className="art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/design/confetti-cake.gif" alt="" />
              </span>
              <span>
                <h3><span className="pink">Kids Birthday,</span> <span className="lilac">please!</span></h3>
                <p><span className="mint">Confetti</span>, <span className="pink2">cake</span>, <span className="blue">candles</span> &amp; all the fun stuff!</p>
              </span>
              {sel && <span className="tick">✓</span>}
            </button>
          );
        })}
      </div>
      {/* 2026-10-23: only Birthday is live; the roadmap cards are display only. */}
      <div className="bz-soon-row">
        {COMING_SOON_EVENTS.map((e) => (
          <div key={e.title} className="bz-choice bz-soon" aria-disabled="true">
            <span className="bz-coming">SOON</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.art} alt="" loading="lazy" />
            <h3>{e.title}</h3>
            <p>{e.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
