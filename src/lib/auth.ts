import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { isPlaceholderEmail } from "@/lib/email";

export const SESSION_COOKIE = "yoga_session";
export const SESSION_DAYS = 30;

/**
 * Session tokens are stored hashed (sha256 hex) so a database read leak does
 * not yield live sessions; the cookie carries the raw random token.
 * NOTE: sessions issued before this change stored the raw token, so they no
 * longer match and simply stop working (no production users yet).
 * The Session table is shared with Better Auth, which keeps its own raw token
 * format in the same column; a 64-char sha256 hex of a legacy token cannot be
 * looked up through Better Auth's cookie, so the two never interfere.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  await db.session.create({
    data: { userId, token: hashSessionToken(token), expiresAt },
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.session
    .deleteMany({ where: { token: hashSessionToken(token) } })
    .catch(() => {});
}

/** Deletes every session (legacy and Better Auth share the table) of a user; returns the count. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const res = await db.session.deleteMany({ where: { userId } });
  return res.count;
}

/** Resolves the user of a raw session token (null if unknown/expired). */
export async function getUserIdForToken(token: string): Promise<string | null> {
  const session = await db.session.findUnique({
    where: { token: hashSessionToken(token) },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.userId;
}

export async function getSession(): Promise<{ userId: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await getUserIdForToken(token);
  return userId ? { userId } : null;
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  status: string;
  phone: string | null;
  whatsappNumber: string | null;
  /** True once a phone-only signup finished the profile dialog. Always true for staff. */
  profileCompleted: boolean;
  /** A WhatsApp-verified number is on the account (every account needs one to use the app). */
  phoneVerified: boolean;
  /** The email is the reserved placeholder of a phone-only signup, not a real mailbox. */
  emailIsPlaceholder: boolean;
  emailVerified: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone: string | null;
  whatsappNumber: string | null;
  emailVerified: boolean;
  profileCompletedAt: Date | null;
};

export function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AuthUser["role"],
    status: user.status,
    phone: user.phone,
    whatsappNumber: user.whatsappNumber,
    profileCompleted: user.profileCompletedAt !== null || user.role !== "STUDENT",
    phoneVerified: user.whatsappNumber !== null,
    emailIsPlaceholder: isPlaceholderEmail(user.email),
    emailVerified: user.emailVerified,
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  // 1. Try Better Auth session first
  try {
    const { getBetterAuthSession } = await import("@/lib/better-auth");
    const baSession = await getBetterAuthSession();
    if (baSession?.user) {
      // Better Auth session found — look up the user in our DB to get
      // the full profile (role, phone, whatsappNumber).
      const user = await db.user.findUnique({
        where: { id: baSession.user.id },
      });
      if (user && user.status === "ACTIVE") {
        return toAuthUser(user);
      }
    }
  } catch {
    // Better Auth not ready or not configured — fall through to legacy
  }

  // 2. Fall back to legacy session (for backward compat with existing
  // sessions created by /api/auth/otp/verify)
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "ACTIVE") return null;
  return toAuthUser(user);
}

export function setSessionCookie(token: string) {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
  };
}

export async function requireRole(
  role: AuthUser["role"] | AuthUser["role"][]
): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
