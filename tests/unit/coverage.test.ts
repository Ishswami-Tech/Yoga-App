import { describe, expect, test } from "bun:test";
import { computeCoverage, ONE_TIME_COVERAGE_DAYS } from "../../src/lib/payments/coverage";

const DAY = 86_400_000;
const now = new Date("2026-10-11T00:00:00.000Z");

describe("computeCoverage", () => {
  test("starts now when there is no existing coverage", () => {
    const cov = computeCoverage(now, null);
    expect(cov.coversFrom).toEqual(now);
    expect(cov.coversUntil.getTime()).toBe(now.getTime() + ONE_TIME_COVERAGE_DAYS * DAY);
  });

  test("starts now when existing coverage already ended", () => {
    const cov = computeCoverage(now, new Date(now.getTime() - DAY));
    expect(cov.coversFrom).toEqual(now);
  });

  test("extends from the end of current coverage so early renewals lose no days", () => {
    const existingEnd = new Date(now.getTime() + 10 * DAY);
    const cov = computeCoverage(now, existingEnd);
    expect(cov.coversFrom).toEqual(existingEnd);
    expect(cov.coversUntil.getTime()).toBe(existingEnd.getTime() + ONE_TIME_COVERAGE_DAYS * DAY);
  });

  test("does not mutate its inputs", () => {
    const existingEnd = new Date(now.getTime() + DAY);
    const before = existingEnd.getTime();
    computeCoverage(now, existingEnd);
    expect(existingEnd.getTime()).toBe(before);
  });
});
