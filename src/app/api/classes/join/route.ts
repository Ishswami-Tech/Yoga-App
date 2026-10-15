import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveMembership } from "@/lib/services/subscriptions";
import { run, unauthorized, forbidden, notFound, fail } from "@/lib/api";
import { audit } from "@/lib/services/audit";
import { istDateTime } from "@/lib/services/scheduling";

export const runtime = "nodejs";

// Students may still open the link briefly after the scheduled end (over-run).
const ENDED_GRACE_MS = 30 * 60_000;

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
    if (cls.status === "CANCELLED") {
      return fail("This class was cancelled", 409, { code: "CLASS_CANCELLED" });
    }
    if (cls.status === "FAILED" || cls.status === "PENDING_MEET") {
      return fail("The class link is not available", 409, { code: "CLASS_NOT_READY" });
    }
    // A finished class (completed, or past its end time) no longer hands out a link.
    const ended =
      cls.status === "COMPLETED" ||
      Date.now() >= istDateTime(cls.date, cls.endTime).getTime() + ENDED_GRACE_MS;
    if (ended) {
      return fail("This class has ended", 409, { code: "CLASS_ENDED" });
    }
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
