import type { NextConfig } from "next";

// Kept permissive enough not to break Next.js hydration scripts, Framer
// Motion's inline styles, and Supabase's realtime websocket connection (whose
// exact origin is only known at runtime via env vars). Tighten script-src to
// a nonce-based policy if/when this app adopts one.
//
// connect-src is normally https:/wss:-only (the real hosted Supabase project
// only ever uses those). But CI's db-integration job — and any dev running
// `supabase start` locally — points NEXT_PUBLIC_SUPABASE_URL at a plain-http
// loopback instance (e.g. http://127.0.0.1:54321), which that strict policy
// silently blocked ("violates Content-Security-Policy directive: connect-src"
// in the browser console, surfaced as every Supabase call failing/timing
// out). Detected from the actual configured URL rather than NODE_ENV, since
// `next start` in CI is a production build/server — NODE_ENV alone can't
// distinguish "real production" from "production build under test."
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const isLoopbackSupabase = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl);

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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      isLoopbackSupabase
        ? "connect-src 'self' https: wss: http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*"
        : "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
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

export default nextConfig;
