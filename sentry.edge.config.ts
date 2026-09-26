import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubRoomCodes } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Room codes are the key to a room; see src/lib/sentry-scrub.ts.
    beforeSend: scrubRoomCodes,
    beforeSendTransaction: scrubRoomCodes,
    beforeBreadcrumb: scrubBreadcrumb,
    debug: false,
  });
}
