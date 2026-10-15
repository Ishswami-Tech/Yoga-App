// Needs a live server: BASE_URL=http://localhost:3000 bun test tests/api/admin-jobs.test.ts
import { describe, expect, test } from "bun:test";
import { api } from "./helpers";

describe("GET /api/admin/jobs", () => {
  test("anon 401", async () => expect((await api("anon", "GET", "/api/admin/jobs")).status).toBe(401));
  test("student 403", async () => expect((await api("student", "GET", "/api/admin/jobs")).status).toBe(403));
  test("admin ok with generate + remind", async () => {
    const r = await api("admin", "GET", "/api/admin/jobs");
    expect(r.status).toBe(200);
    expect(r.json.items.map((i: { job: string }) => i.job)).toEqual(["generate", "remind"]);
    expect(typeof r.json.now).toBe("string");
    for (const i of r.json.items) {
      expect(["ok", "failing", "stale", "never_run"]).toContain(i.state);
      expect(i).toHaveProperty("staleAfterSeconds");
    }
  });
});

describe("POST /api/admin/jobs/run", () => {
  test("anon 401", async () => expect((await api("anon", "POST", "/api/admin/jobs/run", { job: "generate" })).status).toBe(401));
  test("student 403", async () => expect((await api("student", "POST", "/api/admin/jobs/run", { job: "generate" })).status).toBe(403));
  test("rejects unknown job", async () => expect((await api("admin", "POST", "/api/admin/jobs/run", { job: "retry" })).status).toBe(422));
  test("rejects missing body", async () => expect((await api("admin", "POST", "/api/admin/jobs/run", {})).status).toBe(422));
});
