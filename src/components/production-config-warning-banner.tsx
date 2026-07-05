"use client";

import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";

// Renders only if this production build is missing its Supabase env vars —
// the exact condition that otherwise silently drops every visitor into
// same-browser-tab-only demo mode with no visible sign anything is wrong.
// The check is static (NEXT_PUBLIC_*/NODE_ENV are inlined at build time), so
// this component renders nothing and costs nothing when properly configured.
export function ProductionConfigWarningBanner() {
  if (process.env.NODE_ENV !== "production" || isSupabaseConfigured()) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[200] bg-red-600 text-white px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 text-center"
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>
        Multiplayer is running in local-only mode — Supabase environment variables are missing
        from this production build. This should not happen; check the hosting provider&apos;s
        environment configuration.
      </span>
    </div>
  );
}
