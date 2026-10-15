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

// Sunrise Sadhana status chips (sage / marigold / terracotta / neutral).
// All pairs are >= 4.5:1 in light and dark.
export const CHIP_BASE = "min-h-7 px-3 py-0.5 text-[13px] font-extrabold";
export const CHIP_OK = `${CHIP_BASE} border-transparent bg-[#DCEBD8] text-[#244B2B] dark:bg-[#2F5A36]/60 dark:text-[#DCEBD8]`;
export const CHIP_WAIT = `${CHIP_BASE} border-transparent bg-[#FBE3B0] text-[#5C3A00] dark:bg-[#F5A623]/25 dark:text-[#FBE3B0]`;
export const CHIP_BAD = `${CHIP_BASE} border-transparent bg-[#F7C9B6] text-[#7A2A10] dark:bg-[#E8792B]/25 dark:text-[#F7C9B6]`;
export const CHIP_NEU = `${CHIP_BASE} border-transparent bg-[#F3E3CF] text-[#5A372E] dark:bg-muted dark:text-muted-foreground`;

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
    className: CHIP_OK,
  },
  READY: {
    label: "Ready",
    className: CHIP_OK,
  },
  SENT: {
    label: "Sent",
    className: CHIP_OK,
  },
  DELIVERED: {
    label: "Delivered",
    className: CHIP_OK,
  },
  PROCESSED: {
    label: "Processed",
    className: CHIP_OK,
  },
  CAPTURED: {
    label: "Captured",
    className: CHIP_OK,
  },
  PENDING: {
    label: "Pending",
    className: CHIP_WAIT,
  },
  PENDING_MEET: {
    label: "Link not created yet",
    className: CHIP_WAIT,
  },
  PROCESSING: {
    label: "Processing",
    className: CHIP_WAIT,
  },
  FAILED: {
    label: "Failed",
    className: CHIP_BAD,
  },
  CANCELLED: {
    label: "Cancelled",
    className: CHIP_BAD,
  },
  HALTED: {
    label: "Halted",
    className: CHIP_BAD,
  },
  EXPIRED: {
    label: "Expired",
    className: CHIP_BAD,
  },
  IGNORED: {
    label: "Ignored",
    className: CHIP_NEU,
  },
  RETRIED: {
    label: "Retried",
    className: CHIP_NEU,
  },
  COMPLETED: {
    label: "Completed",
    className: CHIP_NEU,
  },
  REFUNDED: {
    label: "Refunded",
    className: CHIP_NEU,
  },
  DISABLED: {
    label: "Disabled",
    className: CHIP_BAD,
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
      className: CHIP_NEU,
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
        className={CHIP_WAIT}
      >
        Special
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={CHIP_BAD}
    >
      No class
    </Badge>
  );
}

// --- Role badge ------------------------------------------------------------

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    ADMIN: CHIP_WAIT,
    INSTRUCTOR:
      CHIP_OK,
    STUDENT:
      CHIP_NEU,
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
    <Card className="border-dashed border-2 border-border">
      <CardContent className="p-10 flex flex-col items-center text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-secondary grid place-items-center">
          <Icon className="h-6 w-6 text-foreground/70" />
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
    <Card className="border-[#7A2A10]/40 bg-[#FCE6DB] dark:bg-[#E8792B]/10">
      <CardContent className="p-6 flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 text-[#7A2A10] dark:text-[#F7C9B6]">
          <AlertCircle className="h-5 w-5" />
          <p className="font-display text-lg font-semibold">Something went wrong</p>
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
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] font-semibold text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// --- KPI tile (dashboard / subscriptions / payments) ----------------------
export function KpiTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "dark" | "wait" | "bad" | "ok";
}) {
  const wrap = {
    default: "bg-card text-card-foreground border border-border/50",
    dark: "bg-[#3B1F1A] text-[#FFF4E0]",
    wait: "bg-[#FBE3B0] text-[#5C3A00]",
    bad: "bg-[#F7C9B6] text-[#7A2A10]",
    ok: "bg-[#DCEBD8] text-[#244B2B]",
  }[tone];
  const sub = {
    default: "text-muted-foreground",
    dark: "text-[#F7DCC8]",
    wait: "text-[#5C3A00]",
    bad: "text-[#7A2A10]",
    ok: "text-[#244B2B]",
  }[tone];
  return (
    <div className={`rounded-3xl p-5 shadow-soft min-w-0 ${wrap}`}>
      <p className={`text-xs font-extrabold uppercase tracking-[0.08em] ${sub}`}>{label}</p>
      <p
        className={`font-display text-4xl sm:text-[44px] font-bold leading-[1.1] mt-2 truncate ${
          tone === "dark" ? "text-[#F5A623]" : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className={`text-sm font-semibold mt-0.5 ${sub}`}>{hint}</p>}
    </div>
  );
}

// --- Dark-selected filter chip -------------------------------------------
export function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-extrabold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-foreground/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        active
          ? "bg-[#3B1F1A] text-[#FFF4E0] dark:bg-[#FFF4E0] dark:text-[#3B1F1A]"
          : "bg-card text-foreground border-2 border-border hover:bg-secondary"
      }`}
    >
      {children}
      {count !== undefined && <span className="opacity-80">{count}</span>}
    </button>
  );
}

// Table skin shared by admin lists (header band + dotted row dividers).
export const TH_CLASS =
  "bg-secondary text-foreground text-[13px] font-extrabold uppercase tracking-[0.06em] h-12 px-4";

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
      className={`font-mono text-xs font-semibold bg-secondary text-foreground/80 px-2 py-0.5 rounded-full ${className ?? ""}`}
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
        <Check className="h-3.5 w-3.5 text-success" />
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
      className={`inline-flex min-h-6 items-center gap-1 font-mono text-xs font-semibold hover:text-primary ${className ?? ""}`}
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
