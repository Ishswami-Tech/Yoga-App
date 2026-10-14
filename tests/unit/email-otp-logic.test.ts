import { describe, expect, test } from "bun:test";
import {
  EMAIL_OTP_MAX_ATTEMPTS,
  EMAIL_OTP_MAX_SENDS_PER_HOUR,
  EMAIL_OTP_TTL_MS,
  decideEmailSendLimit,
  decideEmailVerify,
  generateEmailCode,
  hashEmailCode,
} from "@/lib/providers/email-otp";

const base = { addressCount: 0, ipCount: 0, globalCount: 0, globalMax: 300 };

describe("email OTP constants", () => {
  test("mirror the phone OTP policy", () => {
    expect(EMAIL_OTP_TTL_MS).toBe(5 * 60 * 1000);
    expect(EMAIL_OTP_MAX_ATTEMPTS).toBe(5);
    expect(EMAIL_OTP_MAX_SENDS_PER_HOUR).toBe(5);
  });
});

describe("decideEmailSendLimit", () => {
  test("allows under all limits", () => {
    expect(decideEmailSendLimit(base)).toBe(false);
    expect(decideEmailSendLimit({ ...base, addressCount: 4, ipCount: 4, globalCount: 299 })).toBe(false);
  });
  test("blocks on per-address, per-IP and global limits", () => {
    expect(decideEmailSendLimit({ ...base, addressCount: 5 })).toBe(true);
    expect(decideEmailSendLimit({ ...base, ipCount: 5 })).toBe(true);
    expect(decideEmailSendLimit({ ...base, globalCount: 300 })).toBe(true);
  });
});

describe("decideEmailVerify", () => {
  const now = 1_000_000;
  const row = { expiresAt: new Date(now + 1000), attempts: 0, consumedAt: null };
  test("no row, consumed or expired rows are a generic failure", () => {
    expect(decideEmailVerify(null, now)).toBe("INVALID");
    expect(decideEmailVerify({ ...row, consumedAt: new Date(now) }, now)).toBe("INVALID");
    expect(decideEmailVerify({ ...row, expiresAt: new Date(now - 1) }, now)).toBe("INVALID");
  });
  test("too many attempts is reported separately", () => {
    expect(decideEmailVerify({ ...row, attempts: 5 }, now)).toBe("TOO_MANY_ATTEMPTS");
    expect(decideEmailVerify({ ...row, attempts: 4 }, now)).toBe("CHECK");
  });
});

describe("codes", () => {
  test("generateEmailCode is 6 digits", () => {
    for (let i = 0; i < 50; i++) expect(generateEmailCode()).toMatch(/^\d{6}$/);
  });
  test("hash is keyed, address-bound and not the plain code", () => {
    process.env.AUTH_SECRET = "unit-test-secret-0123456789";
    const h = hashEmailCode("a@example.com", "123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("123456");
    expect(hashEmailCode("b@example.com", "123456")).not.toBe(h);
    expect(hashEmailCode("a@example.com", "123457")).not.toBe(h);
    expect(hashEmailCode("a@example.com", "123456")).toBe(h);
  });
});
