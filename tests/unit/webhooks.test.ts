import { describe, expect, test } from "bun:test";
import { createHash, createHmac } from "node:crypto";
import {
  extractCashfreeOrderId,
  extractPhonePeOrderId,
  verifyCashfreeSignature,
  verifyPhonePeAuthorization,
} from "../../src/lib/payments/webhooks";

describe("verifyCashfreeSignature", () => {
  const secret = "cashfree-secret";
  const raw = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: "o1" } } });
  const timestamp = "1800000000000";
  const signature = createHmac("sha256", secret).update(timestamp + raw).digest("base64");

  test("accepts timestamp+body signed with the client secret", () => {
    expect(verifyCashfreeSignature(secret, timestamp, raw, signature)).toBe(true);
  });

  test("rejects tampering, wrong secret, and missing parts", () => {
    expect(verifyCashfreeSignature(secret, timestamp, raw + " ", signature)).toBe(false);
    expect(verifyCashfreeSignature("other", timestamp, raw, signature)).toBe(false);
    expect(verifyCashfreeSignature(secret, null, raw, signature)).toBe(false);
    expect(verifyCashfreeSignature(secret, timestamp, raw, null)).toBe(false);
  });
});

describe("verifyPhonePeAuthorization", () => {
  const expected = createHash("sha256").update("user:pass").digest("hex");

  test("accepts sha256(username:password), with or without a scheme prefix", () => {
    expect(verifyPhonePeAuthorization("user", "pass", expected)).toBe(true);
    expect(verifyPhonePeAuthorization("user", "pass", `SHA256 ${expected}`)).toBe(true);
  });

  test("rejects wrong or missing credentials", () => {
    expect(verifyPhonePeAuthorization("user", "nope", expected)).toBe(false);
    expect(verifyPhonePeAuthorization("user", "pass", null)).toBe(false);
    expect(verifyPhonePeAuthorization("", "", expected)).toBe(false);
  });
});

describe("order id extraction", () => {
  test("cashfree", () => {
    expect(extractCashfreeOrderId({ data: { order: { order_id: "o1" } } })).toBe("o1");
    expect(extractCashfreeOrderId({ data: {} })).toBeNull();
    expect(extractCashfreeOrderId(null)).toBeNull();
  });

  test("phonepe", () => {
    expect(extractPhonePeOrderId({ payload: { merchantOrderId: "m1" } })).toBe("m1");
    expect(extractPhonePeOrderId({ payload: {} })).toBeNull();
    expect(extractPhonePeOrderId("x")).toBeNull();
  });
});
