"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Flame,
  Trophy,
  CheckCircle2,
  CalendarCheck,
  Sparkles,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { prettyDate, prettyTime } from "./format";

type AttendanceSummary = {
  currentStreak: number;
  longestStreak: number;
  totalAttended: number;
  last30Days: number;
  attendedToday: boolean;
  recentAttendances: {
    id: string;
    classDate: string;
    classStartTime: string;
    scheduleName: string;
    markedAt: string;
  }[];
};

export function StreakCard() {
  const { setView } = useApp();
  const q = useQuery<AttendanceSummary>({
    queryKey: ["attendance"],
    queryFn: () => apiGet<AttendanceSummary>("/api/attendance"),
    refetchInterval: 60 * 1000,
  });

  if (q.isLoading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (q.isError || !q.data) return null;

  const a = q.data;
  const streakLabel =
    a.currentStreak === 0
      ? "Start your streak today"
      : a.currentStreak === 1
      ? "1 day streak"
      : `${a.currentStreak} day streak`;

  return (
    <Card className="relative overflow-hidden border-border/60">
      <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl" />
      <CardContent className="relative p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 grid place-items-center">
              <Flame className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Your practice
            </p>
          </div>
          {a.attendedToday && (
            <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Today
            </Badge>
          )}
        </div>

        {/* Big streak number */}
        <div className="flex items-end gap-3">
          <div>
            <p className="text-5xl font-bold tracking-tight text-brand-gradient leading-none">
              {a.currentStreak}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{streakLabel}</p>
          </div>
          <div className="flex-1 flex justify-end gap-4 text-right">
            <div>
              <div className="flex items-center gap-1 justify-end text-muted-foreground">
                <Trophy className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wide">Best</span>
              </div>
              <p className="text-lg font-bold tabular-nums">{a.longestStreak}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 justify-end text-muted-foreground">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wide">Total</span>
              </div>
              <p className="text-lg font-bold tabular-nums">{a.totalAttended}</p>
            </div>
          </div>
        </div>

        {/* Streak dots — last 7 class days */}
        <StreakDots summary={a} />

        {/* Recent */}
        {a.recentAttendances.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Recent
            </p>
            {a.recentAttendances.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                <span className="text-muted-foreground truncate flex-1">
                  {r.scheduleName}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {prettyDate(r.classDate).split(",")[0]},{" "}
                  {prettyTime(r.classStartTime)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="pt-2 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-primary hover:text-primary"
            onClick={() => setView("student-journal")}
          >
            View full journal <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// A row of 7 dots representing the last 7 class days. Filled = attended,
// hollow = missed, dimmed = no class that day.
function StreakDots({ summary }: { summary: AttendanceSummary }) {
  // We only have recentAttendances (up to 10). Build a simple 7-cell row
  // from the most recent 7 attendances, showing attended vs not.
  const recent = summary.recentAttendances.slice(0, 7);
  const cells = Array.from({ length: 7 }, (_, i) => {
    const idx = 6 - i; // rightmost = most recent
    const attended = idx < recent.length;
    return { attended, idx };
  });

  return (
    <div className="flex items-center gap-1.5">
      {cells.map((c) => (
        <div
          key={c.idx}
          className={`h-2.5 flex-1 rounded-full transition ${
            c.attended
              ? "bg-gradient-to-r from-amber-500 to-rose-500"
              : "bg-muted"
          }`}
          title={c.attended ? "Attended" : "No class / missed"}
        />
      ))}
    </div>
  );
}
