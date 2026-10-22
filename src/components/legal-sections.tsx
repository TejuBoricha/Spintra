import type { ReactNode } from "react";

/** "6. Children and Schools" is linked as #children-and-schools. */
const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * The numbered sections of a legal page and the contents list that links to them, built from one list of titles so the
 * two cannot drift (UX audit U-22: Terms and Privacy ran 91 to 107 characters a line, with no way to a section: a person
 * comes for one answer, and a school needs to point at one part). `<Section n={3}>` renders the third title as its
 * heading and gives the section the anchor `#acceptable-use`; `<Contents />` lists them all.
 */
export function createLegalSections(titles: readonly string[]) {
  function Contents() {
    return (
      <nav aria-label="Contents" className="mb-10 rounded-xl border border-(--border-hairline) bg-(--surface-panel) p-5">
        <p className="mb-3 text-sm font-semibold text-muted-foreground">Contents</p>
        <ol className="grid list-none gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
          {titles.map((title, i) => (
            <li key={title}>
              <a href={`#${slug(title)}`} className="underline underline-offset-4 hover:text-foreground">
                {i + 1}. {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  function Section({ n, children }: { n: number; children: ReactNode }) {
    const title = titles[n - 1];
    return (
      <section id={slug(title)}>
        <h2 className="text-2xl font-semibold mb-3">
          {n}. {title}
        </h2>
        {children}
      </section>
    );
  }

  return { Contents, Section };
}
