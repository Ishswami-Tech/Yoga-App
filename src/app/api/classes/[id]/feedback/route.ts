import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// GET: feedback for a specific class — instructor/admin view.
// Returns all feedback entries with student names + ratings + comments.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    await requireRole(["INSTRUCTOR", "ADMIN"]);
    const { id: classId } = await ctx.params;

    const [feedbacks, stats] = await Promise.all([
      db.classFeedback.findMany({
        where: { classId },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.classFeedback.aggregate({
        where: { classId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    return NextResponse.json({
      items: feedbacks.map((f) => ({
        id: f.id,
        userId: f.userId,
        studentName: f.user?.name ?? "—",
        studentEmail: f.user?.email ?? "—",
        rating: f.rating,
        comment: f.comment,
        createdAt: f.createdAt,
      })),
      summary: {
        count: stats._count._all,
        averageRating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
      },
    });
  });
}
