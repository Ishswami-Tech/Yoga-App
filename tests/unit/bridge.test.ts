import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
  createBridgeUrl,
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
