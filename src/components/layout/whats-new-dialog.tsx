"use client";

import { useRef, useState } from "react";
import {
  Lightbulb,
  Building2,
  GraduationCap,
  PartyPopper,
  Rocket,
  Sparkle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { safeStorageGet, safeStorageSet } from "@/lib/utils";
import { useHasMounted } from "@/lib/use-has-mounted";

// "By clicking on it they can get to know what next we're launching and
// updates" — a lightbulb affordance in the navbar, next to Settings/theme,
// opening a two-section panel: what's coming, and real features already
// live that are easy to miss in the normal /create flow. Bumping SEEN_KEY's
// version re-surfaces the badge dot for everyone the next time this list
// actually changes — it isn't tied to a specific item, so editing COMING/
// UPDATES below without bumping it means returning users won't notice.
const SEEN_KEY = "spintra-whats-new-seen-v1";

interface Announcement {
  icon: typeof Lightbulb;
  title: string;
  body: string;
}

// Spintra City: real, in-progress, not yet launched — see docs/SPINTRA_CITY_SPEC.md.
// Classroom Mode / Party Mode: real, already live, just easy to miss since
// neither is the default path through /create.
const COMING: Announcement[] = [
  {
    icon: Building2,
    title: "Spintra City",
    body: "A property-trading board game for 2-8 players — roll, buy, develop, and negotiate. The server referees every move, so nobody can cheat. In final review now.",
  },
];

const UPDATES: Announcement[] = [
  {
    icon: GraduationCap,
    title: "Classroom Mode",
    body: "A teacher-friendly room preset — only classroom-safe activities, none of the party/social games.",
  },
  {
    icon: PartyPopper,
    title: "Party Mode",
    body: "Every game unlocked in one room, no switching between tools mid-hangout.",
  },
];

function AnnouncementRow({ icon: Icon, title, body }: Announcement) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-9 h-9 rounded-xl bg-(--surface-sunken) border border-(--border-glass) flex items-center justify-center">
        <Icon className="w-4.5 h-4.5 text-(--brand-primary-strong)" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{body}</p>
      </div>
    </div>
  );
}

export interface WhatsNewState {
  open: boolean;
  /** Whether a trigger should render its unread-badge dot — already
   *  combines `hasUnseen` with the post-hydration guard, so a consumer
   *  never has to re-derive (or forget) that pairing itself. */
  showBadge: boolean;
  /** `fromMobile: true` only for the trigger living inside the hamburger
   *  menu — see onDialogClosed below for why this matters. */
  show: (fromMobile?: boolean) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * One shared state object, one <WhatsNewDialog/> instance rendered once at
 * the top of Navbar — everything below exists because the first version
 * didn't do this. It rendered a full <WhatsNewButton> (trigger *and* its own
 * Dialog *and* its own "seen" useState) twice: once as the always-mounted
 * desktop icon, once inside the mobile hamburger's conditionally-unmounted
 * panel. A code-review pass found that shape broke two ways: the two
 * instances' `hasUnseen` could disagree (dismissing via one never touched
 * the other's already-mounted state — resizing across the `sm` breakpoint
 * mid-session could bring the badge back), and opening the mobile trigger
 * also closed the hamburger menu, unmounting the Dialog it owned before the
 * user could read it. A single hook + a single Dialog, with the triggers as
 * thin presentational buttons, can't have either problem: there is only one
 * "seen" flag and the Dialog is never a descendant of anything that
 * conditionally unmounts.
 */
export function useWhatsNew(onDialogClosed?: () => void): WhatsNewState {
  // Read the seen-flag lazily inside useState's initializer rather than in an
  // effect — this only ever reads localStorage, never writes during render,
  // so it doesn't trip the react-hooks/set-state-in-effect rule the rest of
  // this codebase works around elsewhere (use-city-match.ts, room-client.tsx).
  const [hasUnseen, setHasUnseen] = useState(() => {
    if (typeof window === "undefined") return false;
    return safeStorageGet(SEEN_KEY) !== "1";
  });
  const [open, setOpen] = useState(false);

  // Hydration guard: the real localStorage read above can only run
  // client-side, so the badge would otherwise mismatch between the server
  // render and the client's first paint whenever it's genuinely unseen.
  const mounted = useHasMounted();

  // A code-review pass caught a second bug in the first version of this
  // fix: onDialogClosed fired unconditionally on every close, regardless of
  // which trigger opened it. Between 640-1024px both the desktop icon and
  // the mobile hamburger are reachable at once — opening the dialog via the
  // icon while the hamburger happened to already be open, then closing it,
  // collapsed the hamburger too, even though the user never touched it.
  // openedFromMobileRef records which trigger actually opened the dialog so
  // the close side-effect only fires for the one that should own it. A ref,
  // not state — it's written and read only inside event handlers (show/
  // onOpenChange), never during render, so it doesn't need to be a
  // re-render trigger itself.
  const openedFromMobileRef = useRef(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && hasUnseen) {
      safeStorageSet(SEEN_KEY, "1");
      setHasUnseen(false);
    }
    // Closing (not opening) is when a caller wants side effects like
    // dismissing a mobile menu the trigger lived in — doing it on open, as
    // an earlier version did, unmounted the Dialog itself before the user
    // could read it, since it was still a child of that menu at the time.
    if (!next && openedFromMobileRef.current) {
      openedFromMobileRef.current = false;
      onDialogClosed?.();
    }
  };

  const show = (fromMobile = false) => {
    openedFromMobileRef.current = fromMobile;
    onOpenChange(true);
  };

  return { open, showBadge: mounted && hasUnseen, show, onOpenChange };
}

export function WhatsNewTrigger({
  variant,
  whatsNew,
}: {
  /** "icon": the circular navbar trigger (desktop + tablet). "full": a
   *  labeled full-width button matching the mobile hamburger menu's other
   *  entries (Settings, Live Rooms, ...). */
  variant: "icon" | "full";
  whatsNew: WhatsNewState;
}) {
  const showBadge = whatsNew.showBadge;
  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => whatsNew.show()}
        aria-label="What's launching next, and recent updates"
        className="relative rounded-full text-muted-foreground hover:text-foreground hover:bg-(--surface-sunken) transition-colors h-10 w-10"
      >
        <Lightbulb className="w-5 h-5" />
        {showBadge && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-(--brand-primary-strong) ring-2 ring-background"
            aria-hidden="true"
          />
        )}
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      onClick={() => whatsNew.show(true)}
      className="relative w-full rounded-2xl h-12 bg-(--surface-sunken)/50"
    >
      <Lightbulb className="w-4 h-4 mr-2" />
      What&apos;s Next
      {showBadge && (
        <span
          className="absolute top-2 right-4 w-2 h-2 rounded-full bg-(--brand-primary-strong)"
          aria-hidden="true"
        />
      )}
    </Button>
  );
}

export function WhatsNewDialog({ whatsNew }: { whatsNew: WhatsNewState }) {
  return (
    <Dialog open={whatsNew.open} onOpenChange={whatsNew.onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-[440px] p-0 border-0 bg-transparent shadow-none overflow-visible">
        <div className="relative p-[2px] rounded-[2rem] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-(--brand-primary-strong)/40 via-transparent to-transparent" />
          <div className="relative bg-(--surface-glass-strong)/95 backdrop-blur-3xl rounded-[calc(2rem-2px)] p-6 sm:p-7 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-(--surface-sunken) border border-(--border-glass) flex items-center justify-center shrink-0">
                <Rocket className="w-5 h-5 text-(--brand-primary-strong)" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-display font-black tracking-tight text-foreground">
                  What&apos;s next
                </h2>
                <p className="text-xs text-muted-foreground">Coming up, and what you might have missed</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-(--brand-primary-strong) mb-3 flex items-center gap-1.5">
                <Sparkle className="w-3 h-3" aria-hidden="true" />
                Coming soon
              </p>
              <div className="flex flex-col gap-4">
                {COMING.map((a) => (
                  <AnnouncementRow key={a.title} {...a} />
                ))}
              </div>
            </div>

            <div className="w-full h-px bg-(--border-glass) mb-6" />

            <div>
              <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Already live
              </p>
              <div className="flex flex-col gap-4">
                {UPDATES.map((a) => (
                  <AnnouncementRow key={a.title} {...a} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
