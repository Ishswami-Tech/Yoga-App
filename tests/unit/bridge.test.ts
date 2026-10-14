import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
  BRIDGE_PAYMENT_NOTE,
  createBridgeUrl,
  decryptBridgeCustomer,
  encryptBridgeCustomer,
  loadBridgeConfig,
  verifyBridgeRequest,
  type BridgeConfig,
} from "../../src/lib/payments/bridge";

const config: BridgeConfig = {
  baseUrl: "https://www.ishswami.in",
  appId: "vishwayog",
  secret: "s".repeat(40),
};
const NOW = 1_800_000_000;

function decodeToken(url: string) {
  const token = new URL(url).searchParams.get("token") ?? "";
  const [body, sig] = token.split(".");
  return {
    body,
    sig,
    payload: JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
  };
}

describe("loadBridgeConfig", () => {
  test("returns null unless url and secret are set", () => {
    expect(loadBridgeConfig({})).toBeNull();
    expect(loadBridgeConfig({ PAYMENT_BRIDGE_URL: "https://x.in" })).toBeNull();
  });

  test("reads env, trims trailing slashes, defaults appId", () => {
    const cfg = loadBridgeConfig({
      PAYMENT_BRIDGE_URL: "https://www.ishswami.in//",
      PAYMENT_BRIDGE_SECRET: "x".repeat(32),
    });
    expect(cfg).toEqual({ baseUrl: "https://www.ishswami.in", appId: "vishwayog", secret: "x".repeat(32) });
  });

  test("rejects short secrets", () => {
    expect(loadBridgeConfig({ PAYMENT_BRIDGE_URL: "https://x.in", PAYMENT_BRIDGE_SECRET: "short" })).toBeNull();
  });
});

describe("createBridgeUrl", () => {
  test("builds a signed /pay/start url the bridge can verify", () => {
    const url = createBridgeUrl(
      config,
      { provider: "razorpay", orderId: "order_1", amount: 50000, currency: "INR", razorpayKeyId: "rzp_x" },
      NOW,
    );
    expect(url.startsWith("https://www.ishswami.in/pay/start?token=")).toBe(true);
    const { body, sig, payload } = decodeToken(url);
    expect(sig).toBe(createHmac("sha256", config.secret).update(body).digest("base64url"));
    expect(payload).toMatchObject({
      appId: "vishwayog",
      provider: "razorpay",
      orderId: "order_1",
      amount: 50000,
      iat: NOW,
      exp: NOW + 600,
    });
  });

  test("omits undefined optional fields", () => {
    const { payload } = decodeToken(
      createBridgeUrl(config, { provider: "cashfree", orderId: "o", amount: 1, currency: "INR", paymentSessionId: "s" }, NOW),
    );
    expect("razorpayKeyId" in payload).toBe(false);
  });
});

describe("branding and encrypted prefill", () => {
  const base = { provider: "razorpay", orderId: "order_1", amount: 100, currency: "INR" } as const;
  const customer = { name: "Asha Patil", email: "asha.patil@example.com", contact: "+919876543210" };

  test("carries display fields and keeps the same signing", () => {
    const customerEnc = encryptBridgeCustomer(config.secret, customer)!;
    const url = createBridgeUrl(
      config,
      {
        ...base,
        displayName: "Vishwayog",
        logoUrl: "https://www.example.com/logo-mark.png",
        note: BRIDGE_PAYMENT_NOTE,
        customerEnc,
      },
      NOW,
    );
    const { body, sig, payload } = decodeToken(url);
    expect(sig).toBe(createHmac("sha256", config.secret).update(body).digest("base64url"));
    expect(payload).toMatchObject({
      displayName: "Vishwayog",
      logoUrl: "https://www.example.com/logo-mark.png",
      note: BRIDGE_PAYMENT_NOTE,
    });
    expect(BRIDGE_PAYMENT_NOTE).toMatch(/^Payments for .+ are securely processed by Ishswami Tech\.$/u);
    expect(BRIDGE_PAYMENT_NOTE.length).toBeLessThanOrEqual(140);
    expect(payload).toMatchObject({
      customerEnc,
    });
  });

  test("round-trips customer details", () => {
    const enc = encryptBridgeCustomer(config.secret, customer)!;
    expect(enc.split(".")).toHaveLength(3);
    expect(decryptBridgeCustomer(config.secret, enc)).toEqual(customer);
    expect(encryptBridgeCustomer(config.secret, customer)).not.toBe(enc); // random IV
  });

  test("returns null when there is nothing to encrypt", () => {
    expect(encryptBridgeCustomer(config.secret, {})).toBeNull();
    expect(encryptBridgeCustomer(config.secret, { name: "  " })).toBeNull();
  });

  test("decrypt returns null for tampering, wrong key and garbage", () => {
    const enc = encryptBridgeCustomer(config.secret, customer)!;
    const [iv, tag, ct] = enc.split(".");
    const flipped = Buffer.from(ct, "base64url");
    flipped[0] ^= 1;
    expect(decryptBridgeCustomer(config.secret, `${iv}.${tag}.${flipped.toString("base64url")}`)).toBeNull();
    const badTag = Buffer.from(tag, "base64url");
    badTag[0] ^= 1;
    expect(decryptBridgeCustomer(config.secret, `${iv}.${badTag.toString("base64url")}.${ct}`)).toBeNull();
    expect(decryptBridgeCustomer("w".repeat(40), enc)).toBeNull();
    for (const bad of ["", "abc", "a.b", "a.b.c", "a.b.c.d", `${iv}.${tag}.`, "!!.@@.##"]) {
      expect(decryptBridgeCustomer(config.secret, bad)).toBeNull();
    }
  });

  test("personal data never appears in plaintext in the url or token body", () => {
    const customerEnc = encryptBridgeCustomer(config.secret, customer)!;
    const url = createBridgeUrl(config, { ...base, customerEnc }, NOW);
    const { body, payload } = decodeToken(url);
    const decodedBody = Buffer.from(body, "base64url").toString("utf8");
    for (const secretValue of ["asha.patil@example.com", "9876543210", "Asha Patil", "Asha"]) {
      expect(url).not.toContain(secretValue);
      expect(decodedBody).not.toContain(secretValue);
    }
    expect(payload.email).toBeUndefined();
    expect(payload.contact).toBeUndefined();
  });

  test("oversized customer values are truncated to 120 chars", () => {
    const enc = encryptBridgeCustomer(config.secret, { name: "n".repeat(500), email: "e".repeat(500) })!;
    const out = decryptBridgeCustomer(config.secret, enc)!;
    expect(out.name).toHaveLength(120);
    expect(out.email).toHaveLength(120);
  });

  test("length limits: truncates displayName and note, omits bad logoUrl/customerEnc", () => {
    const { payload } = decodeToken(
      createBridgeUrl(
        config,
        {
          ...base,
          displayName: "d".repeat(100),
          note: "n".repeat(300),
          logoUrl: `https://x.in/${"a".repeat(300)}`,
          customerEnc: "c".repeat(2000),
        },
        NOW,
      ),
    );
    expect(payload.displayName).toHaveLength(60);
    expect(payload.note).toHaveLength(140);
    expect("logoUrl" in payload).toBe(false);
    expect("customerEnc" in payload).toBe(false);
    const http = decodeToken(createBridgeUrl(config, { ...base, logoUrl: "http://x.in/a.png" }, NOW)).payload;
    expect("logoUrl" in http).toBe(false);
  });

  test("new fields are optional and omitted when not given", () => {
    const { payload } = decodeToken(createBridgeUrl(config, base, NOW));
    for (const k of ["displayName", "logoUrl", "note", "customerEnc"]) expect(k in payload).toBe(false);
  });
});

describe("verifyBridgeRequest", () => {
  const body = JSON.stringify({ appId: "vishwayog", orderId: "o1" });
  const sign = (ts: string, raw = body) => createHmac("sha256", config.secret).update(`${ts}.${raw}`).digest("hex");

  test("accepts a correctly signed fresh request", () => {
    const ts = String(NOW);
    expect(verifyBridgeRequest(config, { timestamp: ts, signature: sign(ts) }, body, NOW * 1000)).toBe(true);
  });

  test("rejects a wrong signature, tampered body, and missing headers", () => {
    const ts = String(NOW);
    expect(verifyBridgeRequest(config, { timestamp: ts, signature: "00" }, body, NOW * 1000)).toBe(false);
    expect(verifyBridgeRequest(config, { timestamp: ts, signature: sign(ts) }, body + " ", NOW * 1000)).toBe(false);
    expect(verifyBridgeRequest(config, { timestamp: null, signature: null }, body, NOW * 1000)).toBe(false);
  });

  test("rejects stale and far-future timestamps", () => {
    const old = String(NOW - 301);
    expect(verifyBridgeRequest(config, { timestamp: old, signature: sign(old) }, body, NOW * 1000)).toBe(false);
    const future = String(NOW + 301);
    expect(verifyBridgeRequest(config, { timestamp: future, signature: sign(future) }, body, NOW * 1000)).toBe(false);
  });
});
