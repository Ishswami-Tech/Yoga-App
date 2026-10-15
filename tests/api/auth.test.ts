import { describe, expect, test } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { ACCOUNTS, BASE, api, plantEmailOtp, plantOtp, postJson, postProfileComplete, registerStudent, signIn, testPhone, uniqueEmail, verifyWith } from "./helpers";

const db = new PrismaClient();

describe("auth (WhatsApp OTP only)", () => {
  test("valid code signs in and /me returns the user", async () => {
    const { res, cookie } = await signIn(ACCOUNTS.admin);
    expect(res.status).toBe(200);
    expect(cookie).toContain("yoga_session");
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } });
    expect((await me.json()).user.role).toBe("ADMIN");
  });

  test("wrong code is rejected and sets no session", async () => {
    await plantOtp(ACCOUNTS.admin);
    const { res, cookie } = await verifyWith(ACCOUNTS.admin, "000000");
    expect(res.status).toBe(401);
    expect(cookie).not.toContain("yoga_session");
  });

  test("a code is single use", async () => {
    const code = await plantOtp(ACCOUNTS.student);
    expect((await verifyWith(ACCOUNTS.student, code)).res.status).toBe(200);
    expect((await verifyWith(ACCOUNTS.student, code)).res.status).toBe(401);
  });

  test("code is locked after 5 wrong attempts", async () => {
    const code = await plantOtp(ACCOUNTS.noSub);
    for (let i = 0; i < 5; i++) await verifyWith(ACCOUNTS.noSub, "000000");
    expect((await verifyWith(ACCOUNTS.noSub, code)).res.status).toBe(401);
  });

  test("send gives a neutral response for unknown numbers and never returns a code", async () => {
    const r = await api("anon", "POST", "/api/auth/otp/send", { phone: testPhone() });
    // 200 when WhatsApp is configured; 503 ("unavailable") when this environment has no Meta credentials.
    expect([200, 503]).toContain(r.status);
    expect(JSON.stringify(r.json)).not.toMatch(/devCode|\b\d{6}\b/);
  });

  test("a LOGIN-purpose code for an unknown number does not create an account", async () => {
    const phone = testPhone();
    const code = await plantOtp(phone, "LOGIN");
    const { res, cookie } = await verifyWith(phone, code);
    expect(res.status).toBe(401);
    expect(cookie).not.toContain("yoga_session");
    expect(await db.user.count({ where: { whatsappNumber: phone } })).toBe(0);
  });

  test("/me without a session returns no user", async () => {
    const r = await api("anon", "GET", "/api/auth/me");
    expect(r.json?.user ?? null).toBeNull();
  });

  test("sign-out invalidates the session", async () => {
    const { cookie } = await signIn(ACCOUNTS.student);
    const out = await fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, cookie },
      body: "{}",
    });
    expect(out.status).toBe(200);
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } });
    expect((await me.json()).user ?? null).toBeNull();
  });

  test("a new number with a REGISTER code creates a phone-only STUDENT with profileCompleted=false", async () => {
    const { phone, res, cookie } = await registerStudent();
    expect(res.status).toBe(200);
    expect((await res.json()).user.profileCompleted).toBe(false);
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } });
    const { user } = await me.json();
    expect(user.role).toBe("STUDENT");
    expect(user.profileCompleted).toBe(false);
    expect(user.name).toBe("New student");
    expect(user.email).toBe(`${phone.replace(/\D/g, "")}@phone.vishwayog.invalid`);
  });

  test("registration cannot self-assign a role or status", async () => {
    const phone = testPhone();
    const code = await plantOtp(phone, "REGISTER");
    const { cookie } = await verifyWith(phone, code, { role: "ADMIN", status: "ACTIVE", name: "Esc" });
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } });
    const { user } = await me.json();
    expect(user?.role).toBe("STUDENT");
    expect(user?.name).toBe("New student");
  });

  test("existing users sign in with profileCompleted=true", async () => {
    const { res } = await signIn(ACCOUNTS.student);
    expect((await res.json()).user.profileCompleted).toBe(true);
  });

  describe("POST /api/profile/complete", () => {
    test("requires a session", async () => {
      const r = await postProfileComplete("", { name: "Asha Rao", email: uniqueEmail(), acceptTerms: true });
      expect(r.status).toBe(401);
    });

    test("validates input", async () => {
      const { cookie } = await registerStudent();
      const ok = { name: "Asha Rao", email: uniqueEmail(), acceptTerms: true };
      for (const bad of [
        { ...ok, name: "A" },
        { ...ok, email: "not-an-email" },
        { ...ok, email: "919000000099@phone.vishwayog.invalid" },
        { ...ok, acceptTerms: false },
        { name: ok.name, email: ok.email },
      ]) {
        const r = await postProfileComplete(cookie, bad);
        expect(r.status).toBe(422);
        expect(r.json.code).toBe("VALIDATION");
      }
    });

    // The email is proven with a code first (/api/profile/email/*), then the profile is completed.
    async function verifyEmail(cookie: string, email: string) {
      // The server normalises addresses to lowercase, so the planted code must use that form.
      const code = await plantEmailOtp(email.trim().toLowerCase());
      return postJson("/api/profile/email/verify", { email, code }, cookie);
    }

    test("completes the profile and flips profileCompleted to true", async () => {
      const { cookie } = await registerStudent();
      const email = uniqueEmail();
      expect((await verifyEmail(cookie, email.toUpperCase())).status).toBe(200);
      const r = await postProfileComplete(cookie, { name: "  Asha Rao ", acceptTerms: true });
      expect(r.status).toBe(200);
      expect(r.json.user).toMatchObject({ name: "Asha Rao", email, role: "STUDENT", profileCompleted: true });
      const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } });
      expect((await me.json()).user.profileCompleted).toBe(true);
      // Idempotent: a second call updates the name the same way.
      const again = await postProfileComplete(cookie, { name: "Asha R", acceptTerms: true });
      expect(again.status).toBe(200);
      expect(again.json.user.name).toBe("Asha R");
    });

    test("rejects an email owned by another account", async () => {
      const a = await registerStudent();
      const b = await registerStudent();
      const email = uniqueEmail();
      expect((await verifyEmail(a.cookie, email)).status).toBe(200);
      const r = await verifyEmail(b.cookie, email);
      expect(r.status).toBe(409);
      expect(r.json.code).toBe("EMAIL_TAKEN");
    });
  });

  test("removed sign-in methods are gone", async () => {
    for (const path of ["/api/auth/google", "/api/auth/login", "/api/auth/register", "/api/auth/check"]) {
      const r = await api("anon", "POST", path, {});
      expect(r.status).toBe(410);
    }
    for (const path of ["/api/auth/sign-in/email", "/api/auth/sign-up/email"]) {
      const r = await api("anon", "POST", path, { email: "a@b.co", password: "password123", name: "x" });
      expect(r.status).toBe(404);
    }
  });
});
