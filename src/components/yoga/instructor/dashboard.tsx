"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { apiGet, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Video,
  Play,
  ArrowRight,
  Bell,
  CalendarDays,
  History as HistoryIcon,
  Sunrise,
  Moon,
  ExternalLink,
  Copy,
  CheckCircle2,
  Loader2,
  UserCheck,
  StickyNote,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  ClassStatusBadge,
  EmptyState,
  ErrorCard,
  StatusChip,
  Eyebrow,
} from "./shared";
import { HeaderSun } from "@/components/yoga/art/instructor-art";
import { DarkRings, SunFan } from "@/components/yoga/art/sunrise";
import {
  greeting,
  prettyTime,
  prettyDate,
  shortDate,
  classPhase,
  relativeToStart,
} from "@/components/yoga/student/format";
import { ClassCountdown } from "@/components/yoga/student/class-countdown";
import { AttendancePickerDialog } from "./attendance-picker";
import { NotesEditorDialog } from "./notes-editor";
import { FeedbackSummaryCard } from "./feedback-summary";
import { todayIST } from "./shared";

type ClassItem = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  scheduleName: string;
  meetUrl: string | null;
  reminderSentAt?: string | null;
  /** Scheduled WhatsApp reminder time (ISO). Shown when the API provides it. */
  reminderAt?: string | null;
};

type RosterPreview = {
  roster: {
    userId: string;
    studentName: string;
    studentEmail: string;
    attended: boolean;
  }[];
  attendedCount: number;
  totalActive: number;
};

function istClock(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

type InstructorClasses = {
  today: ClassItem[];
  upcoming: ClassItem[];
  history: ClassItem[];
};

export function DashboardView() {
  const { user, setView } = useApp();
  const qc = useQueryClient();

  const q = useQuery<InstructorClasses>({
    queryKey: ["instructor", "classes"],
    queryFn: () => apiGet<InstructorClasses>("/api/instructor/classes"),
    retry: false,
    refetchInterval: 60 * 1000,
  });

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const todayStr = todayIST();
  const [attendanceFor, setAttendanceFor] = useState<ClassItem | null>(null);

  if (q.isLoading) return <DashboardSkeleton />;
  if (q.isError)
    return (
      <ErrorCard
        message={
          (q.error as any)?.message ??
          "Couldn't load your classes right now."
        }
        onRetry={() =>
          qc.invalidateQueries({ queryKey: ["instructor", "classes"] })
        }
      />
    );

  const data = q.data ?? { today: [], upcoming: [], history: [] };
  const todayClasses = data.today;
  const firstToday = todayClasses[0];
  const upcomingThisWeek = data.upcoming
    .filter((c) => withinNext7Days(c.date, todayStr))
    .slice(0, 5);
  const last7 = data.history.filter((c) =>
    withinLast7Days(c.date, todayStr)
  );

  return (
    <div className="space-y-6">
      <DashboardHero
        firstName={firstName}
        todayStr={todayStr}
        todayClass={firstToday}
        onOpenAttendance={() => firstToday && setAttendanceFor(firstToday)}
        onViewSchedule={() => setView("instructor-schedule")}
      />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          tone="sage"
          icon={<Sunrise className="h-4 w-4" />}
          label="Today"
          value={todayClasses.length}
          hint={todayClasses.length === 1 ? "class" : "classes"}
        />
        <StatCard
          tone="marigold"
          icon={<CalendarDays className="h-4 w-4" />}
          label="Next 7 days"
          value={upcomingThisWeek.length}
          hint={upcomingThisWeek.length === 1 ? "class" : "classes"}
        />
        <StatCard
          tone="terracotta"
          icon={<HistoryIcon className="h-4 w-4" />}
          label="Last 7 days"
          value={last7.length}
          hint={last7.length === 1 ? "class" : "classes"}
        />
      </div>

      {/* Today's classes list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Today&apos;s classes
            </h2>
            <p className="text-xs text-muted-foreground">
              {prettyDate(todayStr)} · IST
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("instructor-schedule")}
          >
            View schedule <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {todayClasses.length === 0 ? (
          <EmptyState
            icon={Moon}
            title="Rest day — no classes scheduled today"
            description="Either today is a holiday exception, the weekly schedule doesn't include today, or your class has already been cancelled."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("instructor-schedule")}
              >
                <CalendarDays className="h-4 w-4" /> See weekly schedule
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {todayClasses.map((c) => (
              <TodayRow
                key={c.id}
                c={c}
                onOpenAttendance={() => setAttendanceFor(c)}
                onOpenMeet={(url) => {
                  window.open(url, "_blank", "noopener,noreferrer");
                  toast.success("Opening Google Meet in a new tab");
                }}
                onCopyMeet={(url) => {
                  navigator.clipboard
                    .writeText(url)
                    .then(() => toast.success("Meet link copied"))
                    .catch(() => toast.error("Couldn't copy link"));
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming this week preview */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Upcoming this week
            </h2>
            <p className="text-xs text-muted-foreground">
              Next 7 days · top 5
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("instructor-history")}
          >
            Recent history <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {upcomingThisWeek.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No classes in the next 7 days"
            description="The weekly schedule may be paused, or every day has a NO_CLASS exception."
          />
        ) : (
          <Card className="py-2">
            <CardContent className="p-0 px-2 divide-y-2 divide-dotted divide-border">
              {upcomingThisWeek.map((c) => (
                <UpcomingRow key={c.id} c={c} />
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Feedback summary */}
      <FeedbackSummaryCard />

      {attendanceFor && (
        <AttendancePickerDialog
          classId={attendanceFor.id}
          open={!!attendanceFor}
          onOpenChange={(o) => !o && setAttendanceFor(null)}
          classLabel={
            attendanceFor.scheduleName +
            " · " +
            prettyDate(attendanceFor.date) +
            " " +
            prettyTime(attendanceFor.startTime)
          }
        />
      )}
    </div>
  );
}

function DashboardHero({
  firstName,
  todayStr,
  todayClass,
  onOpenAttendance,
  onViewSchedule,
}: {
  firstName: string;
  todayStr: string;
  todayClass?: ClassItem;
  onOpenAttendance: () => void;
  onViewSchedule: () => void;
}) {
  const rel = todayClass
    ? relativeToStart(todayClass.date, todayClass.startTime)
    : null;
  const isLive = rel?.phase === "live";
  const Icon = isLive ? Sunrise : Moon;

  return (
    <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-secondary to-accent px-6 py-7 md:px-9 md:py-8 shadow-soft">
      <HeaderSun className="absolute right-0 bottom-0 hidden sm:block h-auto w-48 md:w-60" />
      <div className="relative space-y-3 sm:pr-48 md:pr-56">
        <Eyebrow>Teaching · {prettyDate(todayStr)}</Eyebrow>
        <h2 className="font-display text-4xl md:text-5xl font-semibold leading-[1.08] text-foreground">
          {greeting()}, {firstName}.
        </h2>
        <p className="text-foreground/90 text-base max-w-md">
          {todayClass ? (
            <>
              Your class today is{" "}
              <span className="font-extrabold">{todayClass.scheduleName}</span>{" "}
              at {prettyTime(todayClass.startTime)} —{" "}
              {prettyTime(todayClass.endTime)}.
            </>
          ) : (
            "No class scheduled today — a gentle rest day."
          )}
        </p>
        {rel && todayClass && (
          <div className="flex items-center gap-2 flex-wrap">
            {isLive ? (
              <StatusChip
                tone="sage"
                icon={<span className="h-2 w-2 rounded-full bg-ink animate-pulse" />}
              >
                Live now
              </StatusChip>
            ) : (
              <StatusChip tone="marigold" icon={<Icon />}>
                {rel.label}
              </StatusChip>
            )}
          </div>
        )}
        <div className="pt-1">
          {todayClass ? (
            <Button size="lg" className="h-12 px-7" onClick={onOpenAttendance}>
              <UserCheck className="h-5 w-5" /> Open attendance
            </Button>
          ) : (
            <Button size="lg" className="h-12 px-7" onClick={onViewSchedule}>
              See weekly schedule <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

const ON_INK = "text-[#FFF4E0]";
const INK_OUTLINE =
  "bg-transparent border-2 border-[#FFF4E0] text-[#FFF4E0] hover:bg-[#FFF4E0]/15 hover:text-[#FFF4E0] dark:bg-transparent dark:border-[#FFF4E0] dark:hover:bg-[#FFF4E0]/15";

function TodayRow({
  c,
  onOpenMeet,
  onCopyMeet,
  onOpenAttendance,
}: {
  c: ClassItem;
  onOpenMeet: (url: string) => void;
  onCopyMeet: (url: string) => void;
  onOpenAttendance: () => void;
}) {
  const qc = useQueryClient();
  const phase = classPhase(c.date, c.startTime, c.endTime);
  const isCompleted = c.status === "COMPLETED";
  const isCancelled = c.status === "CANCELLED";
  const [notesOpen, setNotesOpen] = useState(false);

  const rosterQ = useQuery<RosterPreview>({
    queryKey: ["attendance", "roster", c.id],
    queryFn: () => apiGet<RosterPreview>(`/api/instructor/classes/${c.id}/attendance`),
    enabled: !isCancelled,
    retry: false,
  });

  const completeMut = useMutation({
    mutationFn: () => apiPost(`/api/admin/classes/${c.id}/complete`),
    onSuccess: () => {
      toast.success("Class marked as completed");
      qc.invalidateQueries({ queryKey: ["instructor", "classes"] });
      qc.invalidateQueries({ queryKey: ["admin", "classes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't complete class"),
  });

  const reminderTime = istClock(c.reminderAt);
  const sentTime = istClock(c.reminderSentAt);
  const actionable = !isCompleted && !isCancelled;

  return (
    <>
      <section
        aria-label={`${c.scheduleName} class`}
        className={`relative overflow-hidden rounded-[2.5rem] bg-ink ${ON_INK} p-6 md:p-8 flex flex-col gap-5 shadow-lift`}
      >
        <SunFan
          size={300}
          className="absolute -right-20 -top-24 opacity-30 pointer-events-none"
        />
        <DarkRings
          size={260}
          className="absolute -left-24 -bottom-24 pointer-events-none"
        />

        <div className="relative flex items-center gap-3 flex-wrap">
          <ClassStatusBadge status={c.status} />
          <span className="font-bold text-base">
            {prettyTime(c.startTime)} – {prettyTime(c.endTime)} IST
          </span>
          {actionable && (
            <span className="rounded-full bg-[#FFF4E0] px-3 py-1 text-ink">
              <ClassCountdown
                date={c.date}
                startTime={c.startTime}
                endTime={c.endTime}
                variant="minimal"
              />
            </span>
          )}
        </div>

        <h3 className="relative font-display text-4xl md:text-5xl font-semibold leading-[1.05]">
          {c.scheduleName}
        </h3>

        {/* Meet link + automatic status chips */}
        <div className="relative flex flex-wrap items-end gap-3">
          <div className="flex-1 basis-72 min-w-0 max-w-lg">
            <label
              htmlFor={`meet-${c.id}`}
              className="block text-sm font-bold mb-2"
            >
              Google Meet link
            </label>
            <input
              id={`meet-${c.id}`}
              type="text"
              readOnly
              value={c.meetUrl ?? ""}
              placeholder="Being created automatically…"
              className="h-14 w-full rounded-[1.25rem] border-2 border-[#FFF4E0] bg-[#FFF4E0] px-4 text-base font-bold text-ink placeholder:text-ink/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-marigold"
            />
          </div>
          {c.meetUrl ? (
            <>
              <Button
                size="lg"
                variant="outline"
                className={`h-14 px-6 ${INK_OUTLINE}`}
                onClick={() => onCopyMeet(c.meetUrl!)}
                aria-label="Copy Meet link"
              >
                <Copy className="h-5 w-5" /> Copy link
              </Button>
              <Button
                size="lg"
                className="h-14 px-7 bg-marigold text-ink hover:bg-marigold/90 shadow-none"
                onClick={() => onOpenMeet(c.meetUrl!)}
                disabled={phase === "ended" && c.status !== "READY"}
              >
                <Play className="h-5 w-5" />{" "}
                {phase === "live" ? "Open Meet" : "Start class"}
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              variant="outline"
              className={`h-14 px-6 ${INK_OUTLINE}`}
              disabled
            >
              <ExternalLink className="h-5 w-5" /> No link yet
            </Button>
          )}
        </div>

        <div
          className="relative flex flex-wrap gap-2.5"
          aria-label="Automatic status"
        >
          {c.meetUrl ? (
            <StatusChip tone="sage" icon={<Check />} className="min-h-8 text-[13px]">
              Meet link created automatically
            </StatusChip>
          ) : c.status === "FAILED" ? (
            <StatusChip tone="terracotta" className="min-h-8 text-[13px]">
              Meet link could not be created
            </StatusChip>
          ) : (
            <StatusChip tone="marigold" icon={<Clock />} className="min-h-8 text-[13px]">
              Meet link will be created automatically
            </StatusChip>
          )}
          {c.reminderSentAt ? (
            <StatusChip tone="sage" icon={<Bell />} className="min-h-8 text-[13px]">
              WhatsApp reminder sent{sentTime ? ` at ${sentTime}` : ""}
            </StatusChip>
          ) : isCancelled ? (
            <StatusChip tone="neutral" icon={<Bell />} className="min-h-8 text-[13px]">
              No reminder (class cancelled)
            </StatusChip>
          ) : (
            <StatusChip tone="marigold" icon={<Clock />} className="min-h-8 text-[13px]">
              WhatsApp reminder sends automatically
              {reminderTime ? ` at ${reminderTime}` : ""}
            </StatusChip>
          )}
        </div>

        {/* Attendance preview: students list stays front and centre */}
        {!isCancelled && (
          <div className="relative rounded-[1.75rem] bg-card text-card-foreground p-5 md:p-6 space-y-3 shadow-soft">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Eyebrow>Today&apos;s students</Eyebrow>
              <span className="text-sm font-bold text-muted-foreground">
                {rosterQ.data
                  ? `${rosterQ.data.attendedCount} of ${rosterQ.data.totalActive} marked present`
                  : rosterQ.isLoading
                  ? "Loading…"
                  : ""}
              </span>
            </div>
            {rosterQ.data && rosterQ.data.roster.length > 0 && (
              <ul className="flex flex-col">
                {rosterQ.data.roster.slice(0, 5).map((r, i) => (
                  <li
                    key={r.userId}
                    className="flex items-center gap-3 py-2.5 border-t-2 border-dotted border-border first:border-t-0"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-10 w-10 shrink-0 rounded-full grid place-items-center font-display font-bold text-sm text-ink ${
                        ["bg-marigold", "bg-saffron", "bg-emerald-400", "bg-rose"][i % 4]
                      }`}
                    >
                      {r.studentName
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-bold">
                      {r.studentName}
                    </span>
                    {r.attended ? (
                      <StatusChip tone="sage" icon={<Check />}>
                        Present
                      </StatusChip>
                    ) : (
                      <StatusChip tone="neutral">Not marked</StatusChip>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {rosterQ.data && rosterQ.data.roster.length > 5 && (
              <p className="text-sm text-muted-foreground">
                + {rosterQ.data.roster.length - 5} more students
              </p>
            )}
            {actionable && (
              <Button size="lg" className="w-full sm:w-auto" onClick={onOpenAttendance}>
                <UserCheck className="h-5 w-5" /> Mark present / absent
              </Button>
            )}
          </div>
        )}

        {actionable && (
          <div className="relative flex flex-wrap gap-2 pt-1 border-t-2 border-dotted border-[#FFF4E0]/35">
            <Button
              variant="outline"
              className={`mt-4 ${INK_OUTLINE}`}
              onClick={() => setNotesOpen(true)}
              title="Edit class notes for attendees"
            >
              <StickyNote className="h-4 w-4" />
              Notes
            </Button>
            <Button
              variant="outline"
              className={`mt-4 ${INK_OUTLINE}`}
              onClick={onOpenAttendance}
              title="Open the per-student attendance picker"
            >
              <UserCheck className="h-4 w-4" />
              Attendance
            </Button>
            <Button
              variant="outline"
              className={`mt-4 ${INK_OUTLINE}`}
              disabled={completeMut.isPending}
              onClick={() => completeMut.mutate()}
              title="Mark this class as completed once the live session ends"
            >
              {completeMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Complete
            </Button>
          </div>
        )}
      </section>
      {notesOpen && (
        <NotesEditorDialog
          classId={c.id}
          open={notesOpen}
          onOpenChange={setNotesOpen}
          classLabel={c.scheduleName + " · " + prettyDate(c.date) + " " + prettyTime(c.startTime)}
        />
      )}
    </>
  );
}

function UpcomingRow({ c }: { c: ClassItem }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col items-center justify-center h-14 w-14 rounded-2xl bg-secondary text-secondary-foreground shrink-0">
          <span className="text-[11px] font-extrabold uppercase">
            {shortDate(c.date).split(" ")[0]}
          </span>
          <span className="font-display text-lg font-semibold leading-none">
            {shortDate(c.date).split(" ")[1]}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-bold truncate">{c.scheduleName}</p>
          <p className="text-sm text-muted-foreground">
            {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
          </p>
        </div>
      </div>
      <ClassStatusBadge status={c.status} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: "sage" | "marigold" | "terracotta";
}) {
  const bubble =
    tone === "sage"
      ? "bg-emerald-400"
      : tone === "marigold"
      ? "bg-marigold"
      : "bg-rose";
  return (
    <Card className="py-0">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          <span className={`h-7 w-7 rounded-full grid place-items-center text-ink ${bubble}`}>
            {icon}
          </span>
          <span>{label}</span>
        </div>
        <p className="font-display text-3xl font-semibold tracking-tight">
          {value}
          <span className="font-sans text-xs font-bold text-muted-foreground ml-1.5">
            {hint}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

// --- Date-range filters ---------------------------------------------------
// YYYY-MM-DD strings sort lexicographically, so simple string comparison
// is correct for date membership.

function withinNext7Days(ymd: string, todayStr: string): boolean {
  if (ymd < todayStr) return false;
  const today = parseYmd(todayStr);
  if (!today) return false;
  const upper = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const d = parseYmd(ymd);
  if (!d) return false;
  return d.getTime() <= upper.getTime();
}

function withinLast7Days(ymd: string, todayStr: string): boolean {
  if (ymd > todayStr) return false;
  const today = parseYmd(todayStr);
  if (!today) return false;
  const lower = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d = parseYmd(ymd);
  if (!d) return false;
  return d.getTime() >= lower.getTime();
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <CardContent className="p-8 space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-28" />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
