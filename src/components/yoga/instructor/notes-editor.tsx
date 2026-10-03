"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, ApiError } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StickyNote,
  Save,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { prettyDate, prettyTime } from "@/components/yoga/student/format";

type NotesResp = {
  classId: string;
  date: string;
  scheduleName: string;
  notes: string | null;
};

export function NotesEditorDialog({
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
  const [text, setText] = useState<string | null>(null); // null = not yet loaded

  const q = useQuery<NotesResp>({
    queryKey: ["class", "notes", classId],
    queryFn: () => apiGet<NotesResp>(`/api/classes/${classId}/notes`),
    enabled: open && !!classId,
    staleTime: 0,
  });

  // Derive the current text: use local state once loaded, fall back to server data.
  const currentText = text ?? q.data?.notes ?? "";

  const saveMut = useMutation({
    mutationFn: () =>
      apiPatch(`/api/admin/classes/${classId}/notes`, { notes: currentText }),
    onSuccess: () => {
      toast.success("Notes saved", {
        description: "Attendees will see them on Today's class.",
      });
      qc.invalidateQueries({ queryKey: ["class", "notes", classId] });
      qc.invalidateQueries({ queryKey: ["classes", "today"] });
      qc.invalidateQueries({ queryKey: ["instructor", "classes"] });
      onOpenChange(false);
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't save notes", { description: e.message }),
  });

  const clearMut = useMutation({
    mutationFn: () =>
      apiPatch(`/api/admin/classes/${classId}/notes`, { notes: null }),
    onSuccess: () => {
      toast.success("Notes cleared");
      setText("");
      qc.invalidateQueries({ queryKey: ["class", "notes", classId] });
      qc.invalidateQueries({ queryKey: ["classes", "today"] });
      onOpenChange(false);
    },
    onError: (e: ApiError) => toast.error("Couldn't clear notes"),
  });

  const maxLen = 2000;
  const remaining = maxLen - currentText.length;
  const hasExisting = !!q.data?.notes;
  const isUnchanged = currentText.trim() === (q.data?.notes ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Class notes
          </DialogTitle>
          <DialogDescription>
            {classLabel} · visible to active members on Today&apos;s class.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes-text" className="text-sm font-medium">
                Note for attendees
              </Label>
              <Textarea
                id="notes-text"
                value={currentText}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Today we focus on hip openers. Bring a bolster if you have one."
                className="min-h-[120px] resize-y"
                maxLength={maxLen}
              />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Supports multi-line text
                </span>
                <span className={remaining < 100 ? "text-rose-600 font-medium" : "text-muted-foreground"}>
                  {remaining} left
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
              {hasExisting ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-700 hover:text-rose-800 hover:bg-rose-500/10"
                  disabled={clearMut.isPending}
                  onClick={() => clearMut.mutate()}
                >
                  {clearMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Clear
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-brand-gradient text-primary-foreground"
                  disabled={saveMut.isPending || isUnchanged}
                  onClick={() => saveMut.mutate()}
                >
                  {saveMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
