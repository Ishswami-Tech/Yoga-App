// Attendance + streak computation service.
//
// "Attendance" is a per-student, per-class check-in record. The instructor
// (or admin) marks a student as having attended a live class after it ends.
// From these records we compute:
//   - currentStreak: consecutive COMPLETED classes the student attended,
//     counting backwards from today. A missed class breaks the streak.
//   - longestStreak: the longest run of consecutive attendances ever.
//   - totalAttended: lifetime count of attended classes.
//   - last30Days: count of attendances in the last 30 days.
//
// Streak logic:
//   - We walk backwards through COMPLETED classes (by date) starting from
//     the most recent one the student attended.
//   - A "gap" (a COMPLETED class the student did NOT attend) breaks the
//     streak. PENDING_MEET / CANCELLED / FAILED classes are skipped (they
//     don't count against you).
//   - Classes that haven't happened yet (future) are also skipped.

import { db } from "@/lib/db";
import { istDateString } from "./scheduling";

export type AttendanceSummary = {
  currentStreak: number;
  longestStreak: number;
  totalAttended: number;
  last30Days: number;
  attendedToday: boolean;
  recentAttendances: {
    id: string;
    classDate: string;
    classStartTime: string;
    scheduleName: string;
    markedAt: string;
  }[];
};

export async function getAttendanceSummary(userId: string): Promise<AttendanceSummary> {
  const attendances = await db.attendance.findMany({
    where: { userId },
    include: {
      yogaClass: { include: { schedule: { select: { name: true } } } },
    },
    orderBy: { yogaClass: { date: "desc" } },
  });

  const todayStr = istDateString(new Date());

  // Map classId -> attendance for quick lookup.
  const attendedClassIds = new Set(attendances.map((a) => a.classId));

  // Gather all COMPLETED or READY-past classes (date <= today) ordered by
  // date descending. We use these to determine "gaps" in attendance.
  const pastClasses = await db.yogaClass.findMany({
    where: {
      date: { lte: todayStr },
      status: { in: ["COMPLETED", "READY"] },
    },
    include: { schedule: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });

  // Group classes by date (a date with at least one COMPLETED/READY class
  // is a "class day"). A day with no class doesn't break the streak.
  const classDays = new Map<string, boolean>(); // date -> had a class
  for (const c of pastClasses) {
    classDays.set(c.date, true);
  }
  // Sorted unique class dates descending.
  const classDayDates = Array.from(classDays.keys()).sort().reverse();

  // Walk class days from most recent backwards. A class day is "attended"
  // if ANY class on that day has an attendance record for this user.
  const attendedDates = new Set<string>();
  for (const a of attendances) {
    if (a.yogaClass) attendedDates.add(a.yogaClass.date);
  }

  // Compute current streak: count consecutive attended class days from the
  // most recent class day backwards. Stop at the first unattended class day.
  let currentStreak = 0;
  for (const date of classDayDates) {
    if (attendedDates.has(date)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Compute longest streak: walk all class days in chronological order,
  // track the max run of consecutive attended days.
  const chronological = [...classDayDates].reverse(); // ascending
  let longestStreak = 0;
  let run = 0;
  for (const date of chronological) {
    if (attendedDates.has(date)) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  const totalAttended = attendances.length;
  const cutoff30 = new Date(Date.now() - 30 * 86400 * 1000);
  const last30Days = attendances.filter(
    (a) => new Date(a.markedAt) >= cutoff30
  ).length;
  const attendedToday = attendances.some((a) => a.yogaClass?.date === todayStr);

  return {
    currentStreak,
    longestStreak,
    totalAttended,
    last30Days,
    attendedToday,
    recentAttendances: attendances.slice(0, 10).map((a) => ({
      id: a.id,
      classDate: a.yogaClass?.date ?? "—",
      classStartTime: a.yogaClass?.startTime ?? "—",
      scheduleName: a.yogaClass?.schedule?.name ?? "Yoga Class",
      markedAt: a.markedAt.toISOString(),
    })),
  };
}

// Mark a student as attended for a class. Idempotent via the unique
// (userId, classId) constraint.
export async function markAttendance(opts: {
  userId: string;
  classId: string;
  markedBy: string;
  source?: string;
  note?: string;
}): Promise<{ created: boolean }> {
  const existing = await db.attendance.findUnique({
    where: {
      userId_classId: { userId: opts.userId, classId: opts.classId },
    },
  });
  if (existing) {
    return { created: false };
  }
  await db.attendance.create({
    data: {
      userId: opts.userId,
      classId: opts.classId,
      markedBy: opts.markedBy,
      source: opts.source ?? "INSTRUCTOR",
      note: opts.note ?? null,
    },
  });
  return { created: true };
}

// Bulk-mark attendance for a class — used by the instructor "record
// attendance" action which marks all active members at once.
export async function bulkMarkAttendance(opts: {
  classId: string;
  markedBy: string;
  userIds: string[];
}): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const userId of opts.userIds) {
    const existing = await db.attendance.findUnique({
      where: {
        userId_classId: { userId, classId: opts.classId },
      },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await db.attendance.create({
      data: {
        userId,
        classId: opts.classId,
        markedBy: opts.markedBy,
        source: "INSTRUCTOR",
      },
    });
    created++;
  }
  return { created, skipped };
}
