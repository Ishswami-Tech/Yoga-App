"use client";
import { usePlan } from "@/hooks/use-plan";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IndianRupee,
  TrendingUp,
  Users,
  Video,
  MessageCircle,
  RefreshCw,
  Activity,
  Percent,
  Inbox,
  Download,
  Trophy,
  Star,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { formatINR } from "@/components/yoga/student/format";
import { PageHeader, ErrorCard, EmptyState } from "./shared";

type Analytics = {
  revenue: {
    monthly: { month: string; revenue: number; fees: number; net: number; count: number }[];
    totalMinor: number;
    totalFeesMinor: number;
    netMinor: number;
    currency: string;
  };
  subscriptions: {
    distribution: { status: string; count: number }[];
    active: number;
    totalStudents: number;
    penetration: number;
  };
  classes: {
    statusDistribution: { status: string; count: number }[];
    totalLast30Days: number;
  };
  whatsapp: {
    delivery: { status: string; count: number }[];
    deliveryRatePct: number;
    totalLast30Days: number;
  };
  dailyClasses: { date: string; count: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#5E8A5A",
  PENDING: "#F5A623",
  HALTED: "#C65D3B",
  CANCELLED: "#A8806F",
  EXPIRED: "#5A372E",
  FAILED: "#B8461F",
  CREATED: "#E8833A",
};
const CLASS_STATUS_COLORS: Record<string, string> = {
  READY: "#5E8A5A",
  COMPLETED: "#3B1F1A",
  PENDING_MEET: "#F5A623",
  CANCELLED: "#A8806F",
  FAILED: "#B8461F",
};
const WA_COLORS: Record<string, string> = {
  DELIVERED: "#5E8A5A",
  SENT: "#3B1F1A",
  READ: "#B8461F",
  FAILED: "#C65D3B",
  QUEUED: "#F5A623",
};

export function AnalyticsView() {
  const plan = usePlan();
  const qc = useQueryClient();
  const q = useQuery<Analytics>({
    queryKey: ["admin", "analytics"],
    queryFn: () => apiGet<Analytics>("/api/admin/analytics"),
    refetchInterval: 60 * 1000,
  });

  if (q.isLoading) return <AnalyticsSkeleton />;
  if (q.isError)
    return (
      <ErrorCard
        message={(q.error as ApiError)?.message ?? "Couldn't load analytics."}
        onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "analytics"] })}
      />
    );
  if (!q.data) return <EmptyState icon={Inbox} title="No analytics data yet" />;

  const a = q.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Revenue, retention, class utilisation & WhatsApp delivery — last 6 months."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin", "analytics"] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.open("/api/admin/analytics/csv", "_blank", "noopener,noreferrer");
              }}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<IndianRupee className="h-5 w-5" />}
          label="Total revenue"
          value={formatINR(a.revenue.totalMinor)}
          sub={`${a.revenue.currency} · captured`}
          tone="emerald"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Net (after fees)"
          value={formatINR(a.revenue.netMinor)}
          sub={`Fees: ${formatINR(a.revenue.totalFeesMinor)}`}
          tone="amber"
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Active members"
          value={String(a.subscriptions.active)}
          sub={`${a.subscriptions.penetration}% of ${a.subscriptions.totalStudents} students`}
          tone="emerald"
        />
        <KpiCard
          icon={<MessageCircle className="h-5 w-5" />}
          label="WhatsApp delivery"
          value={`${a.whatsapp.deliveryRatePct}%`}
          sub={`${a.whatsapp.totalLast30Days} msgs · 30 days`}
          tone="emerald"
        />
      </div>

      {/* Revenue area chart */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" /> Monthly revenue
              </h3>
              <p className="text-xs text-muted-foreground">
                Captured payments grouped by month · last 6 months
              </p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Activity className="h-3 w-3" /> {a.revenue.monthly.reduce((s, m) => s + m.count, 0)} payments
            </Badge>
          </div>
          {a.revenue.monthly.every((m) => m.revenue === 0) ? (
            <EmptyState
              icon={IndianRupee}
              title="No captured payments yet"
              description={`Revenue will appear here once the first ${plan.display} membership payment lands.`}
            />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={a.revenue.monthly} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5E8A5A" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#5E8A5A" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5A623" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F5A623" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBCDB8" opacity={0.4} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#5A372E" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#5A372E"
                  tickFormatter={(v) => `₹${Math.round(v / 100)}`}
                />
                <Tooltip
                  formatter={(v: number) => formatINR(v)}
                  contentStyle={{ borderRadius: 16, background: "#FFFBF2", color: "#3B1F1A", border: "1px solid #EBCDB8", fontSize: 13 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#5E8A5A"
                  strokeWidth={2}
                  fill="url(#rev)"
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#F5A623"
                  strokeWidth={2}
                  fill="url(#net)"
                  name="Net"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Two-column: subscription pie + class status bar */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" /> Subscription states
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Current distribution across all students
            </p>
            {a.subscriptions.distribution.length === 0 ? (
              <EmptyState icon={Users} title="No subscriptions" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={a.subscriptions.distribution}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {a.subscriptions.distribution.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? "#A8806F"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 16, background: "#FFFBF2", color: "#3B1F1A", border: "1px solid #EBCDB8", fontSize: 13 }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <Video className="h-4 w-4 text-primary" /> Class status (30 days)
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {a.classes.totalLast30Days} classes generated
            </p>
            {a.classes.statusDistribution.length === 0 ? (
              <EmptyState icon={Video} title="No classes in the last 30 days" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={a.classes.statusDistribution} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBCDB8" opacity={0.4} />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} stroke="#5A372E" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#5A372E" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, background: "#FFFBF2", color: "#3B1F1A", border: "1px solid #EBCDB8", fontSize: 13 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {a.classes.statusDistribution.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={CLASS_STATUS_COLORS[entry.status] ?? "#A8806F"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily classes + WhatsApp delivery */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" /> Daily classes generated
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Last 14 days</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={a.dailyClasses} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBCDB8" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  stroke="#5A372E"
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#5A372E" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 16, background: "#FFFBF2", color: "#3B1F1A", border: "1px solid #EBCDB8", fontSize: 13 }}
                />
                <Bar dataKey="count" fill="#5E8A5A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp delivery
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {a.whatsapp.totalLast30Days} messages · last 30 days
            </p>
            {a.whatsapp.delivery.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No WhatsApp messages sent yet" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-24 w-24 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="#EBCDB8"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="#5E8A5A"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(a.whatsapp.deliveryRatePct / 100) * 97.4} 97.4`}
                      />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="text-xl font-bold">{a.whatsapp.deliveryRatePct}%</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {a.whatsapp.delivery.map((d) => (
                      <div key={d.status} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: WA_COLORS[d.status] ?? "#A8806F" }}
                          />
                          {d.status}
                        </span>
                        <span className="font-medium tabular-nums">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Penetration callout */}
      <Card className="border-primary/30 bg-accent/40">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary grid place-items-center shrink-0">
            <Percent className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">Membership penetration</p>
            <p className="text-sm text-muted-foreground">
              {a.subscriptions.active} of {a.subscriptions.totalStudents} students have an active
              membership — that&apos;s {a.subscriptions.penetration}% conversion. Aim for 60%+.
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl font-semibold text-primary">
              {a.subscriptions.penetration}%
            </p>
            <p className="text-xs text-muted-foreground">active / total students</p>
          </div>
        </CardContent>
      </Card>

      {/* Revenue leaderboard */}
      <RevenueLeaderboard />

      {/* Retention cohorts */}
      <RetentionCohorts />

      {/* Feedback summary */}
      <AdminFeedbackSummary />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-success-soft text-success"
      : tone === "amber"
      ? "bg-marigold/30 text-foreground"
      : "bg-accent text-primary";
  return (
    <Card>
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
            {label}
          </p>
          <div className={`h-10 w-10 rounded-full grid place-items-center ${toneClass}`}>
            {icon}
          </div>
        </div>
        <p className="font-display text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs font-semibold text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-[220px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

type LeaderboardItem = {
  rank: number;
  userId: string;
  name: string;
  email: string;
  totalRevenue: number;
  paymentCount: number;
  attendanceCount: number;
  joinedAt: string | null;
};

type LeaderboardResp = {
  items: LeaderboardItem[];
  totalStudents: number;
  totalRevenue: number;
};

const RANK_STYLES = [
  "bg-marigold text-foreground", // 1st - gold
  "bg-secondary text-foreground", // 2nd - silver
  "bg-accent text-foreground", // 3rd - bronze
];

function RevenueLeaderboard() {
  const q = useQuery<LeaderboardResp>({
    queryKey: ["admin", "analytics", "leaderboard"],
    queryFn: () => apiGet<LeaderboardResp>("/api/admin/analytics/leaderboard"),
  });

  if (q.isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (q.isError || !q.data || q.data.items.length === 0) return null;

  const items = q.data.items;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-marigold" /> Revenue leaderboard
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Top {items.length} students by total captured revenue
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {q.data.totalStudents} paying students
          </Badge>
        </div>

        {/* Podium for top 3 */}
        {items.length >= 3 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[1, 0, 2].map((idx) => {
              const item = items[idx];
              const style = RANK_STYLES[idx];
              const heights = ["h-20", "h-24", "h-16"];
              return (
                <div key={item.userId} className="flex flex-col items-center justify-end">
                  <div className={`rounded-xl ${style} ${heights[idx]} w-full flex flex-col items-center justify-center p-2 shadow-soft`}>
                    <span className="text-lg font-bold">{item.rank}</span>
                    <span className="text-xs font-bold truncate w-full text-center">{item.name.split(" ")[0]}</span>
                    <span className="text-xs font-semibold">{formatINR(item.totalRevenue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full leaderboard */}
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.userId}
              className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-accent/30 transition border border-border/60"
            >
              <div
                className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                  item.rank <= 3
                    ? RANK_STYLES[item.rank - 1]
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {item.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.paymentCount} payment{item.paymentCount === 1 ? "" : "s"} · {item.attendanceCount} attended
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm text-success">
                  {formatINR(item.totalRevenue)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type RetentionResp = {
  cohorts: {
    active: { count: number; students: { id: string; name: string; email: string; lastClass: string | null; daysSince: number | null }[] };
    engaged: { count: number; students: any[] };
    atRisk: { count: number; students: any[] };
    churning: { count: number; students: any[] };
    churned: { count: number; students: any[] };
  };
  total: number;
  retained: number;
  retentionRate: number;
};

const COHORT_CONFIG = [
  { key: "active", label: "Active", desc: "Last 3 days", color: "bg-success", text: "text-success", bg: "bg-success-soft" },
  { key: "engaged", label: "Engaged", desc: "Last 7 days", color: "bg-chart-4", text: "text-success", bg: "bg-success-soft" },
  { key: "atRisk", label: "At risk", desc: "7-14 days", color: "bg-marigold", text: "text-foreground", bg: "bg-marigold/20" },
  { key: "churning", label: "Churning", desc: "14-30 days", color: "bg-saffron", text: "text-primary", bg: "bg-accent" },
  { key: "churned", label: "Churned", desc: "30+ days", color: "bg-primary", text: "text-primary", bg: "bg-accent" },
] as const;

function RetentionCohorts() {
  const q = useQuery<RetentionResp>({
    queryKey: ["admin", "analytics", "retention"],
    queryFn: () => apiGet<RetentionResp>("/api/admin/analytics/retention"),
  });

  if (q.isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (q.isError || !q.data) return null;

  const data = q.data;
  const maxCount = Math.max(...COHORT_CONFIG.map((c) => data.cohorts[c.key].count), 1);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Retention cohorts
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.total} students · {data.retentionRate}% retained (active + engaged)
            </p>
          </div>
          <Badge
            className={`border-transparent text-xs ${
              data.retentionRate >= 60
                ? "bg-success-soft text-success"
                : data.retentionRate >= 30
                ? "bg-marigold/30 text-foreground"
                : "bg-accent text-primary"
            }`}
          >
            {data.retentionRate}% retention
          </Badge>
        </div>

        {/* Cohort bars */}
        <div className="space-y-2">
          {COHORT_CONFIG.map((c) => {
            const cohort = data.cohorts[c.key];
            const width = (cohort.count / maxCount) * 100;
            return (
              <div key={c.key} className="flex items-center gap-3">
                <div className="w-20 text-right shrink-0">
                  <p className="text-xs font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
                <div className="flex-1 h-7 rounded-full bg-muted overflow-hidden relative">
                  <div
                    className={`h-full ${c.color} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                    style={{ width: `${Math.max(width, cohort.count > 0 ? 8 : 0)}%` }}
                  >
                    {cohort.count > 0 && (
                      <span className={`text-xs font-extrabold ${c.key === "active" || c.key === "churned" ? "text-white" : "text-foreground"}`}>
                        {cohort.count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* At-risk students list */}
        {data.cohorts.atRisk.students.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <p className="text-xs font-semibold text-foreground">
              Students at risk of churning:
            </p>
            {data.cohorts.atRisk.students.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">
                  Last class: {s.daysSince}d ago
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type AdminFeedbackResp = {
  summary: { totalCount: number; avgRating: number; hasFeedback: boolean };
  distribution: { star: number; count: number }[];
  bySchedule: { scheduleName: string; avgRating: number; count: number }[];
  recentComments: { id: string; rating: number; comment: string; className: string; classDate: string; createdAt: string }[];
  monthsTrend: { month: string; avgRating: number; count: number }[];
};

function AdminFeedbackSummary() {
  const q = useQuery<AdminFeedbackResp>({
    queryKey: ["admin", "analytics", "feedback"],
    queryFn: () => apiGet<AdminFeedbackResp>("/api/admin/analytics/feedback"),
  });

  if (q.isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (q.isError || !q.data || !q.data.summary.hasFeedback) return null;

  const { summary, distribution, bySchedule, recentComments } = q.data;
  const maxDist = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-marigold" /> Class feedback
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.totalCount} rating{summary.totalCount === 1 ? "" : "s"} across all classes
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <span className="text-3xl font-bold text-marigold">{summary.avgRating}</span>
              <Star className="h-5 w-5 fill-marigold text-marigold" />
            </div>
            <p className="text-xs text-muted-foreground">average</p>
          </div>
        </div>

        {/* Distribution */}
        <div className="space-y-1">
          {distribution.slice().reverse().map((d) => (
            <div key={d.star} className="flex items-center gap-2 text-xs">
              <span className="w-8 text-right text-muted-foreground flex items-center gap-0.5 justify-end">
                {d.star} <Star className="h-3 w-3 fill-marigold text-marigold" />
              </span>
              <div className="flex-1 h-4 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full bg-marigold rounded-full transition-all"
                  style={{ width: `${(d.count / maxDist) * 100}%` }}
                />
              </div>
              <span className="w-6 text-muted-foreground tabular-nums">{d.count}</span>
            </div>
          ))}
        </div>

        {/* Recent comments */}
        {recentComments.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <p className="text-xs font-semibold">Recent comments:</p>
            {recentComments.map((c) => (
              <div key={c.id} className="text-xs text-muted-foreground">
                <span className="text-marigold font-medium">{c.rating}★</span>{" "}
                {c.comment}{" "}
                <span className="text-muted-foreground/60">— {c.className}</span>
              </div>
            ))}
          </div>
        )}

        {/* Rating trend (6 months) */}
        {q.data.monthsTrend && q.data.monthsTrend.some((m) => m.count > 0) && (
          <div className="pt-2 border-t border-border/40">
            <p className="text-xs font-semibold mb-2">Rating trend (6 months)</p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={q.data.monthsTrend} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="ratingTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5A623" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#F5A623" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBCDB8" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#5A372E" />
                <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} stroke="#5A372E" />
                <Tooltip
                  formatter={(v: number) => [`${v} ★`, "Avg rating"]}
                  contentStyle={{ borderRadius: 16, background: "#FFFBF2", color: "#3B1F1A", border: "1px solid #EBCDB8", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="avgRating"
                  stroke="#F5A623"
                  strokeWidth={2}
                  fill="url(#ratingTrend)"
                  name="Avg rating"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
