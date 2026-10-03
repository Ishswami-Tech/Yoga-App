import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyGoogleCredential, buildMockCredential } from "@/lib/providers/google/index";
import {
  createSession,
  setSessionCookie,
  AuthUser,
  hashPassword,
} from "@/lib/auth";
import { run, fail } from "@/lib/api";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

// POST /api/auth/google
//
// Verifies a Google credential and either:
//   - Logs in an existing user (if the email matches)
//   - Auto-creates a new STUDENT account (if the email is new)
//
// The "credential" is the base64-encoded JSON payload from the Google
// Sign-In SDK. In the mock adapter, we trust the payload (no signature
// verification). In production, this would verify the JWT with Google's
// public keys.
export async function POST(req: NextRequest) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const credential = body?.credential as string | undefined;

    if (!credential) {
      return fail("Missing credential", 400, { code: "NO_CREDENTIAL" });
    }

    const profile = verifyGoogleCredential(credential);
    if (!profile) {
      return fail("Invalid Google credential", 401, { code: "INVALID_CREDENTIAL" });
    }

    // Find or create the user by email
    let user = await db.user.findUnique({ where: { email: profile.email } });

    if (!user) {
      // Auto-create a new STUDENT account via Google sign-up
      user = await db.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          role: "STUDENT",
          status: "ACTIVE",
          // Generate a random password hash — Google users don't need one,
          // but the schema requires a non-null passwordHash.
          passwordHash: hashPassword(randomBytes(32).toString("hex")),
        },
      });
    }

    if (user.status !== "ACTIVE") {
      return fail("Account disabled", 403, { code: "DISABLED" });
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

    const res = NextResponse.json({
      user: authUser,
      isNewUser: user.email === profile.email && user.createdAt > new Date(Date.now() - 5000),
    });
    res.cookies.set(setSessionCookie(token));
    return res;
  });
}

// GET /api/auth/google — returns mock Google accounts for the one-click
// login buttons in the dev environment. In production, the Google Sign-In
// SDK handles this.
export async function GET() {
  return NextResponse.json({
    mockAccounts: [
      { email: "priya@student.demo", name: "Priya Sharma" },
      { email: "ananya@student.demo", name: "Ananya Iyer" },
      { email: "newuser@gmail.com", name: "New Google User" },
    ],
    buildCredential: (email: string, name: string) =>
      buildMockCredential(email, name),
  });
}
