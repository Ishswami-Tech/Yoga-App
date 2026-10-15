// activeMembersWhere / hasActiveMembership consistency against a real Postgres.
// Run with: RUN_DB_TESTS=1 DATABASE_URL=postgresql://... bun test tests/db
import { afterAll, describe, expect, test } from "bun:test";
import { db } from "../../src/lib/db";
import { activeMembersWhere } from "../../src/lib/services/membership";
import { getMembershipState, hasActiveMembership } from "../../src/lib/services/subscriptions";

const enabled = process.env.RUN_DB_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const H = 3_600_000;
const userIds: string[] = [];
let seq = 0;

async function user(tag: string) {
  const u = await db.user.create({
    data: { email: `${tag}-${Date.now()}-${seq++}@membership.test`, name: `M ${tag}` },
  });
  userIds.push(u.id);
  return u.id;
}

async function sub(userId: string, status: string, endDate: Date | null, ageH = 0) {
  seq++;
  await db.subscription.create({
    data: {
      userId,
      razorpaySubscriptionId: `sub_m_${Date.now()}_${seq}`,
      razorpayPlanId: "plan_x",
      status,
      amount: 100,
      endDate,
      createdAt: new Date(Date.now() - ageH * H),
    },
  });
}

suite("membership (Postgres)", () => {
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  async function inActive(id: string) {
    return (await db.user.count({ where: { AND: [{ id }, activeMembersWhere()] } })) === 1;
  }

  const now = () => Date.now();
  const cases: Array<[string, (id: string) => Promise<void>, boolean]> = [
    ["ACTIVE future", (id) => sub(id, "ACTIVE", new Date(now() + 5 * H)), true],
    ["ACTIVE ended 2h ago (grace)", (id) => sub(id, "ACTIVE", new Date(now() - 2 * H)), true],
    ["ACTIVE ended 30h ago", (id) => sub(id, "ACTIVE", new Date(now() - 30 * H)), false],
    ["CANCELLED paid time left", (id) => sub(id, "CANCELLED", new Date(now() + 5 * H)), true],
    ["CANCELLED over", (id) => sub(id, "CANCELLED", new Date(now() - H)), false],
    ["only CREATED", (id) => sub(id, "CREATED", null), false],
    [
      "CANCELLED paid + newer CREATED",
      async (id) => {
        await sub(id, "CANCELLED", new Date(now() + 5 * H), 100);
        await sub(id, "CREATED", null, 1);
      },
      true,
    ],
    [
      "PAID order covering",
      async (id) => {
        await db.paymentOrder.create({
          data: {
            id: `po_m_${id}`,
            userId: id,
            provider: "cashfree",
            providerOrderId: `po_m_${id}`,
            amount: 100,
            status: "PAID",
            coversUntil: new Date(now() + 5 * H),
          },
        });
      },
      true,
    ],
  ];

  test.each(cases)("%s", async (name, setup, want) => {
    const id = await user(name.replace(/\W+/gu, "").slice(0, 12));
    await setup(id);
    expect(await inActive(id)).toBe(want);
    // The query filter and the per-user check must agree.
    expect(await hasActiveMembership(id)).toBe(want);
    expect((await getMembershipState(id)).state === "ACTIVE").toBe(want);
  });

  test("disabled student is excluded", async () => {
    const id = await user("disabled");
    await sub(id, "ACTIVE", null);
    await db.user.update({ where: { id }, data: { status: "DISABLED" } });
    expect(await inActive(id)).toBe(false);
  });
});
