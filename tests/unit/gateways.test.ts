import { describe, expect, test } from "bun:test";
import { createRazorpayGateway } from "../../src/lib/payments/gateways/razorpay";
import { createCashfreeGateway } from "../../src/lib/payments/gateways/cashfree";
import { createPhonePeGateway } from "../../src/lib/payments/gateways/phonepe";
import { getGateways } from "../../src/lib/payments/gateways";
import type { OrderRequest } from "../../src/lib/payments/types";

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: unknown[]) {
  const calls: Call[] = [];
  const queue = [...responses];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = queue.shift();
    const status = typeof next === "object" && next !== null && "__status" in next ? (next as { __status: number }).__status : 200;
    const body = typeof next === "object" && next !== null && "__body" in next ? (next as { __body: unknown }).__body : next;
    return new Response(JSON.stringify(body ?? {}), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const req: OrderRequest = {
  localOrderId: "cm_order_1",
  amountPaise: 50000,
  currency: "INR",
  description: "Yoga Membership",
  customer: { id: "u1", name: "Asha", email: "asha@example.com", phone: "+91 98765 43210" },
  returnUrl: "https://www.ishswami.in/pay/callback?appId=vishwayog&orderId=cm_order_1&provider=phonepe",
  notifyUrl: "https://yoga.example.com/api/webhooks/cashfree",
};

const header = (call: Call, name: string) => (call.init.headers as Record<string, string>)[name];

describe("razorpay gateway", () => {
  const env = { RAZORPAY_KEY_ID: "rzp_test_key", RAZORPAY_KEY_SECRET: "secret" };

  test("is null when not configured", () => {
    expect(createRazorpayGateway({})).toBeNull();
  });

  test("creates an order with basic auth and receipt", async () => {
    const { impl, calls } = fakeFetch([{ id: "order_abc" }]);
    const gw = createRazorpayGateway(env, impl)!;
    const created = await gw.createOrder(req);
    expect(calls[0].url).toBe("https://api.razorpay.com/v1/orders");
    expect(header(calls[0], "Authorization")).toBe(`Basic ${Buffer.from("rzp_test_key:secret").toString("base64")}`);
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ amount: 50000, currency: "INR", receipt: "cm_order_1" });
    expect(created).toEqual({ providerOrderId: "order_abc", checkout: { razorpayKeyId: "rzp_test_key" } });
  });

  test("maps captured payments to PAID with amount", async () => {
    const { impl, calls } = fakeFetch([{ items: [{ id: "pay_1", status: "failed", amount: 50000 }, { id: "pay_2", status: "captured", amount: 50000 }] }]);
    const status = await createRazorpayGateway(env, impl)!.fetchStatus("order_abc");
    expect(calls[0].url).toBe("https://api.razorpay.com/v1/orders/order_abc/payments");
    expect(status).toEqual({ status: "PAID", providerPaymentId: "pay_2", amountPaise: 50000 });
  });

  test("keeps the order PENDING when nothing is captured", async () => {
    const { impl } = fakeFetch([{ items: [{ id: "pay_1", status: "failed", amount: 50000 }] }]);
    expect((await createRazorpayGateway(env, impl)!.fetchStatus("order_abc")).status).toBe("PENDING");
  });

  test("surfaces gateway errors", async () => {
    const { impl } = fakeFetch([{ __status: 400, __body: { error: { description: "bad" } } }]);
    await expect(createRazorpayGateway(env, impl)!.createOrder(req)).rejects.toThrow(/razorpay/i);
  });
});

describe("cashfree gateway", () => {
  const env = { CASHFREE_APP_ID: "app", CASHFREE_SECRET_KEY: "sec", CASHFREE_ENVIRONMENT: "sandbox" };

  test("is null when not configured", () => {
    expect(createCashfreeGateway({})).toBeNull();
  });

  test("creates a sandbox order in rupees with a valid phone", async () => {
    const { impl, calls } = fakeFetch([{ order_id: "cm_order_1", payment_session_id: "session_x" }]);
    const created = await createCashfreeGateway(env, impl)!.createOrder(req);
    expect(calls[0].url).toBe("https://sandbox.cashfree.com/pg/orders");
    expect(header(calls[0], "x-client-id")).toBe("app");
    expect(header(calls[0], "x-client-secret")).toBe("sec");
    expect(header(calls[0], "x-api-version")).toBe("2025-01-01");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.order_id).toBe("cm_order_1");
    expect(body.order_amount).toBe(500);
    expect(body.customer_details.customer_phone).toBe("9876543210");
    expect(body.order_meta.notify_url).toBe(req.notifyUrl);
    expect(created).toEqual({ providerOrderId: "cm_order_1", checkout: { paymentSessionId: "session_x" } });
  });

  test("uses the production host and a fallback phone", async () => {
    const { impl, calls } = fakeFetch([{ order_id: "cm_order_1", payment_session_id: "s" }]);
    await createCashfreeGateway({ ...env, CASHFREE_ENVIRONMENT: "production" }, impl)!.createOrder({
      ...req,
      customer: { ...req.customer, phone: undefined },
    });
    expect(calls[0].url).toBe("https://api.cashfree.com/pg/orders");
    expect(JSON.parse(String(calls[0].init.body)).customer_details.customer_phone).toMatch(/^\d{10}$/);
  });

  test("maps order status", async () => {
    const paid = fakeFetch([{ order_status: "PAID", order_amount: 500 }, [{ cf_payment_id: 777, payment_status: "SUCCESS" }]]);
    expect(await createCashfreeGateway(env, paid.impl)!.fetchStatus("cm_order_1")).toEqual({
      status: "PAID",
      providerPaymentId: "777",
      amountPaise: 50000,
    });
    const expired = fakeFetch([{ order_status: "EXPIRED" }]);
    expect((await createCashfreeGateway(env, expired.impl)!.fetchStatus("x")).status).toBe("FAILED");
    const active = fakeFetch([{ order_status: "ACTIVE" }]);
    expect((await createCashfreeGateway(env, active.impl)!.fetchStatus("x")).status).toBe("PENDING");
  });
});

describe("phonepe gateway", () => {
  const env = { PHONEPE_CLIENT_ID: "cid", PHONEPE_CLIENT_SECRET: "csec", PHONEPE_ENVIRONMENT: "sandbox" };
  const token = { access_token: "tok", expires_at: 4_000_000_000 };

  test("is null when not configured", () => {
    expect(createPhonePeGateway({})).toBeNull();
  });

  test("authenticates then creates a hosted checkout order", async () => {
    const { impl, calls } = fakeFetch([token, { orderId: "OMO1", state: "PENDING", redirectUrl: "https://mercury-uat.phonepe.com/transact/x" }]);
    const created = await createPhonePeGateway(env, impl)!.createOrder(req);
    expect(calls[0].url).toBe("https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token");
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(form.get("client_id")).toBe("cid");
    expect(form.get("client_secret")).toBe("csec");
    expect(form.get("client_version")).toBe("1");
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(calls[1].url).toBe("https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay");
    expect(header(calls[1], "Authorization")).toBe("O-Bearer tok");
    const body = JSON.parse(String(calls[1].init.body));
    expect(body).toMatchObject({ merchantOrderId: "cm_order_1", amount: 50000 });
    expect(body.paymentFlow).toEqual({ type: "PG_CHECKOUT", merchantUrls: { redirectUrl: req.returnUrl } });
    expect(created).toEqual({
      providerOrderId: "cm_order_1",
      checkout: { gatewayRedirectUrl: "https://mercury-uat.phonepe.com/transact/x" },
    });
  });

  test("caches the access token between calls", async () => {
    const { impl, calls } = fakeFetch([token, { state: "PENDING" }, { state: "PENDING" }]);
    const gw = createPhonePeGateway(env, impl)!;
    await gw.fetchStatus("a");
    await gw.fetchStatus("b");
    expect(calls.filter((c) => c.url.includes("oauth/token")).length).toBe(1);
  });

  test("maps order state", async () => {
    const done = fakeFetch([token, { state: "COMPLETED", amount: 50000, paymentDetails: [{ transactionId: "TX1", state: "COMPLETED" }] }]);
    expect(await createPhonePeGateway(env, done.impl)!.fetchStatus("cm_order_1")).toEqual({
      status: "PAID",
      providerPaymentId: "TX1",
      amountPaise: 50000,
    });
    expect(done.calls[1].url).toBe("https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/cm_order_1/status");
    const failed = fakeFetch([token, { state: "FAILED" }]);
    expect((await createPhonePeGateway(env, failed.impl)!.fetchStatus("x")).status).toBe("FAILED");
    const pending = fakeFetch([token, { state: "PENDING" }]);
    expect((await createPhonePeGateway(env, pending.impl)!.fetchStatus("x")).status).toBe("PENDING");
  });

  test("uses production hosts", async () => {
    const { impl, calls } = fakeFetch([token, { state: "PENDING" }]);
    await createPhonePeGateway({ ...env, PHONEPE_ENVIRONMENT: "production" }, impl)!.fetchStatus("a");
    expect(calls[0].url).toBe("https://api.phonepe.com/apis/identity-manager/v1/oauth/token");
    expect(calls[1].url).toBe("https://api.phonepe.com/apis/pg/checkout/v2/order/a/status");
  });
});

describe("getGateways", () => {
  test("returns only configured gateways", () => {
    const gws = getGateways({ RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s" });
    expect(Object.keys(gws)).toEqual(["razorpay"]);
  });
});
