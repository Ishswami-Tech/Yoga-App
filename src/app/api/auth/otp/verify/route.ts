import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOtp } from "@/lib/providers/otp";
import { createSession, setSessionCookie, toAuthUser } from "@/lib/auth";
import { run, fail, fromZodError } from "@/lib/api";
import { normalizePhone, phoneCandidates, toCanonical } from "@/lib/phone";
import { clientIp, throttle } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(7).max(24),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

const BAD = "Incorrect or expired code. Please try again or request a new one.";

// POST /api/auth/otp/verify
//
// Verifies the code and creates the session (same legacy cookie session the
// rest of the app reads). A number with no account gets a STUDENT account created only now, after
// a REGISTER-purpose code verified (never from a LOGIN code); it carries just the phone number and
// profileCompletedAt = null, so the app makes them complete their profile. Role and status are never
// client-controlled.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const { code } = parsed.data;

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return fail("Enter a valid WhatsApp number", 422, { code: "INVALID_PHONE" });

    const ip = clientIp(req);
    const t = throttle(`otp-verify:${ip ?? "unknown"}`, 30, 10 * 60 * 1000);
    if (!t.ok) return fail("Too many attempts. Please try again later.", 429, { code: "RATE_LIMITED" });

    const result = await verifyOtp(phone, code);
    if (!result.ok) return fail(result.error, 401, { code: "OTP_FAILED" });

    const findUser = () =>
      db.user.findFirst({
        where: { whatsappNumber: { in: phoneCandidates(phone) } },
        orderBy: { createdAt: "asc" },
      });
    let user = await findUser();

    if (!user) {
      if (result.purpose !== "REGISTER") {
        return fail(BAD, 401, { code: "OTP_FAILED" });
      }
      try {
        user = await db.user.create({
          data: {
            name: "New student",
            // email is required/unique in the schema; accounts are identified by phone.
            email: `${phone}@phone.vishwayog.invalid`,
            whatsappNumber: toCanonical(phone),
            phone: toCanonical(phone),
            role: "STUDENT",
            status: "ACTIVE",
            profileCompletedAt: null,
          },
        });
      } catch (err) {
        // A concurrent verify for the same number created the account first.
        if (!isUniqueViolation(err, ["email", "whatsappNumber"])) throw err;
        user = await findUser();
        if (!user) throw err;
      }
    }

    if (user.status !== "ACTIVE") {
      return fail("Account disabled", 403, { code: "DISABLED" });
    }

    const token = await createSession(user.id);
    const authUser = toAuthUser(user);

    const res = NextResponse.json({ user: authUser });
    res.cookies.set(setSessionCookie(token));
    return res;
  });
}
