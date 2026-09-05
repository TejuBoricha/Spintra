"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Must stay in sync with the same literal in src/app/layout.tsx's inline
// Consent Mode snippet (an inline <script> string can't import this const).
const CONSENT_STORAGE_KEY = "spintra-cookie-consent";

// Is Google Analytics wired up in this deployment? Gated on the same
// build-time env var as gtag.js itself (layout.tsx / next.config.ts). When
// false there are no analytics or third-party cookies at all — only
// functional local storage, which needs no consent — so this is a plain
// informational notice. When true it's a real analytics-consent choice
// driving Google Consent Mode v2.
const analyticsEnabled = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

// Reflect the user's choice into Consent Mode v2. gtag() is the global
// defined by layout.tsx's inline snippet; it queues onto dataLayer, so this
// is safe even while gtag.js is still loading. We only ever touch
// analytics_storage — this app runs no ads, so ad_* stay denied.
function setAnalyticsConsent(granted: boolean) {
  window.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
  });
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    // In analytics mode a decision only counts once it's an explicit
    // grant/deny — a legacy "acknowledged" value (from the old
    // acknowledge-only banner) is not consent, so those users are asked
    // to choose. In no-analytics mode any stored value means the notice
    // was already dismissed.
    const decided = analyticsEnabled
      ? stored === "granted" || stored === "denied"
      : Boolean(stored);
    if (!decided) queueMicrotask(() => setVisible(true));
  }, []);

  const choose = (granted: boolean) => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, granted ? "granted" : "denied");
    setAnalyticsConsent(granted);
    setVisible(false);
  };

  const dismiss = () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "acknowledged");
    setVisible(false);
  };

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
                {analyticsEnabled ? (
                  <>
                    Spintra uses local storage to remember your session and preferences, and —
                    with your consent — Google Analytics to understand overall site usage. No
                    advertising.
                  </>
                ) : (
                  <>
                    Spintra uses local storage to remember your session and preferences — no
                    advertising or third-party tracking.
                  </>
                )}{" "}
                See our{" "}
                <Link href="/legal/privacy" className="text-(--text-link) underline hover:text-foreground">
                  Privacy Policy
                </Link>{" "}
                for details.
              </p>
              {analyticsEnabled ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="brand" onClick={() => choose(true)}>
                    Accept
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => choose(false)}>
                    Decline
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="brand" onClick={dismiss}>
                  Got it
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
