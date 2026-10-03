import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { run, fail, fromZodError } from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  classId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
});

// POST: submit class feedback (rating + optional comment).
// A student can only rate a class once — the unique (userId, classId)
// constraint enforces this. Re-submitting returns the existing feedback.
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const { classId, rating, comment } = parsed.data;

    // Verify the class exists
    const cls = await db.yogaClass.findUnique({ where: { id: classId } });
    if (!cls) return fail("Class not found", 404, { code: "NOT_FOUND" });

    // Check if feedback already exists (idempotent upsert)
    const existing = await db.classFeedback.findUnique({
      where: { userId_classId: { userId: user.id, classId } },
    });

    if (existing) {
      // Update the existing feedback
      const updated = await db.classFeedback.update({
        where: { id: existing.id },
        data: { rating, comment: comment?.trim() || null },
      });
      return NextResponse.json({ ok: true, feedback: updated, updated: true });
    }

    const feedback = await db.classFeedback.create({
      data: {
        userId: user.id,
        classId,
        rating,
        comment: comment?.trim() || null,
      },
    });
    return NextResponse.json({ ok: true, feedback, updated: false });
  });
}

// GET: current student's feedback history
export async function GET() {
  return run(async () => {
    const user = await requireAuth();
    const feedbacks = await db.classFeedback.findMany({
      where: { userId: user.id },
      include: {
        yogaClass: {
          include: { schedule: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      items: feedbacks.map((f) => ({
        id: f.id,
        classId: f.classId,
        rating: f.rating,
        comment: f.comment,
        createdAt: f.createdAt,
        classDate: f.yogaClass?.date ?? null,
        scheduleName: f.yogaClass?.schedule?.name ?? null,
      })),
    });
  });
}
