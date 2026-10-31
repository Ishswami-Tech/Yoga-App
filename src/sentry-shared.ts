import type { ErrorEvent } from "@sentry/nextjs";

/** Sentry-compatible DSN (Temps error tracking). Unset => SDK stays disabled. */
export function resolveSentryDsn(): string | undefined {
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
}

/**
 * Shared init options. PHI-safe: no PII, no request bodies/cookies/headers,
 * no tracing (traces are exported through OpenTelemetry instead).
 */
export function baseSentryOptions() {
  const dsn = resolveSentryDsn();
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NODE_ENV,
    dataCollection: { userInfo: false, httpBodies: [] },
    tracesSampleRate: 0,
    beforeSend(event: ErrorEvent): ErrorEvent {
      const { request } = event;
      if (request) {
        delete request.data;
        delete request.cookies;
        delete request.headers;
        delete request.query_string;
      }
      if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
      return event;
    },
  };
}
