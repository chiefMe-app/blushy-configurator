import Link from "next/link";
import Sprinkles from "@/components/design/Sprinkles";

// 2026-10-22 redesign: the "Sparkly party in minutes" landing page from
// design-reference/, served at / and at /configure. Every call
// to action opens the existing builder — /builder, or its Theme step — so
// there is no separate demo flow. Decor, preview and pricing links open the
// Theme step as well: the builder requires a theme before Decor, and jumping
// past it would skip that validation.

export default function Home() {
  return (
    <div className="bz-body">
      <header className="bz-landing-top">
        <div className="bz-topbar-inner">
          <Link href="/" className="bz-brand" aria-label="Blushy home">
            <span className="burst">✳</span>
            <span className="word">blushy</span>
            <span className="small">BIRTHDAY BUILDER</span>
          </Link>
          <nav className="bz-land-links" aria-label="Welcome page links">
            <a href="#how-it-works">How it works</a>
            <Link href="/builder?step=theme">Themes</Link>
            <Link href="/builder?step=theme">Decor</Link>
            <Link href="/builder?step=theme">Pricing</Link>
          </nav>
          <Link href="/builder" className="bz-land-top-cta">Start planning <span aria-hidden="true">✦</span></Link>
        </div>
      </header>

      <section className="bz-landing" aria-label="Welcome to Blushy">
        <Sprinkles count={38} seed={11} className="landing" />
        <div className="bz-land-content">
          <div className="bz-land-hero">
            <div className="bz-land-copy">
              <div className="bz-land-eyebrow">PLAN YOUR PARTY THE FUN WAY <span className="dash" aria-hidden="true">✴</span></div>
              <h1><span>Sparkly party</span><em>in minutes.</em></h1>
              <p>Choose your event, pick a theme, style your decor, add extras, and generate your party preview.</p>
              <div className="bz-land-actions">
                <Link href="/builder" className="bz-land-main-cta">Start your party <span aria-hidden="true">⟶</span></Link>
                <a href="#how-it-works" className="bz-land-sub-cta"><span className="bz-play" aria-hidden="true">▶</span> See how it works</a>
              </div>
            </div>
            <div className="bz-land-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/design/landing-party.png" alt="Hand-painted illustration of friends celebrating with balloons, party bunting and a little dog" />
              <svg className="bz-doodle one" viewBox="0 0 70 70" aria-hidden="true"><path d="M33 5v17M33 47v18M5 33h17M47 33h18M14 14l12 12M40 40l14 14M54 14L41 26M25 41L14 53" /></svg>
              <svg className="bz-doodle two" viewBox="0 0 60 60" aria-hidden="true"><path d="M10 32c18-3 21-3 37-23M32 41c8 1 12 3 18 9M8 12l14 11" /></svg>
            </div>
          </div>

          <div className="bz-land-process" id="how-it-works">
            <div className="bz-process-step">
              <div className="bz-process-icons"><span className="bz-process-num pink">1</span>
                <svg className="bz-sketch" viewBox="0 0 70 70" aria-hidden="true"><path d="M14 17h43v42H14zM23 10v15M47 10v15M15 29h42" fill="none" stroke="#302524" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M30 39c-7-9-16 6 2 16 16-12 7-23-2-16" fill="#ff78a5" /></svg></div>
              <h3>Pick your occasion</h3><p>Birthdays, milestones<br />and more.</p>
            </div>
            <svg className="bz-process-arrow" viewBox="0 0 76 38" aria-hidden="true"><path d="M2 23C18 2 49 31 64 17M52 9l12 8-11 11" /></svg>
            <div className="bz-process-step">
              <div className="bz-process-icons"><span className="bz-process-num blue">2</span>
                <svg className="bz-sketch" viewBox="0 0 70 70" aria-hidden="true"><path d="M16 55l18-42 20 42z" fill="#fc694f" stroke="#b62d2d" strokeWidth="3" strokeLinejoin="round" /><path d="M26 31l21 8M21 43l31 2" stroke="#fff" strokeWidth="4" /><path d="M15 13l-6 6M53 19l8-5M49 7l3-5" stroke="#fbc72a" strokeWidth="4" strokeLinecap="round" /></svg></div>
              <h3>Choose a party world</h3><p>From magical themes<br />to modern vibes.</p>
            </div>
            <svg className="bz-process-arrow" viewBox="0 0 76 38" aria-hidden="true"><path d="M2 23C18 2 49 31 64 17M52 9l12 8-11 11" /></svg>
            <div className="bz-process-step">
              <div className="bz-process-icons"><span className="bz-process-num yellow">3</span>
                <svg className="bz-sketch" viewBox="0 0 70 70" aria-hidden="true"><ellipse cx="22" cy="25" rx="15" ry="18" fill="#1ac960" opacity=".88" /><ellipse cx="44" cy="22" rx="16" ry="20" fill="#ff55a6" opacity=".85" /><ellipse cx="39" cy="41" rx="17" ry="15" fill="#64b9ff" opacity=".7" /><path d="M22 43L34 62M44 42L34 62M40 56l-6 6" fill="none" stroke="#5a3c38" strokeWidth="2" /></svg></div>
              <h3>Build your backdrop</h3><p>Backdrops, balloons<br />and party decor.</p>
            </div>
            <svg className="bz-process-arrow" viewBox="0 0 76 38" aria-hidden="true"><path d="M2 23C18 2 49 31 64 17M52 9l12 8-11 11" /></svg>
            <div className="bz-process-step">
              <div className="bz-process-icons"><span className="bz-process-num lilac">4</span>
                <svg className="bz-sketch" viewBox="0 0 70 70" aria-hidden="true"><rect x="13" y="30" width="45" height="31" rx="3" fill="#ffe9f0" stroke="#3a2b2b" strokeWidth="3" /><path d="M13 30h45M35 30v31" stroke="#f91566" strokeWidth="4" /><path d="M34 29c-28 0-13-28 0-6 13-22 28 6 0 6" fill="none" stroke="#f91566" strokeWidth="4" /></svg></div>
              <h3>Add extras &amp; generate preview</h3><p>Add cakes, signage and more.<br />See your concept before booking.</p>
            </div>
          </div>

          <div className="bz-land-discover" aria-label="Explore Blushy builder">
            <Link href="/builder?step=theme" className="bz-discover">
              <span className="icon"><svg viewBox="0 0 100 90" aria-hidden="true"><path d="M7 78C9 18 84 9 94 77" stroke="#f73699" /><path d="M20 78C23 35 73 24 81 77" stroke="#ffd54a" /><path d="M34 78C35 52 62 47 67 77" stroke="#86c6ec" /></svg></span>
              <span><strong>Choose a theme</strong><small>From Frozen to Unicorn<br />and more.</small></span><span className="go pink">→</span>
            </Link>
            <Link href="/builder?step=theme" className="bz-discover">
              <span className="icon"><svg viewBox="0 0 110 90" aria-hidden="true"><path d="M7 14C43 27 70 26 103 8" stroke="#382421" strokeWidth="3" fill="none" /><path d="M18 17v31l18-17V22Z" fill="#ff3444" /><path d="M41 23v33l18-21V25Z" fill="#f9d34b" /><path d="M64 25v33l19-28V20Z" fill="#35b7fa" /><path d="M86 19v30l17-31Z" fill="#13cd66" /></svg></span>
              <span><strong>Style your setup</strong><small>Backdrops, balloons<br />and party extras.</small></span><span className="go blue">→</span>
            </Link>
            <Link href="/builder?step=theme" className="bz-discover">
              <span className="icon"><svg viewBox="0 0 108 90" aria-hidden="true"><path d="M17 45h75v35H17z" fill="#ffc7dc" stroke="#ec6993" strokeWidth="2" /><path d="M17 49q9 16 18 0 9 16 18 0 9 16 18 0 9 16 21 0V37H17Z" fill="#fff0f4" /><path d="M22 38q5-13 12 0q7-13 15 0q7-13 15 0q8-13 19 0" fill="#fff0f4" /><path d="M30 28v-17M50 27V8M70 28V10" stroke="#493329" strokeWidth="3" /><path d="M30 9l3-7 4 7M50 7l3-7 4 7M70 7l3-7 4 7" fill="#ffb53c" /></svg></span>
              <span><strong>Preview before you book</strong><small>See your party concept<br />before checkout.</small></span><span className="go green">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
