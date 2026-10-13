import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyPaymentSignatureWithSecret } from "../../src/lib/providers/razorpay";

describe("verifyPaymentSignatureWithSecret", () => {
  const secret = "key-secret";
  const sig = createHmac("sha256", secret).update("pay_1|sub_1").digest("hex");

  test("accepts HMAC_SHA256(secret, payment_id|subscription_id)", () => {
    expect(verifyPaymentSignatureWithSecret(secret, "sub_1", "pay_1", sig)).toBe(true);
  });

  test("rejects forged, swapped, wrong-secret, empty and prefixed-fake signatures", () => {
    expect(verifyPaymentSignatureWithSecret(secret, "sub_1", "pay_1", "forged")).toBe(false);
    expect(verifyPaymentSignatureWithSecret(secret, "sub_1", "pay_1", "")).toBe(false);
    expect(verifyPaymentSignatureWithSecret(secret, "sub_1", "pay_1", "sig_abc123")).toBe(false);
    expect(verifyPaymentSignatureWithSecret(secret, "sub_2", "pay_1", sig)).toBe(false);
    expect(verifyPaymentSignatureWithSecret("other", "sub_1", "pay_1", sig)).toBe(false);
  });
});
