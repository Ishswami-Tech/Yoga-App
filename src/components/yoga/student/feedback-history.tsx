"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ArrowLeft, MessageSquare, Inbox } from "lucide-react";
import { useApp } from "@/lib/store";
import { ErrorCard, EmptyState } from "./shared";
import { prettyDate } from "./format";
import { SunFan } from "../art/sunrise";

type FeedbackItem = {
  id: string;
  classId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  classDate: string | null;
  scheduleName: string | null;
};

type FeedbackResp = { items: FeedbackItem[] };

export function FeedbackHistoryView() {
  const { setView } = useApp();
  const qc = useQueryClient();
  const q = useQuery<FeedbackResp>({
    queryKey: ["feedback"],
    queryFn: () => apiGet<FeedbackResp>("/api/feedback"),
  });

  if (q.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Card className="rounded-3xl">
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  if (q.isError)
    return (
      <ErrorCard
        message={(q.error as any)?.message ?? "Couldn't load your feedback."}
        onRetry={() => qc.invalidateQueries({ queryKey: ["feedback"] })}
      />
    );

  const items = q.data?.items ?? [];
  const avgRating =
    items.length > 0
      ? (items.reduce((a, f) => a + f.rating, 0) / items.length).toFixed(1)
      : "0";

  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-between gap-4 flex-wrap overflow-hidden rounded-3xl bg-sunrise-sky p-5 text-[#3B1F1A] shadow-lift">
        <SunFan size={180} className="pointer-events-none absolute -right-12 -top-16" />
        <div className="relative">
          <h1 className="font-display text-4xl font-semibold leading-tight">My feedback</h1>
          <p className="text-sm font-semibold">
            Your class ratings and comments
          </p>
        </div>
        <Button variant="outline" className="relative min-h-11 bg-card border-foreground/80" onClick={() => setView("student-dashboard")}>
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Button>
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-3xl shadow-soft">
            <CardContent className="p-4 text-center space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="font-display text-3xl font-bold leading-none">{items.length}</p>
              <p className="text-xs font-semibold text-muted-foreground">ratings given</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl shadow-soft">
            <CardContent className="p-4 text-center space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Average</p>
              <div className="flex items-center justify-center gap-1">
                <p className="font-display text-3xl font-bold leading-none text-primary">{avgRating}</p>
                <Star className="h-4 w-4 fill-marigold text-foreground" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">stars given</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl shadow-soft">
            <CardContent className="p-4 text-center space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Comments</p>
              <p className="font-display text-3xl font-bold leading-none">{items.filter((f) => f.comment).length}</p>
              <p className="text-xs font-semibold text-muted-foreground">written</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feedback list */}
      {items.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No feedback yet"
          description="Rate a class after it ends and your feedback will appear here."
          tone="warm"
        />
      ) : (
        <Card className="rounded-3xl shadow-soft">
          <CardContent className="p-0 divide-y-2 divide-dotted divide-border">
            {items.map((f) => (
              <div key={f.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm truncate">
                      {f.scheduleName ?? "Yoga Class"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.classDate ? prettyDate(f.classDate) : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-4 w-4 ${
                          s <= f.rating
                            ? "fill-marigold text-foreground"
                            : "text-muted-foreground/50"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {f.comment && (
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{f.comment}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
