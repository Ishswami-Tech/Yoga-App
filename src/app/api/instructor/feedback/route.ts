import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Instructor feedback summary — returns the instructor's overall rating,
// recent feedback across all their classes, and per-class breakdown.
export async function GET() {
  return run(async () => {
    await requireRole(["INSTRUCTOR", "ADMIN"]);

    // Get all feedback with class + student details
    const feedbacks = await db.classFeedback.findMany({
      include: {
        yogaClass: {
          include: { schedule: { select: { name: true } } },
        },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Overall stats
    const totalCount = feedbacks.length;
    const avgRating =
      totalCount > 0
        ? Math.round((feedbacks.reduce((a, f) => a + f.rating, 0) / totalCount) * 10) / 10
        : 0;

    // Rating distribution (1-5 stars)
    const distribution = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: feedbacks.filter((f) => f.rating === star).length,
    }));

    // Recent feedback (last 10 with comments)
    const recent = feedbacks
      .filter((f) => f.comment)
      .slice(0, 10)
      .map((f) => ({
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        createdAt: f.createdAt,
        studentName: f.user?.name ?? "—",
        className: f.yogaClass?.schedule?.name ?? "—",
        classDate: f.yogaClass?.date ?? "—",
      }));

    // Per-class average (group by classId)
    const byClassMap = new Map<string, { name: string; date: string; ratings: number[]; count: number }>();
    for (const f of feedbacks) {
      const key = f.classId;
      const entry = byClassMap.get(key) ?? {
        name: f.yogaClass?.schedule?.name ?? "—",
        date: f.yogaClass?.date ?? "—",
        ratings: [],
        count: 0,
      };
      entry.ratings.push(f.rating);
      entry.count++;
      byClassMap.set(key, entry);
    }
    const byClass = [...byClassMap.entries()]
      .map(([classId, e]) => ({
        classId,
        className: e.name,
        classDate: e.date,
        avgRating: Math.round((e.ratings.reduce((a, r) => a + r, 0) / e.count) * 10) / 10,
        count: e.count,
      }))
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalCount,
        avgRating,
        hasFeedback: totalCount > 0,
      },
      distribution,
      recent,
      byClass,
    });
  });
}
