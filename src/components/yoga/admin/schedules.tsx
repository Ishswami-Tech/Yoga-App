"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Globe,
  RefreshCw,
  CalendarX,
} from "lucide-react";
import { toast } from "sonner";
import { prettyTime } from "@/components/yoga/student/format";
import {
  PageHeader,
  ErrorCard,
  EmptyState,
  Spinner,
  istDate,
} from "./shared";

type Schedule = {
  id: string;
  name: string;
  timezone: string;
  startTime: string;
  endTime: string;
  active: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  createdAt: string;
  _count: { classes: number; exceptions: number };
};

type ListResp = { items: Schedule[] };

const WEEKDAYS: Array<{
  key: keyof Omit<Schedule, "id" | "name" | "timezone" | "startTime" | "endTime" | "active" | "createdAt" | "_count">;
  label: string;
}> = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

export function SchedulesView() {
  const qc = useQueryClient();
  const q = useQuery<ListResp>({
    queryKey: ["admin", "schedules"],
    queryFn: () => apiGet<ListResp>("/api/admin/schedules"),
    refetchInterval: 60 * 1000,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [deletingId, setDeletingId] = useState<Schedule | null>(null);

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost("/api/admin/schedules", body),
    onSuccess: () => {
      toast.success("Schedule created");
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "schedules"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't create schedule", { description: e.message }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch(`/api/admin/schedules/${id}`, body),
    onSuccess: () => {
      toast.success("Schedule updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "schedules"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't update schedule", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/schedules/${id}`),
    onSuccess: () => {
      toast.success("Schedule deleted");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "schedules"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't delete schedule", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schedules"
        description="Recurring weekly class templates — one per instructor/program."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin", "schedules"] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setAddKey((k) => k + 1);
                setAddOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add schedule
            </Button>
          </>
        }
      />

      {q.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : q.isError ? (
        <ErrorCard
          message={(q.error as ApiError)?.message ?? "Couldn't load schedules."}
          onRetry={() => qc.invalidateQueries({ queryKey: ["admin", "schedules"] })}
        />
      ) : (q.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="No schedules yet"
          description="Add a recurring weekly schedule to start generating yoga classes."
          action={
            <Button
              size="sm"
              onClick={() => {
                setAddKey((k) => k + 1);
                setAddOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add schedule
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {q.data!.items.map((s) => (
            <ScheduleCard
              key={s.id}
              s={s}
              onEdit={() => setEditing(s)}
              onDelete={() => setDeletingId(s)}
            />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add schedule</DialogTitle>
            <DialogDescription>
              Weekly recurring template. Classes are generated from this each look-ahead window.
            </DialogDescription>
          </DialogHeader>
          <ScheduleForm
            key={`add-${addKey}`}
            isPending={createMut.isPending}
            onSubmit={(body) => createMut.mutate(body)}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name ?? "schedule"}</DialogTitle>
            <DialogDescription>
              Existing generated classes are not retroactively changed.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <ScheduleForm
              key={`edit-${editing.id}`}
              initial={editing}
              isPending={updateMut.isPending}
              onSubmit={(body) =>
                updateMut.mutate({ id: editing.id, body })
              }
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletingId?.name ?? "schedule"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All generated classes for this schedule remain in the system.
              Future look-ahead windows will simply stop creating new classes
              for it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deletingId) deleteMut.mutate(deletingId.id);
              }}
            >
              {deleteMut.isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
              Delete schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ScheduleCard({
  s,
  onEdit,
  onDelete,
}: {
  s: Schedule;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="font-semibold truncate">{s.name}</h3>
              {s.active ? (
                <Badge
                  variant="outline"
                  className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                >
                  Active
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-border bg-muted text-muted-foreground"
                >
                  Paused
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {prettyTime(s.startTime)} – {prettyTime(s.endTime)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {s.timezone}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit schedule">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              aria-label="Delete schedule"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map(({ key, label }) => {
            const on = s[key];
            return (
              <span
                key={key}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                  on
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground line-through"
                }`}
              >
                {label}
              </span>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center border-t border-border/60 pt-3">
          <Stat label="Classes" value={s._count?.classes ?? 0} />
          <Stat label="Exceptions" value={s._count?.exceptions ?? 0} />
          <Stat label="Created" value={istDate(s.createdAt)} small />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-medium ${small ? "text-[11px]" : "text-base"} truncate`}
      >
        {value}
      </span>
    </div>
  );
}

// --- Form (shared by create + edit, keyed to remount on switch) ---------

function ScheduleForm({
  initial,
  isPending,
  onSubmit,
  onCancel,
}: {
  initial?: Schedule;
  isPending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Kolkata");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "07:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "08:00");
  const [active, setActive] = useState(initial?.active ?? true);
  const [days, setDays] = useState<Record<string, boolean>>({
    monday: initial?.monday ?? true,
    tuesday: initial?.tuesday ?? true,
    wednesday: initial?.wednesday ?? true,
    thursday: initial?.thursday ?? true,
    friday: initial?.friday ?? true,
    saturday: initial?.saturday ?? true,
    sunday: initial?.sunday ?? true,
  });

  const valid =
    name.trim().length >= 2 &&
    /^\d{2}:\d{2}$/.test(startTime) &&
    /^\d{2}:\d{2}$/.test(endTime) &&
    timezone.trim().length > 0;

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Schedule name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Vinyasa Flow"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Start time (HH:mm)</Label>
            <Input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="07:00"
              pattern="\d{2}:\d{2}"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">End time (HH:mm)</Label>
            <Input
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="08:00"
              pattern="\d{2}:\d{2}"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Timezone</Label>
          <Input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Asia/Kolkata"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Active weekdays</Label>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDays((d) => ({ ...d, [key]: !d[key] }))}
                className={`text-[11px] font-medium py-1.5 rounded-md border transition-colors ${
                  days[key]
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
          <div className="flex flex-col">
            <Label className="text-xs">Active schedule</Label>
            <span className="text-[11px] text-muted-foreground">
              Pause to stop new class generation.
            </span>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!valid || isPending}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              timezone: timezone.trim(),
              startTime,
              endTime,
              active,
              ...days,
            })
          }
        >
          {isPending ? <Spinner /> : initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {initial ? "Save changes" : "Create schedule"}
        </Button>
      </DialogFooter>
    </>
  );
}
