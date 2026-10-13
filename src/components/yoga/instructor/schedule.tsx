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
  StatusChip,
  Eyebrow,
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
      <Card className="border-0 bg-gradient-to-br from-secondary to-accent rounded-[2rem] py-0">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-marigold text-ink grid place-items-center shrink-0">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <Eyebrow>Today (IST)</Eyebrow>
            <p className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
              {prettyDate(todayStr)} · {prettyTime(currentTimeHHMM())} IST
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Schedules */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
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

        <div className="flex items-start gap-2 rounded-2xl border-2 border-marigold bg-marigold/15 p-4 text-sm font-semibold text-foreground">
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
            <h2 className="font-display text-2xl font-semibold tracking-tight">
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
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
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
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
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
    <Card className="py-0">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-display text-xl font-semibold tracking-tight">{s.name}</p>
              <StatusChip tone={s.active ? "sage" : "neutral"}>
                {s.active ? "Active" : "Paused"}
              </StatusChip>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {s.timezone}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="inline-flex items-center gap-1 text-foreground">
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
                className={`inline-flex items-center justify-center min-w-[48px] min-h-9 rounded-full border-2 px-3 text-xs font-extrabold ${
                  isOn
                    ? "border-transparent bg-emerald-400 text-ink"
                    : "border-border bg-muted text-muted-foreground"
                } ${
                  isToday
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : ""
                }`}
                title={isToday ? "Today" : isOn ? "Active day" : "Inactive"}
              >
                {d.short}
                {isToday && (
                  <span className="ml-1 text-[9px] text-primary">
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
      className={`py-0 ${muted ? "opacity-70" : ""}`}
    >
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`h-11 w-11 rounded-full grid place-items-center shrink-0 text-ink ${
              e.type === "NO_CLASS" ? "bg-rose" : "bg-marigold"
            }`}
          >
            <CalendarOff
              className="h-5 w-5"
            />
          </div>
          <div className="min-w-0">
            <p className="font-bold">{prettyDate(e.date)}</p>
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
