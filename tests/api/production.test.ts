// Production-mode security gates. Runs only when PROD_URL points at a server
// started with NODE_ENV=production, AUTH_SECRET set and
// RAZORPAY_WEBHOOK_SECRET=PROD_WEBHOOK_SECRET:
//   PROD_URL=http://localhost:3100 PROD_WEBHOOK_SECRET=whsec_test bun test tests/api/production.test.ts
import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";

const PROD = process.env.PROD_URL;
const SECRET = process.env.PROD_WEBHOOK_SECRET ?? "";
const d = PROD ? describe : describe.skip;

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${PROD}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: PROD!, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const sign = (raw: string) => createHmac("sha256", SECRET).update(raw).digest("hex");

d("production gates", () => {
  test("removed sign-in methods are gone (no account takeover)", async () => {
    const credential = Buffer.from(JSON.stringify({ email: "admin@example.com", name: "x" })).toString("base64");
    const res = await post("/api/auth/google", { credential });
    expect(res.status).toBe(410);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("simulated checkout does not exist (no free memberships)", async () => {
    const res = await post("/api/subscriptions/simulate", {});
    expect([401, 404]).toContain(res.status);
  });

  test("email/password endpoints do not exist", async () => {
    const up = await post("/api/auth/sign-up/email", { email: "x@example.com", password: "password123", name: "Esc", role: "ADMIN" });
    expect(up.status).toBe(404);
    const login = await post("/api/auth/sign-in/email", { email: "x@example.com", password: "password123" });
    expect(login.status).toBe(404);
  });

  test("webhook rejects unsigned and wrongly signed payloads", async () => {
    const body = JSON.stringify({ event: "test.noop", event_id: `evt_${Date.now()}`, payload: {} });
    expect((await post("/api/webhooks/razorpay", body)).status).toBe(401);
    expect((await post("/api/webhooks/razorpay", body, { "x-razorpay-signature": "deadbeef" })).status).toBe(401);
    expect((await post("/api/webhooks/razorpay", body, { "x-razorpay-signature": sign(body + "x") })).status).toBe(401);
  });

  test("webhook accepts a correct HMAC-SHA256 signature and stays idempotent", async () => {
    const body = JSON.stringify({ event: "test.noop", event_id: `evt_ok_${Date.now()}`, payload: {} });
    const headers = { "x-razorpay-signature": sign(body) };
    const first = await post("/api/webhooks/razorpay", body, headers);
    expect(first.status).toBe(200);
    const second = await (await post("/api/webhooks/razorpay", body, headers)).json();
    expect(second.applied).toBe(false);
  });

  test("OTP responses never leak the code", async () => {
    const res = await post("/api/auth/otp/send", { phone: "+919000000003" });
    // 200 (neutral), 429, or 503 when WhatsApp is not configured; never the code.
    expect([200, 429, 503]).toContain(res.status);
    expect(JSON.stringify(await res.json())).not.toMatch(/code"|\b\d{6}\b/);
  });

  test("security headers are present and x-powered-by is hidden", async () => {
    const res = await fetch(`${PROD}/`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("strict-transport-security")).toContain("max-age");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  test("health endpoint reports the database is reachable", async () => {
    const body = await (await fetch(`${PROD}/api/health`)).json();
    expect(body.status).toBe("ok");
  });
});
