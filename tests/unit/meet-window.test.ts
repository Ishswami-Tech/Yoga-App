import { describe, expect, test } from "bun:test";
import {
  meetAvailableAt,
  parseMeetLeadMinutes,
  parseReminderMinutes,
  shouldCreateMeetNow,
} from "@/lib/services/meet-window";
import { istDateTime } from "@/lib/services/scheduling";

const startsAt = istDateTime("2026-10-15", "06:00");
const endsAt = istDateTime("2026-10-15", "07:00");
const at = (offsetMin: number) => new Date(startsAt.getTime() + offsetMin * 60_000);

describe("shouldCreateMeetNow", () => {
  const cases: [string, number, number, boolean][] = [
    ["days ahead", -2880, 90, false],
    ["1 min before window opens (lead 90)", -91, 90, false],
    ["exactly at window open (lead 90)", -90, 90, true],
    ["inside window", -30, 90, true],
    ["at class start", 0, 90, true],
    ["class running", 30, 90, true],
    ["1 min before end", 59, 90, true],
    ["exactly at end", 60, 90, false],
    ["after end", 120, 90, false],
    ["lead 30: 31 min before", -31, 30, false],
    ["lead 30: 30 min before", -30, 30, true],
    ["lead 240: 241 min before", -241, 240, false],
    ["lead 240: 240 min before", -240, 240, true],
  ];
  for (const [name, offset, lead, expected] of cases) {
    test(name, () => {
      expect(shouldCreateMeetNow({ now: at(offset), startsAt, endsAt, leadMinutes: lead })).toBe(expected);
    });
  }
});

test("meetAvailableAt subtracts the lead", () => {
  expect(meetAvailableAt(startsAt, 90).toISOString()).toBe(at(-90).toISOString());
  expect(meetAvailableAt(startsAt, 90).toISOString()).toBe("2026-10-14T23:00:00.000Z");
});

describe("setting parsing", () => {
  test("meet lead", () => {
    expect(parseMeetLeadMinutes(undefined)).toBe(90);
    expect(parseMeetLeadMinutes("abc")).toBe(90);
    expect(parseMeetLeadMinutes("29")).toBe(90);
    expect(parseMeetLeadMinutes("241")).toBe(90);
    expect(parseMeetLeadMinutes("30")).toBe(30);
    expect(parseMeetLeadMinutes("240")).toBe(240);
    expect(parseMeetLeadMinutes("120")).toBe(120);
  });
  test("reminder", () => {
    expect(parseReminderMinutes(undefined)).toBe(15);
    expect(parseReminderMinutes("4")).toBe(15);
    expect(parseReminderMinutes("61")).toBe(15);
    expect(parseReminderMinutes("5")).toBe(5);
    expect(parseReminderMinutes("60")).toBe(60);
  });
});
