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
import { prettyDate, prettyTime, shortDate } from "./format";

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
};

type Upcoming = { days: number; items: Item[] };

export function UpcomingView() {
  const qc = useQueryClient();
  const q = useQuery<Upcoming>({
    queryKey: ["classes", "upcoming", 7],
    queryFn: () => apiGet<Upcoming>("/api/classes/upcoming?days=7"),
    retry: false,
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upcoming classes</h1>
          <p className="text-sm text-muted-foreground">
            Next {q.data.days} days · times in IST
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <CalendarClock className="h-3.5 w-3.5" /> {q.data.items.length} class
          {q.data.items.length === 1 ? "" : "es"}
        </Badge>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
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
                    <span className="font-medium">
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
      <div className="md:hidden space-y-3">
        {q.data.items.map((c) => (
          <Card key={c.id} className="border-border/60">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{shortDate(c.date)}</span>
                  <StatusBadge status={c.status} hasMeet={c.hasMeet} />
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {prettyTime(c.startTime)} – {prettyTime(c.endTime)} ·{" "}
                  {c.scheduleName}
                </p>
              </div>
              <JoinButton item={c} compact />
            </CardContent>
          </Card>
        ))}
      </div>
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
        className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      >
        Ready
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300"
    >
      Meet pending
    </Badge>
  );
}

function JoinButton({ item, compact }: { item: Item; compact?: boolean }) {
  if (item.canJoin && item.meetUrl) {
    return (
      <Button
        size={compact ? "sm" : "default"}
        className="bg-emerald-600 text-white hover:bg-emerald-700"
        onClick={() => window.open(item.meetUrl!, "_blank")}
      >
        <Play className="h-4 w-4" /> Join
      </Button>
    );
  }
  if (item.canJoin === false && !item.meetUrl) {
    // Inactive membership — show subscribe CTA
    return (
      <Button size={compact ? "sm" : "default"} variant="outline" disabled>
        <Sparkles className="h-4 w-4" /> Members only
      </Button>
    );
  }
  return (
    <Button size={compact ? "sm" : "default"} variant="outline" disabled>
      <Video className="h-4 w-4" /> Soon
    </Button>
  );
}

function UpcomingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-md bg-accent animate-pulse" />
          <div className="h-4 w-32 rounded-md bg-accent animate-pulse" />
        </div>
      </div>
      <Card>
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full rounded-md bg-accent animate-pulse"
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
