import { describe, expect, test } from "bun:test";
import { PrismaClient } from "@prisma/client";
import {
  ACCOUNTS,
  BASE,
  plantEmailOtp,
  plantOtp,
  postJson,
  postProfileComplete,
  registerStudent,
  signInWithEmail,
  testEmail,
  testPhone,
  uniqueEmail,
} from "./helpers";

const db = new PrismaClient();

describe("GET /api/auth/methods", () => {
  test("returns three booleans, no-store, and no secrets", async () => {
    const res = await fetch(`${BASE}/api/auth/methods`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual(["email", "google", "phone"]);
    for (const v of Object.values(json)) expect(typeof v).toBe("boolean");
  });
});

describe("POST /api/auth/email/send", () => {
  test("rejects invalid addresses with 422 VALIDATION", async () => {
    for (const email of ["", "nope", "a@b", "919000000001@phone.vishwayog.invalid"]) {
      const r = await postJson("/api/auth/email/send", { email });
      expect(r.status).toBe(422);
      expect(r.json.code).toBe("VALIDATION");
    }
    expect((await postJson("/api/auth/email/send", {})).status).toBe(422);
  });
});

describe("POST /api/auth/email/verify", () => {
  test("an unknown address creates a phone-less STUDENT and a session", async () => {
    const email = testEmail();
    const r = await signInWithEmail(email);
    expect(r.status).toBe(200);
    expect(r.cookie).toContain("yoga_session");
    expect(r.json.user).toMatchObject({
      email,
      role: "STUDENT",
      whatsappNumber: null,
      phone: null,
      phoneVerified: false,
      emailVerified: true,
      emailIsPlaceholder: false,
      profileCompleted: false,
    });
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: r.cookie } });
    expect((await me.json()).user.email).toBe(email);
  });

  test("an existing account with a verified email signs in", async () => {
    const email = testEmail();
    const created = await db.user.create({
      data: { name: "Mail User", email, emailVerified: true, role: "STUDENT", status: "ACTIVE", whatsappNumber: null, profileCompletedAt: new Date() },
    });
    const r = await signInWithEmail(email);
    expect(r.status).toBe(200);
    expect(r.json.user.id).toBe(created.id);
    expect(r.json.user.emailVerified).toBe(true);
  });

  test("an email that was only typed into a profile (unverified) cannot sign into that account", async () => {
    const email = testEmail();
    await db.user.create({
      data: { name: "Phone User", email, emailVerified: false, role: "STUDENT", status: "ACTIVE", whatsappNumber: null, profileCompletedAt: new Date() },
    });
    const r = await signInWithEmail(email);
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("EMAIL_LINKED_TO_PHONE");
  });

  test("a code is single use", async () => {
    const email = testEmail();
    const code = await plantEmailOtp(email);
    expect((await postJson("/api/auth/email/verify", { email, code })).status).toBe(200);
    expect((await postJson("/api/auth/email/verify", { email, code })).status).toBe(401);
  });

  test("a wrong code is rejected and sets no session", async () => {
    const email = testEmail();
    await plantEmailOtp(email);
    const r = await postJson("/api/auth/email/verify", { email, code: "000000" });
    expect(r.status).toBe(401);
    expect(r.json.code).toBe("OTP_FAILED");
    expect(r.cookie).not.toContain("yoga_session");
  });

  test("a disabled account gets 403 DISABLED", async () => {
    const email = testEmail();
    await db.user.create({ data: { name: "Off", email, role: "STUDENT", status: "DISABLED" } });
    const r = await signInWithEmail(email);
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("DISABLED");
  });

  test("validates the body", async () => {
    expect((await postJson("/api/auth/email/verify", { email: "bad", code: "123456" })).status).toBe(422);
    expect((await postJson("/api/auth/email/verify", { email: testEmail(), code: "12" })).status).toBe(422);
  });
});

describe("profile phone linking", () => {
  test("requires a session", async () => {
    expect((await postJson("/api/profile/phone/send", { phone: testPhone() })).status).toBe(401);
    expect((await postJson("/api/profile/phone/verify", { phone: testPhone(), code: "123456" })).status).toBe(401);
  });

  test("send rejects a number owned by another account with PHONE_TAKEN", async () => {
    const { cookie } = await signInWithEmail(testEmail());
    const r = await postJson("/api/profile/phone/send", { phone: ACCOUNTS.student }, cookie);
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("PHONE_TAKEN");
    expect(r.json.error).toBe("This number is already registered with another account. Sign in with that number instead.");
  });

  test("send rejects an invalid number", async () => {
    const { cookie } = await signInWithEmail(testEmail());
    const r = await postJson("/api/profile/phone/send", { phone: "1234567" }, cookie);
    expect(r.status).toBe(422);
  });

  test("verify rejects a number owned by another account with PHONE_TAKEN", async () => {
    const { cookie } = await signInWithEmail(testEmail());
    await plantOtp(ACCOUNTS.student, "LINK");
    const r = await postJson("/api/profile/phone/verify", { phone: ACCOUNTS.student, code: "123456" }, cookie);
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("PHONE_TAKEN");
  });

  test("a wrong code does not link the number", async () => {
    const { cookie } = await signInWithEmail(testEmail());
    const phone = testPhone();
    await plantOtp(phone, "LINK");
    const r = await postJson("/api/profile/phone/verify", { phone, code: "000000" }, cookie);
    expect(r.status).toBe(401);
  });

  test("a valid code links the number and flips phoneVerified", async () => {
    const { cookie } = await signInWithEmail(testEmail());
    const phone = testPhone();
    const code = await plantOtp(phone, "LINK");
    const r = await postJson("/api/profile/phone/verify", { phone, code }, cookie);
    expect(r.status).toBe(200);
    expect(r.json.user).toMatchObject({ whatsappNumber: phone, phone, phoneVerified: true });
    // Already linked: a second link is refused.
    const again = await postJson("/api/profile/phone/send", { phone: testPhone() }, cookie);
    expect(again.status).toBe(409);
    expect(again.json.code).toBe("PHONE_ALREADY_SET");
  });
});

describe("POST /api/profile/complete with the multi-method flow", () => {
  test("rejects with PHONE_REQUIRED until a WhatsApp number is verified", async () => {
    const { cookie } = await signInWithEmail(testEmail());
    const r = await postProfileComplete(cookie, { name: "Asha Rao", acceptTerms: true });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("PHONE_REQUIRED");
    expect(r.json.error).toBe("Please verify your WhatsApp number first.");
  });

  test("email is optional when the account already has a real email", async () => {
    const email = testEmail();
    const { cookie } = await signInWithEmail(email);
    const phone = testPhone();
    const code = await plantOtp(phone, "LINK");
    expect((await postJson("/api/profile/phone/verify", { phone, code }, cookie)).status).toBe(200);
    const r = await postProfileComplete(cookie, { name: "Asha Rao", acceptTerms: true });
    expect(r.status).toBe(200);
    expect(r.json.user).toMatchObject({ email, profileCompleted: true, phoneVerified: true });
  });

  test("email stays required for phone-only (placeholder) accounts", async () => {
    const { cookie } = await registerStudent();
    const r = await postProfileComplete(cookie, { name: "Asha Rao", acceptTerms: true });
    expect(r.status).toBe(422);
    expect(r.json.code).toBe("VALIDATION");
    const ok = await postProfileComplete(cookie, { name: "Asha Rao", email: uniqueEmail(), acceptTerms: true });
    expect(ok.status).toBe(200);
    expect(ok.json.user).toMatchObject({ emailIsPlaceholder: false, phoneVerified: true });
  });
});
