import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, hashPassword } from "@/lib/auth";
import { run, fromZodError } from "@/lib/api";
import { adminUserUpdateSchema } from "@/lib/validation";
import { z } from "zod";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]).default("STUDENT"),
  phone: z.string().optional().nullable(),
  whatsappNumber: z.string().optional().nullable(),
});

// List users with optional role filter.
export async function GET(req: NextRequest) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    void admin;
    const url = new URL(req.url);
    const role = url.searchParams.get("role") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;
    const users = await db.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q } },
                { name: { contains: q } },
                { phone: { contains: q } },
                { whatsappNumber: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        whatsappNumber: true,
        createdAt: true,
      },
    });
    // Attach membership summary.
    const withMembership = await Promise.all(
      users.map(async (u) => {
        const activeSub = await db.subscription.findFirst({
          where: { userId: u.id, status: "ACTIVE" },
        });
        return {
          ...u,
          membershipStatus: activeSub ? "ACTIVE" : "NONE",
          membershipEnd: activeSub?.endDate ?? null,
        };
      })
    );
    return NextResponse.json({ items: withMembership });
  });
}

// Create a new user (admin only — used to provision instructors/admins).
export async function POST(req: NextRequest) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered", code: "EMAIL_TAKEN" },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        status: "ACTIVE",
        phone: parsed.data.phone || null,
        whatsappNumber: parsed.data.whatsappNumber || null,
        passwordHash: hashPassword(parsed.data.password),
      },
    });
    await audit({
      actorUserId: admin.id,
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      metadata: { role: user.role, email: user.email },
    });
    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
      { status: 201 }
    );
  });
}
