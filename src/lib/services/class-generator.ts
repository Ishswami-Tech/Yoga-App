// Class generation service.
//
// Implements the CLASS GENERATION algorithm from the spec:
//   1. Read current time in Asia/Kolkata.
//   2. Look ahead N days (configurable, default 2).
//   3. For each active schedule, for each day in the window:
//      - skip if weekday flag is false
//      - skip / cancel if there's a NO_CLASS exception for that date
//      - otherwise upsert a YogaClass keyed by (scheduleId, date)
//      - if no Meet exists, create one via the google adapter and persist
//   4. The whole job is idempotent: unique constraint on (scheduleId, date)
//      plus the existing googleEventId check guarantees no duplicates.
//
// This module is pure logic + DB; it does not import any HTTP layer so it
// can be invoked from the Next.js admin action and from the worker.

import { db } from "@/lib/db";
import {
  addDays,
  istDateString,
  istWeekday,
  istDateTime,
  minusMinutes,
} from "./scheduling";
import { googleMeet } from "@/lib/providers/google";
import type { ClassSchedule } from "@prisma/client";

export type GenerationResult = {
  checked: number;
  createdClasses: number;
  createdMeets: number;
  skippedHoliday: number;
  errors: string[];
  perSchedule: { scheduleId: string; name: string; created: number }[];
};

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await db.appSettings.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function getLookAheadDays(): Promise<number> {
  const raw = await getSetting("lookAheadDays", "2");
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : 2;
}

export async function getReminderMinutesBefore(): Promise<number> {
  const raw = await getSetting("reminderMinutesBefore", "15");
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 180 ? n : 15;
}

export async function generateClasses(opts?: {
  lookAheadDaysOverride?: number;
  todayOverride?: Date;
}): Promise<GenerationResult> {
  const lookAhead =
    opts?.lookAheadDaysOverride ?? (await getLookAheadDays());
  const today = opts?.todayOverride ?? new Date();

  const result: GenerationResult = {
    checked: 0,
    createdClasses: 0,
    createdMeets: 0,
    skippedHoliday: 0,
    errors: [],
    perSchedule: [],
  };

  const schedules = await db.classSchedule.findMany({
    where: { active: true },
  });

  for (const schedule of schedules) {
    let createdForThis = 0;
    for (let i = 0; i <= lookAhead; i++) {
      const day = addDays(today, i);
      const dateStr = istDateString(day);
      const weekday = istWeekday(day);
      result.checked++;

      // Holiday / no-class exception overrides the schedule.
      const exception = await db.classException.findUnique({
        where: {
          scheduleId_date: { scheduleId: schedule.id, date: dateStr },
        },
      });
      if (exception?.type === "NO_CLASS") {
        result.skippedHoliday++;
        // If a class was somehow created earlier, mark it CANCELLED.
        await db.yogaClass.updateMany({
          where: { scheduleId: schedule.id, date: dateStr },
          data: { status: "CANCELLED" },
        });
        continue;
      }

      // Weekday rule.
      const weekdayFlag = weekdayFlagFor(schedule, weekday);
      if (!weekdayFlag) continue;

      // Upsert the class row keyed by (scheduleId, date).
      const reminderAt = minusMinutes(
        istDateTime(dateStr, schedule.startTime),
        await getReminderMinutesBefore()
      );
      const cls = await db.yogaClass.upsert({
        where: {
          scheduleId_date: { scheduleId: schedule.id, date: dateStr },
        },
        update: {
          // keep reminderAt fresh in case admin changed schedule time
          reminderAt,
          status: "PENDING_MEET",
        },
        create: {
          scheduleId: schedule.id,
          date: dateStr,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: "PENDING_MEET",
          reminderAt,
        },
      });

      if (cls.status === "CANCELLED") continue;

      if (!cls.meetUrl || !cls.googleEventId) {
        try {
          const created = await googleMeet.createMeetForClass({
            scheduleId: schedule.id,
            date: dateStr,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            timezone: schedule.timezone,
            name: schedule.name,
          });
          await db.yogaClass.update({
            where: { id: cls.id },
            data: {
              googleEventId: created.googleEventId,
              meetUrl: created.meetUrl,
              status: "READY",
            },
          });
          result.createdMeets++;
          createdForThis++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(
            `Schedule ${schedule.name} ${dateStr}: ${msg}`
          );
        }
      } else if (cls.status !== "READY") {
        await db.yogaClass.update({
          where: { id: cls.id },
          data: { status: "READY" },
        });
      }
    }
    result.perSchedule.push({
      scheduleId: schedule.id,
      name: schedule.name,
      created: createdForThis,
    });
  }

  return result;
}

function weekdayFlagFor(s: ClassSchedule, weekday: number): boolean {
  switch (weekday) {
    case 0:
      return s.sunday;
    case 1:
      return s.monday;
    case 2:
      return s.tuesday;
    case 3:
      return s.wednesday;
    case 4:
      return s.thursday;
    case 5:
      return s.friday;
    case 6:
      return s.saturday;
    default:
      return false;
  }
}
