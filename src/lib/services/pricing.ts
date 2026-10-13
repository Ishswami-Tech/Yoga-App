// Membership price, editable at runtime by a super admin.
//
// Source of truth: AppSettings.razorpayPlanAmount (paise). The default is Rs 1,500 per month.
// Existing subscriptions keep the amount they were created with (Subscription.amount), so changing
// the price only affects new subscriptions and new one-time payments.

import { db } from "@/lib/db";

export const DEFAULT_PLAN_AMOUNT_PAISE = 150000; // Rs 1,500
export const MIN_PLAN_AMOUNT_PAISE = 10000; // Rs 100
export const MAX_PLAN_AMOUNT_PAISE = 5000000; // Rs 50,000

export type PriceHistoryEntry = {
  amountPaise: number;
  at: string; // ISO timestamp
  byUserId: string;
  byName: string;
};

export async function getPlanAmount(): Promise<number> {
  const row = await db.appSettings.findUnique({ where: { key: "razorpayPlanAmount" } });
  const n = row ? parseInt(row.value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PLAN_AMOUNT_PAISE;
}

export async function getPriceHistory(): Promise<PriceHistoryEntry[]> {
  const row = await db.appSettings.findUnique({ where: { key: "planPriceHistory" } });
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? (parsed as PriceHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

async function upsertSetting(key: string, value: string, updatedBy: string) {
  await db.appSettings.upsert({
    where: { key },
    update: { value, updatedBy },
    create: { key, value, updatedBy },
  });
}

export async function setPlanAmount(opts: {
  amountPaise: number;
  actor: { id: string; name: string };
}): Promise<{ changed: boolean; previous: number }> {
  const previous = await getPlanAmount();
  if (previous === opts.amountPaise) return { changed: false, previous };
  const history = await getPriceHistory();
  history.unshift({
    amountPaise: opts.amountPaise,
    at: new Date().toISOString(),
    byUserId: opts.actor.id,
    byName: opts.actor.name,
  });
  await upsertSetting("razorpayPlanAmount", String(opts.amountPaise), opts.actor.id);
  await upsertSetting("planPriceHistory", JSON.stringify(history.slice(0, 50)), opts.actor.id);
  return { changed: true, previous };
}

// A super admin is listed in SUPER_ADMIN_EMAILS (comma separated). When the variable is not set,
// the earliest-created ADMIN account is the super admin, so a single-owner install works unchanged.
export async function isSuperAdmin(user: { id: string; email: string; role: string }): Promise<boolean> {
  if (user.role !== "ADMIN") return false;
  const list = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 0) return list.includes(user.email.toLowerCase());
  const first = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id === user.id;
}

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
