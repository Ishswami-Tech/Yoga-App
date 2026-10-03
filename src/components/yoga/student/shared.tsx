"use client";
import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, AlertCircle, Inbox } from "lucide-react";
import { MembershipSummary } from "@/lib/store";

// --- Membership state badge -----------------------------------------------

export type MState = MembershipSummary["state"];

export function MembershipStateBadge({
  state,
  className,
}: {
  state: MState;
  className?: string;
}) {
  const map: Record<
    MState,
    { label: string; className: string }
  > = {
    ACTIVE: {
      label: "Active",
      className:
        "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    },
    PENDING: {
      label: "Pending",
      className:
        "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    EXPIRED: {
      label: "Expired",
      className:
        "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
    },
    HALTED: {
      label: "Halted",
      className:
        "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
    },
    CANCELLED: {
      label: "Cancelled",
      className:
        "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300",
    },
    NONE: {
      label: "None",
      className:
        "border-border bg-muted text-muted-foreground",
    },
  };
  const c = map[state] ?? map.NONE;
  return (
    <Badge variant="outline" className={`${c.className} ${className ?? ""}`}>
      {c.label}
    </Badge>
  );
}

// --- Generic loading / empty / error states -------------------------------

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-1/3" />
          <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin ml-auto" />
        </div>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${88 - i * 8}%` }}
          />
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
  tone = "default",
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
  tone?: "default" | "warm" | "calm";
}) {
  const toneClass =
    tone === "warm"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : tone === "calm"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "bg-muted text-muted-foreground";
  return (
    <Card className="border-dashed">
      <CardContent className="p-10 flex flex-col items-center text-center gap-4">
        <div className={`h-14 w-14 rounded-2xl grid place-items-center ${toneClass} animate-floaty`}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-base">{title}</p>
          {description && (
            <p className="text-sm text-muted-foreground max-w-sm">
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

// --- Small KV row used inside membership & profile cards --------------------

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
