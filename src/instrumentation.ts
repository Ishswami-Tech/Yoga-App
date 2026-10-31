import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Optional telemetry: a failure here must never block the app.
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    try {
      // Traces (no request bodies are recorded by default).
      const { registerOTel } = await import("@vercel/otel");
      registerOTel({ serviceName: "vishwayog" });
    } catch (error) {
      console.warn("[otel] tracing disabled:", error instanceof Error ? error.message : error);
    }
  }

  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config");
    }
  } catch (error) {
    console.warn("[sentry] disabled:", error instanceof Error ? error.message : error);
  }
}

export const onRequestError = Sentry.captureRequestError;
