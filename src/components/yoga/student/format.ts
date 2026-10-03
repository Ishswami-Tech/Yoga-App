// Client-side formatting helpers for the StudentApp. Server-side helpers
// in src/lib/services/scheduling.ts use Node tz data; here we keep things
// tiny, dependency-free, and safe in the browser. All class times are
// "HH:mm" 24h IST strings and dates are "YYYY-MM-DD" IST strings; amounts
// are in paise (50000 = ₹500.00).

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "07:00" -> "7:00 AM" · "12:00" -> "12:00 PM" · "00:30" -> "12:30 AM" */
export function prettyTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "—";
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  let h = parseInt(m[1], 10);
  const mm = m[2];
  const ampm = h < 12 || h === 24 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mm} ${ampm}`;
}

/** "2025-09-22" -> "Mon, 22 Sep 2025" (computed from UTC parts so the user's
 *  local timezone can never shift the day forward/back). */
export function prettyDate(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${WD[wd]}, ${d} ${MO[mo - 1]} ${y}`;
}

/** Short weekday + day: "Mon 22" */
export function shortDate(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${WD[wd]} ${d}`;
}

/** 50000 -> "₹500.00" · 5000 -> "₹50.00" */
export function formatINR(paise: number | null | undefined): string {
  if (paise == null || Number.isNaN(paise)) return "₹0.00";
  return `₹${(paise / 100).toFixed(2)}`;
}

/** Just the integer rupee portion: 50000 -> "500" */
export function rupeeWhole(paise: number | null | undefined): string {
  if (paise == null || Number.isNaN(paise)) return "0";
  return Math.round(paise / 100).toString();
}

/** Parse "2025-09-22" + "07:00" into an epoch ms value interpreted as IST
 *  (UTC+05:30). India has no DST so this offset is constant. */
export function istEpoch(ymd: string, hhmm: string): number {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  const tm = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!dm || !tm) return NaN;
  const y = +dm[1];
  const mo = +dm[2] - 1;
  const d = +dm[3];
  const h = +tm[1];
  const mi = +tm[2];
  // UTC midnight for that date, then subtract 5h30m so the wall-clock time
  // in IST equals the requested hh:mm.
  return Date.UTC(y, mo, d, h, mi) - 5.5 * 60 * 60 * 1000;
}

export type ClassPhase = "before" | "live" | "ended";

/** Determine where we are relative to a class window. */
export function classPhase(
  ymd: string,
  start: string,
  end: string,
  now: number = Date.now()
): ClassPhase {
  const s = istEpoch(ymd, start);
  const e = istEpoch(ymd, end);
  if (Number.isNaN(s) || Number.isNaN(e)) return "ended";
  if (now < s) return "before";
  if (now > e) return "ended";
  return "live";
}

/** Humanised relative time like "in 45 min", "started 12 min ago", "live now". */
export function relativeToStart(
  ymd: string,
  start: string,
  now: number = Date.now()
): { label: string; phase: ClassPhase } {
  const s = istEpoch(ymd, start);
  if (Number.isNaN(s)) return { label: "—", phase: "ended" };
  const diff = s - now;
  if (diff <= 0) {
    const mins = Math.round(-diff / 60000);
    if (mins <= 0) return { label: "live now", phase: "live" };
    return { label: `started ${mins} min ago`, phase: "live" };
  }
  const mins = Math.round(diff / 60000);
  if (mins < 60) return { label: `starts in ${mins} min`, phase: "before" };
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24)
    return {
      label: `starts in ${hrs}h ${rem}m`,
      phase: "before",
    };
  const days = Math.floor(hrs / 24);
  return { label: `starts in ${days}d`, phase: "before" };
}

/** Greeting based on IST hour (UTC+5:30). */
export function greeting(now: Date = new Date()): string {
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  // IST = UTC + 5h30m
  const istMin = (utcMin + 5 * 60 + 30) % (24 * 60);
  const istH = Math.floor(istMin / 60);
  if (istH < 5) return "Good night";
  if (istH < 12) return "Good morning";
  if (istH < 17) return "Good afternoon";
  if (istH < 21) return "Good evening";
  return "Good night";
}
