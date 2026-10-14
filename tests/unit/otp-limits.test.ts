import { describe, expect, test } from "bun:test";
import { decideSendLimit, globalMaxSendsPerHour, OTP_MAX_SENDS_PER_HOUR } from "@/lib/providers/otp";

const ok = { phoneCount: 0, ipCount: 0, globalCount: 0, globalMax: 300 };

describe("decideSendLimit", () => {
  test("allows under all limits", () => {
    expect(decideSendLimit(ok)).toBe(false);
  });
  test("blocks at per-phone limit", () => {
    expect(decideSendLimit({ ...ok, phoneCount: OTP_MAX_SENDS_PER_HOUR })).toBe(true);
  });
  test("blocks at per-IP limit", () => {
    expect(decideSendLimit({ ...ok, ipCount: OTP_MAX_SENDS_PER_HOUR })).toBe(true);
  });
  test("blocks at global limit but not below", () => {
    expect(decideSendLimit({ ...ok, globalCount: 299 })).toBe(false);
    expect(decideSendLimit({ ...ok, globalCount: 300 })).toBe(true);
  });
});

describe("globalMaxSendsPerHour", () => {
  test("defaults to 300 and parses env", () => {
    expect(globalMaxSendsPerHour({})).toBe(300);
    expect(globalMaxSendsPerHour({ OTP_GLOBAL_MAX_SENDS_PER_HOUR: "50" })).toBe(50);
    expect(globalMaxSendsPerHour({ OTP_GLOBAL_MAX_SENDS_PER_HOUR: "x" })).toBe(300);
    expect(globalMaxSendsPerHour({ OTP_GLOBAL_MAX_SENDS_PER_HOUR: "0" })).toBe(300);
  });
});
