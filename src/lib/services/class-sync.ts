// Keeps generated YogaClass rows (and their Google Meet events) consistent
// when an admin edits a schedule, cancels a date or removes a holiday.
// Google failures are logged, never thrown: the DB row is the source of truth.

import { db } from "@/lib/db";
import { googleMeet } from "@/lib/providers/google";
import { istDateString, istDateTime, minusMinutes } from "./scheduling";

async function cancelEventQuietly(googleEventId: string | null): Promise<void> {
  if (!googleEventId) return;
  try {
    await googleMeet.cancelMeet(googleEventId);
  } catch (err) {
    console.error("[class-sync] cancelMeet failed", googleEventId, err);
  }
}

/** Cancel classes of a schedule on a date, deleting any Meet event and clearing the link. */
export async function cancelClassesOn(scheduleId: string, date: string): Promise<number> {
  const rows = await db.yogaClass.findMany({
    where: { scheduleId, date, status: { not: "CANCELLED" } },
  });
  for (const c of rows) {
    await cancelEventQuietly(c.googleEventId);
    await db.yogaClass.update({
      where: { id: c.id },
      data: { status: "CANCELLED", meetUrl: null, googleEventId: null },
    });
  }
  return rows.length;
}

/** Undo a holiday: CANCELLED classes of today or later go back to PENDING_MEET (the generator recreates the Meet in its window). */
export async function restoreCancelledOn(scheduleId: string, date: string, now = new Date()): Promise<number> {
  if (date < istDateString(now)) return 0;
  const r = await db.yogaClass.updateMany({
    where: { scheduleId, date, status: "CANCELLED" },
    data: { status: "PENDING_MEET", meetUrl: null, googleEventId: null, errorMessage: null },
  });
  return r.count;
}

/** After a schedule's start/end time changed: realign future classes, reminder and Meet. */
export async function resyncFutureClasses(
  scheduleId: string,
  startTime: string,
  endTime: string,
  reminderMinutes: number,
  now = new Date()
): Promise<number> {
  const rows = await db.yogaClass.findMany({
    where: {
      scheduleId,
      date: { gte: istDateString(now) },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
  });
  let changed = 0;
  for (const c of rows) {
    if (c.startTime === startTime && c.endTime === endTime) continue;
    await cancelEventQuietly(c.googleEventId);
    await db.yogaClass.update({
      where: { id: c.id },
      data: {
        startTime,
        endTime,
        reminderAt: minusMinutes(istDateTime(c.date, startTime), reminderMinutes),
        reminderSentAt: null,
        status: "PENDING_MEET",
        meetUrl: null,
        googleEventId: null,
        errorMessage: null,
      },
    });
    changed++;
  }
  return changed;
}
