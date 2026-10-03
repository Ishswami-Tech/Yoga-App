"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Video,
  CalendarOff,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  X,
  StickyNote,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ErrorCard } from "./shared";
import { prettyTime, prettyDate } from "@/components/yoga/student/format";

type CalendarDay = {
  date: string;
  day: number;
  isInMonth: boolean;
  weekday: number;
  classes: {
    id: string;
    scheduleName: string;
    scheduleId: string;
    startTime: string;
    endTime: string;
    status: string;
    meetUrl: string | null;
  }[];
  exception: { type: string; reason: string | null } | null;
};

type CalendarResp = {
  days: CalendarDay[];
  schedules: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    weekdays: boolean[];
  }[];
  monthLabel: string;
  year: number;
  month: number;
};

const WD_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS: Record<string, string> = {
  READY: "bg-emerald-500",
  COMPLETED: "bg-sky-500",
  PENDING_MEET: "bg-amber-500",
  CANCELLED: "bg-rose-400",
  FAILED: "bg-rose-600",
};

export function CalendarView() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const q = useQuery<CalendarResp>({
    queryKey: ["admin", "calendar", year, month],
    queryFn: () =>
      apiGet<CalendarResp>(`/api/admin/schedules/calendar?year=${year}&month=${month}`),
  });

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    setYear(now.getUTCFullYear());
    setMonth(now.getUTCMonth() + 1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schedule calendar"
        description="Month view of all classes, exceptions and Meet links."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin", "calendar"] })}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
          </>
        }
      />

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-lg font-semibold">{q.data?.monthLabel ?? "…"}</p>
          <p className="text-xs text-muted-foreground">{q.data?.schedules.length ?? 0} active schedule{(q.data?.schedules.length ?? 0) === 1 ? "" : "s"}</p>
        </div>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      {q.data && q.data.schedules.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Status:</span>
          <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1" /> Ready
          </Badge>
          <Badge className="border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px]">
            <span className="h-2 w-2 rounded-full bg-sky-500 mr-1" /> Completed
          </Badge>
          <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">
            <span className="h-2 w-2 rounded-full bg-amber-500 mr-1" /> Pending
          </Badge>
          <Badge className="border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px]">
            <span className="h-2 w-2 rounded-full bg-rose-400 mr-1" /> Cancelled
          </Badge>
        </div>
      )}

      {/* Calendar grid */}
      {q.isLoading ? (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 42 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : q.isError ? (
        <ErrorCard
          message={(q.error as ApiError)?.message ?? "Couldn't load calendar."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "calendar", year, month] })}
        />
      ) : q.data ? (
        <Card className="border-border/60 overflow-hidden">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-border/40 bg-secondary/30">
            {WD_LABELS.map((wd) => (
              <div
                key={wd}
                className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-2"
              >
                {wd}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-border/20">
            {q.data.days.map((day) => {
              const isToday = day.date === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={day.date}
                  onClick={() => day.classes.length > 0 || day.exception ? setSelectedDay(day) : null}
                  className={`min-h-[100px] p-1.5 transition cursor-pointer ${
                    day.isInMonth ? "bg-background hover:bg-accent/20" : "bg-muted/30 hover:bg-muted/50"
                  } ${isToday ? "ring-2 ring-primary/40 ring-inset" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        day.isInMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                      } ${isToday ? "text-primary font-bold" : ""}`}
                    >
                      {day.day}
                    </span>
                    {day.exception && (
                      <CalendarOff className="h-3 w-3 text-rose-500" />
                    )}
                  </div>
                  {/* Exception badge */}
                  {day.exception && (
                    <div className="rounded bg-rose-500/10 px-1 py-0.5 text-[9px] text-rose-700 dark:text-rose-300 mb-1 truncate">
                      {day.exception.type === "NO_CLASS" ? "No class" : "Special"}
                    </div>
                  )}
                  {/* Class chips */}
                  <div className="space-y-0.5">
                    {day.classes.map((c) => {
                      const dotColor = STATUS_COLORS[c.status] ?? "bg-muted";
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-1 rounded bg-secondary/60 px-1 py-0.5 text-[9px] hover:bg-secondary transition cursor-default group"
                          title={`${c.scheduleName} · ${c.startTime}-${c.endTime} · ${c.status}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${dotColor} shrink-0`} />
                          <span className="truncate text-muted-foreground">
                            {c.startTime}
                          </span>
                          {c.meetUrl && (
                            <span className="text-emerald-600 shrink-0">●</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Schedule legend */}
      {q.data && q.data.schedules.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" /> Active schedules
            </h3>
            <div className="space-y-1.5">
              {q.data.schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">{s.startTime}–{s.endTime}</span>
                  <div className="flex gap-0.5">
                    {s.weekdays.map((on, i) => (
                      <span
                        key={i}
                        className={`h-4 w-4 rounded text-[8px] grid place-items-center ${
                          on
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground/30"
                        }`}
                      >
                        {WD_LABELS[i][0]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day detail dialog */}
      <DayDetailDialog day={selectedDay} onClose={() => setSelectedDay(null)} />
    </div>
  );
}

function DayDetailDialog({
  day,
  onClose,
}: {
  day: CalendarDay | null;
  onClose: () => void;
}) {
  const copyMeet = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Meet link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <Dialog open={!!day} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {day ? prettyDate(day.date) : ""}
          </DialogTitle>
          <DialogDescription>
            {day && day.classes.length > 0
              ? `${day.classes.length} class${day.classes.length === 1 ? "" : "es"} scheduled`
              : day?.exception
              ? "No class — exception"
              : "No classes scheduled"}
          </DialogDescription>
        </DialogHeader>

        {day && (
          <div className="space-y-3">
            {/* Exception */}
            {day.exception && (
              <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <CalendarOff className="h-4 w-4" />
                  <span className="font-medium text-sm">
                    {day.exception.type === "NO_CLASS" ? "No class" : "Special day"}
                  </span>
                </div>
                {day.exception.reason && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {day.exception.reason}
                  </p>
                )}
              </div>
            )}

            {/* Classes */}
            {day.classes.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-border/60 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Video className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {c.scheduleName}
                    </span>
                  </div>
                  <Badge
                    className={`text-[10px] border-transparent ${
                      STATUS_COLORS[c.status] ? STATUS_COLORS[c.status].replace("bg-", "bg-") + "/15" : ""
                    } ${
                      c.status === "READY"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : c.status === "COMPLETED"
                        ? "text-sky-700 dark:text-sky-300"
                        : c.status === "CANCELLED"
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {c.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
                </div>
                {c.meetUrl && (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={c.meetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open Meet
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onClick={() => copyMeet(c.meetUrl!)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Empty state */}
            {day.classes.length === 0 && !day.exception && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No classes or exceptions for this day.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
