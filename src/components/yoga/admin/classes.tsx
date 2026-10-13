"use client";
import { useState, Fragment } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  Zap,
  Send,
  RefreshCw,
  ExternalLink,
  Bell,
  Inbox,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { prettyTime, prettyDate, shortDate } from "@/components/yoga/student/format";
import {
  PageHeader,
  StatusBadge,
  ErrorCard,
  EmptyState,
  Spinner,
  MonoText,
  CopyButton,
  istDateTime,
} from "./shared";

type YogaClass = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  scheduleName: string;
  googleEventId: string | null;
  meetUrl: string | null;
  reminderAt: string | null;
  reminderSentAt: string | null;
};

type ListResp = { items: YogaClass[] };
type Schedule = { id: string; name: string };

const STATUS_FILTERS = [
  { value: "ALL", label: "All statuses" },
  { value: "READY", label: "Ready" },
  { value: "PENDING_MEET", label: "Meet pending" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
];

export function ClassesView() {
  const [status, setStatus] = useState("ALL");
  const [scheduleId, setScheduleId] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const qc = useQueryClient();

  const schedulesQ = useQuery<{ items: Schedule[] }>({
    queryKey: ["admin", "schedules"],
    queryFn: () => apiGet<{ items: Schedule[] }>("/api/admin/schedules"),
    staleTime: 5 * 60 * 1000,
  });

  const q = useQuery<ListResp>({
    queryKey: ["admin", "classes", status, scheduleId],
    queryFn: () => {
      const params = new URLSearchParams({ days: "14" });
      if (status !== "ALL") params.set("status", status);
      if (scheduleId !== "ALL") params.set("scheduleId", scheduleId);
      return apiGet<ListResp>(`/api/admin/classes?${params.toString()}`);
    },
    refetchInterval: 60 * 1000,
  });

  const runJob = useMutation({
    mutationFn: (job: "generate" | "remind" | "retry") =>
      apiPost(`/api/admin/classes/generate?job=${job}`, {}),
    onSuccess: (data, job) => {
      const msgs: Record<string, string> = {
        generate: "Generated classes for the look-ahead window",
        remind: "Reminder job dispatched",
        retry: "Retried failed WhatsApp messages",
      };
      toast.success(`${job} complete`, {
        description: `${msgs[job]}. Result: ${JSON.stringify(data.result).slice(0, 120)}`,
      });
      qc.invalidateQueries({ queryKey: ["admin", "classes"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) =>
      toast.error("Worker job failed", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Generated classes"
        description="YogaClass rows produced by the class generator worker."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin", "classes"] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => runJob.mutate("generate")}
              disabled={runJob.isPending && runJob.variables === "generate"}
            >
              {runJob.isPending && runJob.variables === "generate" ? (
                <Spinner />
              ) : (
                <Zap className="h-4 w-4" />
              )}{" "}
              Generate now
            </Button>
            <Button
              onClick={() => runJob.mutate("remind")}
              disabled={runJob.isPending && runJob.variables === "remind"}
            >
              {runJob.isPending && runJob.variables === "remind" ? (
                <Spinner />
              ) : (
                <Send className="h-4 w-4" />
              )}{" "}
              Send reminders
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-3 md:p-4 flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11 rounded-full font-semibold w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scheduleId} onValueChange={setScheduleId}>
            <SelectTrigger className="h-11 rounded-full font-semibold w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All schedules</SelectItem>
              {schedulesQ.data?.items.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            Next 14 days · {q.data?.items.length ?? 0} of 200 max
          </span>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : q.isError ? (
        <ErrorCard
          message={(q.error as ApiError)?.message ?? "Couldn't load classes."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "classes", status, scheduleId] })}
        />
      ) : (q.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No classes in the next 14 days"
          description="Run the worker to generate classes for the look-ahead window, or adjust your filters."
          action={
            <Button onClick={() => runJob.mutate("generate")}>
              <Zap className="h-4 w-4" /> Generate now
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Meet link</TableHead>
                <TableHead className="hidden lg:table-cell">Reminder</TableHead>
                <TableHead className="hidden lg:table-cell">Google event</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data!.items.map((c) => {
                const isOpen = expanded === c.id;
                return (
                  <Fragment key={c.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                    >
                      <TableCell className="w-8">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-center justify-center h-11 w-11 rounded-2xl bg-secondary shrink-0">
                            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
                              {shortDate(c.date).split(" ")[0]}
                            </span>
                            <span className="text-sm font-semibold leading-none">
                              {shortDate(c.date).split(" ")[1]}
                            </span>
                          </div>
                          <span className="hidden md:inline text-xs text-muted-foreground">
                            {prettyDate(c.date)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {prettyTime(c.startTime)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            – {prettyTime(c.endTime)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <Video className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm truncate">{c.scheduleName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.meetUrl ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-success-soft px-3 text-xs font-extrabold text-success">
                              <Sparkles className="h-3 w-3" /> Auto-created
                            </span>
                            <a
                              href={c.meetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex min-h-11 items-center gap-1 text-primary text-sm font-bold hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              meet
                            </a>
                            <CopyButton
                              text={c.meetUrl}
                              label="Copy Meet link"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No link yet
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {c.reminderSentAt ? (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-success-soft text-success"
                          >
                            <Bell className="h-3 w-3" /> Sent
                          </Badge>
                        ) : c.reminderAt ? (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-marigold/30 text-foreground"
                          >
                            Scheduled
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {c.googleEventId ? (
                          <MonoText>
                            {c.googleEventId.slice(0, 16)}…
                          </MonoText>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <ClassActions
                          cls={c}
                          onDone={() =>
                            qc.invalidateQueries({ queryKey: ["admin", "classes"] })
                          }
                        />
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow
                        className="bg-muted/20 cursor-default"
                      >
                        <TableCell></TableCell>
                        <TableCell colSpan={8}>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2 text-sm">
                            <div>
                              <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                                Class ID
                              </p>
                              <MonoText>{c.id}</MonoText>
                            </div>
                            <div>
                              <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                                Meet URL
                              </p>
                              {c.meetUrl ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-success-soft px-3 text-xs font-extrabold text-success">
                                    <Sparkles className="h-3 w-3" /> Auto-created
                                  </span>
                                  <MonoText>
                                    {c.meetUrl.replace(/^https?:\/\//, "")}
                                  </MonoText>
                                  <CopyButton text={c.meetUrl} label="Copy Meet URL" />
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  No meet URL yet — Google event still pending.
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                                Reminder scheduled for
                              </p>
                              <span className="text-sm">
                                {istDateTime(c.reminderAt)}
                              </span>
                              {c.reminderSentAt && (
                                <p className="text-[11px] text-success mt-0.5">
                                  Sent at {istDateTime(c.reminderSentAt)}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                                Google event ID
                              </p>
                              <div className="flex items-center gap-1">
                                <MonoText>{c.googleEventId ?? "—"}</MonoText>
                                {c.googleEventId && (
                                  <CopyButton
                                    text={c.googleEventId}
                                    label="Copy Google event ID"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// Per-row class actions: Complete (when READY) and Re-open (when COMPLETED).
// Both are idempotent and call the dedicated endpoints.
function ClassActions({
  cls,
  onDone,
}: {
  cls: YogaClass;
  onDone: () => void;
}) {
  const completeMut = useMutation({
    mutationFn: () => apiPost(`/api/admin/classes/${cls.id}/complete`),
    onSuccess: () => {
      toast.success("Class marked completed");
      onDone();
    },
    onError: (e: ApiError) => toast.error(e.message ?? "Couldn't complete class"),
  });
  const reopenMut = useMutation({
    mutationFn: () => apiPost(`/api/admin/classes/${cls.id}/reopen`),
    onSuccess: () => {
      toast.success("Class re-opened", {
        description: "Status set back to READY. Join link is visible again.",
      });
      onDone();
    },
    onError: (e: ApiError) => toast.error(e.message ?? "Couldn't re-open class"),
  });

  if (cls.status === "CANCELLED" || cls.status === "FAILED") {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }
  if (cls.status === "COMPLETED") {
    return (
      <Button
        variant="outline"
        className="text-foreground border-marigold hover:bg-marigold/20"
        disabled={reopenMut.isPending}
        onClick={(e) => {
          e.stopPropagation();
          reopenMut.mutate();
        }}
      >
        {reopenMut.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        Re-open
      </Button>
    );
  }
  if (cls.status === "READY" && cls.meetUrl) {
    return (
      <Button
        variant="outline"
        className="text-success border-success/40 hover:bg-success-soft"
        disabled={completeMut.isPending}
        onClick={(e) => {
          e.stopPropagation();
          completeMut.mutate();
        }}
      >
        {completeMut.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Complete
      </Button>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">—</span>
  );
}
