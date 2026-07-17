import type { Metadata } from "next";
import Link from "next/link";
import {
  GraduationCap,
  Sparkles,
  Lock,
  MonitorSmartphone,
  Users,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GAMES } from "@/lib/games";

export const metadata: Metadata = {
  title: "Free Classroom Tools for Teachers — Spintra",
  description:
    "A free random name picker, team generator, trivia, and more for the classroom. No sign-up for you or your students, works on any Chromebook or browser, free forever.",
  alternates: { canonical: "/for-teachers" },
  openGraph: {
    title: "Free Classroom Tools for Teachers — Spintra",
    description:
      "Random name pickers, team makers, and review games built for the classroom — free, no sign-up required.",
    url: "/for-teachers",
    type: "website",
  },
};

const TRUST_POINTS = [
  { icon: Sparkles, label: "100% free, no catch" },
  { icon: Lock, label: "No student sign-ups, ever" },
  { icon: MonitorSmartphone, label: "Works on Chromebooks & any browser" },
  { icon: Users, label: "Rooms hold up to 50 students" },
];

const CLASSROOM_IDEAS: { href: string; angle: string }[] = [
  { href: "/tools/name-draw", angle: "Cold-call fairly, or draw a random student for a task." },
  { href: "/tools/team-maker", angle: "Split the class into balanced groups in one click." },
  { href: "/tools/trivia", angle: "Turn test review into a live, class-wide quiz." },
  { href: "/tools/lucky-wheel", angle: "Spin for rewards, prizes, or which topic to cover next." },
  { href: "/tools/tournament", angle: "Run a bracket for a class competition or spelling bee." },
  { href: "/tools/word-scramble", angle: "Warm up the class with a quick vocabulary challenge." },
];

const FAQS = [
  {
    q: "Is Spintra free for teachers?",
    a: "Yes. Every tool on this page is free to use, with no account, subscription, or credit card required.",
  },
  {
    q: "Do my students need to sign up or create an account?",
    a: "No. Spintra never asks for an email, password, or real name from you or your students. Anyone who joins a room gets an anonymous guest name automatically.",
  },
  {
    q: "Can I run these on a Chromebook or classroom projector?",
    a: "Yes. Everything runs in the browser with no downloads or extensions, and works on Chromebooks, interactive whiteboards, tablets, and any modern browser.",
  },
  {
    q: "Do my students need to join a room, or can I just run it myself?",
    a: "Both work. Open any tool directly on your own screen and run it for the whole class, or create a Classroom room and share the 6-character code if you want students following along on their own devices.",
  },
  {
    q: "Which tools are appropriate for the classroom?",
    a: "The tools on this page are curated to be classroom-appropriate — party-oriented games elsewhere on Spintra, like Truth or Dare, are deliberately left off this list.",
  },
  {
    q: "Can I keep the room private to just my class?",
    a: "Yes. Rooms use a private 6-character code and can be locked once everyone has joined, so only people you share the code with can enter.",
  },
];

export default function ForTeachersPage() {
  const classroomTools = GAMES.filter((game) => game.classroomSafe);

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
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-sky-500/10 text-sky-500 mb-2">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-4xl sm:text-5xl font-black">
              Free Classroom Tools for <span className="gradient-text">Teachers</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Random name pickers, team makers, trivia, and more — built for the classroom.
              Nothing for you or your students to sign up for, and it&apos;s free forever.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/create?type=classroom">
              <Button variant="brand" size="lg" className="rounded-full font-bold">
                Start a Classroom Room
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="#tools">
              <Button variant="outline" size="lg" className="rounded-full font-bold">
                Browse the Tools
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
                <point.icon className="w-4 h-4 text-sky-500" />
                {point.label}
              </div>
            ))}
          </div>
        </div>

        {/* Classroom ideas */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-black">
              Ideas for your classroom
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A few ways other teachers put these tools to use.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CLASSROOM_IDEAS.map((idea) => {
              const game = GAMES.find((g) => g.href === idea.href);
              if (!game) return null;
              const Icon = game.icon;
              return (
                <Link key={idea.href} href={idea.href} className="block h-full outline-none group">
                  <div className="h-full rounded-2xl border border-(--border-hairline) bg-(--surface-sunken) p-5 hover:border-sky-500/40 transition-colors">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-sky-500 transition-colors">
                      {game.label}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {idea.angle}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Full tools grid */}
        <div id="tools" className="scroll-mt-24 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-black">
              All classroom-safe tools
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Use any of these on their own, or start a Classroom room to run one with the
              whole class at once.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {classroomTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.type} href={tool.href} className="block h-full outline-none">
                  <div className="h-full p-6 group cursor-pointer border border-(--border-hairline) bg-(--surface-panel) hover:border-primary/40 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all flex flex-col items-start gap-4">
                    <div
                      className={`w-14 h-14 rounded-[1.25rem] border-2 border-(--border-strong) bg-gradient-to-br ${tool.color} flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-inner`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-lg group-hover:text-(--brand-primary-strong) transition-colors">
                        {tool.label}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {tool.desc}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto w-full space-y-6">
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
          <h2 className="font-display text-2xl sm:text-3xl font-black">
            Ready to try it with your class?
          </h2>
          <p className="text-muted-foreground">
            No sign-up, no install — just open a room and go.
          </p>
          <Link href="/create?type=classroom" className="inline-block">
            <Button variant="brand" size="lg" className="rounded-full font-bold">
              Start a Classroom Room
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
