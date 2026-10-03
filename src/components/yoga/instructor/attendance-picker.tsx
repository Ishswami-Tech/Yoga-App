"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Check,
  UserCheck,
  UserX,
  Loader2,
  CheckCircle2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

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

export function AttendancePickerDialog({
  classId,
  open,
  onOpenChange,
  classLabel,
}: {
  classId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classLabel: string;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const q = useQuery<RosterResp>({
    queryKey: ["attendance", "roster", classId],
    queryFn: () => apiGet<RosterResp>(`/api/instructor/classes/${classId}/attendance`),
    enabled: open,
    staleTime: 0, // Always refetch when the dialog opens
  });

  // Optimistic overrides: map userId -> attended (true/false). Applied on top
  // of the server roster so toggles feel instant without waiting for the
  // API round-trip. Cleared when the dialog closes or the server refetches.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const roster = useMemo<RosterEntry[]>(() => {
    const base = q.data?.roster ?? [];
    if (Object.keys(overrides).length === 0) return base;
    return base.map((r) =>
      overrides[r.userId] !== undefined
        ? { ...r, attended: overrides[r.userId] }
        : r
    );
  }, [q.data?.roster, overrides]);

  const filtered = useMemo(() => {
    if (!search.trim()) return roster;
    const s = search.toLowerCase();
    return roster.filter(
      (r) =>
        r.studentName.toLowerCase().includes(s) ||
        r.studentEmail.toLowerCase().includes(s)
    );
  }, [roster, search]);

  const attendedCount = roster.filter((r) => r.attended).length;

  const markOneMut = useMutation({
    mutationFn: async (userId: string) => {
      return apiPost(`/api/instructor/classes/${classId}/attendance`, {
        userIds: [userId],
      });
    },
    onMutate: (userId) => {
      setOverrides((prev) => ({ ...prev, [userId]: true }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance", "roster", classId] });
    },
    onError: (e: any, userId) => {
      // Rollback
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      toast.error(e.message ?? "Couldn't mark attendance");
    },
  });

  const unmarkOneMut = useMutation({
    mutationFn: async (userId: string) => {
      return apiDelete(`/api/instructor/classes/${classId}/attendance/${userId}`);
    },
    onMutate: (userId) => {
      setOverrides((prev) => ({ ...prev, [userId]: false }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance", "roster", classId] });
    },
    onError: (e: any, userId) => {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      toast.error(e.message ?? "Couldn't remove attendance");
    },
  });

  const markAllMut = useMutation({
    mutationFn: () =>
      apiPost(`/api/instructor/classes/${classId}/attendance`, { allActive: true }),
    onSuccess: (res: any) => {
      toast.success("Marked all active members", {
        description: `${res.created} new · ${res.skipped} already recorded`,
      });
      // Optimistically mark all as attended
      const allTrue: Record<string, boolean> = {};
      (q.data?.roster ?? []).forEach((r) => (allTrue[r.userId] = true));
      setOverrides(allTrue);
      qc.invalidateQueries({ queryKey: ["attendance", "roster", classId] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: ApiError) => toast.error(e.message ?? "Couldn't mark all"),
  });

  const clearAllMut = useMutation({
    mutationFn: async () => {
      // Delete each attended record
      const attended = roster.filter((r) => r.attended);
      await Promise.all(
        attended.map((r) =>
          apiDelete(`/api/instructor/classes/${classId}/attendance/${r.userId}`)
        )
      );
    },
    onSuccess: () => {
      toast.success("Attendance cleared");
      const allFalse: Record<string, boolean> = {};
      (q.data?.roster ?? []).forEach((r) => (allFalse[r.userId] = false));
      setOverrides(allFalse);
      qc.invalidateQueries({ queryKey: ["attendance", "roster", classId] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: () => toast.error("Couldn't clear attendance"),
  });

  const toggle = (entry: RosterEntry) => {
    if (entry.attended) {
      unmarkOneMut.mutate(entry.userId);
    } else {
      markOneMut.mutate(entry.userId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Record attendance
          </DialogTitle>
          <DialogDescription>
            {classLabel} · tap a student to toggle their attendance.
          </DialogDescription>
        </DialogHeader>

        {/* Summary + bulk actions */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/40">
          <Badge
            variant="outline"
            className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 gap-1"
          >
            <CheckCircle2 className="h-3 w-3" />
            {attendedCount} / {roster.length} attended
          </Badge>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-700 border-emerald-600/40 hover:bg-emerald-500/10"
              disabled={markAllMut.isPending}
              onClick={() => markAllMut.mutate()}
            >
              {markAllMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5" />
              )}
              Mark all
            </Button>
            {attendedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-rose-700 border-rose-600/40 hover:bg-rose-500/10"
                disabled={clearAllMut.isPending}
                onClick={() => clearAllMut.mutate()}
              >
                {clearAllMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserX className="h-3.5 w-3.5" />
                )}
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students…"
            className="pl-9"
          />
        </div>

        {/* Roster list */}
        <div className="flex-1 overflow-y-auto scroll-soft -mx-1 px-1 min-h-0">
          {q.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : q.isError ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Couldn&apos;t load the roster. Close and try again.
            </p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {roster.length === 0
                  ? "No active members yet."
                  : "No students match your search."}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((r) => {
                const busy =
                  (markOneMut.isPending && markOneMut.variables === r.userId) ||
                  (unmarkOneMut.isPending && unmarkOneMut.variables === r.userId);
                return (
                  <button
                    key={r.userId}
                    onClick={() => toggle(r)}
                    disabled={busy}
                    className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                      r.attended
                        ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                        : "border-border bg-card hover:bg-accent/40"
                    } ${busy ? "opacity-60" : ""}`}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback
                        className={
                          r.attended
                            ? "bg-emerald-500/15 text-emerald-700 text-xs font-semibold"
                            : "bg-muted text-muted-foreground text-xs font-semibold"
                        }
                      >
                        {r.studentName
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {r.studentName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.studentEmail}
                      </p>
                    </div>
                    <div
                      className={`h-6 w-6 rounded-full grid place-items-center shrink-0 transition ${
                        r.attended
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : r.attended ? (
                        <Check className="h-4 w-4" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-border/40 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Changes save instantly.
          </p>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
