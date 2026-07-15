import Link from "next/link";
import { getToolSeoContent } from "@/lib/tool-seo-content";
import { GAMES } from "@/lib/games";

/**
 * Server-rendered SEO content that appears below each interactive tool widget.
 *
 * Rendered from each tool's server-component layout.tsx (see
 * src/app/tools/[tool]/layout.tsx), so the copy is in the initial HTML for crawlers
 * and adds no client JS — the FAQ uses native <details>/<summary>. Content and
 * the FAQPage structured data both come from TOOL_SEO_CONTENT, keyed by the same
 * href used by toolMetadata(). Renders nothing for an unknown href.
 */
export function ToolSeoSection({ href }: { href: string }) {
  const content = getToolSeoContent(href);
  if (!content) return null;

  const relatedGames = content.related
    .map((relHref) => GAMES.find((g) => g.href === relHref))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <section
      aria-label="About this tool"
      className="relative border-t border-(--border-hairline) bg-(--surface-panel-soft)"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 space-y-14">
        {/* Intro */}
        <div className="space-y-4">
          <h2 className="font-display text-2xl sm:text-3xl font-black">
            {content.heading}
          </h2>
          <p className="text-muted-foreground leading-relaxed">{content.intro}</p>
        </div>

        {/* How to use */}
        <div className="space-y-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold">
            {content.howTo.title}
          </h2>
          <ol className="space-y-3">
            {content.howTo.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-(--brand-primary-strong) text-sm font-bold">
                  {i + 1}
                </span>
                <span className="text-muted-foreground leading-relaxed pt-0.5">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Use cases */}
        <div className="space-y-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold">
            What you can use it for
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {content.useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="rounded-2xl border border-(--border-hairline) bg-(--surface-sunken) p-5"
              >
                <h3 className="font-semibold mb-1.5">{useCase.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {useCase.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="space-y-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-(--border-hairline) rounded-2xl border border-(--border-hairline) bg-(--surface-sunken)">
            {content.faqs.map((faq) => (
              <details key={faq.q} className="group px-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 font-medium list-none [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="flex-none text-muted-foreground transition-transform group-open:rotate-45 text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>

        {/* Related tools (internal links) */}
        {relatedGames.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl sm:text-2xl font-bold">
              Related tools
            </h2>
            <div className="flex flex-wrap gap-3">
              {relatedGames.map((game) => (
                <Link
                  key={game.href}
                  href={game.href}
                  className="inline-flex items-center gap-2 rounded-full border border-(--border-hairline) bg-(--surface-panel) px-4 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
                >
                  <game.icon className="w-4 h-4" />
                  {game.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
