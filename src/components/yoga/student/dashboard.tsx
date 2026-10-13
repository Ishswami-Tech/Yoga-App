"use client";
import { usePlan } from "@/hooks/use-plan";
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
import { SunFan } from "../art/sunrise";

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
  const plan = usePlan();
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
      {/* HERO — Daily ritual (members) / Join card (no active membership) */}
      {needsSubscription ? (
        <JoinCard
          firstName={firstName}
          expired={state !== "NONE"}
          onSubscribe={() => setView("student-membership")}
        />
      ) : (
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
      )}

      {/* STATE + TODAY + NEXT grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Membership state */}
        <Card className="rounded-3xl shadow-soft">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Membership
              </p>
              <MembershipStateBadge state={state} />
            </div>
            {state === "ACTIVE" ? (
              <>
                <KV label="Plan">Monthly · {plan.display}</KV>
                <KV label="Next billing">
                  {prettyDate(membership?.nextBillingDate)}
                </KV>
                <Button
                  variant="outline"
                  className="w-full min-h-11"
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
                  className="w-full min-h-11"
                  onClick={() => setView("student-membership")}
                >
                  <Sparkles className="h-4 w-4" /> Subscribe {plan.display}/mo
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Today's class */}
        <Card className="rounded-3xl shadow-soft">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Today
              </p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            {todayQ.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : todayQ.data ? (
              <>
                <div>
                  <p className="font-display text-xl font-semibold">{todayQ.data.scheduleName}</p>
                  <p className="text-sm text-muted-foreground">
                    {prettyTime(todayQ.data.startTime)} —{" "}
                    {prettyTime(todayQ.data.endTime)}
                  </p>
                </div>
                {todayQ.data.canJoin && todayQ.data.meetUrl ? (
                  <Button
                    className="w-full min-h-11"
                    onClick={() =>
                      window.open(todayQ.data!.meetUrl!, "_blank")
                    }
                  >
                    <Video className="h-4 w-4" /> Join now
                  </Button>
                ) : todayQ.data.membershipRequired ? (
                  <Button
                    variant="outline"
                    className="w-full min-h-11"
                    onClick={() => setView("student-membership")}
                  >
                    <Sparkles className="h-4 w-4" /> Subscribe to join
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full min-h-11"
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
        <Card className="rounded-3xl shadow-soft">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Next up
              </p>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </div>
            {upcomingQ.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : nextUpcoming ? (
              <>
                <div>
                  <p className="font-display text-xl font-semibold">{nextUpcoming.scheduleName}</p>
                  <p className="text-sm text-muted-foreground">
                    {prettyDate(nextUpcoming.date)} ·{" "}
                    {prettyTime(nextUpcoming.startTime)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full min-h-11"
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

function JoinCard({
  firstName,
  expired,
  onSubscribe,
}: {
  firstName: string;
  expired: boolean;
  onSubscribe: () => void;
}) {
  const plan = usePlan();
  const perks = [
    { icon: Video, bg: "bg-marigold", text: "The live Google Meet class every day" },
    { icon: Bell, bg: "bg-[#8FAF8A]", text: "WhatsApp reminder with your link 15 minutes before" },
    { icon: Flame, bg: "bg-rose", text: "Your streak, badges and practice journal" },
  ];
  return (
    <div className="space-y-4">
      <section
        aria-label="Join Vishwayog"
        className="relative overflow-hidden rounded-3xl bg-sunrise-sky p-5 text-[#3B1F1A] shadow-lift"
      >
        <SunFan size={260} className="pointer-events-none absolute -right-24 -top-24" />
        <span className="relative inline-flex items-center rounded-full bg-card px-3 py-1 text-[12.5px] font-extrabold uppercase tracking-wide">
          Membership
        </span>
        <h2 className="relative mt-2 max-w-[260px] font-display text-3xl font-semibold leading-tight">
          {expired
            ? `Welcome back, ${firstName}`
            : "Join today's class and every one after"}
        </h2>
        <p className="relative mt-2 text-[14.5px] font-semibold leading-snug">
          Live yoga every morning for{" "}
          <span className="font-extrabold">{plan.display} a month</span>. Pause
          or cancel whenever you like.
        </p>
        <Button
          size="lg"
          className="relative mt-4 w-full min-h-14 text-base"
          onClick={onSubscribe}
        >
          {expired ? "Renew membership" : "Start membership"}
        </Button>
      </section>
      <section aria-label="What you get">
        <h2 className="mb-2 ml-1.5 font-display text-xl font-semibold">What you get</h2>
        <ul className="list-none rounded-3xl bg-card px-4 py-0.5 shadow-soft divide-y-2 divide-dotted divide-border">
          {perks.map(({ icon: PIcon, bg, text }) => (
            <li key={text} className="flex min-h-12 items-center gap-3 py-1.5">
              <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full text-[#3B1F1A] ${bg}`}>
                <PIcon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[14.5px] font-bold">{text}</span>
            </li>
          ))}
        </ul>
      </section>
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
      className="text-left min-h-16 rounded-3xl bg-card p-4 shadow-soft hover:bg-accent/40 transition group"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-rose/60 grid place-items-center shrink-0 group-hover:scale-105 transition">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-extrabold text-sm truncate">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{desc}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary transition" />
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
  const plan = usePlan();
  const state = membership?.state ?? "NONE";
  const today = todayQ.data;
  const rel = today
    ? relativeToStart(today.date, today.startTime)
    : null;
  const isLive = rel?.phase === "live";
  const Icon = isLive ? Sunrise : Moon;

  return (
    <Card className="relative overflow-hidden rounded-3xl border-0 shadow-lift">
      <div className="absolute inset-0 bg-primary" />
      <SunFan size={260} className="pointer-events-none absolute -right-16 -top-20 opacity-70" />
      <CardContent className="relative p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">
              <Sparkles className="h-3.5 w-3.5" />
              Daily live yoga
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold leading-tight">
              {greeting()}, {firstName}.
            </h2>
            <p className="text-primary-foreground text-sm md:text-base max-w-md">
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
                className="bg-card text-foreground hover:bg-card/90 min-h-12"
                onClick={onJoin}
              >
                <Play className="h-4 w-4" /> Join on Google Meet
              </Button>
            ) : today && today.membershipRequired ? (
              <Button
                size="lg"
                className="bg-card text-foreground hover:bg-card/90 min-h-12"
                onClick={onSubscribe}
              >
                <Sparkles className="h-4 w-4" /> Subscribe {plan.display}/mo
              </Button>
            ) : today ? (
              <Button
                size="lg"
                variant="secondary"
                className="bg-white/20 text-primary-foreground hover:bg-white/30 min-h-12"
                onClick={onViewToday}
              >
                View today <ArrowRight className="h-4 w-4" />
              </Button>
            ) : state === "ACTIVE" ? (
              <Button
                size="lg"
                variant="secondary"
                className="bg-white/20 text-primary-foreground hover:bg-white/30 min-h-12"
                onClick={onViewToday}
              >
                Rest & breathe <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="bg-card text-foreground hover:bg-card/90 min-h-12"
                onClick={onSubscribe}
              >
                <Sparkles className="h-4 w-4" /> Subscribe {plan.display}/mo
              </Button>
            )}
            <div className="hidden md:flex items-center justify-center gap-1.5 text-xs text-primary-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified access
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
