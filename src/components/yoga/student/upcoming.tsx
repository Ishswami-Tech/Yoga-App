"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  CalendarClock,
  Video,
  Play,
  CalendarX,
  Sparkles,
} from "lucide-react";
import { ErrorCard, EmptyState } from "./shared";
import {
  prettyDate,
  prettyTime,
  shortDate,
  meetPendingLabel,
  meetRefetchInterval,
  MEET_PENDING_HELP,
} from "./format";
import { SunFan } from "../art/sunrise";

function dayParts(date: string) {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return { wd: "", day: "" };
  return {
    wd: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
    day: String(d.getUTCDate()),
  };
}

type Item = {
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
};

type Upcoming = { days: number; items: Item[] };

export function UpcomingView() {
  const qc = useQueryClient();
  const q = useQuery<Upcoming>({
    queryKey: ["classes", "upcoming", 7],
    queryFn: () => apiGet<Upcoming>("/api/classes/upcoming?days=7"),
    retry: false,
    refetchInterval: (query) => meetRefetchInterval(query.state.data?.items),
  });

  if (q.isLoading) return <UpcomingSkeleton />;
  if (q.isError)
    return (
      <ErrorCard
        message={(q.error as any)?.message ?? "Couldn't load upcoming classes."}
        onRetry={() =>
          qc.invalidateQueries({ queryKey: ["classes", "upcoming", 7] })
        }
      />
    );
  if (!q.data || q.data.items.length === 0)
    return (
      <EmptyState
        icon={CalendarX}
        title="No classes in the next 7 days"
        description="The instructor may have set a holiday window. Check back soon."
      />
    );

  return (
    <div className="space-y-4">
      <header className="relative overflow-hidden rounded-3xl bg-sunrise-sky px-5 pb-4 pt-4 text-[#3B1F1A] shadow-lift">
        <SunFan
          size={200}
          className="pointer-events-none absolute -right-14 -top-20"
        />
        <div className="relative flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center rounded-full bg-card px-3 py-1 text-[12.5px] font-extrabold uppercase tracking-wide">
            Next {q.data.days} days
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-[12.5px] font-extrabold">
            <CalendarClock className="h-3.5 w-3.5" /> {q.data.items.length} class
            {q.data.items.length === 1 ? "" : "es"}
          </span>
        </div>
        <h1 className="relative mt-2 font-display text-4xl font-semibold leading-tight">
          Upcoming
        </h1>
        <p className="relative text-sm font-semibold">Times in IST</p>
      </header>

      {/* Desktop table */}
      <Card className="hidden md:block rounded-3xl shadow-soft overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Join</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.items.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-extrabold">
                      {shortDate(c.date)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {prettyDate(c.date)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
                </TableCell>
                <TableCell className="font-medium">
                  {c.scheduleName}
                </TableCell>
                <TableCell>
                  <StatusBadge status={c.status} hasMeet={c.hasMeet} />
                </TableCell>
                <TableCell className="text-right">
                  <JoinButton item={c} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {q.data.items.map((c, i) => {
          const { wd, day } = dayParts(c.date);
          return (
            <Card key={c.id} className="rounded-3xl shadow-soft">
              <CardContent className="p-2 pr-3.5 flex items-center gap-3 min-h-16">
                <div
                  className={`flex size-[52px] shrink-0 flex-col items-center justify-center rounded-[22px] text-[#3B1F1A] ${
                    i % 2 === 0 ? "bg-[#F7C9B6]" : "bg-[#FBD79B]"
                  }`}
                >
                  <div className="text-[11.5px] font-extrabold uppercase tracking-wider">{wd}</div>
                  <div className="font-display text-[22px] font-bold leading-none">{day}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">{c.scheduleName}</div>
                  <p className="text-[13.5px] font-semibold text-muted-foreground">
                    {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={c.status} hasMeet={c.hasMeet} />
                  </div>
                </div>
                <JoinButton item={c} compact />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="px-2 text-[13.5px] font-semibold text-muted-foreground">
        {MEET_PENDING_HELP}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  hasMeet,
}: {
  status: string;
  hasMeet: boolean;
}) {
  if (status === "READY" && hasMeet)
    return (
      <Badge
        variant="outline"
        className="rounded-full border-transparent bg-success-soft px-3 text-success font-extrabold"
      >
        Ready
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent bg-marigold/30 px-3 text-foreground font-extrabold"
    >
      Link not created yet
    </Badge>
  );
}

function JoinButton({ item, compact }: { item: Item; compact?: boolean }) {
  if (item.canJoin && item.meetUrl) {
    return (
      <Button
        className="min-h-11"
        onClick={() => window.open(item.meetUrl!, "_blank")}
      >
        <Play className="h-4 w-4" /> Join
      </Button>
    );
  }
  if (item.canJoin === false && !item.meetUrl) {
    // Inactive membership — show subscribe CTA
    return (
      <Button className="min-h-11" variant="outline" disabled>
        <Sparkles className="h-4 w-4" /> Members only
      </Button>
    );
  }
  return (
    <Button
      className={compact ? "min-h-11 px-3 text-xs" : "min-h-11"}
      variant="outline"
      disabled
    >
      <Video className="h-4 w-4" /> {meetPendingLabel(item.meetAvailableAt)}
    </Button>
  );
}

function UpcomingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-2xl bg-accent animate-pulse" />
          <div className="h-4 w-32 rounded-2xl bg-accent animate-pulse" />
        </div>
      </div>
      <Card className="rounded-3xl">
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full rounded-2xl bg-accent animate-pulse"
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
