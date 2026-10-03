"use client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  GraduationCap,
  RefreshCw,
  IndianRupee,
  CalendarDays,
  MessageCircle,
  Video,
  AlertTriangle,
  Sparkles,
  Zap,
  Send,
  RotateCcw,
  ArrowRight,
  Inbox,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
} from "lucide-react";
import { prettyTime, prettyDate, shortDate, formatINR } from "@/components/yoga/student/format";
import {
  PageHeader,
  StatusBadge,
  ErrorCard,
  EmptyState,
  Spinner,
  MonoText,
  istDateTime,
} from "./shared";

type DashboardData = {
  counts: {
    students: number;
    instructors: number;
    admins: number;
    activeSubs: number;
    payments: number;
    classesToday: number;
    whatsappToday: number;
    pendingMeets: number;
    failedMessages: number;
  };
  revenue: { totalMinor: number; currency: string };
  upcoming: Array<{
    id: string;
    date: string;
    startTime: string;
    scheduleName: string;
    status: string;
  }>;
  recentWebhooks: Array<{
    id: string;
    provider: string;
    eventId: string;
    eventType: string;
    status: string;
    createdAt: string;
  }>;
};

export function DashboardView() {
  const qc = useQueryClient();
  const q = useQuery<DashboardData>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => apiGet<DashboardData>("/api/admin/dashboard"),
    refetchInterval: 60 * 1000,
  });

  const runJob = useMutation({
    mutationFn: (job: "generate" | "remind" | "retry") =>
      apiPost<{ ok: boolean; job: string; result: unknown }>(
        `/api/admin/classes/generate?job=${job}`,
        {}
      ),
    onSuccess: (data, job) => {
      const msgs: Record<string, string> = {
        generate: "Classes generated for the look-ahead window",
        remind: "Reminder job dispatched",
        retry: "Retrying failed WhatsApp messages",
      };
      toast.success(`${job === "generate" ? "Generate" : job === "remind" ? "Remind" : "Retry"} complete`, {
        description: `${msgs[job]}. Result: ${JSON.stringify(data.result).slice(0, 120)}`,
      });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) => {
      toast.error("Worker job failed", { description: e.message });
    },
  });

  if (q.isLoading) return <DashboardSkeleton />;
  if (q.isError)
    return (
      <ErrorCard
        message={(q.error as ApiError)?.message ?? "Couldn't load admin dashboard."}
        onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "dashboard"] })}
      />
    );

  const data = q.data!;
  const c = data.counts;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin console"
        description="Live snapshot of the Prana Live Yoga platform."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin", "dashboard"] })}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {/* Hero card with revenue */}
      <Card className="relative overflow-hidden border-border/60">
        <div className="absolute inset-0 bg-brand-gradient opacity-95" />
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-warm-gradient opacity-30" />
        <CardContent className="relative p-6 md:p-8 text-primary-foreground">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Live operations · {data.upcoming.length} upcoming classes
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Total captured revenue
              </h2>
              <p className="text-primary-foreground/80 text-sm">
                {formatINR(data.revenue.totalMinor)} {data.revenue.currency} · across{" "}
                {c.payments} payment{c.payments === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button
                size="sm"
                className="bg-white text-emerald-700 hover:bg-white/90"
                onClick={() => runJob.mutate("generate")}
                disabled={runJob.isPending}
              >
                {runJob.isPending && runJob.variables === "generate" ? (
                  <Spinner />
                ) : (
                  <Zap className="h-4 w-4" />
                )}{" "}
                Generate next classes
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/15 text-primary-foreground hover:bg-white/25"
                onClick={() => runJob.mutate("remind")}
                disabled={runJob.isPending}
              >
                {runJob.isPending && runJob.variables === "remind" ? (
                  <Spinner />
                ) : (
                  <Send className="h-4 w-4" />
                )}{" "}
                Send reminders now
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/15 text-primary-foreground hover:bg-white/25"
                onClick={() => runJob.mutate("retry")}
                disabled={runJob.isPending}
              >
                {runJob.isPending && runJob.variables === "retry" ? (
                  <Spinner />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}{" "}
                Retry failed messages
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue forecast + CSV export */}
      <ForecastCard />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          iconBg="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          label="Students"
          value={c.students}
        />
        <KpiCard
          icon={<GraduationCap className="h-4 w-4" />}
          iconBg="bg-amber-500/15 text-amber-700 dark:text-amber-300"
          label="Instructors"
          value={c.instructors}
        />
        <KpiCard
          icon={<RefreshCw className="h-4 w-4" />}
          iconBg="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          label="Active subs"
          value={c.activeSubs}
        />
        <KpiCard
          icon={<IndianRupee className="h-4 w-4" />}
          iconBg="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          label="Revenue"
          value={formatINR(data.revenue.totalMinor)}
        />
        <KpiCard
          icon={<CalendarDays className="h-4 w-4" />}
          iconBg="bg-amber-500/15 text-amber-700 dark:text-amber-300"
          label="Classes today"
          value={c.classesToday}
        />
        <KpiCard
          icon={<MessageCircle className="h-4 w-4" />}
          iconBg="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          label="WhatsApp sent today"
          value={c.whatsappToday}
        />
        <KpiCard
          icon={<Video className="h-4 w-4" />}
          iconBg="bg-amber-500/15 text-amber-700 dark:text-amber-300"
          label="Pending Meets"
          value={c.pendingMeets}
          hint={c.pendingMeets > 0 ? "needs Google event" : undefined}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          iconBg="bg-rose-500/15 text-rose-700 dark:text-rose-300"
          label="Failed messages"
          value={c.failedMessages}
          hint={c.failedMessages > 0 ? "retry available" : undefined}
        />
      </div>

      {/* Upcoming + Webhooks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Upcoming classes</h2>
            <span className="text-xs text-muted-foreground">Next 7 days</span>
          </div>
          {data.upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming classes"
              description="No READY classes scheduled in the next 7 days. Run the worker to generate classes for the look-ahead window."
            />
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border/60">
                {data.upcoming.slice(0, 7).map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-secondary shrink-0">
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {shortDate(u.date).split(" ")[0]}
                        </span>
                        <span className="text-base font-semibold leading-none">
                          {shortDate(u.date).split(" ")[1]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.scheduleName}</p>
                        <p className="text-xs text-muted-foreground">
                          {prettyDate(u.date)} · {prettyTime(u.startTime)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Recent webhook events</h2>
            <span className="text-xs text-muted-foreground">Last 10</span>
          </div>
          {data.recentWebhooks.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No webhooks received yet"
              description="Razorpay & WhatsApp status callbacks will show up here as they arrive."
            />
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border/60">
                {data.recentWebhooks.slice(0, 10).map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs uppercase tracking-wide font-medium text-foreground/70">
                          {w.provider}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {w.eventType}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <MonoText>{w.eventId.slice(0, 24)}{w.eventId.length > 24 ? "…" : ""}</MonoText>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={w.status} />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {istDateTime(w.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      {/* Quick-link cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLinkCard label="Students" href="#admin-users" icon={<Users className="h-4 w-4" />} />
        <QuickLinkCard label="Schedules" href="#admin-schedules" icon={<CalendarDays className="h-4 w-4" />} />
        <QuickLinkCard label="Subscriptions" href="#admin-subscriptions" icon={<RefreshCw className="h-4 w-4" />} />
        <QuickLinkCard label="Settings" href="#admin-settings" icon={<Sparkles className="h-4 w-4" />} />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  iconBg,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className={`grid place-items-center h-7 w-7 rounded-md ${iconBg}`}>
            {icon}
          </span>
        </div>
        <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
        {hint && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function QuickLinkCard({
  label,
  href,
  icon,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        window.location.hash = href.slice(1);
      }}
      className="group"
    >
      <Card className="border-border/60 hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid place-items-center h-8 w-8 rounded-md bg-brand-gradient/10 text-primary shrink-0">
              {icon}
            </span>
            <p className="font-medium truncate">{label}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardContent>
      </Card>
    </a>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-1/2" />
      <Card className="relative overflow-hidden border-border/60">
        <CardContent className="p-8 space-y-4">
          <Skeleton className="h-6 w-1/2 bg-white/20" />
          <Skeleton className="h-9 w-2/3 bg-white/20" />
          <Skeleton className="h-5 w-1/2 bg-white/20" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-40" />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Revenue forecast card — shows MRR, 6-month average, trend, and a 3-month
// flat projection. Also exposes the "Export CSV" action for accounting.
type Forecast = {
  monthlyAverage: number;
  weightedAverage: number;
  trendSlope: number;
  mrr: number;
  trend: "up" | "down" | "flat";
  trendPct: number;
  lastMonthRevenue: number;
  historical: { month: string; revenue: number }[];
  projected: { month: string; projected: number }[];
  activeCount: number;
};

function ForecastCard() {
  const q = useQuery<Forecast>({
    queryKey: ["admin", "forecast"],
    queryFn: () => apiGet<Forecast>("/api/admin/dashboard/forecast"),
    refetchInterval: 60 * 1000,
  });

  const exportCsv = () => {
    window.open("/api/admin/analytics/csv", "_blank", "noopener,noreferrer");
    toast.success("Downloading analytics CSV", {
      description: "Opens in a new tab — 12 months of revenue + payments.",
    });
  };

  if (q.isLoading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }
  if (q.isError || !q.data) return null;
  const f = q.data;

  const TrendIcon =
    f.trend === "up" ? TrendingUp : f.trend === "down" ? TrendingDown : Minus;
  const trendColor =
    f.trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : f.trend === "down"
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground";

  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-gradient/10 grid place-items-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Revenue forecast
              </p>
              <p className="text-sm font-medium">Next 3 months · trend-aware projection</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* MRR */}
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              MRR (recurring)
            </p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatINR(f.mrr)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {f.activeCount} active × ₹500
            </p>
          </div>

          {/* Weighted average (trend-aware) */}
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Weighted avg (trend)
            </p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
              {formatINR(f.weightedAverage)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {f.trendSlope > 0 ? "+" : ""}
              {formatINR(f.trendSlope)}/mo slope
            </p>
          </div>

          {/* Trend */}
          <div className="rounded-xl bg-secondary/40 border border-border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Last vs prev month
            </p>
            <div className="flex items-center gap-1.5">
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              <span className={`text-xl font-bold ${trendColor}`}>
                {f.trendPct > 0 ? "+" : ""}
                {f.trendPct}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {formatINR(f.lastMonthRevenue)} last month
            </p>
          </div>

          {/* Projected total (trend-aware) */}
          <div className="rounded-xl bg-brand-gradient/10 border border-primary/20 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Projected (3 mo, trend)
            </p>
            <p className="text-xl font-bold text-brand-gradient">
              {formatINR(f.projected.reduce((a, p) => a + p.projected, 0))}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {f.projected.map((p) => `${p.month} ${formatINR(p.projected)}`).join(" · ")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
