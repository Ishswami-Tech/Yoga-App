"use client";
import { useQuery } from "@tanstack/react-query";
import { useApp, MembershipSummary } from "@/lib/store";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Video,
  CalendarClock,
  CreditCard,
  ArrowRight,
  Play,
  Clock,
  Sunrise,
  Moon,
  Heart,
  Bell,
  ShieldCheck,
  Flame,
} from "lucide-react";
import { MembershipStateBadge, KV } from "./shared";
import { greeting, prettyTime, prettyDate, relativeToStart } from "./format";
import { ClassCountdown } from "./class-countdown";
import { StreakCard } from "./streak-card";
import { BadgesCard } from "./badges-card";

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
  membershipRequired: boolean;
};

type UpcomingItem = TodayClass;
type Upcoming = { days: number; items: UpcomingItem[] };

export function DashboardView() {
  const { user, membership, setView } = useApp();

  const todayQ = useQuery<TodayClass>({
    queryKey: ["classes", "today"],
    queryFn: () => apiGet<TodayClass>("/api/classes/today"),
    retry: false,
    refetchInterval: 60 * 1000,
  });

  const upcomingQ = useQuery<Upcoming>({
    queryKey: ["classes", "upcoming", 7],
    queryFn: () => apiGet<Upcoming>("/api/classes/upcoming?days=7"),
    retry: false,
  });

  const state = membership?.state ?? "NONE";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  // Next upcoming = first upcoming item that is not "today" (or just the
  // first one if today's class doesn't exist).
  const nextUpcoming = upcomingQ.data?.items.find(
    (x) => !todayQ.data || x.id !== todayQ.data.id
  );

  const needsSubscription =
    state === "NONE" ||
    state === "EXPIRED" ||
    state === "CANCELLED" ||
    state === "HALTED";

  return (
    <div className="space-y-6">
      {/* HERO — Daily ritual */}
      <DailyRitualHero
        firstName={firstName}
        membership={membership}
        todayQ={todayQ}
        onJoin={() =>
          todayQ.data?.meetUrl && window.open(todayQ.data.meetUrl, "_blank")
        }
        onViewToday={() => setView("student-today")}
        onSubscribe={() => setView("student-membership")}
      />

      {/* STATE + TODAY + NEXT grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Membership state */}
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Membership
              </p>
              <MembershipStateBadge state={state} />
            </div>
            {state === "ACTIVE" ? (
              <>
                <KV label="Plan">Monthly · ₹500</KV>
                <KV label="Next billing">
                  {prettyDate(membership?.nextBillingDate)}
                </KV>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setView("student-membership")}
                >
                  <CreditCard className="h-4 w-4" /> Manage
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {state === "PENDING"
                    ? "Your payment is being verified. You'll get access the moment the webhook lands."
                    : state === "EXPIRED" || state === "HALTED"
                    ? "Your membership is no longer active. Renew to resume daily classes."
                    : "Subscribe to unlock daily live classes and WhatsApp reminders."}
                </p>
                <Button
                  size="sm"
                  className="w-full bg-brand-gradient text-primary-foreground"
                  onClick={() => setView("student-membership")}
                >
                  <Sparkles className="h-4 w-4" /> Subscribe ₹500/mo
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Today's class */}
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Today
              </p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            {todayQ.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : todayQ.data ? (
              <>
                <div>
                  <p className="font-semibold">{todayQ.data.scheduleName}</p>
                  <p className="text-sm text-muted-foreground">
                    {prettyTime(todayQ.data.startTime)} —{" "}
                    {prettyTime(todayQ.data.endTime)}
                  </p>
                </div>
                {todayQ.data.canJoin && todayQ.data.meetUrl ? (
                  <Button
                    size="sm"
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() =>
                      window.open(todayQ.data!.meetUrl!, "_blank")
                    }
                  >
                    <Video className="h-4 w-4" /> Join now
                  </Button>
                ) : todayQ.data.membershipRequired ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setView("student-membership")}
                  >
                    <Sparkles className="h-4 w-4" /> Subscribe to join
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setView("student-today")}
                  >
                    View details <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : todayQ.isError ? (
              <p className="text-sm text-muted-foreground">
                No class scheduled today.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No class scheduled today. Rest day 🧘
              </p>
            )}
          </CardContent>
        </Card>

        {/* Next upcoming */}
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Next up
              </p>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </div>
            {upcomingQ.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : nextUpcoming ? (
              <>
                <div>
                  <p className="font-semibold">{nextUpcoming.scheduleName}</p>
                  <p className="text-sm text-muted-foreground">
                    {prettyDate(nextUpcoming.date)} ·{" "}
                    {prettyTime(nextUpcoming.startTime)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setView("student-upcoming")}
                >
                  See schedule <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No upcoming classes in the next 7 days.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Streak + practice stats — only for active members */}
      {state === "ACTIVE" && (
        <>
          <StreakCard />
          <BadgesCard />
        </>
      )}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          icon={Video}
          label="Today's class"
          desc="Live join link"
          onClick={() => setView("student-today")}
        />
        <QuickLink
          icon={CalendarClock}
          label="Upcoming"
          desc="Next 7 days"
          onClick={() => setView("student-upcoming")}
        />
        <QuickLink
          icon={CreditCard}
          label="Membership"
          desc={state === "ACTIVE" ? "Manage plan" : "Subscribe"}
          onClick={() => setView("student-membership")}
        />
        <QuickLink
          icon={Heart}
          label="Payments"
          desc="Billing history"
          onClick={() => setView("student-payments")}
        />
      </div>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition group"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-brand-gradient/10 grid place-items-center shrink-0 group-hover:scale-105 transition">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{desc}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 ml-auto group-hover:text-primary transition" />
      </div>
    </button>
  );
}

function DailyRitualHero({
  firstName,
  membership,
  todayQ,
  onJoin,
  onViewToday,
  onSubscribe,
}: {
  firstName: string;
  membership: MembershipSummary | null;
  todayQ: ReturnType<typeof useQuery<TodayClass>>;
  onJoin: () => void;
  onViewToday: () => void;
  onSubscribe: () => void;
}) {
  const state = membership?.state ?? "NONE";
  const today = todayQ.data;
  const rel = today
    ? relativeToStart(today.date, today.startTime)
    : null;
  const isLive = rel?.phase === "live";
  const Icon = isLive ? Sunrise : Moon;

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
              Daily ritual · 7:00 AM IST
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {greeting()}, {firstName}.
            </h2>
            <p className="text-primary-foreground/80 text-sm md:text-base max-w-md">
              {today ? (
                <>
                  Today&apos;s class is{" "}
                  <span className="font-semibold">{today.scheduleName}</span>{" "}
                  at {prettyTime(today.startTime)}.
                </>
              ) : state === "ACTIVE" ? (
                "No class scheduled today — a gentle rest day."
              ) : (
                "Subscribe to start your daily live yoga practice."
              )}
            </p>
            {rel && today && (
              <div className="inline-flex items-center gap-2 text-xs">
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
                {today.reminderSent && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
                    <Bell className="h-3 w-3" /> Reminder sent
                  </span>
                )}
              </div>
            )}
            {/* Live countdown — only when there's a class today and the
                member can see it (active membership). */}
            {today && today.hasMeet && state === "ACTIVE" && (
              <div className="pt-2">
                <ClassCountdown
                  date={today.date}
                  startTime={today.startTime}
                  endTime={today.endTime}
                  variant="hero"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            {today && today.canJoin && today.meetUrl ? (
              <Button
                size="lg"
                className="bg-white text-emerald-700 hover:bg-white/90"
                onClick={onJoin}
              >
                <Play className="h-4 w-4" /> Join on Google Meet
              </Button>
            ) : today && today.membershipRequired ? (
              <Button
                size="lg"
                className="bg-white text-emerald-700 hover:bg-white/90"
                onClick={onSubscribe}
              >
                <Sparkles className="h-4 w-4" /> Subscribe ₹500/mo
              </Button>
            ) : today ? (
              <Button
                size="lg"
                variant="secondary"
                className="bg-white/15 text-primary-foreground hover:bg-white/25"
                onClick={onViewToday}
              >
                View today <ArrowRight className="h-4 w-4" />
              </Button>
            ) : state === "ACTIVE" ? (
              <Button
                size="lg"
                variant="secondary"
                className="bg-white/15 text-primary-foreground hover:bg-white/25"
                onClick={onViewToday}
              >
                Rest & breathe <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="bg-white text-emerald-700 hover:bg-white/90"
                onClick={onSubscribe}
              >
                <Sparkles className="h-4 w-4" /> Subscribe ₹500/mo
              </Button>
            )}
            <div className="hidden md:flex items-center justify-center gap-1.5 text-[11px] text-primary-foreground/70">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified access
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
