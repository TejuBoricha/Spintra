"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const CONSENT_STORAGE_KEY = "spintra-cookie-consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasConsented = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!hasConsented) queueMicrotask(() => setVisible(true));
  }, []);

  const acknowledge = () => {
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
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 border border-(--border-glass) bg-(--surface-glass-strong) backdrop-blur-(--blur-glass) rounded-xl shadow-3 p-4 sm:p-5"
          role="region"
          aria-label="Cookie notice"
        >
          <div className="flex gap-3">
            <Cookie className="w-5 h-5 text-(--brand-secondary) shrink-0 mt-0.5" />
            <div className="space-y-3 font-body text-sm">
              <p className="text-foreground/90 leading-relaxed">
                Spintra uses local storage to remember your session and preferences while you
                play — no advertising or third-party tracking. See our{" "}
                <Link href="/legal/privacy" className="text-(--text-link) underline hover:text-foreground">
                  Privacy Policy
                </Link>{" "}
                for details.
              </p>
              <Button size="sm" variant="brand" onClick={acknowledge}>
                Got it
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
