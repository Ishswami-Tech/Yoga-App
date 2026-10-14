// Concurrent settlement of two different PAID orders for one user must not grant overlapping windows.
// Run with: RUN_DB_TESTS=1 DATABASE_URL=postgresql://... bun test tests/db
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "../../src/lib/db";
import { settleOrder } from "../../src/lib/services/payment-orders";

const enabled = process.env.RUN_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const DAY = 86_400_000;

const realFetch = globalThis.fetch;
const realEnv = { id: process.env.CASHFREE_APP_ID, secret: process.env.CASHFREE_SECRET_KEY };

function fakeCashfree(paidOrderIds: Set<string>): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = url.match(/\/pg\/orders\/([^/]+?)(\/payments)?$/u);
    const id = match ? decodeURIComponent(match[1]) : undefined;
    if (!match || !id || !paidOrderIds.has(id)) {
      return new Response(JSON.stringify({ message: "order not found" }), { status: 404 });
    }
    if (match[2]) {
      return new Response(JSON.stringify([{ cf_payment_id: 9100 + id.length, payment_status: "SUCCESS" }]));
    }
    return new Response(JSON.stringify({ order_status: "PAID", order_amount: 1500 }));
  }) as unknown as typeof fetch;
}

suite("settleOrder concurrency (Postgres)", () => {
  const userIds: string[] = [];
  const paid = new Set<string>();

  beforeAll(() => {
    process.env.CASHFREE_APP_ID = "test-app";
    process.env.CASHFREE_SECRET_KEY = "test-secret";
    fakeCashfree(paid);
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    process.env.CASHFREE_APP_ID = realEnv.id;
    process.env.CASHFREE_SECRET_KEY = realEnv.secret;
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  test("two different paid orders settled concurrently get non-overlapping windows", async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const user = await db.user.create({ data: { email: `race2-${suffix}@payments.test`, name: "Race Two" } });
    userIds.push(user.id);

    const ids = [`ord-x-${user.id}`, `ord-y-${user.id}`];
    for (const id of ids) {
      paid.add(id);
      await db.paymentOrder.create({
        data: { id, userId: user.id, provider: "cashfree", providerOrderId: id, amount: 150000, status: "CREATED" },
      });
    }

    const results = await Promise.all(ids.map((id) => settleOrder(id, "cashfree")));
    expect(results.every((r) => r.paid)).toBe(true);

    const orders = await db.paymentOrder.findMany({ where: { userId: user.id }, orderBy: { coversFrom: "asc" } });
    expect(orders).toHaveLength(2);
    const [first, second] = orders;
    expect(first.coversUntil!.getTime() - first.coversFrom!.getTime()).toBe(30 * DAY);
    expect(second.coversFrom!.getTime()).toBeGreaterThanOrEqual(first.coversUntil!.getTime());
    expect(second.coversUntil!.getTime() - first.coversFrom!.getTime()).toBe(60 * DAY);
  });
});
