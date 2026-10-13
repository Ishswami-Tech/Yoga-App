"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  CheckCircle2,
  Clock,
  Video,
  Play,
  CalendarDays,
  Inbox,
} from "lucide-react";
import { ErrorCard, EmptyState, StatusChip, Eyebrow } from "./shared";
import { todayIST } from "./shared";
import { prettyTime, prettyDate } from "@/components/yoga/student/format";
import { useApp } from "@/lib/store";
import { useState } from "react";
import { AttendancePickerDialog } from "./attendance-picker";

type InstructorClasses = {
  today: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    scheduleName: string;
    meetUrl: string | null;
    reminderSentAt: string | null;
  }[];
  upcoming: any[];
  history: any[];
};

type RosterEntry = {
  userId: string;
  studentName: string;
  studentEmail: string;
  whatsapp: string | null;
  attended: boolean;
};

type RosterResp = {
  roster: RosterEntry[];
  attendedCount: number;
  totalActive: number;
};

export function RosterView() {
  const { setView } = useApp();
  const qc = useQueryClient();
  const [pickerClassId, setPickerClassId] = useState<string | null>(null);

  const classesQ = useQuery<InstructorClasses>({
    queryKey: ["instructor", "classes"],
    queryFn: () => apiGet<InstructorClasses>("/api/instructor/classes"),
    retry: false,
    refetchInterval: 60 * 1000,
  });

  const todayStr = todayIST();
  const todayClasses = classesQ.data?.today ?? [];
  const firstClass = todayClasses[0];

  // Fetch roster for the first class (if any)
  const rosterQ = useQuery<RosterResp>({
    queryKey: ["attendance", "roster", firstClass?.id],
    queryFn: () =>
      apiGet<RosterResp>(
        `/api/instructor/classes/${firstClass!.id}/attendance`
      ),
    enabled: !!firstClass?.id,
  });

  if (classesQ.isLoading) return <RosterSkeleton />;
  if (classesQ.isError)
    return (
      <ErrorCard
        message={(classesQ.error as any)?.message ?? "Couldn't load today's classes."}
        onRetry={() => qc.invalidateQueries({ queryKey: ["instructor", "classes"] })}
      />
    );

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Teaching</Eyebrow>
        <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight">Today&apos;s roster</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {prettyDate(todayStr)} · IST · who&apos;s expected and who attended
        </p>
      </div>

      {todayClasses.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No classes scheduled today"
          description="Today is a rest day or a holiday exception."
        />
      ) : (
        <>
          {/* Class summary card */}
          {firstClass && (
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-secondary to-accent rounded-[2rem] py-0">
              <CardContent className="relative p-6 md:p-7">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-2">
                    <Eyebrow className="inline-flex items-center gap-2">
                      <Video className="h-3.5 w-3.5" />
                      Class
                    </Eyebrow>
                    <h2 className="font-display text-3xl font-semibold leading-tight">
                      {firstClass.scheduleName}
                    </h2>
                    <div className="flex items-center gap-3 text-sm font-bold flex-wrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {prettyTime(firstClass.startTime)} – {prettyTime(firstClass.endTime)}
                      </span>
                      {firstClass.meetUrl && (
                        <StatusChip tone="sage">Meet ready</StatusChip>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {firstClass.meetUrl && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(firstClass.meetUrl!, "_blank")}
                      >
                        <Play className="h-4 w-4" /> Open Meet
                      </Button>
                    )}
                    <Button onClick={() => setPickerClassId(firstClass.id)}>
                      <Users className="h-4 w-4" /> Record attendance
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attendance summary */}
          {rosterQ.isLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ) : rosterQ.data ? (
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard
                icon={<Users className="h-5 w-5" />}
                value={rosterQ.data.totalActive}
                label="Active members"
                tone="primary"
              />
              <SummaryCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                value={rosterQ.data.attendedCount}
                label="Attended"
                tone="sage"
              />
              <SummaryCard
                icon={<Clock className="h-5 w-5" />}
                value={rosterQ.data.totalActive - rosterQ.data.attendedCount}
                label="Not yet"
                tone="marigold"
              />
            </div>
          ) : null}

          {/* Roster list */}
          {rosterQ.data && (
            <Card>
              <CardContent className="p-0 px-3 divide-y-2 divide-dotted divide-border">
                {rosterQ.data.roster.length === 0 ? (
                  <div className="p-8 text-center">
                    <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No active members yet.
                    </p>
                  </div>
                ) : (
                  rosterQ.data.roster.map((entry) => (
                    <div
                      key={entry.userId}
                      className="flex items-center gap-3 py-3 px-1 hover:bg-accent/30 transition rounded-xl"
                    >
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarFallback
                          className={
                            entry.attended
                              ? "bg-emerald-400 text-ink font-display text-sm font-bold"
                              : "bg-secondary text-secondary-foreground font-display text-sm font-bold"
                          }
                        >
                          {entry.studentName
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base truncate">
                          {entry.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.studentEmail}
                        </p>
                      </div>
                      {entry.attended ? (
                        <StatusChip tone="sage" icon={<CheckCircle2 />}>
                          Present
                        </StatusChip>
                      ) : (
                        <StatusChip tone="neutral" icon={<Clock />}>
                          Expected
                        </StatusChip>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Other classes today */}
          {todayClasses.length > 1 && (
            <div>
              <h3 className="font-display text-xl font-semibold mb-2">
                Other classes today ({todayClasses.length - 1})
              </h3>
              <div className="space-y-2">
                {todayClasses.slice(1).map((c) => (
                  <Card key={c.id} className="py-0">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center shrink-0">
                        <Video className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{c.scheduleName}</p>
                        <p className="text-xs text-muted-foreground">
                          {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setPickerClassId(c.id)}
                      >
                        <Users className="h-3.5 w-3.5" /> Attendance
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Attendance picker (for any class, not just the first) */}
      {pickerClassId && firstClass && (
        <AttendancePickerDialog
          classId={pickerClassId}
          open={!!pickerClassId}
          onOpenChange={(o) => !o && setPickerClassId(null)}
          classLabel={`${firstClass.scheduleName} · ${prettyDate(firstClass.date)} ${prettyTime(firstClass.startTime)}`}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "primary" | "sage" | "marigold";
}) {
  const toneClass =
    tone === "sage"
      ? "bg-emerald-400 text-ink"
      : tone === "marigold"
      ? "bg-marigold text-ink"
      : "bg-rose text-ink";
  return (
    <Card className="py-0">
      <CardContent className="p-4 space-y-1">
        <div className={`h-10 w-10 rounded-full grid place-items-center ${toneClass}`}>
          {icon}
        </div>
        <p className="font-display text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

function RosterSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32 mt-2" />
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-8 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
