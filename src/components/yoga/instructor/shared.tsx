"use client";
// Shared UI helpers for the InstructorApp. Kept local so this task only
// touches files under src/components/yoga/instructor/. Reuses the format
// helpers from @/components/yoga/student/format where possible.

import { ReactNode } from "react";
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

// Sunrise chip tones: sage = good, marigold = waiting, terracotta = problem.
export type ChipTone = "sage" | "marigold" | "terracotta" | "neutral";

const CHIP_TONES: Record<ChipTone, string> = {
  sage: "bg-emerald-400 text-ink dark:bg-emerald-400 dark:text-ink",
  marigold: "bg-marigold text-ink",
  terracotta: "bg-rose text-ink",
  neutral: "bg-secondary text-secondary-foreground",
};

/** Pill status chip (min 28px tall) used across the instructor workspace. */
export function StatusChip({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: ChipTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-xs font-extrabold [&>svg]:size-3.5 ${CHIP_TONES[tone]} ${className ?? ""}`}
    >
      {icon}
      {children}
    </span>
  );
}

/** Small uppercase eyebrow label. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

/** Page heading: eyebrow + Fraunces title + optional subtitle. */
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

const STATUS_MAP: Record<ClassStatus, { label: string; tone: ChipTone; strike?: boolean }> = {
  READY: { label: "Ready", tone: "sage" },
  COMPLETED: { label: "Completed", tone: "neutral" },
  PENDING_MEET: { label: "Link not created yet", tone: "marigold" },
  CANCELLED: { label: "Cancelled", tone: "neutral", strike: true },
  FAILED: { label: "Failed", tone: "terracotta" },
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
  ] ?? { label: status ?? "Unknown", tone: "neutral" as ChipTone };
  return (
    <StatusChip
      tone={s.tone}
      className={`${s.strike ? "line-through" : ""} ${className ?? ""}`}
    >
      {s.label}
    </StatusChip>
  );
}

// --- Exception type badge -------------------------------------------------

export function ExceptionTypeBadge({ type }: { type: string }) {
  if (type === "SPECIAL") {
    return <StatusChip tone="marigold">Special</StatusChip>;
  }
  return <StatusChip tone="terracotta">No class</StatusChip>;
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
    <Card className="border-dashed border-2 border-border bg-card/70">
      <CardContent className="p-10 flex flex-col items-center text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-secondary grid place-items-center">
          <Icon className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <p className="font-display text-xl font-semibold">{title}</p>
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
    <Card className="border-2 border-destructive/40" role="alert">
      <CardContent className="p-6 flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="font-display text-lg font-semibold">Something went wrong</p>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
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
      <span className="font-bold text-right">{children}</span>
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
