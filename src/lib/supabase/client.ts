import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let browserSupabase: SupabaseClient<Database> | null = null;

// NEXT_PUBLIC_* vars are inlined at build time, so this is a static check —
// dead-code-eliminated entirely when the app is built with them present.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function createBrowserClient(): SupabaseClient<Database> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // In production this must never fail silently — a build shipped without
    // these vars would otherwise put every visitor into the same-browser-tab
    // BroadcastChannel fallback with no visible difference. See
    // ProductionConfigWarningBanner, mounted app-wide, for the user-facing side.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "PRODUCTION MISCONFIGURATION: NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY " +
          "are missing from this production build. Every visitor will silently fall back to " +
          "same-browser-tab-only demo mode instead of real multiplayer."
      );
    } else {
      console.warn(
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured. Supabase realtime features will be disabled."
      );
    }
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
}

export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!browserSupabase) {
    browserSupabase = createBrowserClient();
  }

  return browserSupabase;
}

