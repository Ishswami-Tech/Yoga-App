"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChangelogToast } from "@/components/yoga/changelog-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Ping /api/health once on mount. This also has the side effect of
  // starting the in-app worker watchdog (idempotent) so the platform is
  // self-sufficient even without the external worker mini-service.
  useEffect(() => {
    fetch("/api/health").catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={client}>
      {children}
      <ChangelogToast />
    </QueryClientProvider>
  );
}
