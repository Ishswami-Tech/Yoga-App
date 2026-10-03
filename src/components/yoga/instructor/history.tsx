"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Video,
  Copy,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import {
  ClassStatusBadge,
  EmptyState,
  ErrorCard,
} from "./shared";
import {
  prettyDate,
  prettyTime,
  shortDate,
} from "@/components/yoga/student/format";

type ClassItem = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  scheduleName: string;
  meetUrl: string | null;
};

type InstructorClasses = {
  today: ClassItem[];
  upcoming: ClassItem[];
  history: ClassItem[];
};

export function HistoryView() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const q = useQuery<InstructorClasses>({
    queryKey: ["instructor", "classes"],
    queryFn: () => apiGet<InstructorClasses>("/api/instructor/classes"),
    retry: false,
  });

  if (q.isLoading) return <HistorySkeleton />;
  if (q.isError)
    return (
      <ErrorCard
        message={
          (q.error as any)?.message ??
          "Couldn't load class history right now."
        }
        onRetry={() =>
          qc.invalidateQueries({ queryKey: ["instructor", "classes"] })
        }
      />
    );

  const items = q.data?.history ?? [];

  if (items.length === 0)
    return (
      <EmptyState
        icon={Inbox}
        title="No class history yet"
        description="Once classes start landing in the past, you'll see the most recent 30 sessions here."
      />
    );

  // Quick totals for the header summary.
  const counts = countByStatus(items);
  const completed = counts.COMPLETED ?? 0;
  const cancelled = counts.CANCELLED ?? 0;
  const failed = counts.FAILED ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Class history
          </h1>
          <p className="text-sm text-muted-foreground">
            Most recent {items.length} past {items.length === 1 ? "class" : "classes"} · IST
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SummaryPill
            label="Completed"
            value={completed}
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          />
          <SummaryPill
            label="Cancelled"
            value={cancelled}
            className="bg-muted text-muted-foreground"
          />
          <SummaryPill
            label="Failed"
            value={failed}
            className="bg-rose-500/10 text-rose-700 dark:text-rose-300"
          />
        </div>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28px]" />
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Meet link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => {
              const isOpen = expanded === c.id;
              return (
                <HistoryRow
                  key={c.id}
                  c={c}
                  isOpen={isOpen}
                  onToggle={() =>
                    setExpanded(isOpen ? null : c.id)
                  }
                />
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {items.map((c) => (
          <Card key={c.id} className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {c.scheduleName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {shortDate(c.date)} · {prettyDate(c.date)}
                  </p>
                </div>
                <ClassStatusBadge status={c.status} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
                </span>
                {c.meetUrl ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(c.meetUrl!, "_blank", "noopener,noreferrer")
                    }
                  >
                    <Video className="h-4 w-4" /> Open
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No link
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function HistoryRow({
  c,
  isOpen,
  onToggle,
}: {
  c: ClassItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        onClick={onToggle}
        className="cursor-pointer hover:bg-accent/30"
      >
        <TableCell className="pl-3">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{shortDate(c.date)}</span>
            <span className="text-xs text-muted-foreground">
              {prettyDate(c.date)}
            </span>
          </div>
        </TableCell>
        <TableCell>
          {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
        </TableCell>
        <TableCell className="font-medium">{c.scheduleName}</TableCell>
        <TableCell>
          <ClassStatusBadge status={c.status} />
        </TableCell>
        <TableCell className="text-right">
          {c.meetUrl ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200"
              onClick={(e) => {
                e.stopPropagation();
                window.open(c.meetUrl!, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="h-4 w-4" /> Open
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              No link
            </span>
          )}
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow className="bg-secondary/20 hover:bg-secondary/20">
          <TableCell />
          <TableCell colSpan={5} className="py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <KVPair label="Date (IST)">
                {prettyDate(c.date)}
              </KVPair>
              <KVPair label="Time (IST)">
                {prettyTime(c.startTime)} – {prettyTime(c.endTime)}
              </KVPair>
              <KVPair label="Schedule">{c.scheduleName}</KVPair>
              <KVPair label="Status">
                <ClassStatusBadge status={c.status} />
              </KVPair>
              <KVPair label="Class ID">
                <code className="text-xs break-all">{c.id}</code>
              </KVPair>
              <KVPair label="Meet URL">
                {c.meetUrl ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="text-xs truncate max-w-[220px]">
                      {c.meetUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard
                          .writeText(c.meetUrl!)
                          .then(() => toast.success("Meet link copied"))
                          .catch(() => toast.error("Couldn't copy link"));
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(
                          c.meetUrl!,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    No Meet link was generated for this class.
                  </span>
                )}
              </KVPair>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function KVPair({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 min-w-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-words min-w-0">
        {children}
      </span>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${className ?? ""}`}
    >
      {label}
      <span className="font-bold">{value}</span>
    </span>
  );
}

function countByStatus(
  items: ClassItem[]
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
}

function HistorySkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44 rounded-md" />
          <Skeleton className="h-4 w-56 rounded-md" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-6 w-24 rounded-md" />
          ))}
        </div>
      </div>
      <Card>
        <div className="p-2 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </Card>
    </div>
  );
}
