// generateClasses Meet-window behaviour against a real Postgres; Google is stubbed (never called).
// Run with: RUN_DB_TESTS=1 DATABASE_URL=postgresql://... bun test tests/db/class-generator-window.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "../../src/lib/db";
import { generateClasses } from "../../src/lib/services/class-generator";
import { googleMeet } from "../../src/lib/providers/google";
import { istDateTime } from "../../src/lib/services/scheduling";

const enabled = process.env.RUN_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;

const DAY0 = "2031-03-10";
const DAY1 = "2031-03-11";
const realCreate = googleMeet.createMeetForClass;
let calls: string[] = [];
let previousLead: string | null = null;
const scheduleIds: string[] = [];

async function newSchedule(tag: string) {
  const s = await db.classSchedule.create({
    data: { name: `window-${tag}-${Date.now()}`, startTime: "10:00", endTime: "11:00" },
  });
  scheduleIds.push(s.id);
  return s;
}

const run = (now: string) =>
  generateClasses({
    lookAheadDaysOverride: 1,
    todayOverride: istDateTime(DAY0, "06:00"),
    nowOverride: istDateTime(DAY0, now),
  });

suite("generateClasses Meet window (Postgres)", () => {
  beforeAll(async () => {
    previousLead = (await db.appSettings.findUnique({ where: { key: "meetLeadMinutes" } }))?.value ?? null;
    await db.appSettings.upsert({
      where: { key: "meetLeadMinutes" },
      update: { value: "90" },
      create: { key: "meetLeadMinutes", value: "90" },
    });
    (googleMeet as { createMeetForClass: unknown }).createMeetForClass = async (i: { scheduleId: string; date: string }) => {
      calls.push(`${i.scheduleId}:${i.date}`);
      return { googleEventId: `evt-${i.scheduleId}-${i.date}`, meetUrl: `https://meet.test/${i.date}` };
    };
  });

  afterAll(async () => {
    (googleMeet as { createMeetForClass: unknown }).createMeetForClass = realCreate;
    await db.yogaClass.deleteMany({ where: { date: { in: [DAY0, DAY1] } } });
    await db.classSchedule.deleteMany({ where: { id: { in: scheduleIds } } });
    if (previousLead === null) await db.appSettings.deleteMany({ where: { key: "meetLeadMinutes" } });
    else await db.appSettings.update({ where: { key: "meetLeadMinutes" }, data: { value: previousLead } });
  });

  test("before the window: rows exist, no Meet, not an error", async () => {
    calls = [];
    const s = await newSchedule("early");
    const r = await run("06:00"); // 4h before 10:00, lead 90
    expect(calls.filter((c) => c.startsWith(s.id))).toHaveLength(0);
    expect(r.pendingUntilWindow).toBeGreaterThanOrEqual(2);
    expect(r.errors).toHaveLength(0);
    const rows = await db.yogaClass.findMany({ where: { scheduleId: s.id } });
    expect(rows).toHaveLength(2);
    expect(rows.every((c) => c.status === "PENDING_MEET" && !c.meetUrl)).toBe(true);
  });

  test("inside the window: only today's Meet is created, and only once", async () => {
    calls = [];
    const s = await newSchedule("open");
    await run("08:30"); // exactly 90 min before
    await run("08:45");
    expect(calls.filter((c) => c.startsWith(s.id))).toEqual([`${s.id}:${DAY0}`]);
    const d0 = await db.yogaClass.findFirstOrThrow({ where: { scheduleId: s.id, date: DAY0 } });
    const d1 = await db.yogaClass.findFirstOrThrow({ where: { scheduleId: s.id, date: DAY1 } });
    expect(d0.status).toBe("READY");
    expect(d0.meetUrl).toBeTruthy();
    expect(d1.status).toBe("PENDING_MEET");
    expect(d1.meetUrl).toBeNull();
  });

  test("after the class ended: no Meet is created, class marked FAILED", async () => {
    calls = [];
    const s = await newSchedule("late");
    await run("11:30");
    expect(calls.filter((c) => c.startsWith(s.id)).includes(`${s.id}:${DAY0}`)).toBe(false);
    const d0 = await db.yogaClass.findFirstOrThrow({ where: { scheduleId: s.id, date: DAY0 } });
    expect(d0.status).toBe("FAILED");
    expect(d0.meetUrl).toBeNull();
  });
});
