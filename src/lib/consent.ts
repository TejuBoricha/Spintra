import { safeStorageGet, safeStorageSet } from "./utils";

// One consent choice covers everything non-essential Spintra does: Google
// Analytics and Spintra's own usage counts (analytics_events). Nothing in
// either runs until the visitor chooses Accept, and choosing Decline later
// (Settings) switches both off again. Error and performance monitoring
// (Sentry) is not covered: it's needed to keep the site working, and the
// privacy policy says so.
//
// Classroom rooms suppress analytics for everyone in them, whatever they
// chose: the people in them are often children.

export const CONSENT_STORAGE_KEY = "spintra-cookie-consent";
export type AnalyticsConsent = "granted" | "denied";

const CHANGE_EVENT = "spintra-analytics-consent-change";
let suppressed = false;

export function getAnalyticsConsent(): AnalyticsConsent | null {
  const stored = safeStorageGet(CONSENT_STORAGE_KEY);
  return stored === "granted" || stored === "denied" ? stored : null;
}

export function setAnalyticsConsent(choice: AnalyticsConsent): void {
  safeStorageSet(CONSENT_STORAGE_KEY, choice);
  if (choice === "denied") clearAnalyticsCookies();
  notify();
}

// While true (a Classroom room is open), analytics is off and the consent
// banner stays hidden.
export function setAnalyticsSuppressed(value: boolean): void {
  if (suppressed === value) return;
  suppressed = value;
  notify();
}

export function isAnalyticsSuppressed(): boolean {
  return suppressed;
}

export function analyticsAllowed(): boolean {
  return !suppressed && getAnalyticsConsent() === "granted";
}

// Fires for changes in this tab and, through the storage event, for a
// choice made in another tab (so turning analytics off in one tab stops it
// in the others too).
export function onAnalyticsConsentChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Google Analytics' own cookies (_ga, _ga_<id>). They're set on the site's
// registrable domain, so each candidate domain is tried.
function clearAnalyticsCookies(): void {
  if (typeof document === "undefined") return;
  const names = document.cookie
    .split(";")
    .map((part) => part.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name) && (name === "_ga" || name.startsWith("_ga_")));
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains = ["", host, ...parts.map((_, i) => "." + parts.slice(i).join(".")).filter((d) => d.split(".").length > 2)];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}
