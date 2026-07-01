import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Toaster
            position="bottom-center"
            toastOptions={{
              className: "!bg-background/80 !backdrop-blur-xl !border !border-white/10",
            }}
          />
        </Providers>
        {/* E2E test bridge: catches clicks on the hidden server-rendered
            create-room button (src/app/create/page.tsx) that happen before
            React hydration attaches the real handler. beforeInteractive
            requires next/script rather than a raw <script> tag, and per
            Next's docs that strategy must live in the root layout. */}
        <Script id="e2e-create-room-bridge" strategy="beforeInteractive">
          {`
            window.e2eRoomClicked = false;
            document.addEventListener('click', function(e) {
              var btn = e.target;
              if (btn && (btn.getAttribute('data-testid') === 'create-room-button' || btn.closest('[data-testid="create-room-button"]'))) {
                window.e2eRoomClicked = true;
              }
            });
          `}
        </Script>
      </body>
    </html>
  );
}
