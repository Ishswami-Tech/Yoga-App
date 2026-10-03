"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageSquare, TrendingUp, Award } from "lucide-react";
import { prettyDate } from "@/components/yoga/student/format";

type FeedbackSummary = {
  summary: {
    totalCount: number;
    avgRating: number;
    hasFeedback: boolean;
  };
  distribution: { star: number; count: number }[];
  recent: {
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    studentName: string;
    className: string;
    classDate: string;
  }[];
  byClass: {
    classId: string;
    className: string;
    classDate: string;
    avgRating: number;
    count: number;
  }[];
};

export function FeedbackSummaryCard() {
  const q = useQuery<FeedbackSummary>({
    queryKey: ["instructor", "feedback"],
    queryFn: () => apiGet<FeedbackSummary>("/api/instructor/feedback"),
  });

  if (q.isLoading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }
  if (q.isError || !q.data || !q.data.summary.hasFeedback) return null;

  const { summary, distribution, recent, byClass } = q.data;
  const maxDist = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/15 grid place-items-center">
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Class feedback
                </p>
                <p className="text-sm font-medium">
                  {summary.totalCount} rating{summary.totalCount === 1 ? "" : "s"} across your classes
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                <span className="text-3xl font-bold text-amber-500">{summary.avgRating}</span>
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-[10px] text-muted-foreground">average rating</p>
            </div>
          </div>

          {/* Rating distribution */}
          <div className="space-y-1">
            {distribution.slice().reverse().map((d) => (
              <div key={d.star} className="flex items-center gap-2 text-xs">
                <span className="w-8 text-right text-muted-foreground flex items-center gap-0.5 justify-end">
                  {d.star} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-4 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                    style={{ width: `${(d.count / maxDist) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-muted-foreground tabular-nums">{d.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent comments */}
      {recent.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-primary" /> Recent comments
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto scroll-soft">
              {recent.map((r) => (
                <div key={r.id} className="rounded-lg border border-border/40 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3 w-3 ${
                            s <= r.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {prettyDate(r.classDate)}
                    </span>
                  </div>
                  <p className="text-sm">{r.comment}</p>
                  <p className="text-[10px] text-muted-foreground">
                    — {r.studentName}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-class breakdown */}
      {byClass.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Award className="h-4 w-4 text-primary" /> Top-rated classes
            </p>
            <div className="space-y-1.5">
              {byClass.slice(0, 5).map((c) => (
                <div
                  key={c.classId}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-accent/20 transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.className}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {prettyDate(c.classDate)} · {c.count} rating{c.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold text-amber-500">{c.avgRating}</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
