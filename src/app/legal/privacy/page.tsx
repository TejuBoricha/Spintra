import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Spintra",
  description: "What data Spintra collects, how it's used, and your rights over it.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen pb-16 px-4">
      <div className="max-w-3xl mx-auto prose-content">
        <h1 className="text-4xl sm:text-5xl font-bold mb-2">
          Privacy <span className="gradient-text">Policy</span>
        </h1>
        <p className="text-muted-foreground mb-10">Effective date: July 15, 2026</p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <p>
            This Privacy Policy explains what information Spintra (&quot;we&quot;, &quot;us&quot;),
            operated by <strong>Tejas Gogara</strong>, collects when you
            use the Service, and how it is used, stored, and shared.
          </p>

          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Anonymous session identifier</strong> — a randomly generated ID
                (Supabase anonymous auth, or a local ID stored in your browser if Supabase is
                unavailable). We do not require an email, password, or real name.
              </li>
              <li>
                <strong>Room and profile data</strong> — the room code, room name, and the
                display name, avatar, and in-room stats (e.g. XP, rank) you set for yourself.
              </li>
              <li>
                <strong>Chat messages</strong> — content you send inside a room&apos;s chat.
              </li>
              <li>
                <strong>Standard technical logs</strong> — IP address, browser/device
                information, and timestamps, collected automatically by our hosting and
                database providers for security and abuse prevention.
              </li>
              <li>
                <strong>Local storage / functional cookies</strong> — used to remember your
                session ID, theme preference, and whether you&apos;ve dismissed the cookie
                notice. We do not use advertising cookies.
              </li>
              <li>
                <strong>Analytics cookies</strong> — <strong>only with your consent</strong>,
                Google Analytics sets cookies (e.g. <code>_ga</code>, <code>{"_ga_<id>"}</code>)
                to measure aggregate site traffic and usage (pages visited, approximate location,
                device/browser type). These are off by default: no analytics cookies are set and
                no data is sent to Google until you choose <strong>Accept</strong> in our cookie
                banner, and you can choose <strong>Decline</strong> to keep them off. We do not
                use this data for advertising or to identify you individually. See{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Google&apos;s Privacy Policy
                </a>{" "}
                for how Google handles this data.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. How We Use This Information</h2>
            <p>To operate the Service: creating and syncing rooms, delivering chat and game events in real time, enforcing room limits and locks, and preventing abuse. Aggregate analytics (see above) help us understand overall usage and improve the Service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Who We Share Data With</h2>
            <p>
              We use third-party infrastructure providers to run the Service, including{" "}
              <strong>Supabase</strong> (database, authentication, realtime messaging), a
              hosting provider (e.g. Vercel), and, where enabled,{" "}
              <strong>Google Analytics</strong> (aggregate traffic and usage analytics). These
              providers process data on our behalf and do not use it for their own purposes. We
              do not sell personal data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Data Retention</h2>
            <p>
              Room, participant, and chat data are tied to the lifetime of a room and are
              deleted when a room is closed or expires. Your anonymous session ID persists
              only in your browser&apos;s local storage until you clear it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Your Rights</h2>
            <p>
              Depending on your location, you may have the right to request access to,
              correction of, or deletion of your data. Because accounts are anonymous, we can
              typically only act on requests tied to a specific room code or session ID you
              provide. Contact us at <strong>tejasboricha225@gmail.com</strong> to make a
              request.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed at children under 13, and we do not knowingly
              collect personal information from them. If you believe a child has provided us
              information, contact us and we will remove it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be
              reflected by updating the effective date above.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Contact</h2>
            <p>
              Questions about this Policy can be sent to <strong>tejasboricha225@gmail.com</strong>.
            </p>
          </section>

          <p className="text-sm text-muted-foreground pt-4 border-t border-border">
            See also our <Link href="/legal/terms" className="underline hover:text-foreground">Terms of Service</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
