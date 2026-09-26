"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
import {
  getAnalyticsConsent,
  isAnalyticsSuppressed,
  onAnalyticsConsentChange,
  setAnalyticsConsent,
} from "@/lib/consent";

// One choice for all analytics: Google Analytics (when configured) and
// Spintra's own usage counts. See src/lib/consent.ts. Always a real
// Accept/Decline, since the usage counts exist even without Google
// Analytics; Decline is as easy as Accept, and either can be changed later
// in Settings. Hidden inside Classroom rooms, where analytics is off for
// everyone and students shouldn't be asked.
const googleAnalyticsConfigured = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

export function CookieConsentBanner() {
  const [undecided, setUndecided] = useState(false);
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUndecided(getAnalyticsConsent() === null);
      setSuppressed(isAnalyticsSuppressed());
    };
    queueMicrotask(sync);
    return onAnalyticsConsentChange(sync);
  }, []);

  const visible = undecided && !suppressed;
  const choose = (granted: boolean) => setAnalyticsConsent(granted ? "granted" : "denied");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          // Full-width-on-mobile (left-4 right-4 with no max-width) let this
          // sit directly over whatever a game happened to anchor near the
          // bottom of the viewport, with no visual hint anything was
          // underneath it — a click on e.g. the trade panel's "Send offer"
          // button landed on the banner instead and silently did nothing
          // (BUG-040). ml-auto plus a max-width hugs it to the right edge
          // at every size, same shape as the sm:+ breakpoint already had.
          className="fixed bottom-4 left-4 right-4 ml-auto max-w-sm sm:max-w-md z-40 border border-(--border-glass) bg-(--surface-glass-strong) backdrop-blur-(--blur-glass) rounded-xl shadow-3 p-4 sm:p-5"
          role="region"
          aria-label="Cookie notice"
        >
          <div className="flex gap-3">
            <Cookie className="w-5 h-5 text-(--brand-secondary) shrink-0 mt-0.5" />
            <div className="space-y-3 font-body text-sm">
              <p className="text-foreground/90 leading-relaxed">
                Spintra uses local storage to remember your session and preferences. If you
                agree, we also measure how the site is used
                {googleAnalyticsConfigured ? " (with Google Analytics and our own usage counts)" : " (our own usage counts)"}
                . No advertising, ever.{" "}
                See our{" "}
                <Link href="/legal/privacy" className="text-(--text-link) underline hover:text-foreground">
                  Privacy Policy
                </Link>{" "}
                for details.
              </p>
              {/* Equal weight on purpose: making Accept more prominent than
                  Decline is the "nudge" the UK Children's Code and EU
                  regulators single out. */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => choose(true)}>
                  Accept
                </Button>
                <Button size="sm" variant="secondary" onClick={() => choose(false)}>
                  Decline
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
