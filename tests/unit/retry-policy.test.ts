import { describe, expect, test } from "bun:test";
import { decideRetry, isClassOver, MAX_SEND_ATTEMPTS } from "@/lib/services/retry-policy";

const base = { errorCode: "NETWORK", attempts: 1, classDate: "2026-10-15", classEndTime: "08:00" };
// 2026-10-15 07:00 IST = 01:30 UTC
const before = new Date("2026-10-15T01:30:00Z");
const after = new Date("2026-10-15T03:00:00Z");

describe("retry policy", () => {
  test("retries transient failures while class is upcoming", () => {
    expect(decideRetry({ ...base, now: before })).toEqual({ retry: true });
    expect(decideRetry({ ...base, errorCode: null, now: before })).toEqual({ retry: true });
  });
  test("skips non-retryable codes", () => {
    for (const code of ["INVALID_RECIPIENT", "NOT_CONFIGURED", "131026", "132018"]) {
      expect(decideRetry({ ...base, errorCode: code, now: before })).toEqual({ retry: false, reason: "non_retryable" });
    }
  });
  test("caps attempts", () => {
    expect(decideRetry({ ...base, attempts: MAX_SEND_ATTEMPTS, now: before })).toEqual({ retry: false, reason: "max_attempts" });
  });
  test("skips ended classes", () => {
    expect(decideRetry({ ...base, now: after })).toEqual({ retry: false, reason: "class_over" });
    expect(isClassOver("2026-10-15", "08:00", after)).toBe(true);
    expect(isClassOver("2026-10-15", "08:00", before)).toBe(false);
  });
});
