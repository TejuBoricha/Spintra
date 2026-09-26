import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Toaster } from "@/components/ui/toaster";
import { AnalyticsScripts } from "@/components/analytics-scripts";

// Self-hosted (src/app/fonts, SIL Open Font License, texts alongside), not
// next/font/google: that downloads the fonts from Google during every build,
// and a failed download failed the whole build (CI, 2026-09-27). These are
// the same Latin variable files Google serves for these weight ranges.
const archivo = localFont({
  src: "./fonts/archivo-latin-wght.woff2",
  variable: "--font-archivo",
  weight: "500 900",
  display: "swap",
});

const plusJakartaSans = localFont({
  src: "./fonts/plus-jakarta-sans-latin-wght.woff2",
  variable: "--font-plus-jakarta-sans",
  weight: "400 800",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-wght.woff2",
  variable: "--font-jetbrains-mono",
  weight: "400 700",
  display: "swap",
});


export const metadata: Metadata = {
  metadataBase: new URL("https://spintra.io"),
  title: "Spintra | Free wheel spinner, team maker, and party games",
  description:
    "Spin a wheel, draw names, split into teams, or run a bracket. Open a room and everyone sees the same result on their own screen. Free, in your browser.",
  keywords: [
    "team generator", "wheel spinner", "tournament bracket", "random name picker",
    "multiplayer games", "party games", "classroom activities", "lucky wheel",
  ],
  openGraph: {
    title: "Spintra | Free wheel spinner, team maker, and party games",
    description: "Can't decide? Spin for it. Free games and group tools you play together in one room.",
    url: "https://spintra.io",
    siteName: "Spintra",
    images: [{ url: "/og-image.png" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spintra",
    description: "Can't decide? Spin for it. Free games and group tools you play together in one room.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
};

// Structured data (schema.org WebApplication) — previously absent
// site-wide. Helps search engines understand what Spintra actually is
// (a free, interactive multiplayer app, not a content/article site) and
// is a prerequisite for various rich-result types. Safe to render as an
// inline <script> here: production CSP's script-src already includes
// 'unsafe-inline' (see next.config.ts's comment — required unconditionally
// by Next.js's own hydration bootstrap, not something this addition
// introduces).
const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Spintra",
  url: "https://spintra.io",
  description:
    "Spin a wheel, draw names, split into teams, or run a bracket. Open a room and everyone sees the same result on their own screen. Free, in your browser.",
  applicationCategory: "GameApplication",
  operatingSystem: "Any (web browser)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${archivo.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {/* Google Analytics loads only after the visitor accepts (see
            AnalyticsScripts and src/lib/consent.ts). Nothing without
            NEXT_PUBLIC_GA_MEASUREMENT_ID set; next.config.ts's
            googletagmanager.com script-src entry is gated on the same var. */}
        {gaMeasurementId && <AnalyticsScripts measurementId={gaMeasurementId} />}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-pill focus:outline-none">
          Skip to content
        </a>
        <Providers>
          <Navbar />
          <main id="main-content" className="min-h-screen pt-[6rem]">{children}</main>
          <Toaster position="bottom-center" />
        </Providers>
        {/* E2E test bridge: catches clicks on the hidden server-rendered
            create-room button (src/app/create/page.tsx) that happen before
            React hydration attaches the real handler. Loaded from a static
            file (public/e2e-create-room-bridge.js) rather than an inline
            dangerouslySetInnerHTML script so the CSP's script-src can stay
            'self'-only — no 'unsafe-inline', no nonce, no dynamic rendering
            trade-off (see next.config.ts). */}
        <Script src="/e2e-create-room-bridge.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
