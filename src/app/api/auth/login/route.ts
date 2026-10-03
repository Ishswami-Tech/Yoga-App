import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSession,
  verifyPassword,
  setSessionCookie,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { run, fail, fromZodError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const { email, password } = parsed.data;

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return fail("Invalid email or password", 401, { code: "BAD_CREDENTIALS" });
    }
    if (user.status !== "ACTIVE") {
      return fail("Account disabled", 403, { code: "DISABLED" });
    }

    const token = await createSession(user.id);
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
    res.cookies.set(setSessionCookie(token));
    return res;
  });
}
