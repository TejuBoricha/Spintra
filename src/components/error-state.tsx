"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Emoji, type EmojiName } from "@/components/emoji";

/**
 * The one "you cannot be here" page (UX audit U-18): the 404, a room that is gone, locked or full, and a route that
 * threw an error used to be three separate looks. A picture, a heading in the display font, a plain sentence, and two
 * ways forward as `children`: the one most people want first, then the other.
 *
 * `takeFocus` is for a state that replaces a page already on screen (a room's access check, a route that threw): the
 * heading takes focus so a screen reader announces what happened and a keyboard user is already at the way out. The
 * 404 is a document of its own, where focus belongs at the top, as on every other page (the skip link comes first).
 */
export function ErrorState({
  emoji,
  title,
  description,
  takeFocus = false,
  children,
}: {
  emoji: EmojiName;
  title: string;
  description: string;
  takeFocus?: boolean;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (takeFocus) heading.current?.focus(); // scrolls the heading into view if the page it replaced was scrolled down
  }, [takeFocus]);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-(--border-hairline) bg-(--surface-panel) p-8 text-center shadow-3">
        {/* decorative: without this the glyph is announced as an image before the heading */}
        <div className="flex justify-center" aria-hidden="true">
          <Emoji name={emoji} size={64} pop />
        </div>
        <div className="space-y-2">
          <h1 ref={heading} tabIndex={takeFocus ? -1 : undefined} className="font-display text-2xl font-black text-foreground">
            {title}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
