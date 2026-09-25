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
  title: "Free Classroom Tools for Teachers | Spintra",
  description:
    "A free random name picker, team generator, trivia, and more for the classroom. Nobody signs up, not you and not your students, and it works on Chromebooks and any browser.",
  alternates: { canonical: "/for-teachers" },
  openGraph: {
    title: "Free Classroom Tools for Teachers | Spintra",
    description:
      "Name pickers, team makers, and review games for the classroom. Free, and your students don't need accounts.",
    url: "/for-teachers",
    type: "website",
  },
};

const TRUST_POINTS = [
  { icon: Sparkles, label: "Free to use" },
  { icon: Lock, label: "Students don't sign up" },
  { icon: MonitorSmartphone, label: "Works on Chromebooks and any browser" },
  { icon: Users, label: "Rooms for up to 50 people" },
];

const CLASSROOM_IDEAS: { href: string; angle: string }[] = [
  { href: "/tools/name-draw", angle: "Cold-call fairly, or draw a random student for a task." },
  { href: "/tools/team-maker", angle: "Split the class into even groups." },
  { href: "/tools/trivia", angle: "Review for a test with a quiz the whole class answers at once." },
  { href: "/tools/lucky-wheel", angle: "Spin for rewards, prizes, or which topic to cover next." },
  { href: "/tools/tournament", angle: "Run a bracket for a class competition or spelling bee." },
  { href: "/tools/word-scramble", angle: "Start the lesson with a quick vocabulary round." },
];

const FAQS = [
  {
    q: "Is Spintra free for teachers?",
    a: "Yes. Every tool on this page is free, and there's no account, subscription, or card details to hand over.",
  },
  {
    q: "Do my students need to sign up or create an account?",
    a: "No. Spintra never asks you or your students for an email, a password, or a real name. Anyone who joins a room is given a guest name.",
  },
  {
    q: "Can I run these on a Chromebook or classroom projector?",
    a: "Yes. Everything runs in the browser with nothing to install, so it works on Chromebooks, interactive whiteboards, tablets, and ordinary laptops.",
  },
  {
    q: "Do my students need to join a room, or can I just run it myself?",
    a: "Either works. Open a tool on your own screen and run it at the front of the class, or create a Classroom room and share the 6-character code so students can follow along on their own devices.",
  },
  {
    q: "Which tools are appropriate for the classroom?",
    a: "Everything on this page. Party games like Truth or Dare are left off this list on purpose, and a Classroom room hides them too.",
  },
  {
    q: "Can I keep the room private to just my class?",
    a: "Yes. Only people with the 6-character code can join, and you can lock the room once your class is in.",
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
              Name pickers, team makers, trivia, and more, for use in class.
              It&apos;s free, and neither you nor your students need an account.
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
              A few ways to use these in a lesson.
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
            Try it with your class
          </h2>
          <p className="text-muted-foreground">
            Open a room, put the code on the board, and your students can join.
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
