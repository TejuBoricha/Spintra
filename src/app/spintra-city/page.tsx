import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  Users,
  Sparkles,
  Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Free Online Monopoly-Style Game — Spintra City",
  description:
    "Play a free Monopoly-style board game online with friends — no download, no sign-up. Roll, buy, build, and trade your way to the top in Spintra City, refereed automatically so nobody can cheat.",
  alternates: { canonical: "/spintra-city" },
  openGraph: {
    title: "Free Online Monopoly-Style Game — Spintra City",
    description:
      "Roll, buy, build, and trade with 2-8 players. A free, browser-based Monopoly-style game — no download, no sign-up.",
    url: "/spintra-city",
    type: "website",
  },
};

const TRUST_POINTS = [
  { icon: Sparkles, label: "100% free, no catch" },
  { icon: ShieldCheck, label: "Server-refereed — nobody can cheat" },
  { icon: Users, label: "2-8 players in one room" },
  { icon: Globe2, label: "Real cities & flags, no downloads" },
];

const HOW_IT_WORKS = [
  {
    step: "1. Open a room",
    body: "Create a Spintra City room and share the 6-character code — no account needed for you or anyone joining.",
  },
  {
    step: "2. Take a seat",
    body: "Up to 8 players seat themselves and ready up. The host starts the match once everyone's in.",
  },
  {
    step: "3. Roll, buy, build, trade",
    body: "Classic property-trading rules — roll dice, buy or auction unclaimed properties, complete sets to build, negotiate trades with other players.",
  },
  {
    step: "4. Last player standing wins",
    body: "Bankrupt everyone else, or come out ahead when time runs out in timed mode. Every move is validated server-side, so there's no house-ruling or disputing a result.",
  },
];

const FAQS = [
  {
    q: "Is Spintra City the official Monopoly game?",
    a: "No. Spintra City is an original, Monopoly-style property-trading board game inspired by the classic genre — it's not affiliated with, sponsored by, or endorsed by Hasbro or the Monopoly brand. The rules structure (buy, build, trade, bankrupt your opponents) will feel familiar; the board, art, and content are Spintra's own.",
  },
  {
    q: "Is it free to play?",
    a: "Yes. Spintra City is free, with no account, subscription, or credit card required for you or anyone you play with.",
  },
  {
    q: "Do I need to download anything?",
    a: "No. It runs entirely in your browser — desktop or mobile — with nothing to install.",
  },
  {
    q: "How many players can join a match?",
    a: "2 to 8 players in one room. Anyone who joins after a match starts can still watch as a spectator.",
  },
  {
    q: "Can someone cheat or fudge the rules?",
    a: "No — every roll, purchase, and trade is validated by the server, not the players' browsers. There's no way to grant yourself extra cash or skip a rule, and nobody has to referee.",
  },
  {
    q: "What happens if someone disconnects mid-game?",
    a: "Their seat is auto-piloted for a short grace period so the match keeps moving, and they can rejoin and pick back up right where they left off.",
  },
];

export default function SpintraCityPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="max-w-6xl mx-auto space-y-20">
        {/* Hero */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 text-amber-500 mb-2">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-4xl sm:text-5xl font-black">
              A free online <span className="gradient-text">Monopoly-style</span> board game
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Spintra City: roll, buy, build, and trade your way to the top with 2-8 players —
              refereed automatically, so nobody can cheat and nobody has to keep score by hand.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/create?type=city">
              <Button variant="brand" size="lg" className="rounded-full font-bold">
                Start a Match
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#faq">
              <Button variant="outline" size="lg" className="rounded-full font-bold">
                How It Works
              </Button>
            </Link>
          </div>

          {/* Trust points */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-6">
            {TRUST_POINTS.map((point) => (
              <div
                key={point.label}
                className="flex items-center gap-2 rounded-full border border-(--border-hairline) bg-(--surface-panel) px-4 py-2 text-sm text-muted-foreground"
              >
                <point.icon className="w-4 h-4 text-amber-500" />
                {point.label}
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-black">How it works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              The classic property-trading loop, playable in one browser tab.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="h-full rounded-2xl border border-(--border-hairline) bg-(--surface-sunken) p-5"
              >
                <h3 className="font-semibold text-foreground">{item.step}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div id="faq" className="scroll-mt-24 max-w-3xl mx-auto w-full space-y-6">
          <h2 className="font-display text-2xl sm:text-3xl font-black text-center">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-(--border-hairline) rounded-2xl border border-(--border-hairline) bg-(--surface-sunken)">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group px-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 font-medium list-none [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="flex-none text-muted-foreground transition-transform group-open:rotate-45 text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="text-sm text-muted-foreground leading-relaxed pb-4">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="max-w-3xl mx-auto w-full text-center rounded-[2rem] border border-(--border-hairline) bg-(--surface-panel) p-10 space-y-4">
          <h2 className="font-display text-2xl sm:text-3xl font-black">Ready to play?</h2>
          <p className="text-muted-foreground">
            No sign-up, no install — open a room and share the code.
          </p>
          <Link href="/create?type=city" className="inline-block">
            <Button variant="brand" size="lg" className="rounded-full font-bold">
              Start a Match
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
