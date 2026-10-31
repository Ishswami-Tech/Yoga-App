import * as Sentry from "@sentry/nextjs";

// Client bundles only see NEXT_PUBLIC_* vars; disabled when unset.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  dataCollection: { userInfo: false, httpBodies: [] },
  tracesSampleRate: 0,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.query_string;
    }
    if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
