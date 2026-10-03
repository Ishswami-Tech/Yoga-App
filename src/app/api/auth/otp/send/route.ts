import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOtp } from "@/lib/providers/otp";
import { run, fail, fromZodError } from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().regex(/^[0-9+\-\s]{8,15}$/, "Invalid phone number"),
});

// POST /api/auth/otp/send
//
// Sends a 6-digit OTP via WhatsApp to the given phone number.
// The number must match a registered student's WhatsApp number.
// In dev/mock mode, the code is returned in the response for display.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const { phone } = parsed.data;
    const normalized = phone.replace(/[\s-]/g, "");

    // Check if a user with this WhatsApp number exists
    const user = await db.user.findFirst({
      where: {
        whatsappNumber: { contains: normalized.replace(/^\+/, "") },
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    if (!user) {
      return fail(
        "No active student found with this WhatsApp number. Please register first.",
        404,
        { code: "NOT_FOUND" }
      );
    }

    const result = await sendOtp(normalized);
    if (!result.ok) {
      return fail(result.error ?? "Failed to send OTP", 429, { code: "RATE_LIMITED" });
    }

    return NextResponse.json({
      ok: true,
      phone: normalized,
      devCode: result.devCode, // REMOVE in production
    });
  });
}
