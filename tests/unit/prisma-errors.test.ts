import { describe, expect, test } from "bun:test";
import { isUniqueViolation } from "../../src/lib/prisma-errors";

describe("isUniqueViolation", () => {
  test("true for P2002", () => {
    expect(isUniqueViolation({ code: "P2002", meta: { target: ["email"] } })).toBe(true);
  });
  test("false for other prisma codes", () => {
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
  });
  test("false for non-objects and plain errors", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("P2002")).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
  });
  test("target filter matches column names (array or string)", () => {
    const e = { code: "P2002", meta: { target: ["whatsappNumber"] } };
    expect(isUniqueViolation(e, ["email", "whatsappNumber"])).toBe(true);
    expect(isUniqueViolation(e, ["email"])).toBe(false);
    expect(isUniqueViolation({ code: "P2002", meta: { target: "User_whatsappNumber_key" } }, ["whatsappNumber"])).toBe(true);
  });
  test("target filter is lenient when meta.target is absent", () => {
    expect(isUniqueViolation({ code: "P2002" }, ["email"])).toBe(true);
  });
});
