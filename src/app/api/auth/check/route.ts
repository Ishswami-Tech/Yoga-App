import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { run } from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
});

// POST /api/auth/check
// Checks if a user with this email already exists.
// Returns { exists: true, name, hasWhatsapp, whatsappNumber, hasPassword }
// or { exists: false }.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { exists: false, error: "Invalid email" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        email: true,
        name: true,
        whatsappNumber: true,
        accounts: { select: { providerId: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ exists: false });
    }

    const hasBetterAuthPassword = user.accounts.some(
      (a) => a.providerId === "credential"
    );

    return NextResponse.json({
      exists: true,
      name: user.name,
      email: user.email,
      hasWhatsapp: !!user.whatsappNumber,
      whatsappNumber: user.whatsappNumber,
      hasPassword: hasBetterAuthPassword,
    });
  });
}
