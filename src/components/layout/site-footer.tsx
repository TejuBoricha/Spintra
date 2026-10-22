"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Footer links are 44px tall by default (a phone, any device with a touchscreen: WCAG 2.5.8 asks for 24px, and 44px
// is the size a thumb hits reliably) and 36px only where there is room and no touch input at all (md and up, mouse
// only), where the row is compact. `any-pointer` rather than `pointer`: a touchscreen laptop or a 2-in-1 with a
// trackpad reports a fine primary pointer, and a finger still taps those links. The compact size has to be asked for.
// The home page's footer uses this too.
export const FOOTER_LINK = "inline-flex items-center min-h-11 md:not-any-pointer-coarse:min-h-9 hover:text-foreground transition-colors";

/**
 * The footer of every page except two: the home page, which has its own (with the game table), and a room, which is an
 * app screen that fills the window and has no page below it. Before this, Terms, Privacy and the copyright could only be
 * reached from the home page, the cookie notice and Settings, so a visitor who landed on a tool page from search had no
 * way to the legal pages, or back to the hub, except the navbar (audit finding U-12).
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/room" || pathname.startsWith("/room/")) return null;
  return (
    <footer className="relative z-10 border-t border-border px-4 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center md:flex-row md:items-start md:justify-between md:text-left">
        <div className="flex max-w-sm flex-col items-center gap-3 md:items-start">
          {/* The same wordmark as the navbar (only "Spin" is brand-coloured). */}
          <Link href="/" className="flex items-center gap-2 text-foreground" aria-label="Spintra home">
            <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-(--brand-primary-strong)">
              <Image src="/icons/logo.png" alt="" width={28} height={28} className="h-full w-full object-cover" />
            </span>
            <span className="font-display text-lg font-black tracking-tight">
              <span className="text-(--brand-primary-strong)">Spin</span>tra
            </span>
          </Link>
          <p className="leading-relaxed text-pretty">
            Spintra is a free set of games and group tools that run in your browser. No account needed.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 md:justify-end">
          <Link href="/tools" className={FOOTER_LINK}>Tools</Link>
          <Link href="/explore" className={FOOTER_LINK}>Explore</Link>
          <Link href="/create" className={FOOTER_LINK}>Create Room</Link>
          <Link href="/for-teachers" className={FOOTER_LINK}>For Teachers</Link>
          <Link href="/legal/terms" className={FOOTER_LINK}>Terms</Link>
          <Link href="/legal/privacy" className={FOOTER_LINK}>Privacy</Link>
        </nav>
      </div>
      {/* The year is the one of the build; the flag stops React flagging a visit in a later year (it keeps the built text). */}
      <p className="mx-auto mt-6 max-w-6xl text-center md:text-left" suppressHydrationWarning>
        © {new Date().getFullYear()} Spintra
      </p>
    </footer>
  );
}
