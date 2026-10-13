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
  StatusBadge,
  istDate,
} from "./shared";
import { HeaderSun } from "@/components/yoga/art/admin-art";

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Classes"
        title="Class schedules"
        description="Recurring weekly class templates — one per instructor/program."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin", "schedules"] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
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
            <Skeleton key={i} className="h-56 rounded-3xl" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

      <div className="relative overflow-hidden rounded-3xl bg-[#FBE3B0] px-5 py-4 text-[#3B1F1A]">
        <HeaderSun className="pointer-events-none absolute -bottom-6 -right-8 opacity-80" />
        <p className="relative m-0 max-w-2xl pr-24 text-[15px] font-semibold leading-relaxed">
          A Google Meet link is created for each class day, and a WhatsApp reminder goes out shortly before the start. Holidays are set on the Exceptions page.
        </p>
      </div>

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
    <article
      className={`rounded-3xl p-6 shadow-soft ${
        s.active ? "bg-[#FFF0DA] text-[#3B1F1A] dark:bg-card dark:text-card-foreground" : "bg-card text-card-foreground border border-border/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-2xl font-semibold leading-tight">{s.name}</h3>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-extrabold">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {prettyTime(s.startTime)} – {prettyTime(s.endTime)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-muted-foreground">
              <Globe className="h-4 w-4" />
              {s.timezone}
            </span>
          </p>
        </div>
        <StatusBadge status={s.active ? "ACTIVE" : "IGNORED"} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="img" aria-label={`Runs ${WEEKDAYS.filter((w) => s[w.key]).map((w) => w.label).join(", ") || "no days"}`}>
        {WEEKDAYS.map(({ key, label }) => {
          const on = s[key];
          return (
            <span
              key={key}
              aria-hidden="true"
              className={`inline-flex min-h-8 min-w-11 items-center justify-center rounded-full px-3 text-[13px] font-extrabold ${
                on
                  ? "bg-[#8FAF8A] text-[#19301d]"
                  : "bg-secondary text-muted-foreground line-through"
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t-2 border-dotted border-border pt-4">
        <Stat label="Classes" value={s._count?.classes ?? 0} />
        <Stat label="Exceptions" value={s._count?.exceptions ?? 0} />
        <Stat label="Created" value={istDate(s.createdAt)} small />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="outline" onClick={onEdit} aria-label="Edit schedule">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
        <Button
          variant="ghost"
          onClick={onDelete}
          aria-label="Delete schedule"
          className="bg-[#F7C9B6] text-[#7A2A10] hover:bg-[#F7C9B6]/80 hover:text-[#7A2A10] dark:bg-[#E8792B]/25 dark:text-[#F7C9B6]"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </article>
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
    <div className="flex min-w-0 flex-col">
      <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`truncate ${small ? "text-sm font-bold mt-1.5" : "font-display text-3xl font-bold leading-tight"}`}
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
          <Label className="text-sm font-extrabold">Schedule name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Vinyasa Flow"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-extrabold">Start time (HH:mm)</Label>
            <Input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="07:00"
              pattern="\d{2}:\d{2}"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-extrabold">End time (HH:mm)</Label>
            <Input
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="08:00"
              pattern="\d{2}:\d{2}"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-extrabold">Timezone</Label>
          <Input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Asia/Kolkata"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-extrabold">Active weekdays</Label>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAYS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDays((d) => ({ ...d, [key]: !d[key] }))}
                aria-pressed={!!days[key]}
                className={`min-h-11 rounded-full border-2 text-[13px] font-extrabold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-foreground/80 ${
                  days[key]
                    ? "bg-[#3B1F1A] text-[#FFF4E0] border-[#3B1F1A] dark:bg-[#FFF4E0] dark:text-[#3B1F1A] dark:border-[#FFF4E0]"
                    : "bg-card text-foreground border-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-3xl bg-[#DCEBD8] px-5 py-4 text-[#244B2B] dark:bg-[#2F5A36]/40 dark:text-[#DCEBD8]">
          <div className="flex flex-col">
            <Label className="text-base font-extrabold">Active schedule</Label>
            <span className="text-sm font-bold">
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
