import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Admin feedback analytics — overall rating across all classes + trends.
export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");

    const feedbacks = await db.classFeedback.findMany({
      include: {
        yogaClass: { include: { schedule: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalCount = feedbacks.length;
    const avgRating =
      totalCount > 0
        ? Math.round((feedbacks.reduce((a, f) => a + f.rating, 0) / totalCount) * 10) / 10
        : 0;

    const distribution = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: feedbacks.filter((f) => f.rating === star).length,
    }));

    // Per-schedule average
    const byScheduleMap = new Map<string, { name: string; ratings: number[] }>();
    for (const f of feedbacks) {
      const name = f.yogaClass?.schedule?.name ?? "Unknown";
      const entry = byScheduleMap.get(name) ?? { name, ratings: [] };
      entry.ratings.push(f.rating);
      byScheduleMap.set(name, entry);
    }
    const bySchedule = [...byScheduleMap.entries()]
      .map(([name, e]) => ({
        scheduleName: name,
        avgRating: Math.round((e.ratings.reduce((a, r) => a + r, 0) / e.ratings.length) * 10) / 10,
        count: e.ratings.length,
      }))
      .sort((a, b) => b.avgRating - a.avgRating);

    // Recent comments (last 5)
    const recentComments = feedbacks
      .filter((f) => f.comment)
      .slice(0, 5)
      .map((f) => ({
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        className: f.yogaClass?.schedule?.name ?? "—",
        classDate: f.yogaClass?.date ?? "—",
        createdAt: f.createdAt,
      }));

    // Monthly trend (last 6 months): average rating per month
    const now = new Date();
    const monthsTrend: { month: string; avgRating: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      const monthFeedback = feedbacks.filter((f) => {
        const fd = f.createdAt;
        const fkey = `${fd.getUTCFullYear()}-${String(fd.getUTCMonth() + 1).padStart(2, "0")}`;
        return fkey === key;
      });
      const avg = monthFeedback.length > 0
        ? Math.round((monthFeedback.reduce((a, f) => a + f.rating, 0) / monthFeedback.length) * 10) / 10
        : 0;
      monthsTrend.push({ month: label, avgRating: avg, count: monthFeedback.length });
    }

    return NextResponse.json({
      summary: { totalCount, avgRating, hasFeedback: totalCount > 0 },
      distribution,
      bySchedule,
      recentComments,
      monthsTrend,
    });
  });
}
