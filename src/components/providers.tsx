"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { ProductionConfigWarningBanner } from "@/components/production-config-warning-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/* The stylesheet's prefers-reduced-motion rule does not reach framer-motion's JavaScript-driven
          animation (11 of them loop forever); with "user" it skips transform and layout animation when
          the visitor's device asks for less motion (UX audit U-25). */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <ProductionConfigWarningBanner />
          {children}
          <CookieConsentBanner />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
