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
  metadataBase: new URL("https://spintra.com"),
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
    url: "https://spintra.com",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${archivo.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
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
