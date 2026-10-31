"use client";
import { TempsAnalyticsProvider } from "@temps-sdk/react-analytics";

// The /api/_temps path only exists when served by Temps, so analytics is
// disabled outside production builds. Session recording stays off (PHI).
export function TempsAnalytics({ children }: { children: React.ReactNode }) {
  return (
    <TempsAnalyticsProvider
      basePath="/api/_temps"
      disabled={process.env.NODE_ENV !== "production"}
      ignoreLocalhost
      enableSessionRecording={false}
    >
      {children}
    </TempsAnalyticsProvider>
  );
}
