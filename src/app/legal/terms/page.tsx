import type { Metadata } from "next";
import Link from "next/link";
import { createLegalSections } from "@/components/legal-sections";

export const metadata: Metadata = {
  title: "Terms of Service | Spintra",
  description: "The terms that govern your use of Spintra's rooms, games, and chat features.",
  alternates: { canonical: "/legal/terms" },
};

const { Contents, Section } = createLegalSections([
  "What Spintra Is",
  "Age and Schools",
  "Acceptable Use",
  "User-Generated Content",
  "No Verified Identity",
  "Termination",
  "Disclaimer of Warranties",
  "Limitation of Liability",
  "Changes to These Terms",
  "Governing Law",
  "Contact",
]);

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen pb-16 px-4">
      <div className="max-w-[32rem] mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold mb-2">
          Terms of <span className="gradient-text">Service</span>
        </h1>
        <p className="text-muted-foreground mb-6">Effective date: September 26, 2026</p>

        <Contents />

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of Spintra
            (the &quot;Service&quot;), operated by{" "}
            <strong>Tejas Gogara</strong> (&quot;Spintra&quot;, &quot;we&quot;,
            &quot;us&quot;). By creating or joining a room, you agree to these Terms. If you do
            not agree, do not use the Service.
          </p>

          <Section n={1}>
            <p>
              Spintra lets people create shareable rooms to play real-time games, run
              tournaments, chat, and make group decisions together. Most rooms do not require
              a registered account. You take part as an anonymous session identified only
              by a randomly generated ID.
            </p>
          </Section>

          <Section n={2}>
            <p>
              You must be at least 13 years old, or the age of digital consent where you live if
              that is higher (in some countries, including India, it is 18), to use Spintra on
              your own. Younger people may use it with a parent or guardian&apos;s permission, or
              in a Classroom room run by a teacher. Teachers and schools that use Spintra with
              students are responsible for supervising that use and for any permission their
              school or local law requires. How Classroom rooms protect students is described in
              our <Link href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
            </p>
          </Section>

          <Section n={3}>
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
          </Section>

          <Section n={4}>
            <p>
              Chat messages, room names, and profile fields (display name, avatar) you submit
              are your own content and your responsibility. We do not pre-screen content, but
              we may remove content, kick a participant, or close a room at our discretion,
              particularly in response to a violation of Section 3. Room hosts also have
              limited moderation tools (e.g. removing a participant from their own room).
            </p>
          </Section>

          <Section n={5}>
            <p>
              The Service does not verify who you are. Anonymous sessions provide a
              lightweight way to prevent casual abuse but are not a secure identity system.
              Do not rely on another participant&apos;s claimed identity, and do not share
              sensitive personal information in rooms or chat.
            </p>
          </Section>

          <Section n={6}>
            <p>
              We may suspend or terminate your access to the Service, or close any room, at
              any time, with or without notice, if we believe these Terms have been
              violated or the Service is being misused.
            </p>
          </Section>

          <Section n={7}>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties
              of any kind, express or implied, including fitness for a particular purpose,
              non-infringement, or uninterrupted availability.
            </p>
          </Section>

          <Section n={8}>
            <p>
              To the maximum extent permitted by law, Spintra and its operators are not
              liable for any indirect, incidental, or consequential damages arising from your
              use of the Service, including content posted by other users.
            </p>
          </Section>

          <Section n={9}>
            <p>
              We may update these Terms from time to time. Continued use of the Service after
              a change takes effect constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section n={10}>
            <p>
              These Terms are governed by the laws of <strong>India</strong>,
              without regard to its conflict-of-law principles.
            </p>
          </Section>

          <Section n={11}>
            <p>
              Questions about these Terms can be sent to{" "}
              <strong className="[overflow-wrap:anywhere]">tejasboricha225@gmail.com</strong>.
            </p>
          </Section>

          <p className="text-sm text-muted-foreground pt-4 border-t border-border">
            See also our <Link href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
