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

import { allowedPriorStatuses, canAdvance, extractStatuses } from "@/lib/providers/whatsapp-webhook";

describe("extractStatuses", () => {
  const st = (id: string, status: string, extra: object = {}) => ({ id, status, ...extra });
  test("reads all entries, changes and statuses, ordered sent->read", () => {
    const payload = {
      entry: [
        { changes: [{ value: { statuses: [st("a", "read"), st("b", "sent")] } }, { value: {} }] },
        { changes: [{ value: { statuses: [st("c", "delivered")] } }] },
      ],
    };
    expect(extractStatuses(payload).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });
  test("ignores malformed items and unknown statuses", () => {
    expect(extractStatuses(null)).toEqual([]);
    expect(extractStatuses({ entry: [{ changes: [{ value: { statuses: [{ status: "sent" }, st("x", "weird")] } }] }] })).toEqual([]);
  });
  test("captures failure error and caps the count", () => {
    const f = extractStatuses({ entry: [{ changes: [{ value: { statuses: [st("f", "failed", { errors: [{ code: 131026, title: "Undeliverable" }] })] } }] }] });
    expect(f[0]).toMatchObject({ status: "FAILED", errorCode: "131026", errorMessage: "Undeliverable" });
    const many = Array.from({ length: 500 }, (_, i) => st(`m${i}`, "sent"));
    expect(extractStatuses({ entry: [{ changes: [{ value: { statuses: many } }] }] })).toHaveLength(200);
  });
});

describe("status ordering", () => {
  test("moves forward only; FAILED never overwrites READ", () => {
    expect(canAdvance("SENT", "DELIVERED")).toBe(true);
    expect(canAdvance("READ", "DELIVERED")).toBe(false);
    expect(canAdvance("DELIVERED", "SENT")).toBe(false);
    expect(canAdvance("READ", "FAILED")).toBe(false);
    expect(canAdvance("FAILED", "READ")).toBe(false);
    expect(canAdvance("DELIVERED", "FAILED")).toBe(true);
    expect(allowedPriorStatuses("SENT")).toEqual(["QUEUED"]);
  });
});
