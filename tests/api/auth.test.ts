import { describe, expect, test } from "bun:test";
import { ACCOUNTS, BASE, api, plantOtp, registerStudent, signIn, testPhone, verifyWith } from "./helpers";

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
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.json)).not.toMatch(/devCode|\b\d{6}\b/);
  });

  test("verify for an unregistered number fails without creating an account", async () => {
    const phone = testPhone();
    const code = await plantOtp(phone);
    const { res } = await verifyWith(phone, code);
    expect(res.status).toBe(401);
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

  test("registration creates a STUDENT only after the code verifies", async () => {
    const { res, cookie } = await registerStudent("API Test");
    expect(res.status).toBe(200);
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } });
    expect((await me.json()).user.role).toBe("STUDENT");
  });

  test("registration cannot self-assign a role or status", async () => {
    const phone = testPhone();
    const code = await plantOtp(phone, "REGISTER");
    const { cookie } = await verifyWith(phone, code, { mode: "register", name: "Esc", role: "ADMIN", status: "ACTIVE" });
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie } });
    expect((await me.json()).user?.role).toBe("STUDENT");
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
