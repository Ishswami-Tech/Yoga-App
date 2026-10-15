// class-sync against a real Postgres; Google is stubbed (never called).
// Run with: RUN_DB_TESTS=1 bun test tests/db/class-sync.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "../../src/lib/db";
import { googleMeet } from "../../src/lib/providers/google";
import { istDateTime } from "../../src/lib/services/scheduling";
import { cancelClassesOn, restoreCancelledOn, resyncFutureClasses } from "../../src/lib/services/class-sync";

const enabled = process.env.RUN_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;

const PAST = "2031-03-09";
const FUTURE = "2031-03-11";
const NOW = istDateTime("2031-03-10", "06:00");
const realCancel = googleMeet.cancelMeet;
let cancelled: string[] = [];
let scheduleId = "";

async function mkClass(date: string, extra: Record<string, unknown> = {}) {
  return db.yogaClass.create({
    data: {
      scheduleId,
      date,
      startTime: "10:00",
      endTime: "11:00",
      status: "READY",
      googleEventId: `evt-${date}`,
      meetUrl: `https://meet.test/${date}`,
      ...extra,
    },
  });
}

suite("class-sync (Postgres)", () => {
  beforeAll(async () => {
    (googleMeet as { cancelMeet: unknown }).cancelMeet = async (id: string) => {
      cancelled.push(id);
    };
    scheduleId = (await db.classSchedule.create({ data: { name: `sync-${Date.now()}`, startTime: "10:00", endTime: "11:00" } })).id;
  });

  afterAll(async () => {
    (googleMeet as { cancelMeet: unknown }).cancelMeet = realCancel;
    await db.classSchedule.deleteMany({ where: { id: scheduleId } });
  });

  test("time change resyncs future classes only, drops the old Meet", async () => {
    cancelled = [];
    await mkClass(PAST);
    await mkClass(FUTURE);
    const n = await resyncFutureClasses(scheduleId, "12:00", "13:00", 15, NOW);
    expect(n).toBe(1);
    expect(cancelled).toEqual([`evt-${FUTURE}`]);
    const f = await db.yogaClass.findUniqueOrThrow({ where: { scheduleId_date: { scheduleId, date: FUTURE } } });
    expect(f.startTime).toBe("12:00");
    expect(f.endTime).toBe("13:00");
    expect(f.status).toBe("PENDING_MEET");
    expect(f.meetUrl).toBeNull();
    expect(f.googleEventId).toBeNull();
    expect(f.reminderAt?.getTime()).toBe(istDateTime(FUTURE, "11:45").getTime());
    const p = await db.yogaClass.findUniqueOrThrow({ where: { scheduleId_date: { scheduleId, date: PAST } } });
    expect(p.startTime).toBe("10:00");
    expect(p.meetUrl).not.toBeNull();
  });

  test("cancel clears the link and event; restore returns to PENDING_MEET", async () => {
    cancelled = [];
    await db.yogaClass.update({
      where: { scheduleId_date: { scheduleId, date: FUTURE } },
      data: { status: "READY", googleEventId: "evt-x", meetUrl: "https://meet.test/x" },
    });
    expect(await cancelClassesOn(scheduleId, FUTURE)).toBe(1);
    expect(cancelled).toEqual(["evt-x"]);
    const c = await db.yogaClass.findUniqueOrThrow({ where: { scheduleId_date: { scheduleId, date: FUTURE } } });
    expect(c.status).toBe("CANCELLED");
    expect(c.meetUrl).toBeNull();

    expect(await restoreCancelledOn(scheduleId, FUTURE, NOW)).toBe(1);
    const r = await db.yogaClass.findUniqueOrThrow({ where: { scheduleId_date: { scheduleId, date: FUTURE } } });
    expect(r.status).toBe("PENDING_MEET");
  });

  test("past cancelled classes are not restored; Google failures do not throw", async () => {
    await db.yogaClass.update({ where: { scheduleId_date: { scheduleId, date: PAST } }, data: { status: "CANCELLED" } });
    expect(await restoreCancelledOn(scheduleId, PAST, NOW)).toBe(0);
    (googleMeet as { cancelMeet: unknown }).cancelMeet = async () => {
      throw new Error("boom");
    };
    await db.yogaClass.update({
      where: { scheduleId_date: { scheduleId, date: FUTURE } },
      data: { status: "READY", googleEventId: "evt-y" },
    });
    expect(await cancelClassesOn(scheduleId, FUTURE)).toBe(1);
  });
});
