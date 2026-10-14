"use client";
import { usePlan } from "@/hooks/use-plan";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Play,
  Clock,
  CalendarDays,
  Bell,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CalendarX,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { ErrorCard, LoadingCard, EmptyState } from "./shared";
import {
  prettyTime,
  prettyDate,
  relativeToStart,
  classPhase,
  meetPendingLabel,
  MEET_PENDING_HELP,
} from "./format";
import { ClassCountdown } from "./class-countdown";
import { SunFan } from "@/components/yoga/art/sunrise";
import { FeedbackWidget } from "./feedback-widget";

type TodayClass = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  scheduleName: string;
  hasMeet: boolean;
  meetUrl: string | null;
  reminderSent: boolean;
  canJoin: boolean;
  meetAvailableAt?: string | null;
  membershipRequired: boolean;
  notes?: string | null;
};

export function TodayView() {
  const plan = usePlan();
  const { setView } = useApp();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  // Tick every 30s so the "starts in / live now" indicator stays fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const q = useQuery<TodayClass>({
    queryKey: ["classes", "today"],
    queryFn: () => apiGet<TodayClass>("/api/classes/today"),
    retry: false,
    refetchInterval: 60 * 1000,
  });

  if (q.isLoading) return <LoadingCard lines={4} />;
  // A 404 from /api/classes/today means "no class today" (rest day / holiday),
  // not a real error — surface a friendly empty state in that case.
  const isNotFound =
    q.isError &&
    ((q.error as any)?.status === 404 ||
      (q.error as any)?.code === "NOT_FOUND");
  if (q.isError && !isNotFound)
    return (
      <ErrorCard
        message={
          (q.error as any)?.message ?? "Couldn't load today's class."
        }
        onRetry={() => qc.invalidateQueries({ queryKey: ["classes", "today"] })}
      />
    );
  if (q.isError || !q.data) {
    return (
      <EmptyState
        icon={CalendarX}
        title="No class scheduled today"
        description="Enjoy a gentle rest day, or peek at what's coming up this week."
        action={
          <Button
            variant="outline"
            onClick={() => setView("student-upcoming")}
          >
            <CalendarDays className="h-4 w-4" /> See upcoming
          </Button>
        }
      />
    );
  }

  const c = q.data;
  const rel = relativeToStart(c.date, c.startTime, now);
  const isLive = rel.phase === "live";
  const phase = classPhase(c.date, c.startTime, c.endTime, now);
  const hasEnded = phase === "ended";
  const copyMeet = async () => {
    if (!c.meetUrl) return;
    try {
      await navigator.clipboard.writeText(c.meetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Today&apos;s class</h1>
        <p className="text-sm text-muted-foreground">
          {prettyDate(c.date)}
        </p>
      </div>

      {/* Hero class card with live countdown */}
      <Card className="relative overflow-hidden rounded-[2rem] border-0 shadow-lift">
        <div className="absolute inset-0 bg-sunrise-sky" />
        <SunFan className="pointer-events-none absolute -right-24 -top-28" />
        <CardContent className="relative p-6 md:p-8 text-[#3B1F1A] space-y-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="space-y-3 min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFFBF2] px-3 py-1 text-xs font-extrabold uppercase tracking-wide">
                <Video className="h-3.5 w-3.5" />
                {c.scheduleName}
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
                {c.scheduleName}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFBF2]/80 px-3 py-1 font-bold">
                  <Clock className="h-4 w-4" /> {prettyTime(c.startTime)} —{" "}
                  {prettyTime(c.endTime)}
                </span>
                {c.reminderSent && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCEBD8] text-[#2F5A36] px-3 py-1 text-xs font-bold">
                    <Bell className="h-3 w-3" /> WhatsApp reminder sent
                  </span>
                )}
              </div>

              {/* Live countdown */}
              <div className="pt-2">
                <ClassCountdown
                  date={c.date}
                  startTime={c.startTime}
                  endTime={c.endTime}
                  variant="hero"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {c.canJoin && c.meetUrl ? (
              <>
                <Button
                  size="lg"
                  className="h-14 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-lift"
                  onClick={() => window.open(c.meetUrl!, "_blank")}
                >
                  <Play className="h-4 w-4" /> Join class on Google Meet
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-14 px-6 bg-[#FFFBF2] text-[#3B1F1A] hover:bg-white border-0"
                  onClick={copyMeet}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copy link
                    </>
                  )}
                </Button>
              </>
            ) : c.membershipRequired ? (
              <Button
                size="lg"
                className="h-14 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-lift"
                onClick={() => setView("student-membership")}
              >
                <Sparkles className="h-4 w-4" /> Subscribe to join
              </Button>
            ) : (
              <Button
                size="lg"
                variant="secondary"
                className="h-14 px-6 bg-[#FFFBF2]/70 text-[#3B1F1A]"
                disabled
              >
                <Clock className="h-4 w-4" />{" "}
                {meetPendingLabel(c.meetAvailableAt)}
              </Button>
            )}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A372E] self-center px-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Access verified by active
              membership
            </div>
          </div>
          {!(c.canJoin && c.meetUrl) && !c.membershipRequired && (
            <p className="text-xs font-semibold text-[#5A372E]">
              {MEET_PENDING_HELP}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Details grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Time
            </p>
            <p className="font-display text-xl font-semibold">
              {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
            </p>
            <p className="text-xs text-muted-foreground">
              {prettyDate(c.date)} · IST
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Schedule
            </p>
            <p className="text-lg font-semibold">{c.scheduleName}</p>
            <p className="text-xs text-muted-foreground">
              Daily morning practice
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  c.status === "READY"
                    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300"
                }
              >
                {c.status === "READY" ? "Ready" : "Link not created yet"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {c.hasMeet ? "Meet created" : "Created automatically before class"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructor notes */}
      {c.notes && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
                Instructor notes
              </p>
              <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback widget — shown after the class has ended */}
      {hasEnded && c.canJoin && (
        <FeedbackWidget classId={c.id} scheduleName={c.scheduleName} />
      )}

      {/* Membership-required banner */}
      {c.membershipRequired && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-amber-500/15 grid place-items-center shrink-0">
              <Sparkles className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Subscribe to unlock today&apos;s class</p>
              <p className="text-sm text-muted-foreground">
                A {plan.display}/month recurring membership unlocks every live class and
                the daily WhatsApp reminder.
              </p>
            </div>
            <Button
              className="bg-brand-gradient text-primary-foreground"
              onClick={() => setView("student-membership")}
            >
              Subscribe now <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Helper note */}
      <Card className="border-dashed">
        <CardContent className="p-5 flex items-start gap-3 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Meet links are generated fresh each day. You&apos;ll receive a
            WhatsApp reminder with the join link just before class — keep
            your WhatsApp number current in your{" "}
            <button
              className="text-primary underline underline-offset-4"
              onClick={() => setView("student-profile")}
            >
              profile
            </button>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
