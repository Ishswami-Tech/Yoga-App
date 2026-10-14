// Better Auth server configuration.
//
// Sign-in uses WhatsApp OTP (see /api/auth/otp/*) plus "Sign in with Google".
// Better Auth handles session lookup/sign-out and the Google OAuth flow;
// email/password is disabled, and the catch-all route only exposes
// get-session, sign-out, sign-in/social (google) and callback/google
// (see lib/auth-allowlist.ts).
//
// Google Cloud Console > Credentials > OAuth client: register these exact
// Authorized redirect URIs (baseURL + /api/auth/callback/google):
//   https://www.shreevishwayogayurved.com/api/auth/callback/google
//   http://localhost:3000/api/auth/callback/google
//
// Account linking: trustedProviders is intentionally empty, so a Google login
// for an existing email links to that user ONLY when Google reports the email
// as verified (and the local user's email is verified too, the default
// requireLocalEmailVerified). Otherwise the callback redirects to the error
// URL with ?error=account_not_linked and no session is created.

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

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

// Registered only when both are set so the app still boots without them.
const googleProvider =
  googleClientId && googleClientSecret
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          scope: ["openid", "email", "profile"],
        },
      }
    : {};

const appBaseURL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: appBaseURL,
  secret: authSecret(),
  socialProviders: googleProvider,
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: [],
      requireLocalEmailVerified: true,
      allowDifferentEmails: false,
    },
  },
  // OAuth failures redirect to `/?error=<code>` (the default /api/auth/error
  // page is blocked by the allow-list).
  onAPIError: {
    errorURL: appBaseURL ? `${appBaseURL.replace(/\/+$/, "")}/` : "/",
  },
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
