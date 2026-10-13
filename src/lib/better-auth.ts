// Better Auth server configuration.
//
// Sign-in is WhatsApp OTP only (see /api/auth/otp/*). Better Auth is kept for
// session lookup/sign-out of existing sessions; email/password and social
// providers are disabled, and the catch-all route only exposes get-session
// and sign-out.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";

const prisma = new PrismaClient();

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("AUTH_SECRET must be set in production");
  }
  return "yoga-dev-auth-secret-v1";
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000"),
  secret: authSecret(),
  emailAndPassword: {
    enabled: false,
  },
  user: {
    additionalFields: {
      // input:false => clients cannot set these via sign-up / update-user.
      role: {
        type: "string",
        defaultValue: "STUDENT",
        input: false,
      },
      status: {
        type: "string",
        defaultValue: "ACTIVE",
        input: false,
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
