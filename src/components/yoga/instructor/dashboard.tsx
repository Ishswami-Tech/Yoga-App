"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { apiGet, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
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
} from "lucide-react";
import { toast } from "sonner";
import {
  ClassStatusBadge,
  EmptyState,
  ErrorCard,
} from "./shared";
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
};

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
        onViewHistory={() => setView("instructor-history")}
        onViewSchedule={() => setView("instructor-schedule")}
      />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Sunrise className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          label="Today"
          value={todayClasses.length}
          hint={todayClasses.length === 1 ? "class" : "classes"}
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          label="Next 7 days"
          value={upcomingThisWeek.length}
          hint={upcomingThisWeek.length === 1 ? "class" : "classes"}
        />
        <StatCard
          icon={<HistoryIcon className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
          label="Last 7 days"
          value={last7.length}
          hint={last7.length === 1 ? "class" : "classes"}
        />
      </div>

      {/* Today's classes list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
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
          <div className="space-y-2">
            {todayClasses.map((c) => (
              <TodayRow
                key={c.id}
                c={c}
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
            <h2 className="text-lg font-semibold tracking-tight">
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
          <Card className="border-border/60">
            <CardContent className="p-0 divide-y divide-border/60">
              {upcomingThisWeek.map((c) => (
                <UpcomingRow key={c.id} c={c} />
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Feedback summary */}
      <FeedbackSummaryCard />
    </div>
  );
}

function DashboardHero({
  firstName,
  todayStr,
  todayClass,
  onOpenMeet,
  onCopyMeet,
  onViewHistory,
  onViewSchedule,
}: {
  firstName: string;
  todayStr: string;
  todayClass?: ClassItem;
  onOpenMeet: (url: string) => void;
  onCopyMeet: (url: string) => void;
  onViewHistory: () => void;
  onViewSchedule: () => void;
}) {
  const rel = todayClass
    ? relativeToStart(todayClass.date, todayClass.startTime)
    : null;
  const isLive = rel?.phase === "live";
  const Icon = isLive ? Sunrise : Moon;
  const phase = todayClass
    ? classPhase(todayClass.date, todayClass.startTime, todayClass.endTime)
    : null;

  return (
    <Card className="relative overflow-hidden border-border/60">
      <div className="absolute inset-0 bg-brand-gradient opacity-90" />
      <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-warm-gradient opacity-30" />
      <CardContent className="relative p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Instructor workspace · {prettyDate(todayStr)}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {greeting()}, {firstName}.
            </h2>
            <p className="text-primary-foreground/80 text-sm md:text-base max-w-md">
              {todayClass ? (
                <>
                  Your class today is{" "}
                  <span className="font-semibold">
                    {todayClass.scheduleName}
                  </span>{" "}
                  at {prettyTime(todayClass.startTime)} —{" "}
                  {prettyTime(todayClass.endTime)}.
                </>
              ) : (
                "No class scheduled today — a gentle rest day."
              )}
            </p>
            {rel && todayClass && (
              <div className="inline-flex items-center gap-2 text-xs flex-wrap">
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    Live now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
                    <Icon className="h-3.5 w-3.5" /> {rel.label}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
                  <ClassStatusBadgeLite
                    status={todayClass.status}
                  />
                </span>
                {todayClass.reminderSentAt && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
                    <Bell className="h-3 w-3" /> Reminder sent
                  </span>
                )}
              </div>
            )}
            {todayClass && todayClass.meetUrl && (
              <div className="pt-1">
                <ClassCountdown
                  date={todayClass.date}
                  startTime={todayClass.startTime}
                  endTime={todayClass.endTime}
                  variant="hero"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            {todayClass && todayClass.meetUrl ? (
              <>
                <Button
                  size="lg"
                  className="bg-white text-emerald-700 hover:bg-white/90"
                  onClick={() => onOpenMeet(todayClass.meetUrl!)}
                  disabled={phase === "ended"}
                >
                  <Play className="h-4 w-4" />{" "}
                  {phase === "live" ? "Open today's Meet" : "Start today's class"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/15 text-primary-foreground hover:bg-white/25"
                  onClick={() => onCopyMeet(todayClass.meetUrl!)}
                >
                  <Copy className="h-4 w-4" /> Copy Meet link
                </Button>
              </>
            ) : todayClass ? (
              <Button
                size="lg"
                variant="secondary"
                className="bg-white/15 text-primary-foreground hover:bg-white/25"
                onClick={onViewSchedule}
              >
                Meet link pending <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                variant="secondary"
                className="bg-white/15 text-primary-foreground hover:bg-white/25"
                onClick={onViewSchedule}
              >
                See weekly schedule <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <button
              onClick={onViewHistory}
              className="hidden md:flex items-center justify-center gap-1.5 text-[11px] text-primary-foreground/70 hover:text-primary-foreground/90"
            >
              <HistoryIcon className="h-3.5 w-3.5" /> Recent class history
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact white-on-emerald status pill used inside the hero. The outline
// badge styles assume a light surface, so we re-tint for the gradient bg.
function ClassStatusBadgeLite({ status }: { status: string }) {
  const map: Record<string, string> = {
    READY: "bg-white/20",
    PENDING_MEET: "bg-white/20",
    COMPLETED: "bg-white/20",
    CANCELLED: "bg-white/20 line-through",
    FAILED: "bg-white/20",
  };
  const labelMap: Record<string, string> = {
    READY: "Ready",
    PENDING_MEET: "Meet pending",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    FAILED: "Failed",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
        map[status] ?? "bg-white/20"
      }`}
    >
      {labelMap[status] ?? status}
    </span>
  );
}

function TodayRow({
  c,
  onOpenMeet,
  onCopyMeet,
}: {
  c: ClassItem;
  onOpenMeet: (url: string) => void;
  onCopyMeet: (url: string) => void;
}) {
  const qc = useQueryClient();
  const phase = classPhase(c.date, c.startTime, c.endTime);
  const isCompleted = c.status === "COMPLETED";
  const isCancelled = c.status === "CANCELLED";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const completeMut = useMutation({
    mutationFn: () => apiPost(`/api/admin/classes/${c.id}/complete`),
    onSuccess: () => {
      toast.success("Class marked as completed");
      qc.invalidateQueries({ queryKey: ["instructor", "classes"] });
      qc.invalidateQueries({ queryKey: ["admin", "classes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't complete class"),
  });

  return (
    <>
    <Card className="border-border/60">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-lg bg-brand-gradient/10 grid place-items-center shrink-0">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{c.scheduleName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
              </p>
              {!isCompleted && !isCancelled && (
                <ClassCountdown
                  date={c.date}
                  startTime={c.startTime}
                  endTime={c.endTime}
                  variant="minimal"
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          <ClassStatusBadge status={c.status} />
          {c.reminderSentAt && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
              <Bell className="h-3 w-3" /> Reminder sent
            </span>
          )}
          {c.meetUrl ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => onOpenMeet(c.meetUrl!)}
                disabled={phase === "ended" && c.status !== "READY"}
              >
                <Play className="h-4 w-4" /> Open Meet
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCopyMeet(c.meetUrl!)}
                aria-label="Copy Meet link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              {!isCompleted && !isCancelled && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-700 border-amber-600/40 hover:bg-amber-500/10"
                    onClick={() => setNotesOpen(true)}
                    title="Edit class notes for attendees"
                  >
                    <StickyNote className="h-4 w-4" />
                    Notes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-violet-700 border-violet-600/40 hover:bg-violet-500/10"
                    onClick={() => setPickerOpen(true)}
                    title="Open the per-student attendance picker"
                  >
                    <UserCheck className="h-4 w-4" />
                    Attendance
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-700 border-emerald-600/40 hover:bg-emerald-500/10"
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
                </>
              )}
            </div>
          ) : (
            <Button size="sm" variant="outline" disabled>
              <ExternalLink className="h-4 w-4" /> No link yet
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
    {pickerOpen && (
      <AttendancePickerDialog
        classId={c.id}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        classLabel={c.scheduleName + " · " + prettyDate(c.date) + " " + prettyTime(c.startTime)}
      />
    )}
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
        <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-secondary shrink-0">
          <span className="text-[10px] uppercase text-muted-foreground">
            {shortDate(c.date).split(" ")[0]}
          </span>
          <span className="text-base font-semibold leading-none">
            {shortDate(c.date).split(" ")[1]}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{c.scheduleName}</p>
          <p className="text-xs text-muted-foreground">
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">
          {value}
          <span className="text-xs font-normal text-muted-foreground ml-1">
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
      <Card className="relative overflow-hidden border-border/60">
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
