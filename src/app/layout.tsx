import type { Metadata } from "next";
import { Archivo, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Toaster } from "@/components/ui/toaster";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});


export const metadata: Metadata = {
  metadataBase: new URL("https://spintra.io"),
  title: "Spintra — Decisions. Games. Teams. Together.",
  description:
    "Create rooms, invite friends, spin wheels, draw names, build teams, run tournaments, and play together in real time.",
  keywords: [
    "team generator", "wheel spinner", "tournament bracket", "random name picker",
    "multiplayer games", "party games", "classroom activities", "lucky wheel",
  ],
  openGraph: {
    title: "Spintra — Decisions. Games. Teams. Together.",
    description: "Turn every decision into an experience.",
    url: "https://spintra.io",
    siteName: "Spintra",
    images: [{ url: "/og-image.png" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spintra",
    description: "Turn every decision into an experience.",
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
    "Create rooms, invite friends, spin wheels, draw names, build teams, run tournaments, and play together in real time.",
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
        {/* Google Analytics (GA4) with Google Consent Mode v2 — no-ops
            entirely without NEXT_PUBLIC_GA_MEASUREMENT_ID set, same
            optional-integration pattern as Sentry (src/instrumentation-client.ts).
            The googletagmanager.com script-src allowlist in next.config.ts is
            itself gated on this same env var.

            Consent defaults to DENIED for all storage before config runs, so
            no analytics cookies are set and no identifiable data is sent until
            the visitor clicks Accept in the cookie banner
            (src/components/cookie-consent-banner.tsx), which calls
            gtag('consent','update',...). A previously stored grant is
            re-applied here on load so returning visitors are tracked from the
            first pageview. gtag() queues onto dataLayer, so ordering across
            these two afterInteractive scripts doesn't matter — gtag.js
            processes the queue (consent default first) when it loads. The
            'spintra-cookie-consent' key must match CONSENT_STORAGE_KEY in the
            banner. */}
        {gaMeasurementId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('consent', 'default', {
                  ad_storage: 'denied',
                  ad_user_data: 'denied',
                  ad_personalization: 'denied',
                  analytics_storage: 'denied',
                });
                try {
                  if (window.localStorage.getItem('spintra-cookie-consent') === 'granted') {
                    gtag('consent', 'update', { analytics_storage: 'granted' });
                  }
                } catch (e) {}
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}');
              `}
            </Script>
          </>
        )}
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
