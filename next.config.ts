import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Skippable via SKIP_ENV_VALIDATION for builds that intentionally have no
// Supabase backend — e.g. CI's `validate` job builds without these vars on
// purpose, to exercise the app's demo-mode/BroadcastChannel fallback path
// (see ci.yml's `validate` job and src/lib/supabase/client.ts). Everywhere
// else (real deploys, db-integration's real-Supabase build) this still
// fails fast on a missing var instead of silently shipping a broken build.
const REQUIRED_ENV_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
if (!process.env.SKIP_ENV_VALIDATION) {
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      throw new Error(
        `Missing required env var: ${key}. Set it in .env.local or the CI environment, ` +
          `or set SKIP_ENV_VALIDATION=true for an intentional no-Supabase build (demo mode).`
      );
    }
  }
}

// script-src used to include 'unsafe-inline'/'unsafe-eval', which defeats
// most of what a CSP is for. A stricter, nonce-based policy is possible in
// Next.js but requires reading headers() in the root layout, which forces
// the entire app out of static rendering (every route becomes
// server-rendered per-request) — an unacceptable trade-off against this
// app's Explore-page scalability work.
//
// 'unsafe-inline' can't be dropped without that nonce machinery: confirmed
// live (production build + real browser) that Next.js's own framework
// bootstrap/hydration payload uses inline <script> tags on every route, not
// just this app's one inline script (which was moved to a static file,
// public/e2e-create-room-bridge.js, anyway — real improvement, just not
// sufficient on its own). 'unsafe-eval' IS dropped in production — nothing
// in this app calls eval()/`new Function()`, and a live check (including
// the Lucky Wheel's WebGL/Three.js rendering, the one place a runtime eval
// was plausible) against a production build/server showed zero script-src
// violations once only 'unsafe-eval' was removed. It stays in *development*
// only: React's own dev-mode debugging (reconstructing callstacks, Fast
// Refresh) calls eval() unconditionally in dev builds regardless of this
// app's own code — confirmed by `next dev` breaking outright (every
// Supabase call failing) the moment 'unsafe-eval' was dropped unconditionally.
//
// connect-src is normally https:/wss:-only (the real hosted Supabase
// project only ever uses those). But CI's db-integration job — and any dev
// running `supabase start` locally — points NEXT_PUBLIC_SUPABASE_URL at a
// plain-http loopback instance (e.g. http://127.0.0.1:54321), which that
// strict policy silently blocked ("violates Content-Security-Policy
// directive: connect-src" in the browser console, surfaced as every
// Supabase call failing/timing out). Detected from the actual configured
// URL rather than NODE_ENV, since `next start` in CI is a production
// build/server — NODE_ENV alone can't distinguish "real production" from
// "production build under test."
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const isLoopbackSupabase = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl);

// Google Analytics (gtag.js) is loaded from a remote googletagmanager.com
// script (see layout.tsx), unlike Sentry which ships bundled in-app and
// needs no script-src entry. Gated on the same env var that gates loading
// it at all, so a deployment without NEXT_PUBLIC_GA_MEASUREMENT_ID set gets
// a CSP byte-for-byte identical to before this integration existed.
// connect-src needs no change: it already allows any https: origin, which
// covers gtag.js's own calls to google-analytics.com/analytics.google.com.
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
const gaScriptSrc = gaMeasurementId ? " https://www.googletagmanager.com" : "";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      process.env.NODE_ENV === "production"
        ? `script-src 'self' 'unsafe-inline'${gaScriptSrc}`
        : `script-src 'self' 'unsafe-inline' 'unsafe-eval'${gaScriptSrc}`,
      // style-src keeps 'unsafe-inline' deliberately — Framer Motion and
      // Radix primitives set inline style="" attributes directly via JS at
      // runtime (not <style> tags), which CSP nonces cannot cover (nonces
      // only apply to <script>/<style> elements). Ripping out Framer Motion
      // to close this specific gap is disproportionate to a Medium-severity
      // finding; script-src (blocking injected/exfiltrating <script>
      // execution and eval()-based attacks) is where CSP does its real work,
      // and that's now locked down to 'self' with no escape hatches.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      isLoopbackSupabase
        ? "connect-src 'self' https: wss: http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*"
        : "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Source-map upload (for readable production stack traces in Sentry) needs
// org/project/authToken — all optional here since this app has no Sentry
// project configured yet in most environments; the plugin skips the upload
// step gracefully (a build-time warning, not a failure) when authToken is
// unset, matching this project's existing pattern of every third-party
// integration degrading gracefully rather than requiring configuration to
// build at all (see isSupabaseConfigured()/SKIP_ENV_VALIDATION above).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // disableLogger is deprecated in favor of webpack.treeshake.removeDebugLogging,
  // but neither option is supported under Turbopack (this app's build target,
  // confirmed via `next build` output) — omitted rather than set either way.
});
