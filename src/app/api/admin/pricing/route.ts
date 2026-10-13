import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { run, fromZodError } from "@/lib/api";
import { audit } from "@/lib/services/audit";
import { isRazorpayConfigured } from "@/lib/providers/razorpay";
import {
  MAX_PLAN_AMOUNT_PAISE,
  MIN_PLAN_AMOUNT_PAISE,
  getPlanAmount,
  getPriceHistory,
  isSuperAdmin,
  setPlanAmount,
} from "@/lib/services/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amountPaise: z.number().int().min(MIN_PLAN_AMOUNT_PAISE).max(MAX_PLAN_AMOUNT_PAISE),
});

export async function GET() {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const [amountPaise, history, superAdmin] = await Promise.all([
      getPlanAmount(),
      getPriceHistory(),
      isSuperAdmin(admin),
    ]);
    return NextResponse.json({
      amountPaise,
      currency: "INR",
      isSuperAdmin: superAdmin,
      minPaise: MIN_PLAN_AMOUNT_PAISE,
      maxPaise: MAX_PLAN_AMOUNT_PAISE,
      existingMembers: "KEEP_CURRENT_PRICE",
      razorpay: { configured: isRazorpayConfigured() },
      history,
    });
  });
}

export async function PUT(req: NextRequest) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    if (!(await isSuperAdmin(admin))) throw new Error("FORBIDDEN");
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const { changed, previous } = await setPlanAmount({
      amountPaise: parsed.data.amountPaise,
      actor: { id: admin.id, name: admin.name },
    });
    if (changed) {
      await audit({
        actorUserId: admin.id,
        action: "PLAN_PRICE_UPDATE",
        entityType: "AppSettings",
        entityId: "razorpayPlanAmount",
        metadata: { previousPaise: previous, amountPaise: parsed.data.amountPaise },
      });
    }
    return NextResponse.json({ ok: true, changed, amountPaise: parsed.data.amountPaise });
  });
}
