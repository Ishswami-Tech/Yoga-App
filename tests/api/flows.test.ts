import { describe, expect, test } from "bun:test";
import { BASE, api, registerStudent } from "./helpers";

async function freshStudent() {
  const { phone, cookie } = await registerStudent();
  const as = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { cookie, origin: BASE, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const t = await res.text();
    let json: any = null;
    try {
      json = t ? JSON.parse(t) : null;
    } catch {
      json = t;
    }
    return { status: res.status, json };
  };
  return { phone, as };
}

describe("membership lifecycle", () => {
  test("new student has no membership; payments are unavailable without Razorpay keys", async () => {
    const { as } = await freshStudent();

    const before = await as("GET", "/api/subscription");
    expect(before.status).toBe(200);
    expect(JSON.stringify(before.json)).not.toContain('"ACTIVE"');

    // No simulator exists any more.
    const sim = await as("POST", "/api/subscriptions/simulate", {});
    expect(sim.status).toBe(404);

    // With RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET unset the API answers 503, never a fake checkout.
    // (With real test keys this would create a real Razorpay subscription, so only assert when unset.)
    if (!process.env.RAZORPAY_KEY_ID) {
      const create = await as("POST", "/api/subscriptions/create", {});
      expect(create.status).toBe(503);
    }
  });

  test("a forged checkout signature is not accepted", async () => {
    const { as } = await freshStudent();
    const forged = await as("POST", "/api/subscriptions/verify", {
      razorpaySubscriptionId: "sub_unknown",
      razorpayPaymentId: "pay_forged",
      razorpaySignature: "forged",
    });
    const accepted = forged.status === 200 && (forged.json?.valid === true || forged.json?.ok === true || forged.json?.verified === true);
    expect(accepted, JSON.stringify(forged.json)).toBe(false);
  });

  test("staff cannot create student subscriptions", async () => {
    for (const role of ["admin", "instructor"] as const) {
      const r = await api(role, "POST", "/api/subscriptions/create", {});
      expect(r.status).toBe(403);
    }
  });
});

describe("class access gating", () => {
  test("students without an active membership never receive the meet link", async () => {
    for (const role of ["noSub", "expired"] as const) {
      const r = await api(role, "GET", "/api/classes/today");
      expect([200, 404]).toContain(r.status);
      if (r.status === 200) expect(JSON.stringify(r.json)).not.toMatch(/meet\.google/i);
    }
  });

  test("join endpoint does not 5xx for any seeded student", async () => {
    for (const role of ["student", "noSub", "expired"] as const) {
      const r = await api(role, "GET", "/api/classes/join");
      expect(r.status).toBeLessThan(500);
    }
  });

  test("active member and no-membership student get different join outcomes", async () => {
    const active = await api("student", "GET", "/api/classes/join");
    const none = await api("noSub", "GET", "/api/classes/join");
    if (active.status === 200 && none.status === 200) {
      expect(JSON.stringify(none.json)).not.toEqual(JSON.stringify(active.json));
    } else {
      expect(none.status).not.toBe(200);
    }
  });
});

describe("profile", () => {
  test("PATCH persists and GET reflects it; invalid input is 4xx", async () => {
    const { as } = await freshStudent();
    const patched = await as("PATCH", "/api/profile", { name: "Renamed Tester", phone: "+919876543210" });
    expect(patched.status, JSON.stringify(patched.json)).toBe(200);
    const got = await as("GET", "/api/profile");
    expect(got.json.name).toBe("Renamed Tester");
    const bad = await as("PATCH", "/api/profile", { name: "" });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).toBeLessThan(500);
  });

  test("a student cannot change their own role via PATCH /api/profile", async () => {
    const { as } = await freshStudent();
    await as("PATCH", "/api/profile", { name: "X Y", role: "ADMIN" });
    const me = await as("GET", "/api/auth/me");
    expect(me.json.user.role).toBe("STUDENT");
  });
});

describe("feedback validation", () => {
  test("rating out of range is rejected, unknown class is 404", async () => {
    const bad = await api("student", "POST", "/api/feedback", { classId: "x", rating: 9 });
    expect([400, 422]).toContain(bad.status);
    const none = await api("student", "POST", "/api/feedback", { classId: "does-not-exist", rating: 5 });
    expect(none.status).toBe(404);
  });
});

describe("razorpay webhook", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    fetch(`${BASE}/api/webhooks/razorpay`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    });

  test("rejects malformed JSON and payloads without an event", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post(JSON.stringify({ foo: 1 }))).status).toBe(400);
  });

  test("events are idempotent by event id", async () => {
    const body = JSON.stringify({ event: "test.noop", event_id: `evt_idem_${Date.now()}`, payload: {} });
    const first = await (await post(body)).json();
    const second = await (await post(body)).json();
    expect(first.received).toBe(true);
    expect(second.applied).toBe(false);
  });
});

describe("admin", () => {
  test("users list, settings and dashboard return data", async () => {
    const paths = [
      "/api/admin/users",
      "/api/admin/settings",
      "/api/admin/dashboard",
      "/api/admin/payments",
      "/api/admin/subscriptions",
    ];
    for (const p of paths) {
      const r = await api("admin", "GET", p);
      expect(r.status, p).toBe(200);
      expect(r.json).toBeTruthy();
    }
  });

  test("admin user detail works for a real id and 404s for a fake one", async () => {
    const users = await api("admin", "GET", "/api/admin/users");
    const list = Array.isArray(users.json) ? users.json : (users.json.users ?? users.json.items ?? []);
    expect(list.length).toBeGreaterThan(0);
    const ok = await api("admin", "GET", `/api/admin/users/${list[0].id}/detail`);
    expect(ok.status).toBe(200);
    const none = await api("admin", "GET", "/api/admin/users/nope/detail");
    expect([404, 400]).toContain(none.status);
  });
});

describe("input hardening: garbage bodies never cause 5xx", () => {
  const garbage: unknown[] = [{}, { id: null, name: 123, email: [] }, "str", [], { rating: "x", classId: {} }];
  const targets = [
    ["student", "POST", "/api/feedback"],
    ["student", "PATCH", "/api/profile"],
    ["student", "POST", "/api/subscriptions/verify"],
    ["admin", "POST", "/api/admin/schedules"],
    ["admin", "POST", "/api/admin/exceptions"],
    ["admin", "POST", "/api/admin/bulk-message"],
    ["admin", "POST", "/api/admin/classes/generate"],
    ["anon", "POST", "/api/auth/check"],
    ["anon", "POST", "/api/auth/register"],
    ["anon", "POST", "/api/auth/login"],
    ["anon", "POST", "/api/auth/otp/send"],
    ["anon", "POST", "/api/auth/otp/verify"],
  ] as const;
  for (const [role, method, path] of targets) {
    test(`${method} ${path}`, async () => {
      for (const body of garbage) {
        const r = await api(role, method, path, body);
        expect(r.status, `${JSON.stringify(body)} -> ${r.status} ${JSON.stringify(r.json)?.slice(0, 160)}`).toBeLessThan(500);
      }
    });
  }
});
