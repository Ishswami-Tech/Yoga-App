import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { bulkMarkAttendance } from "@/lib/services/attendance";
import { run, notFound, fail } from "@/lib/api";
import { audit } from "@/lib/services/audit";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  userIds: z.array(z.string()).default([]),
  // If userIds is empty, mark ALL active members.
  allActive: z.boolean().default(false),
});

// POST: record attendance for a class.
//
// Instructors/admins can either pass an explicit list of userIds, or set
// allActive=true to mark every active member as attended (the common case
// after a live class). Idempotent per (userId, classId).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const actor = await requireRole(["INSTRUCTOR", "ADMIN"]);
    const { id: classId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fail("Invalid body", 422);

    const cls = await db.yogaClass.findUnique({
      where: { id: classId },
      include: { schedule: true },
    });
    if (!cls) return notFound("Class");

    let userIds = parsed.data.userIds;
    if (parsed.data.allActive && userIds.length === 0) {
      const active = await db.user.findMany({
        where: {
          role: "STUDENT",
          status: "ACTIVE",
          subscriptions: { some: { status: "ACTIVE" } },
        },
        select: { id: true },
      });
      userIds = active.map((u) => u.id);
    }

    const res = await bulkMarkAttendance({
      classId,
      markedBy: actor.id,
      userIds,
    });
    await audit({
      actorUserId: actor.id,
      action: "ATTENDANCE_MARKED",
      entityType: "YogaClass",
      entityId: classId,
      metadata: {
        date: cls.date,
        scheduleName: cls.schedule?.name,
        created: res.created,
        skipped: res.skipped,
        allActive: parsed.data.allActive,
      },
    });
    return NextResponse.json({ ok: true, ...res });
  });
}

// GET: list attendance for a class — who attended, plus all eligible
// (active) members with their attendance status so the picker UI can show
// a complete roster with check/uncheck state.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    await requireRole(["INSTRUCTOR", "ADMIN"]);
    const { id: classId } = await ctx.params;

    const [rows, activeMembers] = await Promise.all([
      db.attendance.findMany({
        where: { classId },
        include: { user: { select: { name: true, email: true, whatsappNumber: true } } },
        orderBy: { markedAt: "desc" },
      }),
      db.user.findMany({
        where: {
          role: "STUDENT",
          status: "ACTIVE",
          subscriptions: { some: { status: "ACTIVE" } },
        },
        select: { id: true, name: true, email: true, whatsappNumber: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const attendedSet = new Set(rows.map((r) => r.userId));

    return NextResponse.json({
      // Roster: every active member with `attended` flag.
      roster: activeMembers.map((m) => ({
        userId: m.id,
        studentName: m.name,
        studentEmail: m.email,
        whatsapp: m.whatsappNumber,
        attended: attendedSet.has(m.id),
      })),
      // Attendance records (kept for backwards compat).
      items: rows.map((a) => ({
        id: a.id,
        userId: a.userId,
        studentName: a.user?.name ?? "—",
        studentEmail: a.user?.email ?? "—",
        whatsapp: a.user?.whatsappNumber ?? null,
        markedAt: a.markedAt,
        source: a.source,
        note: a.note,
      })),
      attendedCount: rows.length,
      totalActive: activeMembers.length,
    });
  });
}
