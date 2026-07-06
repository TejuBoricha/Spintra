import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Found in the Session 41 audit: no way for an uptime monitor, load
// balancer, or deploy pipeline to check whether the app (and its only
// backend dependency, Supabase) is actually working — the app could be
// silently down with nothing to page anyone. This is deliberately a plain
// GET route handler, not a page, so it stays a stable machine-readable
// contract for external monitoring services (UptimeRobot, Pingdom, a
// platform's own health check, etc.) regardless of UI changes.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { status: "error", database: "not_configured", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    // Cheapest possible real round-trip: no rows returned, just confirms
    // the database accepts and answers a query under current RLS/network
    // conditions — the same dependency every real page load has.
    const { error } = await supabase.from("rooms").select("id", { count: "exact", head: true }).limit(1);

    if (error) {
      return NextResponse.json(
        { status: "error", database: "unreachable", detail: error.message, timestamp: new Date().toISOString() },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "ok", database: "reachable", timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        detail: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
