import type { ReactNode } from "react";
import { Volume2, VolumeX, type LucideIcon } from "lucide-react";

/**
 * The header every tool page opens with (UX audit U-13): a chip, the title in the display font with its last word in the
 * brand gradient, and a subtitle. The 14 pages each wrote their own, so the title was white on one, lime on another and
 * capitals on a third, at three sizes, with the first element 8 or 44 px under the banner. One word of a title is the
 * accent; a one-word title is all accent.
 *
 * `sound` is the mute toggle of the games that make noise, one button with one label for all of them; `children` (the other
 * toggles: a voice caller, a settings drawer) follow it on the subtitle's row, which wraps on a narrow screen.
 */
export function ToolHeader({
  icon: Icon,
  iconClassName = "text-(--brand-primary-strong)",
  chip,
  title,
  subtitle,
  sound,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  chip: ReactNode;
  title: string;
  subtitle: ReactNode;
  sound?: { enabled: boolean; onToggle: () => void };
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
      <div className={sound || children ? "flex flex-wrap items-center justify-center gap-3" : undefined}>
        <p className="mx-auto min-w-0 max-w-xl text-base text-muted-foreground sm:text-lg">{subtitle}</p>
        {sound && (
          <button
            type="button"
            onClick={sound.onToggle}
            title={sound.enabled ? "Sound On" : "Sound Off"}
            aria-label={sound.enabled ? "Mute sound effects" : "Unmute sound effects"}
            className="rounded-lg border border-(--border-hairline) bg-(--surface-sunken) p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {sound.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
