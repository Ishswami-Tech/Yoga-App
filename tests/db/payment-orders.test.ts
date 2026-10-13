// Integration test for one-time payments against a real Postgres (gateway HTTP is faked).
// Run with: RUN_DB_TESTS=1 DATABASE_URL=postgresql://... bun test tests/db
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "../../src/lib/db";
import { settleOrder } from "../../src/lib/services/payment-orders";
import {
  applyRazorpayEvent,
  getMembershipState,
  summarizeMembership,
} from "../../src/lib/services/subscriptions";
import { POST as bridgeVerify } from "../../src/app/api/bridge/verify/route";
import { createHmac } from "node:crypto";

const enabled = process.env.RUN_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const DAY = 86_400_000;

type CashfreeFake = { orderStatus: string; amountRupees: number; cfPaymentId: number };
const gateway = new Map<string, CashfreeFake>();
const realFetch = globalThis.fetch;
const realEnv = { id: process.env.CASHFREE_APP_ID, secret: process.env.CASHFREE_SECRET_KEY };

function fakeCashfree(): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = url.match(/\/pg\/orders\/([^/]+?)(\/payments)?$/u);
    const order = match ? gateway.get(decodeURIComponent(match[1])) : undefined;
    if (!match || !order) {
      return new Response(JSON.stringify({ message: "order not found" }), { status: 404 });
    }
    if (match[2]) {
      return new Response(JSON.stringify([{ cf_payment_id: order.cfPaymentId, payment_status: "SUCCESS" }]));
    }
    return new Response(JSON.stringify({ order_status: order.orderStatus, order_amount: order.amountRupees }));
  }) as unknown as typeof fetch;
}

async function createUser(tag: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  return db.user.create({ data: { email: `${tag}-${suffix}@payments.test`, name: `Pay ${tag}` } });
}

async function createOrder(userId: string, providerOrderId: string) {
  return db.paymentOrder.create({
    data: { id: providerOrderId, userId, provider: "cashfree", providerOrderId, amount: 150000, status: "CREATED" },
  });
}

suite("settleOrder (Postgres)", () => {
  const userIds: string[] = [];

  beforeAll(() => {
    process.env.CASHFREE_APP_ID = "test-app";
    process.env.CASHFREE_SECRET_KEY = "test-secret";
    fakeCashfree();
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    process.env.CASHFREE_APP_ID = realEnv.id;
    process.env.CASHFREE_SECRET_KEY = realEnv.secret;
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  test("marks a paid order PAID, grants 30 days, and activates membership", async () => {
    const user = await createUser("paid");
    userIds.push(user.id);
    const orderId = `ord-${user.id}`;
    await createOrder(user.id, orderId);
    gateway.set(orderId, { orderStatus: "PAID", amountRupees: 1500, cfPaymentId: 7001 });

    expect((await getMembershipState(user.id)).state).toBe("NONE");
    expect(await settleOrder(orderId, "cashfree")).toEqual({ paid: true });

    const order = await db.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAID");
    expect(order.providerPaymentId).toBe("7001");
    expect(order.coversUntil!.getTime() - order.coversFrom!.getTime()).toBe(30 * DAY);

    const membership = await getMembershipState(user.id);
    expect(membership.state).toBe("ACTIVE");
    expect(membership.order?.id).toBe(orderId);
    expect(await db.payment.count({ where: { userId: user.id } })).toBe(1);
    expect((await db.payment.findFirstOrThrow({ where: { userId: user.id } })).razorpayPaymentId).toBe("cashfree_7001");
  });

  test("is idempotent, including under concurrent calls", async () => {
    const user = await createUser("race");
    userIds.push(user.id);
    const orderId = `ord-${user.id}`;
    await createOrder(user.id, orderId);
    gateway.set(orderId, { orderStatus: "PAID", amountRupees: 1500, cfPaymentId: 7002 });

    const results = await Promise.all(Array.from({ length: 8 }, () => settleOrder(orderId, "cashfree")));
    expect(results.every((r) => r.paid)).toBe(true);
    expect(await db.payment.count({ where: { userId: user.id } })).toBe(1);
    const first = await db.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });

    await settleOrder(orderId, "cashfree");
    const second = await db.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(second.coversUntil!.getTime()).toBe(first.coversUntil!.getTime());
  });

  test("a second payment extends from the end of current coverage", async () => {
    const user = await createUser("renew");
    userIds.push(user.id);
    const a = `ord-a-${user.id}`;
    const b = `ord-b-${user.id}`;
    await createOrder(user.id, a);
    await createOrder(user.id, b);
    gateway.set(a, { orderStatus: "PAID", amountRupees: 1500, cfPaymentId: 7003 });
    gateway.set(b, { orderStatus: "PAID", amountRupees: 1500, cfPaymentId: 7004 });

    await settleOrder(a, "cashfree");
    await settleOrder(b, "cashfree");
    const first = await db.paymentOrder.findUniqueOrThrow({ where: { id: a } });
    const second = await db.paymentOrder.findUniqueOrThrow({ where: { id: b } });
    expect(second.coversFrom!.getTime()).toBe(first.coversUntil!.getTime());
    expect(second.coversUntil!.getTime() - first.coversFrom!.getTime()).toBe(60 * DAY);
  });

  test("does not settle on amount mismatch, pending, expired, or unknown orders", async () => {
    const user = await createUser("nope");
    userIds.push(user.id);
    const mismatch = `ord-m-${user.id}`;
    const pending = `ord-p-${user.id}`;
    const expired = `ord-e-${user.id}`;
    for (const id of [mismatch, pending, expired]) await createOrder(user.id, id);
    gateway.set(mismatch, { orderStatus: "PAID", amountRupees: 1, cfPaymentId: 7005 });
    gateway.set(pending, { orderStatus: "ACTIVE", amountRupees: 1500, cfPaymentId: 0 });
    gateway.set(expired, { orderStatus: "EXPIRED", amountRupees: 1500, cfPaymentId: 0 });

    expect(await settleOrder(mismatch, "cashfree")).toEqual({ paid: false, reason: "amount_mismatch" });
    expect(await settleOrder(pending, "cashfree")).toEqual({ paid: false, reason: "not_paid" });
    expect(await settleOrder(expired, "cashfree")).toEqual({ paid: false, reason: "not_paid" });
    expect(await settleOrder("does-not-exist", "cashfree")).toEqual({ paid: false, reason: "unknown_order" });

    expect((await db.paymentOrder.findUniqueOrThrow({ where: { id: mismatch } })).status).toBe("CREATED");
    expect((await db.paymentOrder.findUniqueOrThrow({ where: { id: expired } })).status).toBe("FAILED");
    expect((await getMembershipState(user.id)).state).toBe("NONE");
    expect(await db.payment.count({ where: { userId: user.id } })).toBe(0);
  });

  test("an expired one-time coverage no longer counts as active", async () => {
    const user = await createUser("lapsed");
    userIds.push(user.id);
    await db.paymentOrder.create({
      data: {
        id: `ord-${user.id}`,
        userId: user.id,
        provider: "cashfree",
        providerOrderId: `ord-${user.id}`,
        amount: 150000,
        status: "PAID",
        paidAt: new Date(Date.now() - 40 * DAY),
        coversFrom: new Date(Date.now() - 40 * DAY),
        coversUntil: new Date(Date.now() - 10 * DAY),
      },
    });
    expect((await getMembershipState(user.id)).state).toBe("NONE");
  });

  describe("POST /api/bridge/verify", () => {
    const secret = "bridgesecretbridgesecretbridgesecret1234";
    const previous = {
      url: process.env.PAYMENT_BRIDGE_URL,
      secret: process.env.PAYMENT_BRIDGE_SECRET,
      appId: process.env.PAYMENT_BRIDGE_APP_ID,
    };

    beforeAll(() => {
      process.env.PAYMENT_BRIDGE_URL = "https://bridge.example.test";
      process.env.PAYMENT_BRIDGE_SECRET = secret;
      process.env.PAYMENT_BRIDGE_APP_ID = "vishwayog";
    });
    afterAll(() => {
      process.env.PAYMENT_BRIDGE_URL = previous.url;
      process.env.PAYMENT_BRIDGE_SECRET = previous.secret;
      process.env.PAYMENT_BRIDGE_APP_ID = previous.appId;
    });

    function signedRequest(body: object, overrides: { timestamp?: string; signature?: string } = {}) {
      const raw = JSON.stringify(body);
      const timestamp = overrides.timestamp ?? String(Math.floor(Date.now() / 1000));
      const signature =
        overrides.signature ?? createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
      return new Request("http://localhost/api/bridge/verify", {
        method: "POST",
        headers: { "x-bridge-timestamp": timestamp, "x-bridge-signature": signature },
        body: raw,
      }) as never;
    }

    test("rejects unsigned and badly signed requests", async () => {
      const body = { appId: "vishwayog", orderId: "x" };
      expect((await bridgeVerify(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) }) as never)).status).toBe(401);
      expect((await bridgeVerify(signedRequest(body, { signature: "deadbeef" }))).status).toBe(401);
      expect((await bridgeVerify(signedRequest(body, { timestamp: "1000" }))).status).toBe(401);
    });

    test("rejects another app id", async () => {
      expect((await bridgeVerify(signedRequest({ appId: "other", orderId: "x" }))).status).toBe(400);
    });

    test("confirms a paid one-time order and refuses unpaid ones", async () => {
      const user = await createUser("bridge");
      userIds.push(user.id);
      const paid = `ord-paid-${user.id}`;
      const unpaid = `ord-unpaid-${user.id}`;
      await createOrder(user.id, paid);
      await createOrder(user.id, unpaid);
      gateway.set(paid, { orderStatus: "PAID", amountRupees: 1500, cfPaymentId: 7010 });
      gateway.set(unpaid, { orderStatus: "ACTIVE", amountRupees: 1500, cfPaymentId: 0 });

      const ok = await bridgeVerify(signedRequest({ appId: "vishwayog", orderId: paid, provider: "cashfree" }));
      expect(await ok.json()).toEqual({ success: true });
      const no = await bridgeVerify(signedRequest({ appId: "vishwayog", orderId: unpaid, provider: "cashfree" }));
      expect(await no.json()).toEqual({ success: false });
      expect((await getMembershipState(user.id)).state).toBe("ACTIVE");
    });

    test("subscription mode requires a valid checkout signature for a known subscription", async () => {
      const user = await createUser("subverify");
      userIds.push(user.id);
      const keys = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
      process.env.RAZORPAY_KEY_ID = "rzp_test_key";
      process.env.RAZORPAY_KEY_SECRET = "rzp-test-secret";
      try {
        const subId = `sub_${user.id}`;
        await db.subscription.create({
          data: { userId: user.id, razorpaySubscriptionId: subId, razorpayPlanId: "plan_test", status: "CREATED", amount: 150000 },
        });
        const paymentId = "pay_test_1";
        const signature = createHmac("sha256", "rzp-test-secret").update(`${paymentId}|${subId}`).digest("hex");

        const good = await bridgeVerify(
          signedRequest({ appId: "vishwayog", orderId: subId, paymentId, razorpaySignature: signature, mode: "subscription" }),
        );
        expect(await good.json()).toEqual({ success: true });

        const bad = await bridgeVerify(
          signedRequest({ appId: "vishwayog", orderId: subId, paymentId, razorpaySignature: "forged", mode: "subscription" }),
        );
        expect(await bad.json()).toEqual({ success: false });

        const unknown = await bridgeVerify(
          signedRequest({ appId: "vishwayog", orderId: "sub_unknown", paymentId: "pay_x", razorpaySignature: "sig_x", mode: "subscription" }),
        );
        expect(await unknown.json()).toEqual({ success: false });
      } finally {
        if (keys.id === undefined) delete process.env.RAZORPAY_KEY_ID;
        else process.env.RAZORPAY_KEY_ID = keys.id;
        if (keys.secret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
        else process.env.RAZORPAY_KEY_SECRET = keys.secret;
      }
    });
  });

  describe("subscription webhooks", () => {
    function charged(subId: string, payId: string, amount: number) {
      const now = Math.floor(Date.now() / 1000);
      return {
        event: "subscription.charged",
        payload: {
          subscription: { entity: { id: subId, status: "active", current_start: now, current_end: now + 30 * 86400, charge_at: now + 30 * 86400 } },
          payment: { entity: { id: payId, amount, currency: "INR", status: "captured", fee: 3540, created_at: now } },
        },
      };
    }

    test("activates from the webhook with real amounts, is idempotent, and summarizes as recurring", async () => {
      const user = await createUser("legacy");
      userIds.push(user.id);
      const subId = `sub_hook_${user.id}`;
      await db.subscription.create({
        data: { userId: user.id, razorpaySubscriptionId: subId, razorpayPlanId: "plan_test", status: "CREATED", amount: 150000 },
      });
      expect((await getMembershipState(user.id)).state).toBe("PENDING");

      const event = charged(subId, `pay_${user.id}`, 175000);
      const first = await applyRazorpayEvent(event, `evt_${user.id}`);
      expect(first.applied).toBe(true);
      const replay = await applyRazorpayEvent(event, `evt_${user.id}`);
      expect(replay).toMatchObject({ applied: false, reason: "duplicate_event" });
      expect(await db.payment.count({ where: { userId: user.id } })).toBe(1);

      const payment = await db.payment.findFirstOrThrow({ where: { userId: user.id } });
      expect(payment).toMatchObject({ amount: 175000, gatewayFee: 3540, status: "CAPTURED" });

      const membership = await getMembershipState(user.id);
      expect(membership.state).toBe("ACTIVE");
      expect(summarizeMembership(membership)).toMatchObject({ billing: "RECURRING", status: "ACTIVE" });

      await applyRazorpayEvent(
        { event: "subscription.halted", payload: { subscription: { entity: { id: subId, status: "halted" } } } },
        `evt_halt_${user.id}`,
      );
      expect((await getMembershipState(user.id)).state).toBe("HALTED");
    });
  });
});
