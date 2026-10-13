"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Flame,
  TrendingUp,
  CheckCircle2,
  Circle,
  Minus,
  ArrowLeft,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { ErrorCard, EmptyState } from "./shared";
import { prettyDate } from "./format";
import { Mandala } from "../art/sunrise";

type JournalDay = {
  date: string;
  attended: boolean;
  className: string | null;
  hadClass: boolean;
};

type JournalResp = {
  days: JournalDay[];
  stats: {
    attendedCount: number;
    classDaysCount: number;
    attendanceRate: number;
  };
};

const WD = ["S", "M", "T", "W", "T", "F", "S"];

export function JournalView() {
  const { setView } = useApp();
  const qc = useQueryClient();
  const q = useQuery<JournalResp>({
    queryKey: ["attendance", "journal"],
    queryFn: () => apiGet<JournalResp>("/api/attendance/journal"),
  });

  if (q.isLoading)
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  if (q.isError)
    return (
      <ErrorCard
        message={(q.error as any)?.message ?? "Couldn't load your journal."}
        onRetry={() => qc.invalidateQueries({ queryKey: ["attendance", "journal"] })}
      />
    );

  const data = q.data!;
  const { days, stats } = data;

  // Group days into weeks (columns of 7, oldest first). We pad the start so
  // the first day aligns to its weekday.
  const firstDay = days[0];
  const firstWeekday = firstDay
    ? new Date(firstDay.date).getUTCDay()
    : 0;
  const padded: (JournalDay | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...days,
  ];
  // Ensure we have full weeks.
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks: (JournalDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[13px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Attendance
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight">Journal</h1>
          <p className="text-sm text-muted-foreground">
            Your last 90 days of practice · attendance heatmap
          </p>
        </div>
        <Button variant="outline" className="min-h-11" onClick={() => setView("student-dashboard")}>
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-3xl shadow-soft">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" /> Attended
            </div>
            <p className="font-display text-3xl font-bold leading-none">{stats.attendedCount}</p>
            <p className="text-xs font-semibold text-muted-foreground">classes in 90 days</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-soft">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3 w-3" /> Scheduled
            </div>
            <p className="font-display text-3xl font-bold leading-none">{stats.classDaysCount}</p>
            <p className="text-xs font-semibold text-muted-foreground">class days</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-soft">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Rate
            </div>
            <p className="font-display text-3xl font-bold leading-none text-primary">
              {stats.attendanceRate}%
            </p>
            <p className="text-xs font-semibold text-muted-foreground">attendance rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="relative overflow-hidden rounded-3xl shadow-soft">
        <Mandala size={90} className="pointer-events-none absolute -right-7 -top-8 opacity-70" />
        <CardContent className="relative p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" /> 90-day heatmap
            </h2>
            <div className="flex items-center gap-3 text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-full bg-marigold" /> Attended
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-full bg-rose/70" /> Missed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-full bg-transparent border-2 border-input" /> No class
              </span>
            </div>
          </div>

          {/* Weekday labels + grid */}
          <div className="flex gap-2 overflow-x-auto scroll-soft pb-2">
            {/* Weekday column */}
            <div className="flex flex-col gap-1 shrink-0">
              {WD.map((d, i) => (
                <div
                  key={i}
                  className="h-5 w-3 text-[10px] font-bold text-muted-foreground grid place-items-center"
                >
                  {i % 2 === 1 ? d : ""}
                </div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1 shrink-0">
                {week.map((day, di) => {
                  if (!day) {
                    return (
                      <div
                        key={di}
                        className="h-5 w-5 rounded-full bg-transparent"
                      />
                    );
                  }
                  const cls = day.attended
                    ? "bg-marigold hover:bg-saffron"
                    : day.hadClass
                    ? "bg-rose/70 hover:bg-rose"
                    : "bg-transparent border-2 border-border hover:border-input";
                  return (
                    <div
                      key={di}
                      title={`${prettyDate(day.date)}${day.attended ? " · Attended" : day.hadClass ? " · Missed" : " · No class"}`}
                      className={`h-5 w-5 rounded-full transition cursor-default ${cls}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Month labels (approximate) */}
          <div className="flex gap-1 text-[10px] font-bold text-muted-foreground pl-6">
            {weeks.map((_, i) =>
              i % 4 === 0 ? (
                <span key={i} className="w-[28px] text-center">
                  {new Date(days[i * 7]?.date ?? Date.now())
                    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
                    .slice(0, 3)}
                </span>
              ) : (
                <span key={i} className="w-[28px]" />
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent attendances list */}
      <Card className="rounded-3xl shadow-soft">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-semibold">Recent practice</h2>
          {days.filter((d) => d.attended).length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No practice recorded yet"
              description="Attend your first class and ask your instructor to record it — it'll show up here."
              tone="calm"
            />
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto scroll-soft">
              {days
                .filter((d) => d.attended)
                .slice()
                .reverse()
                .slice(0, 20)
                .map((d) => (
                  <div
                    key={d.date}
                    className="flex items-center gap-3 p-2 min-h-11 rounded-2xl hover:bg-accent/30 transition"
                  >
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold truncate">
                        {d.className ?? "Yoga Class"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {prettyDate(d.date)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full border-transparent bg-success-soft text-success text-xs font-extrabold shrink-0"
                    >
                      Attended
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
