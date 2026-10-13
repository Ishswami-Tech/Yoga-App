"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  CheckCircle2,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { DarkRings, StreakSun } from "@/components/yoga/art/sunrise";
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
    <Card className="relative overflow-hidden rounded-[2rem] border-0 bg-[#3B1F1A] text-white shadow-lift">
      <DarkRings className="pointer-events-none absolute -left-24 -top-20" />
      <CardContent className="relative p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#FFE4C4]">
            Your practice
          </p>
          {a.attendedToday && (
            <Badge className="border-transparent bg-[#DCEBD8] text-[#2F5A36] gap-1">
              <CheckCircle2 className="h-3 w-3" /> Today
            </Badge>
          )}
        </div>

        {/* Sun emblem with streak number */}
        <div className="flex items-center gap-4">
          <StreakSun size={104}>{a.currentStreak}</StreakSun>
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold leading-tight">{streakLabel}</p>
            <p className="mt-1 text-sm font-semibold text-[#FFE4C4]">
              {a.currentStreak === 0
                ? "One class begins it."
                : `Tomorrow makes ${a.currentStreak + 1}.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-[#FFF4E0]/10 px-1.5 py-2 text-center">
            <p className="font-display text-2xl font-bold leading-tight tabular-nums">{a.longestStreak}</p>
            <p className="flex items-center justify-center gap-1 text-xs font-bold text-[#FFE4C4]">
              <Trophy className="h-3 w-3" /> Best
            </p>
          </div>
          <div className="rounded-2xl bg-[#FFF4E0]/10 px-1.5 py-2 text-center">
            <p className="font-display text-2xl font-bold leading-tight tabular-nums">{a.last30Days}</p>
            <p className="text-xs font-bold text-[#FFE4C4]">Last 30 days</p>
          </div>
          <div className="rounded-2xl bg-[#FFF4E0]/10 px-1.5 py-2 text-center">
            <p className="font-display text-2xl font-bold leading-tight tabular-nums">{a.totalAttended}</p>
            <p className="flex items-center justify-center gap-1 text-xs font-bold text-[#FFE4C4]">
              <CalendarCheck className="h-3 w-3" /> Total
            </p>
          </div>
        </div>

        {/* Streak dots - last 7 class days */}
        <StreakDots summary={a} />

        {/* Recent */}
        {a.recentAttendances.length > 0 && (
          <div className="pt-2 border-t border-[#FFF4E0]/20 space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#FFE4C4]">
              Recent
            </p>
            {a.recentAttendances.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3 w-3 text-[#F5A623] shrink-0" />
                <span className="text-[#FFF4E0] truncate flex-1">
                  {r.scheduleName}
                </span>
                <span className="text-[#FFE4C4] tabular-nums">
                  {prettyDate(r.classDate).split(",")[0]},{" "}
                  {prettyTime(r.classStartTime)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="pt-2 border-t border-[#FFF4E0]/20">
          <Button
            variant="ghost"
            size="sm"
            className="w-full min-h-11 text-white hover:bg-[#FFF4E0]/10 hover:text-white"
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
          className={`h-3 flex-1 rounded-full transition ${
            c.attended ? "bg-[#F5A623]" : "border-2 border-dashed border-[#C65D3B] bg-transparent"
          }`}
          title={c.attended ? "Attended" : "No class / missed"}
        />
      ))}
    </div>
  );
}
