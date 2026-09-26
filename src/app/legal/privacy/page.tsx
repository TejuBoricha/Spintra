import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Spintra",
  description: "What data Spintra collects, how it's used, how long it's kept, and your choices.",
};

// Every statement here should match what the code does. If you change what
// is collected, sent, or kept, change this page in the same pull request.
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen pb-16 px-4">
      <div className="max-w-3xl mx-auto prose-content">
        <h1 className="text-4xl sm:text-5xl font-bold mb-2">
          Privacy <span className="gradient-text">Policy</span>
        </h1>
        <p className="text-muted-foreground mb-10">Effective date: September 26, 2026</p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <p>
            This Privacy Policy explains what information Spintra (&quot;we&quot;, &quot;us&quot;),
            operated by <strong>Tejas Gogara</strong>, collects when you use the Service, how it
            is used, who it is shared with, and how long it is kept.
          </p>

          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>An anonymous ID:</strong> a random identifier created for your browser
                (Supabase anonymous sign-in). We never ask for an email, a password, a phone
                number, or your real name.
              </li>
              <li>
                <strong>What you enter in rooms:</strong> room names, the display name and
                avatar you pick, chat messages, and your moves in games (answers, votes, picks).
                Other people in the room see these; that&apos;s how rooms work.
              </li>
              <li>
                <strong>Error and performance reports:</strong> when something breaks, and for
                about 1 in 10 page loads, your browser sends a report to Sentry: the page (with
                any room code removed), your browser and device type, and technical details of
                the error or how fast the page loaded. We don&apos;t attach your IP address or
                cookies to these reports. They are how we find and fix problems, so they
                aren&apos;t optional.
              </li>
              <li>
                <strong>Technical logs:</strong> our hosting and database providers
                automatically record IP addresses, browser details, and timestamps for security
                and abuse prevention.
              </li>
              <li>
                <strong>Local storage:</strong> your browser stores your anonymous session,
                display name, preferences (sound, theme), recent rooms, and your analytics
                choice. This is needed for the Service to work.
              </li>
              <li>
                <strong>Analytics, only if you choose Accept:</strong> Google Analytics cookies
                (<code>_ga</code>, <code>{"_ga_<id>"}</code>) and page views (never room pages,
                whose address contains a room code), approximate location, and device and
                browser type; plus our own counts of rooms created, rooms joined, and games
                started, linked to your anonymous ID. Until you choose Accept, none of this is
                collected and nothing is sent to Google. Choosing Decline keeps it off, and you
                can change your choice at any time in{" "}
                <Link href="/settings" className="underline hover:text-foreground">Settings</Link>.
              </li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> show advertising, sell data, build profiles of
              individuals, or collect device fingerprints or precise location.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. How We Use This Information</h2>
            <p>
              To run the Service: creating and syncing rooms, delivering chat and game moves in
              real time, keeping scores, enforcing room limits, locks, and bans, and preventing
              abuse. Error and performance reports are used to fix problems. Analytics, if you
              allow it, is used only to understand overall use and improve the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Who We Share Data With</h2>
            <p>
              Providers that run parts of the Service for us: <strong>Supabase</strong>{" "}
              (database, anonymous sign-in, real-time messaging), <strong>Vercel</strong>{" "}
              (hosting), <strong>Sentry</strong> (error and performance reports),{" "}
              <strong>Cloudflare</strong> (DNS, and storage for our encrypted database
              backups), and <strong>Google</strong> (Google Analytics, only if you accept; see{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Google&apos;s Privacy Policy
              </a>
              ). They process data on our behalf. We do not sell personal data or share it for
              advertising.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">4. How Long We Keep It</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Rooms and everything in them</strong> (who joined, chat, game moves,
                scores, reports, bans) are deleted when the host closes the room, and in any
                case 7 days after the room was created (30 days for Spintra City). A room nobody
                is in may be deleted sooner.
              </li>
              <li>
                <strong>Our own usage counts:</strong> 12 months.
              </li>
              <li>
                <strong>Google Analytics</strong> (if you accepted): up to 14 months, Google
                Analytics&apos; limit.
              </li>
              <li>
                <strong>Error and performance reports:</strong> up to 90 days in Sentry.
              </li>
              <li>
                <strong>Database backups:</strong> encrypted, and kept for up to 30 days.
              </li>
              <li>
                <strong>Your anonymous ID</strong> stays in your browser until you clear it
                (Settings, &quot;Delete my data&quot;). Its matching record at Supabase is kept
                until you ask us to delete it.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Your Choices and Rights</h2>
            <p>
              You can turn analytics on or off at any time in{" "}
              <Link href="/settings" className="underline hover:text-foreground">Settings</Link>,
              where &quot;Delete my data&quot; also clears everything Spintra stored in your
              browser. Depending on where you live, you may have the right to access, correct,
              or delete your data, or to withdraw consent. Because Spintra has no accounts, we
              can usually only act on requests that include a room code or your anonymous ID.
              Write to <strong>tejasboricha225@gmail.com</strong>; this address also handles
              complaints about how we process data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Children and Schools</h2>
            <p>
              Spintra is for general audiences and is also used in classrooms. We don&apos;t ask
              anyone, including children, for a name, an email, or an account, and we never
              show ads or build profiles.
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Children under 13, or under the age of digital consent where they live (in some
                countries, including India, that is 18), should use Spintra only with a parent
                or guardian, or in a Classroom room run by a teacher.
              </li>
              <li>
                In <strong>Classroom rooms</strong>, only the teacher who created the room can
                host it or post in chat, no analytics runs for anyone in the room (and students
                aren&apos;t asked), and the room&apos;s data is deleted within the limits in
                section 4.
              </li>
              <li>
                Please use first names or nicknames, not full names, for students on wheels, in
                team lists, and as guest names.
              </li>
              <li>
                Teachers and schools that use Spintra with students are responsible for deciding
                that it&apos;s appropriate and for any permission their school or local law
                requires, such as parental consent.
              </li>
              <li>
                If you believe a child has shared personal information with us, write to{" "}
                <strong>tejasboricha225@gmail.com</strong> with the room code and we will delete
                it.
              </li>
            </ul>
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
