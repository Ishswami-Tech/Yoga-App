// Scheduling utilities.
//
// All business scheduling happens in Asia/Kolkata (per spec). We store class
// dates as "YYYY-MM-DD" strings and times as "HH:mm" 24h strings to avoid
// SQLite timezone pitfalls. Date math is done with the Intl helpers below so
// the look-ahead window and "today" always reflect IST regardless of the
// server's local timezone.

import type { ClassSchedule } from "@prisma/client";

export const BUSINESS_TZ = "Asia/Kolkata";

// Weekday key -> boolean flag on ClassSchedule.
const WEEKDAY_FLAGS: Record<number, keyof ClassSchedule> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

// Format an IST date for our internal YYYY-MM-DD storage.
export function istDateString(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // en-CA gives YYYY-MM-DD
}

export function istTimeHM(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(date);
}

// Return the current IST date as a Date object that we can do .addDays on.
export function nowInIST(): Date {
  // We don't change the wall-clock of `now`, but callers use istDateString /
  // istTimeHM so the values are always IST. This helper exists for clarity.
  return new Date();
}

// Compute the Date instance for a given IST date string + HH:mm time,
// interpreted as an absolute UTC moment.
export function istDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  // Build a UTC timestamp then shift by IST offset (+5:30).
  // IST = UTC + 5:30 → to get the UTC moment we subtract 5:30.
  const utcMs = Date.UTC(y, m - 1, d, hh, mm) - 5.5 * 3600 * 1000;
  return new Date(utcMs);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// IST weekday index (0=Sun..6=Sat) for a given Date.
export function istWeekday(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "short",
  });
  const day = fmt.format(date); // "Mon","Tue",...
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[day] ?? 0;
}

export function scheduleAppliesOn(
  schedule: ClassSchedule,
  date: Date
): boolean {
  if (!schedule.active) return false;
  const wd = istWeekday(date);
  const flag = WEEKDAY_FLAGS[wd];
  return Boolean(schedule[flag]);
}

// Subtract `minutes` from a Date.
export function minusMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

export function formatIST(date: Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    ...opts,
  }).format(date);
}

// Pretty-print a HH:mm 24h time as 7:00 AM.
export function prettyTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function prettyDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
