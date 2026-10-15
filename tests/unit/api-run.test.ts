import { describe, expect, mock, test, spyOn } from "bun:test";

let hdrs = new Headers();
mock.module("next/headers", () => ({ headers: async () => hdrs, cookies: async () => ({ get: () => undefined }) }));
process.env.NEXT_PUBLIC_APP_URL = "https://yoga.example.com";
const { run } = await import("@/lib/api");

describe("run()", () => {
  test("blocks cross-origin writes", async () => {
    hdrs = new Headers({ origin: "https://evil.com" });
    const res = await run(async () => ({ a: 1 }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Cross-site request blocked", code: "CSRF" });
  });
  test("allows same-origin and header-less clients", async () => {
    hdrs = new Headers({ origin: "https://yoga.example.com" });
    expect((await run(async () => ({ a: 1 }))).status).toBe(200);
    hdrs = new Headers();
    expect((await run(async () => ({ a: 1 }))).status).toBe(200);
  });
  test("uses the real method when the request is given", async () => {
    hdrs = new Headers();
    const get = new Request("https://yoga.example.com/x", { headers: { "sec-fetch-site": "cross-site" } });
    expect((await run(async () => ({}), get)).status).toBe(200);
    const post = new Request("https://yoga.example.com/x", { method: "POST", headers: { "sec-fetch-site": "cross-site" } });
    expect((await run(async () => ({}), post)).status).toBe(403);
  });
  test("unexpected errors are generic", async () => {
    hdrs = new Headers();
    const spy = spyOn(console, "error").mockImplementation(() => {});
    const res = await run(async () => {
      throw new Error('column "secret_col" does not exist');
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error", code: "INTERNAL" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
