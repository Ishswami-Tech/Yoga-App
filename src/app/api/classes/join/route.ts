import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveMembership } from "@/lib/services/subscriptions";
import { run, unauthorized, forbidden, notFound } from "@/lib/api";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

// Returns the Google Meet URL for a specific class. Access-controlled:
// only ACTIVE members (or staff) receive the actual URL. The endpoint is
// hit when the student clicks "Join Class".
export async function GET(req: NextRequest) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const url = new URL(req.url);
    const classId = url.searchParams.get("classId");
    if (!classId) return notFound("classId");

    const cls = await db.yogaClass.findUnique({
      where: { id: classId },
      include: { schedule: true },
    });
    if (!cls) return notFound("Class");
    if (!cls.meetUrl) return notFound("Meet link");

    const active = await hasActiveMembership(user.id);
    const isStaff = user.role === "INSTRUCTOR" || user.role === "ADMIN";
    if (!active && !isStaff) {
      await audit({
        actorUserId: user.id,
        action: "JOIN_DENIED",
        entityType: "YogaClass",
        entityId: cls.id,
        metadata: { reason: "no_active_membership" },
      });
      return forbidden();
    }

    await audit({
      actorUserId: user.id,
      action: "JOIN_GRANTED",
      entityType: "YogaClass",
      entityId: cls.id,
    });

    return NextResponse.json({
      classId: cls.id,
      date: cls.date,
      startTime: cls.startTime,
      endTime: cls.endTime,
      scheduleName: cls.schedule.name,
      meetUrl: cls.meetUrl,
    });
  });
}
