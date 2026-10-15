// Pure helper: choose the class to feature when several run on the same day.
import { istDateTime } from "./scheduling";

type Timed = { date: string; startTime: string; endTime: string };

/** Live class first, else the next upcoming one, else the last of the day. */
export function pickBestClass<T extends Timed>(classes: readonly T[], now: Date): T | null {
  if (classes.length === 0) return null;
  const t = now.getTime();
  const sorted = [...classes].sort(
    (a, b) => istDateTime(a.date, a.startTime).getTime() - istDateTime(b.date, b.startTime).getTime()
  );
  const live = sorted.find(
    (c) => istDateTime(c.date, c.startTime).getTime() <= t && t < istDateTime(c.date, c.endTime).getTime()
  );
  if (live) return live;
  const next = sorted.find((c) => istDateTime(c.date, c.startTime).getTime() > t);
  return next ?? sorted[sorted.length - 1];
}
