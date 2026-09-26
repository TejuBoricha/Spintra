"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { analyticsAllowed, onAnalyticsConsentChange } from "@/lib/consent";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Room pages are never reported to Google: the address carries the room's
// join code (effectively the key to a private room), and Classroom rooms
// are full of children. Spintra's own usage counts still record rooms
// created and joined, with consent.
const isRoomPath = (path: string) => path.startsWith("/room/");

// A referrer is only ever sent as origin plus path, with a room page
// reduced to "/room", so a code can't leave through it either (after
// someone leaves a room, the next page's referrer is the room's address).
function safeReferrer(): string {
  try {
    if (!document.referrer) return "";
    const url = new URL(document.referrer);
    const path = isRoomPath(url.pathname) ? "/room" : url.pathname;
    return url.origin + path;
  } catch {
    return "";
  }
}

// Loads Google Analytics only once the visitor has accepted (audit X-1).
// It used to load for every visitor with Consent Mode defaulting to denied,
// which still sends Google cookieless pings before any choice and after
// Decline, while the privacy policy promised nothing was sent until Accept.
//
// Page views are sent here (send_page_view: false), once per path, and
// never for room pages. GA's own "page changes based on browser history
// events" (Enhanced measurement) would otherwise record in-app navigations
// itself; rather than rely on that dashboard setting being off, navigating
// into a room turns GA off *before* the address changes (the history
// methods are wrapped below), so GA's listener finds it disabled.
//
// Once loaded, a script can't be unloaded, so withdrawing consent, opening
// a Classroom room or being on a room page sets Google's documented opt-out
// flag, window["ga-disable-<id>"], which stops gtag.js sending anything.
export function AnalyticsScripts({ measurementId }: { measurementId: string }) {
  const pathname = usePathname() ?? "/";
  const [allowed, setAllowed] = useState(false);
  const lastReportedPath = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => setAllowed(analyticsAllowed());
    sync();
    return onAnalyticsConsentChange(sync);
  }, []);

  const active = allowed && !isRoomPath(pathname);

  // Disable GA synchronously on any navigation into a room page.
  useEffect(() => {
    const disableKey = `ga-disable-${measurementId}`;
    const guard = (url: string | URL | null | undefined) => {
      if (url == null) return;
      try {
        if (isRoomPath(new URL(String(url), window.location.href).pathname)) {
          (window as unknown as Record<string, unknown>)[disableKey] = true;
        }
      } catch {
        // Not a URL we can read; leave GA as it is.
      }
    };
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = function pushState(data, unused, url) {
      guard(url);
      return originalPush.call(this, data, unused, url);
    };
    window.history.replaceState = function replaceState(data, unused, url) {
      guard(url);
      return originalReplace.call(this, data, unused, url);
    };
    // Back and Forward change the address without pushState; this runs
    // before GA's own popstate listener, which is added later, when gtag.js
    // loads.
    const onPopState = () => guard(window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
      window.removeEventListener("popstate", onPopState);
    };
  }, [measurementId]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = !active;
    if (!active) return;

    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        // gtag.js reads the arguments object itself, not an array copy.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
      window.gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "granted",
      });
      window.gtag("js", new Date());
      window.gtag("config", measurementId, { send_page_view: false, page_referrer: safeReferrer() });
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);
    }

    // Once per path: turning analytics off and on again on the same page
    // doesn't count the page twice.
    if (lastReportedPath.current === pathname) return;
    lastReportedPath.current = pathname;
    // Path only: query strings can carry things like room codes too.
    window.gtag("event", "page_view", {
      page_location: window.location.origin + pathname,
      page_path: pathname,
      page_referrer: safeReferrer(),
      page_title: document.title,
    });
  }, [active, pathname, measurementId]);

  return null;
}
