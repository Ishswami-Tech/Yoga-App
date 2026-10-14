// Pure helpers for the "create the Meet link shortly before class" rule.

export const MEET_LEAD_DEFAULT = 90;
export const MEET_LEAD_MIN = 30;
export const MEET_LEAD_MAX = 240;
export const REMINDER_DEFAULT = 15;
export const REMINDER_MIN = 5;
export const REMINDER_MAX = 60;

function parseClamped(raw: string | null | undefined, min: number, max: number, fallback: number): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export function parseMeetLeadMinutes(raw: string | null | undefined): number {
  return parseClamped(raw, MEET_LEAD_MIN, MEET_LEAD_MAX, MEET_LEAD_DEFAULT);
}

export function parseReminderMinutes(raw: string | null | undefined): number {
  return parseClamped(raw, REMINDER_MIN, REMINDER_MAX, REMINDER_DEFAULT);
}

/** Moment from which the Meet link may be created. */
export function meetAvailableAt(startsAt: Date, leadMinutes: number): Date {
  return new Date(startsAt.getTime() - leadMinutes * 60_000);
}

/** True only inside [startsAt - lead, endsAt). Never before the window, never after the class ended. */
export function shouldCreateMeetNow(input: {
  now: Date;
  startsAt: Date;
  endsAt: Date;
  leadMinutes: number;
}): boolean {
  const t = input.now.getTime();
  return t >= meetAvailableAt(input.startsAt, input.leadMinutes).getTime() && t < input.endsAt.getTime();
}
