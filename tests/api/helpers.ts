// Shared helpers for API tests. Run against a live server:
//   BASE_URL=http://localhost:3000 bun test tests/api
//
// Sign-in is WhatsApp OTP only. Tests cannot read the WhatsApp message, so they
// insert a known OtpCode row directly (same HMAC scheme as src/lib/providers/otp.ts)
// and call /api/auth/otp/verify. Requires DATABASE_URL and AUTH_SECRET in the test
// environment, matching the server under test.
import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new PrismaClient();

export type Role = "admin" | "instructor" | "student" | "noSub" | "expired" | "anon";

// Seeded accounts (prisma/seed.ts), identified by WhatsApp number.
export const ACCOUNTS: Record<Exclude<Role, "anon">, string> = {
  admin: "+919000000001",
  instructor: "+919000000002",
  student: "+919000000010",
  noSub: "+919000000012",
  expired: "+919000000013",
};

export function testPhone(): string {
  return `+91700${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
}

/** Plants a known code for `phone` (E.164 with +) and returns it. */
export async function plantOtp(phone: string, purpose: "LOGIN" | "REGISTER" | "LINK" = "LOGIN"): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set for API tests");
  const digits = phone.replace(/\D/g, "");
  const code = "123456";
  await db.otpCode.updateMany({ where: { phone: digits, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.otpCode.create({
    data: {
      phone: digits,
      codeHash: createHmac("sha256", secret).update(`otp:${digits}:${code}`).digest("hex"),
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  return code;
}

const rnd = () => Math.floor(Math.random() * 250) + 1;

export async function verifyWith(
  phone: string,
  code: string,
  extra: Record<string, unknown> = {},
): Promise<{ res: Response; cookie: string }> {
  const res = await fetch(`${BASE}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": `10.${rnd()}.${rnd()}.${rnd()}` },
    body: JSON.stringify({ phone, code, ...extra }),
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { res, cookie };
}

export async function signIn(phone: string): Promise<{ res: Response; cookie: string }> {
  const code = await plantOtp(phone);
  return verifyWith(phone, code);
}

/** New number + REGISTER code: verify creates a phone-only STUDENT (profile not completed yet). */
export async function registerStudent(): Promise<{ phone: string; cookie: string; res: Response }> {
  const phone = testPhone();
  const code = await plantOtp(phone, "REGISTER");
  const { res, cookie } = await verifyWith(phone, code);
  return { phone, cookie, res };
}

export function uniqueEmail(): string {
  return `t${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function postProfileComplete(cookie: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}/api/profile/complete`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const cookies = new Map<string, string>();

export async function cookieFor(role: Role): Promise<string> {
  if (role === "anon") return "";
  const hit = cookies.get(role);
  if (hit) return hit;
  const { res, cookie } = await signIn(ACCOUNTS[role]);
  if (!res.ok || !cookie) throw new Error(`sign-in failed for ${role}: ${res.status}`);
  cookies.set(role, cookie);
  return cookie;
}

export async function api(
  role: Role,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: any; res: Response }> {
  const cookie = await cookieFor(role);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      origin: BASE,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, res };
}

export const TEST_EMAIL_DOMAIN = "vy-test.example";

export function testEmail(): string {
  return `t${Date.now()}${Math.floor(Math.random() * 1e6)}@${TEST_EMAIL_DOMAIN}`;
}

/** Plants a known email code (same HMAC scheme as src/lib/providers/email-otp.ts) and returns it. */
export async function plantEmailOtp(email: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set for API tests");
  const code = "123456";
  await db.emailOtpCode.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.emailOtpCode.create({
    data: {
      email,
      codeHash: createHmac("sha256", secret).update(`email-otp:${email}:${code}`).digest("hex"),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  return code;
}

export async function postJson(
  path: string,
  body: unknown,
  cookie = "",
): Promise<{ status: number; json: any; res: Response; cookie: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      "x-forwarded-for": `10.${rnd()}.${rnd()}.${rnd()}`,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const setCookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: res.status, json: await res.json().catch(() => null), res, cookie: setCookie };
}

/** Email sign-in with a planted code; creates a phone-less STUDENT for an unknown address. */
export async function signInWithEmail(email: string) {
  const code = await plantEmailOtp(email);
  return postJson("/api/auth/email/verify", { email, code });
}
