import type { Metadata } from "next";
import LegalPage, { CONTACT_EMAIL } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — PartyMuse by Blushy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        PartyMuse is a party design tool by Blushy Events, based in the United Arab Emirates. This page explains what
        we collect when you use it, why, and what you can ask us to do with it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Your designs.</b> The choices you make in the builder (theme, backdrop, colours, lettering, extras). They are
          kept in your browser, and in our database when you press <i>Save</i>.</li>
        <li><b>Your account.</b> If you sign in with Google, we receive your name, email address and profile picture from
          Google. If you sign in with an email link, we keep your email address. We never see or store a password.</li>
        <li><b>Booking requests.</b> When you send a request, we keep your name, WhatsApp number, the event details you
          enter (date, time, area, venue type, guest and children numbers) and the design.</li>
        <li><b>Technical data.</b> Your IP address is used briefly to limit how many previews can be made at once. It is
          not stored with your designs.</li>
      </ul>
      <p>Venue photos you add in the builder stay on your device; they are not uploaded.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To show and save your designs, and let you open them again on any device.</li>
        <li>To create preview images of your design.</li>
        <li>To contact you on WhatsApp about your request: availability, venue and the final quote.</li>
        <li>To keep the service safe and working.</li>
      </ul>
      <p>We do not sell your information, and we do not use it for advertising. We do not use advertising or tracking cookies.</p>

      <h2>Who helps us</h2>
      <ul>
        <li><b>Supabase</b> — our database and sign-in.</li>
        <li><b>Vercel</b> — hosts the website.</li>
        <li><b>Google</b> — only if you choose to sign in with Google.</li>
        <li><b>fal.ai</b> — creates the preview images. It receives the design, not your name or contact details.</li>
      </ul>
      <p>These services may process data outside the UAE.</p>

      <h2>How long we keep it</h2>
      <p>
        Saved designs are kept until you delete them in <i>My designs</i> or ask us to delete your account. Booking
        requests are kept as long as we need them for your event and our records.
      </p>

      <h2>Your choices</h2>
      <p>
        You can delete any saved design yourself in <i>My designs</i>. To see, correct or delete everything we hold about
        you, email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Children</h2>
      <p>PartyMuse is for parents and party planners. It is not meant for children to use, and we do not knowingly collect children&apos;s data.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we update this page and the date at the top.</p>

      <h2>Contact</h2>
      <p>Blushy Events — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalPage>
  );
}
