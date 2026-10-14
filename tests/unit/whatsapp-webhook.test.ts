import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
  safeEqual,
  verifyMetaHandshake,
  verifyMetaSignature,
} from "@/lib/providers/whatsapp-webhook";

const secret = "app-secret";
const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1" }] } }] }] });
const sign = (s: string, b: string) => "sha256=" + createHmac("sha256", s).update(b).digest("hex");

describe("verifyMetaSignature", () => {
  test("accepts a valid signature", () => {
    expect(verifyMetaSignature(secret, body, sign(secret, body))).toBe(true);
  });

  test("rejects tampered body and wrong secret", () => {
    expect(verifyMetaSignature(secret, body + " ", sign(secret, body))).toBe(false);
    expect(verifyMetaSignature(secret, body, sign("other", body))).toBe(false);
  });

  test("rejects missing or empty signature / secret", () => {
    expect(verifyMetaSignature(secret, body, null)).toBe(false);
    expect(verifyMetaSignature(secret, body, "")).toBe(false);
    expect(verifyMetaSignature("", body, sign(secret, body))).toBe(false);
    expect(verifyMetaSignature(undefined, body, sign(secret, body))).toBe(false);
  });

  test("rejects wrong-length, malformed, or unprefixed signatures without throwing", () => {
    expect(verifyMetaSignature(secret, body, "sha256=abcd")).toBe(false);
    expect(verifyMetaSignature(secret, body, "sha256=" + "z".repeat(64))).toBe(false);
    expect(verifyMetaSignature(secret, body, sign(secret, body).slice(7))).toBe(false);
    expect(verifyMetaSignature(secret, body, "sha1=" + "a".repeat(40))).toBe(false);
  });
});

describe("safeEqual", () => {
  test("handles equal, different, and different-length strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("verifyMetaHandshake", () => {
  const ok = { mode: "subscribe", token: "tok", challenge: "12345" };

  test("returns the challenge on success", () => {
    expect(verifyMetaHandshake("tok", ok)).toEqual({ ok: true, challenge: "12345" });
  });

  test("fails on wrong token, wrong mode, missing challenge/token", () => {
    expect(verifyMetaHandshake("tok", { ...ok, token: "bad" })).toEqual({ ok: false, status: 403 });
    expect(verifyMetaHandshake("tok", { ...ok, token: "toklong" })).toEqual({ ok: false, status: 403 });
    expect(verifyMetaHandshake("tok", { ...ok, mode: "unsubscribe" })).toEqual({ ok: false, status: 403 });
    expect(verifyMetaHandshake("tok", { ...ok, token: null })).toEqual({ ok: false, status: 403 });
    expect(verifyMetaHandshake("tok", { ...ok, challenge: null })).toEqual({ ok: false, status: 403 });
  });

  test("returns 503 when the verify token is unset or empty", () => {
    expect(verifyMetaHandshake(undefined, ok)).toEqual({ ok: false, status: 503 });
    expect(verifyMetaHandshake("", ok)).toEqual({ ok: false, status: 503 });
  });
});
