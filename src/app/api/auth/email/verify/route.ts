import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyEmailOtp } from "@/lib/providers/email-otp";
import { createSession, setSessionCookie, toAuthUser } from "@/lib/auth";
import { run, fail, fromZodError } from "@/lib/api";
import { emailSignInDecision, normalizeEmail } from "@/lib/email";
import { clientIp, throttle } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().max(320),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

// POST /api/auth/email/verify
//
// Verifies the emailed code and creates the same legacy cookie session as the WhatsApp flow. An
// ACTIVE account with that email signs in (and its email becomes verified); an unknown address gets
// a STUDENT account created only now, after the code verified. That account has no phone number yet,
// so the app makes the user verify one on WhatsApp before anything else. Role/status are never
// client-controlled.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const email = normalizeEmail(parsed.data.email);
    if (!email) {
      return fail("Validation failed", 422, {
        code: "VALIDATION",
        details: [{ path: ["email"], message: "Enter a valid email address" }],
      });
    }

    const ip = clientIp(req);
    const t = throttle(`email-verify:${ip ?? "unknown"}`, 30, 10 * 60 * 1000);
    if (!t.ok) return fail("Too many attempts. Please try again later.", 429, { code: "RATE_LIMITED" });

    const result = await verifyEmailOtp(email, parsed.data.code);
    if (!result.ok) return fail(result.error, 401, { code: "OTP_FAILED" });

    const findUser = () =>
      db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
      });
    let user = await findUser();

    if (!user) {
      try {
        user = await db.user.create({
          data: {
            name: "New student",
            email,
            emailVerified: true,
            whatsappNumber: null,
            phone: null,
            role: "STUDENT",
            status: "ACTIVE",
            profileCompletedAt: null,
          },
        });
      } catch (err) {
        // A concurrent verify for the same address created the account first.
        if (!isUniqueViolation(err, ["email"])) throw err;
        user = await findUser();
        if (!user) throw err;
      }
    }

    const decision = emailSignInDecision(user);
    if (decision === "disabled") {
      return fail("Account disabled", 403, { code: "DISABLED" });
    }
    if (decision === "unverified_claim") {
      // The address was typed into a profile but never verified, so a code sent to it must not open
      // that account. Its owner signs in with their WhatsApp number.
      return fail(
        "This email is attached to an account that signs in with a WhatsApp number. Please sign in with that number.",
        409,
        { code: "EMAIL_LINKED_TO_PHONE" },
      );
    }

    const token = await createSession(user.id);
    const res = NextResponse.json({ user: toAuthUser(user) });
    res.cookies.set(setSessionCookie(token));
    return res;
  });
}
