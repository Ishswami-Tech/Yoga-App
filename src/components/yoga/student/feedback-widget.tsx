"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function FeedbackWidget({
  classId,
  scheduleName,
}: {
  classId: string;
  scheduleName: string;
}) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      apiPost("/api/feedback", { classId, rating, comment: comment || null }),
    onSuccess: () => {
      toast.success("Thanks for your feedback! 🙏");
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["feedback"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't submit feedback"),
  });

  if (submitted) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/15 grid place-items-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-medium text-sm">Feedback submitted</p>
            <p className="text-xs text-muted-foreground">
              Thank you for rating {scheduleName}!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Star className="h-4 w-4 text-amber-500" /> How was today&apos;s class?
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rate {scheduleName} to help your instructor improve.
          </p>
        </div>

        {/* Star rating */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="transition hover:scale-110"
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
            >
              <Star
                className={`h-7 w-7 ${
                  star <= (hovered || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              {["", "Poor", "Fair", "Good", "Great", "Amazing"][rating]}
            </span>
          )}
        </div>

        {/* Comment */}
        {rating > 0 && (
          <>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional: what did you love? what could be better?"
              className="min-h-[80px] resize-y text-sm"
              maxLength={500}
            />
            <Button
              size="sm"
              className="bg-brand-gradient text-primary-foreground"
              disabled={mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Submit feedback"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
