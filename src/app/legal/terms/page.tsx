import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Spintra",
  description: "The terms that govern your use of Spintra's rooms, games, and chat features.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen pb-16 px-4">
      <div className="max-w-3xl mx-auto prose-content">
        <h1 className="text-4xl sm:text-5xl font-bold mb-2">
          Terms of <span className="gradient-text">Service</span>
        </h1>
        <p className="text-muted-foreground mb-10">Effective date: July 4, 2026</p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of Spintra
            (the &quot;Service&quot;), operated by{" "}
            <strong>Tejas Gogara</strong> (&quot;Spintra&quot;, &quot;we&quot;,
            &quot;us&quot;). By creating or joining a room, you agree to these Terms. If you do
            not agree, do not use the Service.
          </p>

          <section>
            <h2 className="text-2xl font-semibold mb-3">1. What Spintra Is</h2>
            <p>
              Spintra lets people create shareable rooms to play real-time games, run
              tournaments, chat, and make group decisions together. Most rooms do not require
              a registered account — you participate as an anonymous session identified only
              by a randomly generated ID.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Harass, threaten, defame, or abuse other participants;</li>
              <li>Post or transmit unlawful, hateful, sexually explicit, or violent content;</li>
              <li>Impersonate any person or misrepresent your affiliation with anyone;</li>
              <li>Spam, flood, or otherwise disrupt rooms, chat, or the Service&apos;s infrastructure;</li>
              <li>Attempt to bypass room locks, participant limits, or access rooms you were not invited to;</li>
              <li>Use automated means (bots, scripts) to create rooms or send messages at scale; or</li>
              <li>Interfere with or attempt to gain unauthorized access to the Service or its underlying systems.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">3. User-Generated Content</h2>
            <p>
              Chat messages, room names, and profile fields (display name, avatar) you submit
              are your own content and your responsibility. We do not pre-screen content, but
              we may remove content, kick a participant, or close a room at our discretion —
              particularly in response to a violation of Section 2. Room hosts also have
              limited moderation tools (e.g. removing a participant from their own room).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">4. No Verified Identity</h2>
            <p>
              The Service does not verify who you are. Anonymous sessions provide a
              lightweight way to prevent casual abuse but are not a secure identity system.
              Do not rely on another participant&apos;s claimed identity, and do not share
              sensitive personal information in rooms or chat.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service, or close any room, at
              any time — with or without notice — if we believe these Terms have been
              violated or the Service is being misused.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties
              of any kind, express or implied, including fitness for a particular purpose,
              non-infringement, or uninterrupted availability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Spintra and its operators are not
              liable for any indirect, incidental, or consequential damages arising from your
              use of the Service, including content posted by other users.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after
              a change takes effect constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Governing Law</h2>
            <p>
              These Terms are governed by the laws of <strong>India</strong>,
              without regard to its conflict-of-law principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">10. Contact</h2>
            <p>
              Questions about these Terms can be sent to{" "}
              <strong>tejasboricha225@gmail.com</strong>.
            </p>
          </section>

          <p className="text-sm text-muted-foreground pt-4 border-t border-border">
            See also our <Link href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
