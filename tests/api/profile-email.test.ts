import { describe, expect, test } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { BASE, plantEmailOtp, postJson, postProfileComplete, registerStudent, testEmail } from "./helpers";

const db = new PrismaClient();

async function emailDeliveryOn(): Promise<boolean> {
  return (await (await fetch(`${BASE}/api/auth/methods`)).json()).email === true;
}

function owner(email: string) {
  return db.user.create({
    data: { name: "Owner", email, emailVerified: true, role: "STUDENT", status: "ACTIVE", whatsappNumber: null, profileCompletedAt: new Date() },
  });
}

describe("POST /api/profile/email/send", () => {
  test("requires a session", async () => {
    expect((await postJson("/api/profile/email/send", { email: testEmail() })).status).toBe(401);
  });

  test("rejects invalid addresses with 422", async () => {
    const { cookie } = await registerStudent();
    for (const email of ["", "nope", "919000000001@phone.vishwayog.invalid"]) {
      expect((await postJson("/api/profile/email/send", { email }, cookie)).status).toBe(422);
    }
  });

  test("409 EMAIL_TAKEN when another account owns the address (case-insensitive)", async () => {
    const { cookie } = await registerStudent();
    const email = testEmail();
    await owner(email);
    const r = await postJson("/api/profile/email/send", { email: email.toUpperCase() }, cookie);
    // 503 UNAVAILABLE comes first when delivery is not configured on the test server.
    expect(r.status).toBe((await emailDeliveryOn()) ? 409 : 503);
    if (r.status === 409) expect(r.json.code).toBe("EMAIL_TAKEN");
  });

  test("503 UNAVAILABLE when email delivery is not configured", async () => {
    if (await emailDeliveryOn()) return;
    const { cookie } = await registerStudent();
    const r = await postJson("/api/profile/email/send", { email: testEmail() }, cookie);
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("UNAVAILABLE");
  });
});

describe("POST /api/profile/email/verify", () => {
  test("requires a session", async () => {
    expect((await postJson("/api/profile/email/verify", { email: testEmail(), code: "123456" })).status).toBe(401);
  });

  test("a wrong code is rejected and stores nothing", async () => {
    const { cookie } = await registerStudent();
    const email = testEmail();
    await plantEmailOtp(email);
    const r = await postJson("/api/profile/email/verify", { email, code: "000000" }, cookie);
    expect(r.status).toBe(401);
    expect(r.json.code).toBe("OTP_FAILED");
    expect(await db.user.findFirst({ where: { email } })).toBeNull();
  });

  test("a valid code stores the address as verified and returns the user", async () => {
    const { cookie } = await registerStudent();
    const email = testEmail();
    const code = await plantEmailOtp(email);
    const r = await postJson("/api/profile/email/verify", { email: email.toUpperCase(), code }, cookie);
    expect(r.status).toBe(200);
    expect(r.json.user).toMatchObject({ email, emailVerified: true, emailIsPlaceholder: false });
    // Single use.
    expect((await postJson("/api/profile/email/verify", { email, code }, cookie)).status).toBe(401);
  });

  test("409 EMAIL_TAKEN when the address belongs to another account", async () => {
    const { cookie } = await registerStudent();
    const email = testEmail();
    await owner(email);
    const code = await plantEmailOtp(email);
    const r = await postJson("/api/profile/email/verify", { email, code }, cookie);
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("EMAIL_TAKEN");
  });
});

describe("POST /api/profile/complete email rule", () => {
  test("with delivery configured a typed email is refused with EMAIL_REQUIRED and nothing is stored", async () => {
    if (!(await emailDeliveryOn())) return;
    const { cookie } = await registerStudent();
    const email = testEmail();
    const r = await postProfileComplete(cookie, { name: "Asha Rao", email, acceptTerms: true });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("EMAIL_REQUIRED");
    expect(await db.user.findFirst({ where: { email } })).toBeNull();
  });

  test("verify then complete succeeds", async () => {
    const { cookie } = await registerStudent();
    const email = testEmail();
    const code = await plantEmailOtp(email);
    expect((await postJson("/api/profile/email/verify", { email, code }, cookie)).status).toBe(200);
    const r = await postProfileComplete(cookie, { name: "Asha Rao", acceptTerms: true });
    expect(r.status).toBe(200);
    expect(r.json.user).toMatchObject({ email, emailVerified: true, profileCompleted: true });
  });

  test("without delivery the unverified claim still works", async () => {
    if (await emailDeliveryOn()) return;
    const { cookie } = await registerStudent();
    const email = testEmail();
    const r = await postProfileComplete(cookie, { name: "Asha Rao", email, acceptTerms: true });
    expect(r.status).toBe(200);
    expect(r.json.user).toMatchObject({ email, emailVerified: false });
  });
});
