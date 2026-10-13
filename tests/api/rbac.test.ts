import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { api, type Role } from "./helpers";

// Public by design: auth flows, health probe, provider webhooks, root.
const PUBLIC = [/^auth\//, /^health$/, /^webhooks\//, /^$/];
// Secret-protected machine endpoint.
const MACHINE = [/^workers\/run$/];

const routes = [...new Glob("**/route.ts").scanSync("src/app/api")]
  .map((p) => p.replaceAll("\\", "/").replace(/\/?route\.ts$/, ""))
  .filter((r) => !PUBLIC.some((re) => re.test(r)) && !MACHINE.some((re) => re.test(r)))
  .sort();

// Replace dynamic segments with an id that cannot exist.
const toPath = (r: string) => "/api/" + r.replace(/\[[^\]]+\]/g, "does-not-exist");
const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"];

async function routeMethods(r: string): Promise<string[]> {
  const src = await Bun.file(`src/app/api/${r}/route.ts`).text();
  return METHODS.filter((m) => new RegExp(String.raw`export\s+(async\s+)?function\s+${m}\b`).test(src));
}

describe("route inventory", () => {
  test("there are routes to check", () => expect(routes.length).toBeGreaterThan(30));
});

describe("anonymous access is rejected everywhere", () => {
  for (const r of routes) {
    test(r, async () => {
      for (const m of await routeMethods(r)) {
        const res = await api("anon", m, toPath(r), m === "GET" ? undefined : {});
        expect([401, 403], `${m} ${toPath(r)} -> ${res.status}`).toContain(res.status);
      }
    });
  }
});

const adminOnly = routes.filter((r) => r.startsWith("admin/"));
const instructorArea = routes.filter((r) => r.startsWith("instructor/"));

describe("students cannot reach staff routes", () => {
  for (const r of [...adminOnly, ...instructorArea]) {
    test(r, async () => {
      for (const m of await routeMethods(r)) {
        const res = await api("student", m, toPath(r), m === "GET" ? undefined : {});
        expect(res.status, `${m} ${toPath(r)} -> ${res.status}`).toBe(403);
      }
    });
  }
});

describe("instructors cannot reach admin-only routes", () => {
  // Instructors may read these (and use the listed writes); every other
  // method on an /admin route must be forbidden.
  const instructorMethods: Record<string, string[]> = {
    "admin/classes": ["GET"],
    "admin/classes/[id]/notes": ["GET", "POST", "PUT", "PATCH"],
    "admin/classes/[id]/complete": ["POST"],
    "admin/classes/[id]/reopen": ["POST"],
    "admin/schedules": ["GET"],
    "admin/schedules/calendar": ["GET"],
    "admin/exceptions": ["GET"],
  };
  for (const r of adminOnly) {
    test(r, async () => {
      for (const m of await routeMethods(r)) {
        if (instructorMethods[r]?.includes(m)) continue;
        const res = await api("instructor", m, toPath(r), m === "GET" ? undefined : {});
        expect([403, 404], `${m} ${toPath(r)} -> ${res.status}`).toContain(res.status);
      }
    }, 30_000);
  }
});

describe("authorised GETs never 5xx", () => {
  const roleFor = (r: string): Role =>
    r.startsWith("admin/") ? "admin" : r.startsWith("instructor/") ? "instructor" : "student";
  for (const r of routes) {
    if (r.includes("[")) continue; // needs real ids; covered by flow tests
    test(r, async () => {
      if (!(await routeMethods(r)).includes("GET")) return;
      const res = await api(roleFor(r), "GET", toPath(r));
      expect(res.status, `GET ${toPath(r)} -> ${res.status} ${JSON.stringify(res.json)?.slice(0, 200)}`).toBeLessThan(500);
    });
  }
});

describe("machine endpoint", () => {
  test("workers/run rejects missing/wrong secret", async () => {
    expect([401, 403]).toContain((await api("anon", "POST", "/api/workers/run", {})).status);
    expect([401, 403]).toContain((await api("anon", "POST", "/api/workers/run?secret=wrong", {})).status);
  });
});
