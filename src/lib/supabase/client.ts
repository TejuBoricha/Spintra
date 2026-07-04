import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let browserSupabase: SupabaseClient<Database> | null = null;

function createBrowserClient(): SupabaseClient<Database> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured. Supabase realtime features will be disabled."
    );
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

