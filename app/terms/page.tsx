import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { CONTACT_EMAIL } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service — PartyMuse by Blushy" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms apply when you use PartyMuse, a party design tool by Blushy Events (&quot;we&quot;). By using the site
        you agree to them.
      </p>

      <h2>Using PartyMuse</h2>
      <p>
        You can design and preview party setups for free, with or without an account. Please use the site for planning
        your own events, and don&apos;t misuse it — for example by trying to break it or by making previews in bulk. We may
        limit how many previews can be made.
      </p>

      <h2>Previews and prices</h2>
      <p>
        Preview images are made by AI to show the idea of your design. The real setup can differ in details such as
        balloon placement, colours and lettering. Prices shown in the builder are estimates; a booking request is not a
        booking. We confirm availability, venue details and the final price with you on WhatsApp before anything is
        booked or paid.
      </p>

      <h2>Your account</h2>
      <p>
        You can sign in with Google or an email link. Keep access to your email account safe. You can delete your saved
        designs at any time, and ask us to delete your account.
      </p>

      <h2>Your content</h2>
      <p>
        The words, names and choices you add stay yours. You let us store and process them to run the service, make your
        previews and prepare your event. Don&apos;t add anything you don&apos;t have the right to use.
      </p>

      <h2>Our content</h2>
      <p>The site, its designs, illustrations and software belong to Blushy Events or its licensors.</p>

      <h2>Availability</h2>
      <p>
        We work to keep PartyMuse running, but it is provided as it is, and it may sometimes be unavailable or change.
        As far as the law allows, we are not liable for indirect losses from using it.
      </p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of the United Arab Emirates.</p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
