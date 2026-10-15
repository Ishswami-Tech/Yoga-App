import { describe, expect, test } from "bun:test";
import { hashSessionToken } from "../../src/lib/auth";

describe("hashSessionToken", () => {
  test("is deterministic 64-char hex", () => {
    const h = hashSessionToken("abc");
    expect(h).toBe(hashSessionToken("abc"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  test("different inputs differ and never equal the raw token", () => {
    expect(hashSessionToken("a")).not.toBe(hashSessionToken("b"));
    expect(hashSessionToken("a")).not.toBe("a");
  });
  test("matches known sha256 vector", () => {
    expect(hashSessionToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
