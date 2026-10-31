import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/sentry-shared";

// Tracing is handled by @vercel/otel (see instrumentation.ts); don't let
// Sentry install a second OpenTelemetry provider.
Sentry.init({ ...baseSentryOptions(), enableOpenTelemetrySetup: false });
