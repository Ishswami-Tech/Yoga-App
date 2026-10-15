import { describe, expect, test } from "bun:test";
import { decideProfileEmail, needsEmailVerification } from "@/lib/email-otp-config";

const base = {
  currentEmail: "919000000001@phone.vishwayog.invalid",
  isPlaceholder: true,
  emailVerified: false,
  claimedEmail: undefined as string | undefined,
  deliveryConfigured: true,
};

describe("decideProfileEmail", () => {
  test("delivery configured: a placeholder account must verify, a typed claim is ignored", () => {
    expect(decideProfileEmail(base)).toEqual({ kind: "require_verification" });
    expect(decideProfileEmail({ ...base, claimedEmail: "victim@example.com" })).toEqual({ kind: "require_verification" });
  });
  test("delivery configured: a real verified email passes, a real unverified one must verify", () => {
    const real = { ...base, currentEmail: "a@example.com", isPlaceholder: false };
    expect(decideProfileEmail({ ...real, emailVerified: true })).toEqual({ kind: "keep" });
    expect(decideProfileEmail({ ...real, emailVerified: false })).toEqual({ kind: "require_verification" });
    expect(decideProfileEmail({ ...real, emailVerified: true, claimedEmail: "other@example.com" })).toEqual({ kind: "keep" });
  });
  test("no delivery: the old unverified claim still works", () => {
    const off = { ...base, deliveryConfigured: false };
    expect(decideProfileEmail(off)).toEqual({ kind: "claim_required" });
    expect(decideProfileEmail({ ...off, claimedEmail: "a@example.com" })).toEqual({ kind: "claim", email: "a@example.com" });
    expect(
      decideProfileEmail({ ...off, isPlaceholder: false, currentEmail: "x@example.com", claimedEmail: "a@example.com" }),
    ).toEqual({ kind: "keep" });
  });
});

describe("needsEmailVerification", () => {
  test("only when email codes are available and the email is a placeholder or unverified", () => {
    expect(needsEmailVerification({ emailIsPlaceholder: true, emailVerified: false }, true)).toBe(true);
    expect(needsEmailVerification({ emailIsPlaceholder: false, emailVerified: false }, true)).toBe(true);
    expect(needsEmailVerification({ emailIsPlaceholder: false, emailVerified: true }, true)).toBe(false);
    expect(needsEmailVerification({ emailIsPlaceholder: true, emailVerified: false }, false)).toBe(false);
  });
});
