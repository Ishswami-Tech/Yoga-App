"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  CalendarOff,
  Info,
  Clock,
  Layers,
} from "lucide-react";
import {
  EmptyState,
  ErrorCard,
  ExceptionTypeBadge,
  KV,
  todayIST,
  todayISTWeekday,
} from "./shared";
import { prettyDate, prettyTime } from "@/components/yoga/student/format";

type ScheduleItem = {
  id: string;
  name: string;
  timezone: string;
  startTime: string;
  endTime: string;
  active: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  createdAt: string;
  _count: { classes: number; exceptions: number };
};

type SchedulesResponse = { items: ScheduleItem[] };

type ExceptionItem = {
  id: string;
  scheduleId: string;
  date: string;
  type: string; // NO_CLASS | SPECIAL
  reason: string | null;
  schedule: { name: string };
};

type ExceptionsResponse = { items: ExceptionItem[] };

const WEEKDAYS = [
  { key: "monday", short: "Mon", iso: 1 },
  { key: "tuesday", short: "Tue", iso: 2 },
  { key: "wednesday", short: "Wed", iso: 3 },
  { key: "thursday", short: "Thu", iso: 4 },
  { key: "friday", short: "Fri", iso: 5 },
  { key: "saturday", short: "Sat", iso: 6 },
  { key: "sunday", short: "Sun", iso: 0 },
] as const;

export function ScheduleView() {
  const qc = useQueryClient();
  const todayStr = todayIST();
  const todayWd = todayISTWeekday();

  const schedulesQ = useQuery<SchedulesResponse>({
    queryKey: ["admin", "schedules"],
    queryFn: () => apiGet<SchedulesResponse>("/api/admin/schedules"),
    retry: false,
  });

  const exceptionsQ = useQuery<ExceptionsResponse>({
    queryKey: ["admin", "exceptions"],
    queryFn: () => apiGet<ExceptionsResponse>("/api/admin/exceptions"),
    retry: false,
  });

  if (schedulesQ.isLoading || exceptionsQ.isLoading)
    return <ScheduleSkeleton />;
  if (schedulesQ.isError)
    return (
      <ErrorCard
        message={
          (schedulesQ.error as any)?.message ??
          "Couldn't load the weekly schedules."
        }
        onRetry={() =>
          qc.invalidateQueries({ queryKey: ["admin", "schedules"] })
        }
      />
    );
  if (exceptionsQ.isError)
    return (
      <ErrorCard
        message={
          (exceptionsQ.error as any)?.message ??
          "Couldn't load the holiday exceptions."
        }
        onRetry={() =>
          qc.invalidateQueries({ queryKey: ["admin", "exceptions"] })
        }
      />
    );

  const schedules = schedulesQ.data?.items ?? [];
  const exceptions = (exceptionsQ.data?.items ?? []).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
  const upcomingExceptions = exceptions.filter((e) => e.date >= todayStr);
  const pastExceptions = exceptions.filter((e) => e.date < todayStr);

  return (
    <div className="space-y-6">
      {/* Today header */}
      <Card className="border-border/60">
        <CardContent className="p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-gradient/10 grid place-items-center shrink-0">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Today (IST)
            </p>
            <p className="text-lg font-semibold tracking-tight">
              {prettyDate(todayStr)} · {prettyTime(currentTimeHHMM())} IST
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Schedules */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Recurring weekly schedules
            </h2>
            <p className="text-xs text-muted-foreground">
              {schedules.length === 1
                ? "1 schedule defined"
                : `${schedules.length} schedules defined`}{" "}
              · weekday chips show active practice days
            </p>
          </div>
        </div>

        {schedules.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No schedules defined yet"
            description="Once an admin defines a weekly recurring schedule, classes will be generated for each active weekday."
          />
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <ScheduleCard
                key={s.id}
                s={s}
                todayWd={todayWd}
              />
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Instructors can&apos;t edit schedules in this MVP. Ask an admin to
            change the weekly schedule or add holiday exceptions.
          </p>
        </div>
      </section>

      {/* Exceptions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Holiday &amp; special-day exceptions
            </h2>
            <p className="text-xs text-muted-foreground">
              {exceptions.length === 1
                ? "1 exception"
                : `${exceptions.length} exceptions`}{" "}
              · NO_CLASS cancels; SPECIAL keeps the class but flags it
            </p>
          </div>
        </div>

        {exceptions.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No exceptions defined"
            description="Add a NO_CLASS exception to cancel a class for a specific date (e.g. a public holiday)."
          />
        ) : (
          <div className="space-y-4">
            {upcomingExceptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Upcoming ({upcomingExceptions.length})
                </p>
                <div className="space-y-2">
                  {upcomingExceptions.map((e) => (
                    <ExceptionCard key={e.id} e={e} />
                  ))}
                </div>
              </div>
            )}
            {pastExceptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Past ({pastExceptions.length})
                </p>
                <div className="space-y-2">
                  {pastExceptions.map((e) => (
                    <ExceptionCard key={e.id} e={e} muted />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ScheduleCard({
  s,
  todayWd,
}: {
  s: ScheduleItem;
  todayWd: number;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold tracking-tight">{s.name}</p>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${
                  s.active
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.active ? "Active" : "Paused"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {s.timezone}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {prettyTime(s.startTime)} – {prettyTime(s.endTime)}
            </span>
          </div>
        </div>

        {/* Weekday chips */}
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const isOn = (s as any)[d.key] as boolean;
            const isToday = d.iso === todayWd;
            return (
              <span
                key={d.key}
                className={`inline-flex items-center justify-center min-w-[42px] rounded-md border px-2 py-1 text-[11px] font-medium ${
                  isOn
                    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-border bg-muted text-muted-foreground"
                } ${
                  isToday
                    ? "ring-2 ring-amber-500/60 ring-offset-1 ring-offset-background"
                    : ""
                }`}
                title={isToday ? "Today" : isOn ? "Active day" : "Inactive"}
              >
                {d.short}
                {isToday && (
                  <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400">
                    ●
                  </span>
                )}
              </span>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <KV label="Classes generated">
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              {s._count.classes}
            </span>
          </KV>
          <KV label="Exceptions">
            <span className="inline-flex items-center gap-1">
              <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
              {s._count.exceptions}
            </span>
          </KV>
          <KV label="Created">
            {new Date(s.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </KV>
        </div>
      </CardContent>
    </Card>
  );
}

function ExceptionCard({
  e,
  muted,
}: {
  e: ExceptionItem;
  muted?: boolean;
}) {
  return (
    <Card
      className={`border-border/60 ${muted ? "opacity-70" : ""}`}
    >
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${
              e.type === "NO_CLASS"
                ? "bg-rose-500/10"
                : "bg-amber-500/10"
            }`}
          >
            <CalendarOff
              className={`h-5 w-5 ${
                e.type === "NO_CLASS"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{prettyDate(e.date)}</p>
            <p className="text-sm text-muted-foreground truncate">
              {e.schedule.name}
              {e.reason ? ` · ${e.reason}` : ""}
            </p>
          </div>
        </div>
        <ExceptionTypeBadge type={e.type} />
      </CardContent>
    </Card>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-10 w-full rounded-full" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-4">
              <Skeleton className="h-5 w-1/3" />
              <div className="flex gap-1.5">
                {Array.from({ length: 7 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-12 rounded-md" />
                ))}
              </div>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Returns current IST HH:mm string for the "Today · HH:mm IST" header.
function currentTimeHHMM(): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const h = String(ist.getUTCHours()).padStart(2, "0");
  const m = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
