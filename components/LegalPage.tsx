// The Privacy Policy and Terms pages: the site's top bar and a readable column.
import Link from "next/link";

export const LEGAL_UPDATED = "27 October 2026";
export const CONTACT_EMAIL = "blushyevents@gmail.com";

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bz-body bz-legal">
      <header className="bz-topbar">
        <div className="bz-topbar-inner">
          <Link href="/" className="bz-brand" aria-label="PartyMuse by Blushy — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/design/partymuse-logo.webp" alt="PartyMuse by Blushy" />
          </Link>
        </div>
      </header>
      <main className="bz-legal-main">
        <h1>{title}</h1>
        <p className="updated">Last updated: {LEGAL_UPDATED}</p>
        {children}
        <p className="links"><Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Service</Link> · <Link href="/">Home</Link></p>
      </main>
    </div>
  );
}
