"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { ProductionConfigWarningBanner } from "@/components/production-config-warning-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ProductionConfigWarningBanner />
        {children}
        <CookieConsentBanner />
      </TooltipProvider>
    </ThemeProvider>
  );
}
