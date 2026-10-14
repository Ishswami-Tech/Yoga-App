import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { buildLoginCodeEmail, emailConfigured, escapeHtml, sendEmail } from "@/lib/providers/email";

const realFetch = globalThis.fetch;
const msg = { to: "a@example.com", subject: "S", html: "<p>x</p>", text: "x" };
const ENV_KEYS = ["ZEPTOMAIL_TOKEN", "EMAIL_FROM_ADDRESS", "EMAIL_FROM_NAME", "ZEPTOMAIL_API_URL"] as const;

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  globalThis.fetch = impl as unknown as typeof fetch;
}

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.ZEPTOMAIL_TOKEN = "tok_123";
  process.env.EMAIL_FROM_ADDRESS = "noreply@example.com";
  process.env.EMAIL_FROM_NAME = "Yoga";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("sendEmail (ZeptoMail)", () => {
  test("posts to the default India endpoint with the Zoho auth header and ZeptoMail body", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    stubFetch(async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({ request_id: "r1", data: [] }), { status: 200 });
    });
    expect(await sendEmail(msg)).toEqual({ ok: true });
    expect(seen!.url).toBe("https://api.zeptomail.in/v1.1/email");
    const headers = seen!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Zoho-enczapikey tok_123");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Accept).toBe("application/json");
    expect(JSON.parse(String(seen!.init.body))).toEqual({
      from: { address: "noreply@example.com", name: "Yoga" },
      to: [{ email_address: { address: "a@example.com", name: "a@example.com" } }],
      subject: "S",
      htmlbody: "<p>x</p>",
      textbody: "x",
    });
  });

  test("never doubles the token prefix", async () => {
    process.env.ZEPTOMAIL_TOKEN = "Zoho-enczapikey tok_123";
    let auth = "";
    stubFetch(async (_u, init) => {
      auth = (init.headers as Record<string, string>).Authorization;
      return new Response("{}", { status: 200 });
    });
    await sendEmail(msg);
    expect(auth).toBe("Zoho-enczapikey tok_123");
  });

  test("honours ZEPTOMAIL_API_URL (trailing slash tolerated) and defaults the sender name", async () => {
    process.env.ZEPTOMAIL_API_URL = "https://api.zeptomail.com/";
    delete process.env.EMAIL_FROM_NAME;
    let seen: { url: string; body: any } | undefined;
    stubFetch(async (url, init) => {
      seen = { url, body: JSON.parse(String(init.body)) };
      return new Response("{}", { status: 200 });
    });
    await sendEmail(msg);
    expect(seen!.url).toBe("https://api.zeptomail.com/v1.1/email");
    expect(typeof seen!.body.from.name).toBe("string");
    expect(seen!.body.from.name.length).toBeGreaterThan(0);
  });

  test("API error with the ZeptoMail error shape returns ok:false with code and message", async () => {
    stubFetch(async () =>
      new Response(
        JSON.stringify({ error: { code: "TM_3501", message: "Sender domain not verified", details: [] } }),
        { status: 400 },
      ),
    );
    const r = await sendEmail(msg);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("HTTP_400_TM_3501");
    expect(r.errorMessage).toContain("Sender domain not verified");
    expect(JSON.stringify(r)).not.toContain("tok_123");
  });

  test("non-JSON error body still fails cleanly", async () => {
    stubFetch(async () => new Response("oops", { status: 502 }));
    expect(await sendEmail(msg)).toMatchObject({ ok: false, errorCode: "HTTP_502" });
  });

  test("network error returns ok:false", async () => {
    stubFetch(async () => {
      throw new Error("boom");
    });
    expect(await sendEmail(msg)).toMatchObject({ ok: false, errorCode: "NETWORK_ERROR" });
  });

  test("not configured never calls fetch", async () => {
    delete process.env.ZEPTOMAIL_TOKEN;
    let called = false;
    stubFetch(async () => {
      called = true;
      return new Response("{}");
    });
    expect(emailConfigured()).toBe(false);
    expect(await sendEmail(msg)).toMatchObject({ ok: false, errorCode: "NOT_CONFIGURED" });
    expect(called).toBe(false);
  });

  test("emailConfigured needs both token and from address", () => {
    expect(emailConfigured()).toBe(true);
    delete process.env.EMAIL_FROM_ADDRESS;
    expect(emailConfigured()).toBe(false);
  });
});

describe("buildLoginCodeEmail", () => {
  test("includes the code, expiry and ignore notice in both parts", () => {
    const m = buildLoginCodeEmail("a@example.com", "123456");
    expect(m.to).toBe("a@example.com");
    expect(m.subject).toMatch(/^Your .+ login code$/);
    for (const part of [m.text, m.html]) {
      expect(part).toContain("123456");
      expect(part).toContain("5 minutes");
      expect(part.toLowerCase()).toContain("ignore");
    }
  });
  test("escapeHtml neutralises markup", () => {
    expect(escapeHtml(`<b onclick="x">&'`)).toBe("&lt;b onclick=&quot;x&quot;&gt;&amp;&#39;");
  });
});
