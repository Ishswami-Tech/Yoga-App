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
  READY: "bg-chart-4",
  COMPLETED: "bg-foreground",
  PENDING_MEET: "bg-marigold",
  CANCELLED: "bg-primary",
  FAILED: "bg-primary",
};

const STATUS_CHIP: Record<string, string> = {
  READY: "bg-success-soft text-success",
  COMPLETED: "bg-secondary text-foreground",
  PENDING_MEET: "bg-marigold/40 text-foreground",
  CANCELLED: "bg-accent text-primary",
  FAILED: "bg-accent text-primary",
};

function dayTint(day: CalendarDay): string {
  if (day.exception?.type === "NO_CLASS") return "border-muted bg-muted";
  const sts = day.classes.map((c) => c.status);
  if (sts.length === 0) return "border-border bg-card";
  if (sts.some((x) => x === "FAILED" || x === "CANCELLED")) return "border-accent bg-accent";
  if (sts.some((x) => x === "PENDING_MEET")) return "border-marigold/40 bg-marigold/40";
  if (sts.every((x) => x === "COMPLETED")) return "border-secondary bg-secondary";
  return "border-success-soft bg-success-soft";
}

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
            <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["admin", "calendar"] })}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={goToday}>
              Today
            </Button>
          </>
        }
      />

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" aria-label="Previous month" className="h-12 w-12 rounded-full border-2 border-foreground bg-transparent" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-display text-2xl font-semibold">{q.data?.monthLabel ?? "…"}</p>
          <p className="text-sm font-semibold text-muted-foreground">{q.data?.schedules.length ?? 0} active schedule{(q.data?.schedules.length ?? 0) === 1 ? "" : "s"}</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Next month" className="h-12 w-12 rounded-full border-2 border-foreground bg-transparent" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      {q.data && q.data.schedules.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Status legend">
          {[
            ["Ready", "bg-success-soft", "bg-chart-4"],
            ["Completed", "bg-secondary", "bg-foreground"],
            ["Link not created yet", "bg-marigold/40", "bg-marigold"],
            ["No class", "bg-muted", "bg-transparent"],
            ["Cancelled", "bg-accent", "bg-primary"],
          ].map(([label, bg, dot]) => (
            <span
              key={label}
              className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3.5 text-[13px] font-extrabold text-foreground shadow-sm ${bg}`}
            >
              <span className={`h-3 w-3 rounded-full border-2 border-foreground ${dot}`} />
              {label}
            </span>
          ))}
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
        <Card className="overflow-hidden border-border/50 py-0">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-border/50 bg-secondary/50">
            {WD_LABELS.map((wd) => (
              <div
                key={wd}
                className="py-2.5 text-center text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground"
              >
                {wd}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1.5 p-2 sm:gap-2 sm:p-3">
            {q.data.days.map((day) => {
              const isToday = day.date === new Date().toISOString().slice(0, 10);
              const tint = dayTint(day);
              const interactive = day.classes.length > 0 || !!day.exception;
              return (
                <div
                  key={day.date}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={() => (interactive ? setSelectedDay(day) : null)}
                  onKeyDown={(e) => {
                    if (interactive && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setSelectedDay(day);
                    }
                  }}
                  className={`min-h-[72px] rounded-2xl border-2 p-1.5 transition sm:min-h-[96px] sm:p-2.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                    day.isInMonth ? tint : "border-transparent bg-muted/40 opacity-60"
                  } ${interactive ? "cursor-pointer" : "cursor-default"} ${
                    isToday ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`text-sm font-extrabold tabular-nums ${
                        day.isInMonth ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {day.day}
                    </span>
                    {day.exception && <CalendarOff className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  {day.exception && (
                    <div className="mb-1 truncate rounded-full bg-card/70 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                      {day.exception.type === "NO_CLASS" ? "No class" : "Special"}
                    </div>
                  )}
                  <div className="space-y-1">
                    {day.classes.map((c) => {
                      const dotColor = STATUS_COLORS[c.status] ?? "bg-muted";
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-foreground"
                          title={`${c.scheduleName} · ${c.startTime}-${c.endTime} · ${c.status === "PENDING_MEET" ? "Link not created yet (created automatically before class)" : c.status}`}
                        >
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 border-foreground ${dotColor}`} />
                          <span className="truncate">{c.startTime}</span>
                          {c.meetUrl && <Video className="h-3 w-3 shrink-0 text-success" aria-label="Meet link ready" />}
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
        <Card>
          <CardContent className="p-5">
            <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" /> Active schedules
            </h3>
            <div className="space-y-1.5">
              {q.data.schedules.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="font-semibold text-muted-foreground">{s.startTime}–{s.endTime}</span>
                  <div className="flex gap-0.5">
                    {s.weekdays.map((on, i) => (
                      <span
                        key={i}
                        className={`h-6 w-6 rounded-full text-[10px] font-bold grid place-items-center ${
                          on
                            ? "bg-success/20 text-success"
                            : "bg-muted text-muted-foreground"
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
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-xl">
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
              <div className="rounded-2xl bg-accent/50 border border-primary/30 p-3.5">
                <div className="flex items-center gap-2 text-primary">
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
                className="rounded-2xl border border-border bg-background p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Video className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {c.scheduleName}
                    </span>
                  </div>
                  <Badge
                    className={`border-transparent text-[11px] ${STATUS_CHIP[c.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {c.status === "PENDING_MEET" ? "Link not created yet" : c.status}
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
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-bold text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open Meet
                    </a>
                    <Button
                      variant="ghost"
                      className="h-11 w-11 rounded-full px-2" aria-label="Copy Meet link"
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
