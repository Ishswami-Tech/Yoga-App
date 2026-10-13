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
        "border-transparent bg-success-soft text-success font-extrabold",
    },
    PENDING: {
      label: "Pending",
      className:
        "border-transparent bg-marigold/30 text-foreground font-extrabold",
    },
    EXPIRED: {
      label: "Expired",
      className:
        "border-transparent bg-primary/15 text-primary font-extrabold",
    },
    HALTED: {
      label: "Halted",
      className:
        "border-transparent bg-primary/15 text-primary font-extrabold",
    },
    CANCELLED: {
      label: "Cancelled",
      className:
        "border-transparent bg-primary/15 text-primary font-extrabold",
    },
    NONE: {
      label: "None",
      className:
        "border-transparent bg-muted text-muted-foreground font-extrabold",
    },
  };
  const c = map[state] ?? map.NONE;
  return (
    <Badge variant="outline" className={`rounded-full px-3 py-1 ${c.className} ${className ?? ""}`}>
      {c.label}
    </Badge>
  );
}

// --- Generic loading / empty / error states -------------------------------

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="rounded-3xl shadow-soft">
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
      ? "bg-marigold/25 text-foreground"
      : tone === "calm"
      ? "bg-success-soft text-success"
      : "bg-rose/50 text-foreground";
  return (
    <Card className="rounded-3xl border-2 border-dashed shadow-none">
      <CardContent className="p-10 flex flex-col items-center text-center gap-4">
        <div className={`h-14 w-14 rounded-2xl grid place-items-center ${toneClass} animate-floaty`}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="font-display font-semibold text-xl">{title}</p>
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
    <Card className="rounded-3xl border-2 border-primary/40 shadow-soft">
      <CardContent className="p-6 flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 text-primary">
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
      <span className="text-muted-foreground font-semibold">{label}</span>
      <span className="font-extrabold text-right">{children}</span>
    </div>
  );
}
