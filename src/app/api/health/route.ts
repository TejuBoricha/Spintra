import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { status: "error", database: "not_configured", auth: "not_configured", realtime: "not_configured", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }

  const checks: { database?: string; auth?: string; realtime?: string } = {};
  let allOk = true;

  // Database check
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from("rooms").select("id", { count: "exact", head: true }).limit(1);
    if (error) {
      console.error("Health check: database query failed:", error.message);
      checks.database = "unreachable";
      allOk = false;
    } else {
      checks.database = "reachable";
    }
  } catch (err) {
    console.error("Health check: database error:", err instanceof Error ? err.message : err);
    checks.database = "unreachable";
    allOk = false;
  }

  // Auth check — verify the Supabase Auth endpoint responds
  try {
    const authRes = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
      signal: AbortSignal.timeout(5000),
    });
    checks.auth = authRes.ok ? "reachable" : "error";
    if (!authRes.ok) allOk = false;
  } catch {
    checks.auth = "unreachable";
    allOk = false;
  }

  // Realtime check — verify the Realtime endpoint is alive
  try {
    const rtUrl = supabaseUrl.replace(/\/+$/, "") + "/realtime/v1/ws";
    const rtRes = await fetch(rtUrl, {
      method: "GET",
      headers: { apikey: supabaseAnonKey },
      signal: AbortSignal.timeout(5000),
    });
    checks.realtime = rtRes.status !== 404 ? "reachable" : "error";
    if (rtRes.status === 404) allOk = false;
  } catch {
    checks.realtime = "unreachable";
    allOk = false;
  }

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", ...checks, timestamp: new Date().toISOString() },
    {
      status: allOk ? 200 : 503,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}
