"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarOff,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { prettyDate } from "@/components/yoga/student/format";
import {
  PageHeader,
  ExceptionTypeBadge,
  ErrorCard,
  EmptyState,
  Spinner,
  todayIST,
} from "./shared";

type Schedule = {
  id: string;
  name: string;
  timezone: string;
  startTime: string;
  endTime: string;
  active: boolean;
};

type Exception = {
  id: string;
  scheduleId: string;
  date: string;
  type: "NO_CLASS" | "SPECIAL";
  reason: string | null;
  schedule: { name: string };
};

export function ExceptionsView() {
  const [scheduleId, setScheduleId] = useState<string>("ALL");
  const [addKey, setAddKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const qc = useQueryClient();

  const schedulesQ = useQuery<{ items: Schedule[] }>({
    queryKey: ["admin", "schedules"],
    queryFn: () => apiGet<{ items: Schedule[] }>("/api/admin/schedules"),
    staleTime: 5 * 60 * 1000,
  });

  const exQ = useQuery<{ items: Exception[] }>({
    queryKey: ["admin", "exceptions", scheduleId],
    queryFn: () =>
      apiGet<{ items: Exception[] }>(
        `/api/admin/exceptions${
          scheduleId !== "ALL" ? `?scheduleId=${scheduleId}` : ""
        }`
      ),
    refetchInterval: 60 * 1000,
  });

  const createMut = useMutation({
    mutationFn: (body: {
      scheduleId: string;
      date: string;
      type: "NO_CLASS" | "SPECIAL";
      reason?: string;
    }) => apiPost("/api/admin/exceptions", body),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.type === "NO_CLASS" ? "Holiday marked — class cancelled" : "Special day added"
      );
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "exceptions"] });
      qc.invalidateQueries({ queryKey: ["admin", "schedules"] });
      qc.invalidateQueries({ queryKey: ["admin", "classes"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't create exception", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/exceptions/${id}`),
    onSuccess: () => {
      toast.success("Exception removed");
      qc.invalidateQueries({ queryKey: ["admin", "exceptions"] });
      qc.invalidateQueries({ queryKey: ["admin", "schedules"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't delete exception", { description: e.message }),
  });

  const scheduleName = (id: string) =>
    schedulesQ.data?.items.find((s) => s.id === id)?.name ?? "Unknown";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exceptions"
        description="One-off dates that override the recurring weekly schedule."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin", "exceptions"] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Select
              value={scheduleId}
              onValueChange={setScheduleId}
            >
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
            <Button
              onClick={() => {
                setAddKey((k) => k + 1);
                setAddOpen(true);
              }}
              disabled={!schedulesQ.data?.items.length}
            >
              <Plus className="h-4 w-4" /> Add exception
            </Button>
          </>
        }
      />

      {exQ.isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : exQ.isError ? (
        <ErrorCard
          message={(exQ.error as ApiError)?.message ?? "Couldn't load exceptions."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "exceptions", scheduleId] })}
        />
      ) : (exQ.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="No exceptions"
          description={
            schedulesQ.data?.items.length
              ? "Mark holidays (NO_CLASS) or special days to override the recurring schedule."
              : "You need at least one schedule before adding exceptions."
          }
          action={
            schedulesQ.data?.items.length ? (
              <Button
                onClick={() => {
                  setAddKey((k) => k + 1);
                  setAddOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add exception
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="hidden md:table-cell">Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exQ.data!.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{prettyDate(e.date)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {e.date}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ExceptionTypeBadge type={e.type} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{e.schedule?.name ?? scheduleName(e.scheduleId)}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {e.reason ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete exception"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMut.mutate(e.id)}
                      disabled={deleteMut.isPending && deleteMut.variables === e.id}
                    >
                      {deleteMut.isPending && deleteMut.variables === e.id ? (
                        <Spinner />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add exception</DialogTitle>
            <DialogDescription>
              NO_CLASS cancels any generated class for that date. SPECIAL just
              flags it (used for guest teachers / different timings).
            </DialogDescription>
          </DialogHeader>
          <ExceptionForm
            key={addKey}
            schedules={schedulesQ.data?.items ?? []}
            isPending={createMut.isPending}
            onSubmit={(body) => createMut.mutate(body)}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExceptionForm({
  schedules,
  isPending,
  onSubmit,
  onCancel,
}: {
  schedules: Schedule[];
  isPending: boolean;
  onSubmit: (body: {
    scheduleId: string;
    date: string;
    type: "NO_CLASS" | "SPECIAL";
    reason?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [scheduleId, setScheduleId] = useState(schedules[0]?.id ?? "");
  const [date, setDate] = useState(todayIST());
  const [type, setType] = useState<"NO_CLASS" | "SPECIAL">("NO_CLASS");
  const [reason, setReason] = useState("");

  const valid = !!scheduleId && /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-bold">Schedule</Label>
          <Select value={scheduleId} onValueChange={setScheduleId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick a schedule" />
            </SelectTrigger>
            <SelectContent>
              {schedules.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-bold">Date (YYYY-MM-DD)</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            pattern="\d{4}-\d{2}-\d{2}"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-bold">Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as "NO_CLASS" | "SPECIAL")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NO_CLASS">No class (holiday)</SelectItem>
              <SelectItem value="SPECIAL">Special day</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-bold">Reason (optional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Diwali holiday / Guest teacher workshop"
            rows={3}
          />
        </div>
        {type === "NO_CLASS" && (
          <div className="flex items-start gap-2 rounded-2xl border border-marigold/60 bg-marigold/15 p-3.5 text-xs font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Already-generated classes for this date will be marked{" "}
              <span className="font-medium">CANCELLED</span>. Students will see
              the rest-day empty state.
            </p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!valid || isPending}
          onClick={() =>
            onSubmit({
              scheduleId,
              date,
              type,
              reason: reason.trim() || undefined,
            })
          }
        >
          {isPending ? <Spinner /> : <Plus className="h-4 w-4" />}
          Add exception
        </Button>
      </DialogFooter>
    </>
  );
}
