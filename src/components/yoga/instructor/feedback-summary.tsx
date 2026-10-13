"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageSquare, TrendingUp, Award } from "lucide-react";
import { prettyDate } from "@/components/yoga/student/format";
import { Eyebrow } from "./shared";
import { PetalBloom } from "@/components/yoga/art/instructor-art";

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
      <Card>
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
      <Card className="relative overflow-hidden bg-secondary border-0 rounded-[2rem]">
        <PetalBloom size={90} className="absolute right-3 top-3" />
        <CardContent className="relative p-6 md:p-7 space-y-4">
          <div className="space-y-1">
            <Eyebrow>Class feedback</Eyebrow>
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-6xl md:text-7xl font-bold leading-none">
                {summary.avgRating}
              </span>
              <span className="text-sm font-bold">out of 5</span>
            </div>
            <div
              role="img"
              aria-label={`${summary.avgRating} out of 5 stars`}
              className="flex gap-1 pt-1"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-5 w-5 ${
                    n <= Math.round(summary.avgRating)
                      ? "fill-marigold text-marigold"
                      : "text-muted-foreground/50"
                  }`}
                />
              ))}
            </div>
            <p className="text-base font-semibold pt-1">
              {summary.totalCount} rating{summary.totalCount === 1 ? "" : "s"} across your classes
            </p>
          </div>

          {/* Rating distribution */}
          <div className="space-y-1.5">
            {distribution.slice().reverse().map((d) => (
              <div key={d.star} className="flex items-center gap-2 text-sm font-bold">
                <span className="w-9 text-right flex items-center gap-0.5 justify-end">
                  {d.star} <Star className="h-3.5 w-3.5 fill-marigold text-marigold" />
                </span>
                <div className="flex-1 h-4 rounded-full bg-card overflow-hidden">
                  <div
                    className="h-full bg-saffron rounded-full transition-all"
                    style={{ width: `${(d.count / maxDist) * 100}%` }}
                  />
                </div>
                <span className="w-6 tabular-nums">{d.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent comments */}
      {recent.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="font-display text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Recent comments
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto scroll-soft">
              {recent.map((r) => (
                <div key={r.id} className="rounded-2xl border-2 border-dotted border-border p-4 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= r.rating
                              ? "fill-marigold text-marigold"
                              : "text-muted-foreground/40"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {prettyDate(r.classDate)}
                    </span>
                  </div>
                  <p className="text-base">{r.comment}</p>
                  <p className="text-xs text-muted-foreground">
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
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="font-display text-xl font-semibold flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Top-rated classes
            </p>
            <div className="space-y-1.5">
              {byClass.slice(0, 5).map((c) => (
                <div
                  key={c.classId}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-2xl hover:bg-accent/30 transition"
                >
                  <div className="min-w-0">
                    <p className="font-bold truncate">{c.className}</p>
                    <p className="text-xs text-muted-foreground">
                      {prettyDate(c.classDate)} · {c.count} rating{c.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-extrabold">{c.avgRating}</span>
                    <Star className="h-4 w-4 fill-marigold text-marigold" />
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
