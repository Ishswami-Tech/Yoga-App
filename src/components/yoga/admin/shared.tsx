"use client";
// Shared UI helpers for the AdminApp. Kept local so this task only touches
// files under src/components/yoga/admin/. Reuses the IST-safe format helpers
// from @/components/yoga/student/format.

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
  Check,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";

// --- Semantic status badge -----------------------------------------------
// Maps common statuses to brand-friendly colors:
//   emerald  -> ACTIVE/READY/SENT/DELIVERED/PROCESSED/CAPTURED
//   amber    -> PENDING/PENDING_MEET/PROCESSING
//   rose     -> FAILED/CANCELLED/HALTED/EXPIRED
//   muted    -> IGNORED/COMPLETED/REFUNDED

const STATUS_MAP: Record<
  string,
  { label?: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  READY: {
    label: "Ready",
    className: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  SENT: {
    label: "Sent",
    className: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  DELIVERED: {
    label: "Delivered",
    className: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  PROCESSED: {
    label: "Processed",
    className: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  CAPTURED: {
    label: "Captured",
    className: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  PENDING: {
    label: "Pending",
    className: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  PENDING_MEET: {
    label: "Meet pending",
    className: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  PROCESSING: {
    label: "Processing",
    className: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  FAILED: {
    label: "Failed",
    className: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  HALTED: {
    label: "Halted",
    className: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  EXPIRED: {
    label: "Expired",
    className: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  IGNORED: {
    label: "Ignored",
    className: "border-border bg-muted text-muted-foreground",
  },
  COMPLETED: {
    label: "Completed",
    className: "border-border bg-muted text-muted-foreground",
  },
  REFUNDED: {
    label: "Refunded",
    className: "border-border bg-muted text-muted-foreground",
  },
  DISABLED: {
    label: "Disabled",
    className: "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) {
    return (
      <Badge variant="outline" className={className}>
        —
      </Badge>
    );
  }
  const c =
    STATUS_MAP[status] ?? {
      className: "border-border bg-muted text-muted-foreground",
    };
  return (
    <Badge variant="outline" className={`${c.className} ${className ?? ""}`}>
      {c.label ?? status}
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

// --- Role badge ------------------------------------------------------------

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    ADMIN: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    INSTRUCTOR:
      "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    STUDENT:
      "border-transparent bg-secondary text-secondary-foreground",
  };
  return (
    <Badge variant="outline" className={map[role] ?? ""}>
      {role}
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

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
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

// --- KV + SectionHeader helpers ------------------------------------------

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

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// --- Copyable mono text ---------------------------------------------------

export function MonoText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <code
      className={`font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded ${className ?? ""}`}
    >
      {children}
    </code>
  );
}

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      aria-label={label}
    >
      {done ? (
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  );
}

// Hide / reveal password-style secrets toggle for long IDs
export function RevealText({
  text,
  max = 18,
  className,
}: {
  text: string;
  max?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!text) return <span className="text-muted-foreground">—</span>;
  const truncated = text.length > max && !open ? `${text.slice(0, max)}…` : text;
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={`inline-flex items-center gap-1 font-mono text-[11px] hover:text-primary ${className ?? ""}`}
      title={text}
    >
      {truncated}
      {text.length > max &&
        (open ? (
          <EyeOff className="h-3 w-3 text-muted-foreground" />
        ) : (
          <Eye className="h-3 w-3 text-muted-foreground" />
        ))}
    </button>
  );
}

// --- IST timestamp helper (ISO -> "Mon, 22 Sep 2025 07:00 IST") ----------

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function istDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  return `${WD[ist.getUTCDay()]}, ${ist.getUTCDate()} ${MO[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

export function istTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  let h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const ampm = h < 12 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${pad(m)} ${ampm} IST`;
}

export function istDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${istDate(iso)} · ${istTime(iso)}`;
}

export function todayIST(): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(
    ist.getUTCDate()
  )}`;
}
