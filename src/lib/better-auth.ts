// Better Auth server configuration.
//
// This replaces the custom email/password + Google mock + OTP auth with
// Better Auth's framework. Better Auth handles:
//   - Email/password sign-up & sign-in
//   - Google OAuth (needs real GOOGLE_CLIENT_ID in production)
//   - Session management (cookies, expiry, refresh)
//   - Account linking (multiple providers per user)
//
// The existing role system (STUDENT/INSTRUCTOR/ADMIN) is preserved via
// additional user fields. The existing `requireAuth`/`requireRole`
// helpers in src/lib/auth.ts are updated to read Better Auth sessions.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  secret: process.env.AUTH_SECRET || "yoga-dev-auth-secret-v1",
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    // Google OAuth — uncomment in production with real credentials:
    // google: {
    //   clientId: process.env.GOOGLE_CLIENT_ID as string,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    // },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "STUDENT",
      },
      status: {
        type: "string",
        defaultValue: "ACTIVE",
      },
      phone: {
        type: "string",
        required: false,
      },
      whatsappNumber: {
        type: "string",
        required: false,
      },
    },
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days (seconds)
    updateAge: 24 * 60 * 60, // Refresh session every 24h
  },
});

// Helper: get the current session from Better Auth (for server-side use).
export async function getBetterAuthSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
