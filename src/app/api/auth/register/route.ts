import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { createSession, hashPassword, setSessionCookie } from "@/lib/auth";
import { run, fail, fromZodError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);
    const data = parsed.data;

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return fail("Email already registered", 409, { code: "EMAIL_TAKEN" });
    }

    // Self-registration only creates STUDENT accounts. Admin/instructor
    // accounts must be created through the admin UI.
    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone || null,
        whatsappNumber: data.whatsappNumber || null,
        role: "STUDENT",
        status: "ACTIVE",
        passwordHash: hashPassword(data.password),
      },
    });

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

export async function GET() {
  return NextResponse.json({ enabled: true });
}
