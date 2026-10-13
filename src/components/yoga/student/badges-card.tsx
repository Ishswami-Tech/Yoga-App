"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Flame,
  Trophy,
  CalendarCheck,
  Star,
  Target,
  Award,
} from "lucide-react";
import { BadgeEmblem, type EmblemKind } from "@/components/yoga/art/sunrise";

const EMBLEM: Record<string, EmblemKind> = {
  "first-class": "lotus",
  "streak-3": "flame",
  "streak-7": "sun",
  "total-10": "rings",
  "streak-14": "flame",
  "total-30": "bloom",
  "streak-30": "sun",
  "total-100": "star",
};

type AttendanceSummary = {
  currentStreak: number;
  longestStreak: number;
  totalAttended: number;
  last30Days: number;
  attendedToday: boolean;
};

// Milestone badges — unlocked based on streak and total attendance.
const MILESTONES: {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  threshold: number;
  type: "streak" | "total";
  gradient: string;
}[] = [
  {
    id: "first-class",
    label: "First Steps",
    desc: "Attend your first class",
    icon: Star,
    threshold: 1,
    type: "total",
    gradient: "from-emerald-400 to-emerald-600",
  },
  {
    id: "streak-3",
    label: "3-Day Flow",
    desc: "3 consecutive classes",
    icon: Flame,
    threshold: 3,
    type: "streak",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    id: "streak-7",
    label: "Week Warrior",
    desc: "7-day streak",
    icon: Flame,
    threshold: 7,
    type: "streak",
    gradient: "from-rose-400 to-rose-600",
  },
  {
    id: "total-10",
    label: "Dedicated",
    desc: "10 classes attended",
    icon: CalendarCheck,
    threshold: 10,
    type: "total",
    gradient: "from-teal-400 to-emerald-600",
  },
  {
    id: "streak-14",
    label: "Fortnight Flame",
    desc: "14-day streak",
    icon: Target,
    threshold: 14,
    type: "streak",
    gradient: "from-violet-400 to-violet-600",
  },
  {
    id: "total-30",
    label: "Monthly Master",
    desc: "30 classes attended",
    icon: Trophy,
    threshold: 30,
    type: "total",
    gradient: "from-amber-500 to-yellow-600",
  },
  {
    id: "streak-30",
    label: "Unbreakable",
    desc: "30-day streak",
    icon: Award,
    threshold: 30,
    type: "streak",
    gradient: "from-fuchsia-500 to-purple-700",
  },
  {
    id: "total-100",
    label: "Centurion",
    desc: "100 classes attended",
    icon: Trophy,
    threshold: 100,
    type: "total",
    gradient: "from-cyan-400 to-blue-600",
  },
];

export function BadgesCard() {
  const q = useQuery<AttendanceSummary>({
    queryKey: ["attendance"],
    queryFn: () => apiGet<AttendanceSummary>("/api/attendance"),
    refetchInterval: 60 * 1000,
  });

  if (q.isLoading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (q.isError || !q.data) return null;

  const a = q.data;

  return (
    <Card className="rounded-[2rem] border-0 shadow-soft">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center">
              <Award className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">
                Badges
              </p>
              <p className="text-sm font-semibold text-muted-foreground">
                {MILESTONES.filter((m) => isUnlocked(m, a)).length} / {MILESTONES.length} unlocked
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 gap-3">
          {MILESTONES.map((m) => {
            const unlocked = isUnlocked(m, a);
            const progress = getProgress(m, a);
            return (
              <div
                key={m.id}
                className={`relative rounded-3xl p-3 text-center transition ${
                  unlocked ? "bg-card shadow-soft" : "bg-[#F8E6D3] dark:bg-muted"
                }`}
              >
                <div className="flex justify-center mb-1.5">
                  <BadgeEmblem kind={EMBLEM[m.id] ?? "lotus"} earned={unlocked} size={60} />
                </div>
                <p className="text-sm font-extrabold leading-tight">{m.label}</p>
                <p
                  className={`text-xs font-bold mt-0.5 ${
                    unlocked ? "text-[#2F5A36] dark:text-emerald-300" : "text-muted-foreground"
                  }`}
                >
                  {unlocked ? "Earned" : m.desc}
                </p>
                {!unlocked && progress > 0 && (
                  <div
                    className="mt-1.5 h-1.5 rounded-full bg-[#3B1F1A]/10 overflow-hidden"
                    role="progressbar"
                    aria-label={`${m.label} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                  >
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, progress * 100)}%` }}
                    />
                  </div>
                )}
                {!unlocked && progress > 0 && (
                  <p className="text-xs font-semibold text-muted-foreground mt-1">
                    {Math.round(progress * 100)}% there
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function isUnlocked(
  m: (typeof MILESTONES)[number],
  a: AttendanceSummary
): boolean {
  if (m.type === "streak") return a.longestStreak >= m.threshold;
  return a.totalAttended >= m.threshold;
}

function getProgress(
  m: (typeof MILESTONES)[number],
  a: AttendanceSummary
): number {
  const current =
    m.type === "streak"
      ? Math.max(a.currentStreak, a.longestStreak)
      : a.totalAttended;
  return current / m.threshold;
}
