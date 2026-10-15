import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { googleMeet } from "@/lib/providers/google";

const realFetch = globalThis.fetch;
const env = { ...process.env };
let calls: { url: string; method: string; signal: boolean }[] = [];

function stub(handler: (url: string, method: string) => unknown) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, signal: !!init?.signal });
    return new Response(JSON.stringify(handler(url, method)), { status: 200 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "id";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "secret";
  process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = "refresh";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

const input = { scheduleId: "s1", date: "2026-10-15", startTime: "07:00", endTime: "08:00", timezone: "Asia/Kolkata", name: "Yoga" };

describe("googleMeet.createMeetForClass", () => {
  test("reuses an existing event tagged with the class key (no duplicate insert)", async () => {
    stub((url) => {
      if (url.includes("oauth2")) return { access_token: "tok", expires_in: 3600 };
      return { items: [{ id: "ev1", hangoutLink: "https://meet.google.com/abc", htmlLink: "h" }] };
    });
    const r = await googleMeet.createMeetForClass(input);
    expect(r.googleEventId).toBe("ev1");
    expect(calls.some((c) => c.method === "POST" && c.url.includes("/events"))).toBe(false);
    expect(calls.every((c) => c.signal)).toBe(true);
    expect(calls.some((c) => decodeURIComponent(c.url).includes("vishwayogClassKey=s1:2026-10-15"))).toBe(true);
  });

  test("creates the event when none exists", async () => {
    stub((url, method) => {
      if (url.includes("oauth2")) return { access_token: "tok2", expires_in: 3600 };
      if (method === "POST") return { id: "ev2", hangoutLink: "https://meet.google.com/xyz" };
      return { items: [] };
    });
    const r = await googleMeet.createMeetForClass(input);
    expect(r.googleEventId).toBe("ev2");
    expect(calls.filter((c) => c.method === "POST" && c.url.includes("/events"))).toHaveLength(1);
  });
});
