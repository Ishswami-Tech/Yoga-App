import { describe, expect, test } from "bun:test";
import { isPlaceholderEmail, normalizeEmail } from "@/lib/email";

describe("normalizeEmail", () => {
  test("trims and lowercases a valid address", () => {
    expect(normalizeEmail("  Aadesh@Example.COM ")).toBe("aadesh@example.com");
  });
  test("accepts plus-addressing and subdomains", () => {
    expect(normalizeEmail("a.b+yoga@mail.shreevishwayogayurved.com")).toBe("a.b+yoga@mail.shreevishwayogayurved.com");
  });
  test("rejects malformed or oversized input", () => {
    for (const bad of ["", "   ", "plain", "a@b", "a@@b.com", "a b@c.com", "@c.com", "a@.com", `${"x".repeat(250)}@a.com`]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
  test("rejects the reserved placeholder domain used for phone-only accounts", () => {
    expect(normalizeEmail("919876543210@phone.vishwayog.invalid")).toBeNull();
  });
});

describe("isPlaceholderEmail", () => {
  test("detects phone-only placeholder addresses", () => {
    expect(isPlaceholderEmail("919876543210@phone.vishwayog.invalid")).toBe(true);
    expect(isPlaceholderEmail("real@example.com")).toBe(false);
  });
});

import { emailSignInDecision } from "@/lib/email";

describe("emailSignInDecision", () => {
  test("verified active accounts may sign in with an emailed code", () => {
    expect(emailSignInDecision({ status: "ACTIVE", emailVerified: true })).toBe("ok");
  });
  test("an unverified claim never signs in (prevents pre-account takeover)", () => {
    expect(emailSignInDecision({ status: "ACTIVE", emailVerified: false })).toBe("unverified_claim");
  });
  test("disabled accounts are refused whatever the email state", () => {
    expect(emailSignInDecision({ status: "DISABLED", emailVerified: true })).toBe("disabled");
    expect(emailSignInDecision({ status: "DISABLED", emailVerified: false })).toBe("disabled");
  });
});
