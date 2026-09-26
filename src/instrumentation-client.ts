import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubRoomCodes } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Error and performance monitoring only. It keeps the site working, so it
// isn't behind the analytics choice, and the privacy policy says what it
// sends. No session replay: the replay integration is not installed (the
// replay sample-rate options that used to be here never had any effect
// without it), no personal data (IP address, cookies) is attached, and room
// codes are scrubbed (src/lib/sentry-scrub.ts).
if (dsn) {
  Sentry.init({
    dsn,
    // 10% of page loads and navigations, for performance monitoring.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrubRoomCodes,
    beforeSendTransaction: scrubRoomCodes,
    beforeBreadcrumb: scrubBreadcrumb,
    debug: false,
  });
}
