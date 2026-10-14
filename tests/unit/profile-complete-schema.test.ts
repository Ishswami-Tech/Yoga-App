import { describe, expect, test } from "bun:test";
import { profileCompleteSchema } from "@/lib/validation";

const good = { name: "  Asha Rao ", email: " Asha@Example.COM ", acceptTerms: true };

describe("profileCompleteSchema", () => {
  test("trims name and normalises email", () => {
    const r = profileCompleteSchema.parse(good);
    expect(r).toEqual({ name: "Asha Rao", email: "asha@example.com", acceptTerms: true });
  });
  test("rejects short and over-long names", () => {
    expect(profileCompleteSchema.safeParse({ ...good, name: " a " }).success).toBe(false);
    expect(profileCompleteSchema.safeParse({ ...good, name: "x".repeat(81) }).success).toBe(false);
    expect(profileCompleteSchema.safeParse({ ...good, name: "x".repeat(80) }).success).toBe(true);
  });
  test("rejects invalid and placeholder emails", () => {
    for (const email of ["nope", "a@b", "a..b@example.com", "919000000001@phone.vishwayog.invalid"]) {
      expect(profileCompleteSchema.safeParse({ ...good, email }).success).toBe(false);
    }
  });
  test("email is optional: absent or blank becomes undefined", () => {
    const { email: _omit, ...noEmail } = good;
    expect(profileCompleteSchema.parse(noEmail)).toEqual({ name: "Asha Rao", email: undefined, acceptTerms: true });
    expect(profileCompleteSchema.parse({ ...good, email: "   " }).email).toBeUndefined();
    expect(profileCompleteSchema.parse({ ...good, email: "" }).email).toBeUndefined();
  });
  test("acceptTerms must be literally true", () => {
    for (const acceptTerms of [false, "true", 1, undefined]) {
      expect(profileCompleteSchema.safeParse({ ...good, acceptTerms }).success).toBe(false);
    }
  });
  test("non-string email is rejected", () => {
    expect(profileCompleteSchema.safeParse({ ...good, email: 5 }).success).toBe(false);
  });
});
