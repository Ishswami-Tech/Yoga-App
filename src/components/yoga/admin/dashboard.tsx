"use client";
import { APP_NAME } from "@/lib/brand";
import { usePlan } from "@/hooks/use-plan";
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
import { prettyTime, prettyDate, formatINR } from "@/components/yoga/student/format";
import {
  PageHeader,
  StatusBadge,
  ErrorCard,
  EmptyState,
  Spinner,
  MonoText,
  KpiTile,
  istDate,
  istDateTime,
  todayIST,
} from "./shared";
import { HeaderSun, CornerSun } from "@/components/yoga/art/admin-art";

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

  const today = todayIST();
  const hourIST = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours();
  const greeting = hourIST < 12 ? "Good morning" : hourIST < 17 ? "Good afternoon" : "Good evening";
  const attention: string[] = [];
  if (c.failedMessages > 0)
    attention.push(
      `${c.failedMessages} WhatsApp message${c.failedMessages === 1 ? "" : "s"} failed to send`
    );
  if (c.pendingMeets > 0)
    attention.push(
      `${c.pendingMeets} class${c.pendingMeets === 1 ? " is" : "es are"} still waiting on a Google Meet link`
    );
  const jobBtn = (job: "generate" | "remind" | "retry", label: string, Icon: typeof Zap) => (
    <Button
      variant="outline"
      onClick={() => runJob.mutate(job)}
      disabled={runJob.isPending}
    >
      {runJob.isPending && runJob.variables === job ? <Spinner /> : <Icon className="h-4 w-4" />}{" "}
      {label}
    </Button>
  );

  return (
    <div className="space-y-8">
      <header className="relative flex flex-wrap items-end justify-between gap-4">
        <HeaderSun className="pointer-events-none absolute right-0 -top-3 hidden sm:block" />
        <div className="relative min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
            {istDate(new Date().toISOString())}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-[42px] font-semibold leading-[1.1] tracking-tight">
            {greeting}
          </h1>
          <p className="mt-1 text-[15px] font-semibold text-muted-foreground">
            Live snapshot of the {APP_NAME} platform · {data.upcoming.length} upcoming classes
          </p>
        </div>
        <div className="relative flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin", "dashboard"] })}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </header>

      {attention.length > 0 && (
        <section
          aria-label="Needs attention"
          className="flex flex-wrap items-center gap-4 rounded-3xl bg-[#F7C9B6] px-6 py-5 text-[#3B1F1A]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#3B1F1A]">
            <AlertTriangle className="h-5 w-5 text-[#F5A623]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 basis-72">
            <p className="font-display text-xl font-semibold">
              {attention.length === 1 ? "One thing needs you today" : "Two things need you today"}
            </p>
            <p className="mt-0.5 text-[15px] font-semibold leading-relaxed">
              {attention.join(", and ")}.
            </p>
          </div>
          {c.failedMessages > 0 && (
            <Button
              onClick={() => runJob.mutate("retry")}
              disabled={runJob.isPending}
            >
              <RotateCcw className="h-4 w-4" /> Retry failed messages
            </Button>
          )}
        </section>
      )}

      {/* KPI tiles */}
      <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <KpiTile label="Students" value={c.students} hint={`${c.instructors} instructors`} />
        <KpiTile label="Active subs" value={c.activeSubs} hint={`of ${c.students} students`} />
        <KpiTile
          tone="dark"
          label="Total revenue"
          value={formatINR(data.revenue.totalMinor)}
          hint={`${c.payments} captured payment${c.payments === 1 ? "" : "s"} · ${data.revenue.currency}`}
        />
        <KpiTile label="Classes today" value={c.classesToday} />
        <KpiTile label="WhatsApp sent today" value={c.whatsappToday} hint="class reminders" />
        <KpiTile
          tone="wait"
          label="Pending Meets"
          value={c.pendingMeets}
          hint={c.pendingMeets > 0 ? "needs Google event" : "all set"}
        />
        <KpiTile
          tone="bad"
          label="Failed messages"
          value={c.failedMessages}
          hint={c.failedMessages > 0 ? "retry available" : "none to retry"}
        />
      </section>

      {/* Revenue forecast + CSV export */}
      <ForecastCard />

      {/* Worker jobs */}
      <section aria-labelledby="worker-jobs" className="space-y-4">
        <h2 id="worker-jobs" className="font-display text-2xl font-semibold leading-tight tracking-tight">
          Run now
        </h2>
        <div className="flex flex-wrap gap-3">
          {jobBtn("generate", "Generate next classes", Zap)}
          {jobBtn("remind", "Send reminders now", Send)}
          {jobBtn("retry", "Retry failed messages", RotateCcw)}
        </div>
      </section>

      {/* Upcoming */}
      <section aria-labelledby="next-days" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="next-days" className="font-display text-2xl font-semibold leading-tight tracking-tight">
            Upcoming classes
          </h2>
          <span className="text-sm font-semibold text-muted-foreground">Next 7 days</span>
        </div>
        {data.upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming classes"
            description="No READY classes scheduled in the next 7 days. Run the worker to generate classes for the look-ahead window."
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
            {data.upcoming.slice(0, 7).map((u) => {
              const isToday = u.date === today;
              const pending = u.status === "PENDING_MEET";
              const ready = u.status === "READY";
              const tone = isToday && ready
                ? "bg-[#DCEBD8] text-[#244B2B]"
                : pending
                ? "bg-[#FBE3B0] text-[#5C3A00]"
                : "bg-card text-card-foreground border border-border/50";
              const eyebrowTone = isToday && ready || pending ? "" : "text-muted-foreground";
              return (
                <article
                  key={u.id}
                  className={`relative flex flex-col gap-2.5 overflow-hidden rounded-3xl p-5 shadow-soft ${tone}`}
                >
                  {isToday && ready && (
                    <CornerSun className="pointer-events-none absolute -right-4 -top-4" />
                  )}
                  <p className={`relative text-xs font-extrabold uppercase tracking-[0.08em] ${eyebrowTone}`}>
                    {isToday ? "Today" : prettyDate(u.date)}
                  </p>
                  <p className="relative font-display text-2xl font-semibold leading-tight">
                    {u.scheduleName}
                  </p>
                  <div className="relative">
                    <StatusBadge status={u.status} />
                  </div>
                  <p className="relative text-[15px] font-semibold leading-relaxed text-[#3B1F1A] dark:text-inherit">
                    {prettyTime(u.startTime)}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Webhooks */}
      <section aria-labelledby="webhooks" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="webhooks" className="font-display text-2xl font-semibold leading-tight tracking-tight">
            Recent webhook events
          </h2>
          <span className="text-sm font-semibold text-muted-foreground">Last 10</span>
        </div>
        {data.recentWebhooks.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No webhooks received yet"
            description="Razorpay & WhatsApp status callbacks will show up here as they arrive."
          />
        ) : (
          <ul className="m-0 list-none rounded-3xl border border-border/50 bg-card px-6 py-1.5 shadow-soft">
            {data.recentWebhooks.slice(0, 10).map((w, i) => (
              <li
                key={w.id}
                className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 ${
                  i > 0 ? "border-t-2 border-dotted border-border" : ""
                }`}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold">
                    <span className="mr-2 text-xs uppercase tracking-wide text-muted-foreground">
                      {w.provider}
                    </span>
                    {w.eventType}
                  </span>
                  <MonoText>
                    {w.eventId.slice(0, 24)}
                    {w.eventId.length > 24 ? "…" : ""}
                  </MonoText>
                </span>
                <span className="flex items-center gap-3">
                  <StatusBadge status={w.status} />
                  <span className="text-sm font-semibold text-muted-foreground">
                    {istDateTime(w.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick links */}
      <section aria-labelledby="quick-links" className="space-y-4">
        <h2 id="quick-links" className="font-display text-2xl font-semibold leading-tight tracking-tight">
          Quick links
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <QuickLinkCard label="Students" href="#admin-users" icon={<Users className="h-4 w-4" />} />
          <QuickLinkCard label="Schedules" href="#admin-schedules" icon={<CalendarDays className="h-4 w-4" />} />
          <QuickLinkCard label="Subscriptions" href="#admin-subscriptions" icon={<RefreshCw className="h-4 w-4" />} />
          <QuickLinkCard label="Settings" href="#admin-settings" icon={<Sparkles className="h-4 w-4" />} />
        </div>
      </section>
    </div>
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
      className="group block rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-foreground/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-full border-2 border-foreground/80 bg-transparent px-5 transition-colors group-hover:bg-accent">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
            {icon}
          </span>
          <p className="truncate font-extrabold">{label}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-foreground" />
      </div>
    </a>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-1/2 rounded-full" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-56 rounded-3xl" />
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
  const plan = usePlan();
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
    return <Skeleton className="h-48 rounded-3xl" />;
  }
  if (q.isError || !q.data) return null;
  const f = q.data;

  const TrendIcon =
    f.trend === "up" ? TrendingUp : f.trend === "down" ? TrendingDown : Minus;
  const trendColor =
    f.trend === "up"
      ? "text-success"
      : f.trend === "down"
      ? "text-[#7A2A10] dark:text-[#F7C9B6]"
      : "text-muted-foreground";

  return (
    <Card className="gap-5 p-6">
      <CardContent className="space-y-5 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
              Revenue forecast
            </p>
            <h2 className="font-display text-2xl font-semibold leading-tight">
              Next 3 months, trend-aware
            </h2>
          </div>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1 rounded-3xl bg-[#DCEBD8] p-4 text-[#244B2B]">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em]">MRR (recurring)</p>
            <p className="font-display text-3xl font-bold">{formatINR(f.mrr)}</p>
            <p className="text-sm font-semibold">
              {f.activeCount} active × {plan.display}
            </p>
          </div>

          <div className="space-y-1 rounded-3xl bg-[#FBE3B0] p-4 text-[#5C3A00]">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em]">Weighted avg (trend)</p>
            <p className="font-display text-3xl font-bold">{formatINR(f.weightedAverage)}</p>
            <p className="text-sm font-semibold">
              {f.trendSlope > 0 ? "+" : ""}
              {formatINR(f.trendSlope)}/mo slope
            </p>
          </div>

          <div className="space-y-1 rounded-3xl bg-secondary p-4 text-secondary-foreground">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
              Last vs prev month
            </p>
            <div className="flex items-center gap-1.5">
              <TrendIcon className={`h-5 w-5 ${trendColor}`} />
              <span className={`font-display text-3xl font-bold ${trendColor}`}>
                {f.trendPct > 0 ? "+" : ""}
                {f.trendPct}%
              </span>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              {formatINR(f.lastMonthRevenue)} last month
            </p>
          </div>

          <div className="space-y-1 rounded-3xl bg-[#3B1F1A] p-4 text-[#FFF4E0]">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#F7DCC8]">
              Projected (3 mo, trend)
            </p>
            <p className="font-display text-3xl font-bold text-[#F5A623]">
              {formatINR(f.projected.reduce((a, p) => a + p.projected, 0))}
            </p>
            <p className="text-sm font-semibold text-[#F7DCC8]">
              {f.projected.map((p) => `${p.month} ${formatINR(p.projected)}`).join(" · ")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
