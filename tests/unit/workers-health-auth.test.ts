import { describe, expect, mock, test, beforeEach } from "bun:test";

let adminOk = false;
const executeJob = mock(async () => ({ skipped: false, ms: 1, payload: { result: 1 } }));
mock.module("@/lib/auth", () => ({
  requireRole: async () => {
    if (!adminOk) throw new Error("UNAUTHORIZED");
    return { id: "a" };
  },
}));
mock.module("@/lib/services/job-runner", () => ({ executeJob, readHeartbeat: async () => null }));
mock.module("@/lib/db", () => ({ db: { $queryRaw: async () => [1] } }));
mock.module("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));

const { NextRequest } = await import("next/server");
const workers = await import("@/app/api/workers/run/route");
const health = await import("@/app/api/health/route");

const req = (method: string, headers: Record<string, string> = {}, url = "http://localhost:3000/api/workers/run") =>
  new NextRequest(url, { method, headers, body: method === "POST" ? "{}" : undefined });

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret-value";
  adminOk = false;
  executeJob.mockClear();
});

describe("workers/run auth", () => {
  test("GET with bearer works", async () => {
    const res = await workers.GET(req("GET", { authorization: "Bearer s3cret-value" }));
    expect(res.status).toBe(200);
  });
  test("GET with admin session only is rejected", async () => {
    adminOk = true;
    expect((await workers.GET(req("GET"))).status).toBe(401);
    expect(executeJob).not.toHaveBeenCalled();
  });
  test("GET with wrong bearer is rejected", async () => {
    expect((await workers.GET(req("GET", { authorization: "Bearer nope" }))).status).toBe(401);
  });
  test("POST accepts admin session", async () => {
    adminOk = true;
    expect((await workers.POST(req("POST"))).status).toBe(200);
  });
  test("POST accepts bearer", async () => {
    expect((await workers.POST(req("POST", { authorization: "Bearer s3cret-value" }))).status).toBe(200);
  });
  test("POST anonymous rejected", async () => {
    expect((await workers.POST(req("POST"))).status).toBe(401);
  });
});

describe("health output", () => {
  const get = (headers: Record<string, string> = {}) =>
    health.GET(req("GET", headers, "http://localhost:3000/api/health"));

  test("public body is minimal", async () => {
    const body = await (await get()).json();
    expect(Object.keys(body).sort()).toEqual(["db", "status", "ts"]);
    expect(body.db).toBe("ok");
  });
  test("wrong bearer stays minimal", async () => {
    const body = await (await get({ authorization: "Bearer wrong" })).json();
    expect(body.integrations).toBeUndefined();
  });
  test("bearer gets the detailed report", async () => {
    const body = await (await get({ authorization: "Bearer s3cret-value" })).json();
    expect(body.integrations).toBeDefined();
    expect(body.workers).toBeDefined();
    expect(body.missingEnv).toBeDefined();
    expect(body.optionalIntegrations).toBeDefined();
  });
});
