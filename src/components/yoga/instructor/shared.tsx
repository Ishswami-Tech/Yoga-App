"use client";
// Shared UI helpers for the InstructorApp. Kept local so this task only
// touches files under src/components/yoga/instructor/. Reuses the format
// helpers from @/components/yoga/student/format where possible.

import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Inbox,
} from "lucide-react";

// --- Class status badge ---------------------------------------------------

export type ClassStatus =
  | "PENDING_MEET"
  | "READY"
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED";

const STATUS_MAP: Record<
  ClassStatus,
  { label: string; className: string; strike?: boolean }
> = {
  READY: {
    label: "Ready",
    className:
      "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  COMPLETED: {
    label: "Completed",
    className:
      "border-transparent bg-secondary text-secondary-foreground",
  },
  PENDING_MEET: {
    label: "Meet pending",
    className:
      "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  CANCELLED: {
    label: "Cancelled",
    strike: true,
    className:
      "border-transparent bg-muted text-muted-foreground line-through",
  },
  FAILED: {
    label: "Failed",
    className:
      "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
};

export function ClassStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = (STATUS_MAP as Record<string, (typeof STATUS_MAP)[ClassStatus]>)[
    status
  ] ?? {
    label: status ?? "Unknown",
    className: "border-border bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`${s.className} ${className ?? ""}`}>
      {s.label}
    </Badge>
  );
}

// --- Exception type badge -------------------------------------------------

export function ExceptionTypeBadge({ type }: { type: string }) {
  if (type === "SPECIAL") {
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300"
      >
        Special
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300"
    >
      No class
    </Badge>
  );
}

// --- Generic loading / empty / error states ------------------------------

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <Skeleton className="h-5 w-1/3" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
        <Skeleton className="h-9 w-32" />
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-10 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted grid place-items-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {description}
            </p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-rose-500/40">
      <CardContent className="p-6 flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-5 w-5" />
          <p className="font-medium">Something went wrong</p>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className ?? ""}`} />;
}

export function KV({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}

// --- IST helpers ----------------------------------------------------------
// India has no DST so the +05:30 offset is constant. We compute the IST
// "today" date string client-side using UTC parts so the browser's own
// timezone can never shift the day forward/back.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Returns "YYYY-MM-DD" for the current IST date. */
export function todayIST(): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(
    ist.getUTCDate()
  )}`;
}

/** Returns "HH:mm" (24h) for the current IST time. */
export function nowISTTime(): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  return `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

/** 0 = Sunday, 1 = Monday, ... 6 = Saturday for the current IST date. */
export function todayISTWeekday(): number {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  return ist.getUTCDay();
}
