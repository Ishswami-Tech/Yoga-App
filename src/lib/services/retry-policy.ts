// Pure decision logic for retrying failed WhatsApp reminders.

import { istDateTime } from "./scheduling";

export const MAX_SEND_ATTEMPTS = 3;

/** Errors that will never succeed on retry (bad/unreachable number, missing config). */
export const NON_RETRYABLE_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_RECIPIENT",
  "NOT_CONFIGURED",
  "131026", // message undeliverable / not on WhatsApp
  "131030", // recipient not in allowed list
  "131047", // re-engagement window
  "131052",
  "132000",
  "132001",
  "132012",
  "132015",
  "132016",
  "132018",
]);

export type RetryDecision = { retry: true } | { retry: false; reason: "non_retryable" | "max_attempts" | "class_over" };

export function isClassOver(date: string, endTime: string, now: Date): boolean {
  return istDateTime(date, endTime).getTime() <= now.getTime();
}

export function decideRetry(input: {
  errorCode: string | null | undefined;
  attempts: number; // failed attempts so far for (user, class, template)
  classDate: string;
  classEndTime: string;
  now: Date;
}): RetryDecision {
  if (input.errorCode && NON_RETRYABLE_ERROR_CODES.has(input.errorCode)) return { retry: false, reason: "non_retryable" };
  if (input.attempts >= MAX_SEND_ATTEMPTS) return { retry: false, reason: "max_attempts" };
  if (isClassOver(input.classDate, input.classEndTime, input.now)) return { retry: false, reason: "class_over" };
  return { retry: true };
}
