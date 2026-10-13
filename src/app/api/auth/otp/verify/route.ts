import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOtp } from "@/lib/providers/otp";
import { createSession, setSessionCookie, AuthUser } from "@/lib/auth";
import { run, fail, fromZodError } from "@/lib/api";
import { normalizePhone, phoneCandidates, toCanonical } from "@/lib/phone";
import { clientIp, throttle } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(7).max(24),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  mode: z.enum(["login", "register"]).default("login"),
  name: z.string().trim().min(2).max(80).optional(),
});

const BAD = "Incorrect or expired code. Please try again or request a new one.";

// POST /api/auth/otp/verify
//
// Verifies the code and creates the session (same legacy cookie session the
// rest of the app reads). In register mode the STUDENT account is created only
// now, after the code verified; role and status are never client-controlled.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const { code, mode, name } = parsed.data;

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return fail("Enter a valid WhatsApp number", 422, { code: "INVALID_PHONE" });

    const ip = clientIp(req);
    const t = throttle(`otp-verify:${ip ?? "unknown"}`, 30, 10 * 60 * 1000);
    if (!t.ok) return fail("Too many attempts. Please try again later.", 429, { code: "RATE_LIMITED" });

    const result = await verifyOtp(phone, code);
    if (!result.ok) return fail(result.error, 401, { code: "OTP_FAILED" });

    let user = await db.user.findFirst({
      where: { whatsappNumber: { in: phoneCandidates(phone) } },
      orderBy: { createdAt: "asc" },
    });

    if (!user) {
      if (mode !== "register" || result.purpose !== "REGISTER" || !name) {
        return fail(BAD, 401, { code: "OTP_FAILED" });
      }
      user = await db.user.create({
        data: {
          name,
          // email is required/unique in the schema; accounts are identified by phone.
          email: `${phone}@phone.vishwayog.invalid`,
          whatsappNumber: toCanonical(phone),
          phone: toCanonical(phone),
          role: "STUDENT",
          status: "ACTIVE",
        },
      });
    }

    if (user.status !== "ACTIVE") {
      return fail("Account disabled", 403, { code: "DISABLED" });
    }

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
