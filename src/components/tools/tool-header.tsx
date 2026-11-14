import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The header every tool page opens with (UX audit U-13): a chip, the title in the display font with its last word in the
 * brand gradient, and a subtitle. The 14 pages each wrote their own, so the title was white on one, lime on another and
 * capitals on a third, at three sizes, with the first element 8 or 44 px under the banner. One word of a title is the
 * accent; a one-word title is all accent.
 *
 * `children` sit on the subtitle's row (the sound toggle of the games that make noise).
 */
export function ToolHeader({
  icon: Icon,
  iconClassName = "text-(--brand-primary-strong)",
  chip,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  chip: ReactNode;
  title: string;
  subtitle: ReactNode;
  children?: ReactNode;
}) {
  const words = title.split(" ");
  const accent = words.pop();
  const lead = words.join(" ");
  return (
    <div data-tool-header className="reveal reveal-up mb-8 text-center">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-(--border-hairline) bg-(--surface-glass) px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-(--blur-glass-soft)">
        <Icon className={`h-4 w-4 ${iconClassName}`} />
        <span>{chip}</span>
      </div>
      <h1 className="mb-3 font-display text-4xl font-black tracking-tight hyphens-auto sm:text-5xl [overflow-wrap:anywhere]">
        {lead && <>{lead} </>}
        <span className="gradient-text">{accent}</span>
      </h1>
      <div className={children ? "flex items-center justify-center gap-3" : undefined}>
        <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
