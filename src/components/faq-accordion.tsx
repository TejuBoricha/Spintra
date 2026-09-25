// Shared by ToolSeoSection (src/components/tool-seo-section.tsx, used by all
// /tools/* pages) and the Spintra City marketing page
// (src/app/spintra-city/page.tsx) — both built the same FAQPage schema object
// and the same <details>/<summary> accordion markup independently before this
// extraction (a code-review "reuse" finding). Pulled out here rather than
// City importing ToolSeoSection directly: City's page isn't a /tools/* widget
// page (its GAMES entry is createOnly, no standalone tool href), so the whole
// component doesn't fit — only this inner piece was actually duplicated.

export interface Faq {
  q: string;
  a: string;
}

export function buildFaqSchema(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="divide-y divide-(--border-hairline) rounded-2xl border border-(--border-hairline) bg-(--surface-sunken)">
      {faqs.map((faq) => (
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
  );
}
