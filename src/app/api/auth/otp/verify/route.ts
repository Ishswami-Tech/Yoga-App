import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOtp } from "@/lib/providers/otp";
import { createSession, setSessionCookie, AuthUser } from "@/lib/auth";
import { run, fail, fromZodError } from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(8),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

// POST /api/auth/otp/verify
//
// Verifies the 6-digit OTP and creates a session if correct.
// The user is identified by the phone number — no password needed.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const { phone, code } = parsed.data;
    const normalized = phone.replace(/[\s-]/g, "");

    // Verify the OTP
    const result = verifyOtp(normalized, code);
    if (!result.ok) {
      return fail(result.error ?? "Verification failed", 401, { code: "OTP_FAILED" });
    }

    // Find the user by WhatsApp number
    const user = await db.user.findFirst({
      where: {
        whatsappNumber: { contains: normalized.replace(/^\+/, "") },
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    if (!user) {
      return fail("User not found", 404, { code: "NOT_FOUND" });
    }

    // Create session
    const token = await createSession(user.id);
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AuthUser["role"],
      status: user.status,
      phone: user.phone,
      whatsappNumber: user.whatsappNumber,
    };

    const res = NextResponse.json({ user: authUser });
    res.cookies.set(setSessionCookie(token));
    return res;
  });
}
