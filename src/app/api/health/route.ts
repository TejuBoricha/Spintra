import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const CHECK_TIMEOUT_MS = 5000;

type CheckStatus = "reachable" | "unreachable" | "error";

async function checkDatabase(supabaseUrl: string, supabaseAnonKey: string): Promise<CheckStatus> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(CHECK_TIMEOUT_MS));
    if (error) {
      console.error("Health check: database query failed:", error.message);
      return "unreachable";
    }
    return "reachable";
  } catch (err) {
    console.error("Health check: database error:", err instanceof Error ? err.message : err);
    return "unreachable";
  }
}

async function checkAuth(supabaseUrl: string, supabaseAnonKey: string): Promise<CheckStatus> {
  try {
    const authRes = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    return authRes.ok ? "reachable" : "error";
  } catch {
    return "unreachable";
  }
}

async function checkRealtime(supabaseUrl: string, supabaseAnonKey: string): Promise<CheckStatus> {
  try {
    const rtUrl = supabaseUrl.replace(/\/+$/, "") + "/realtime/v1/ws";
    const rtRes = await fetch(rtUrl, {
      method: "GET",
      headers: { apikey: supabaseAnonKey },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    return rtRes.status !== 404 ? "reachable" : "error";
  } catch {
    return "unreachable";
  }
}

function healthResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(
    { ...body, timestamp: new Date().toISOString() },
    {
      status,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "Content-Type": "application/json; charset=utf-8",
        // Uptime monitors must always see a live result, never a cached one.
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return healthResponse(
      { status: "error", database: "not_configured", auth: "not_configured", realtime: "not_configured" },
      503
    );
  }

  // Run all three checks concurrently — sequential awaits would stack each
  // check's own timeout on top of the others, risking a false "down" report
  // from an uptime monitor's own timeout during a partial outage.
  const [database, auth, realtime] = await Promise.all([
    checkDatabase(supabaseUrl, supabaseAnonKey),
    checkAuth(supabaseUrl, supabaseAnonKey),
    checkRealtime(supabaseUrl, supabaseAnonKey),
  ]);

  const allOk = database === "reachable" && auth === "reachable" && realtime === "reachable";

  return healthResponse({ status: allOk ? "ok" : "degraded", database, auth, realtime }, allOk ? 200 : 503);
}
