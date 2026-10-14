import { afterEach, describe, expect, test } from "bun:test";
import { clientIp, parseClientIp } from "@/lib/rate-limit";

const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });

describe("parseClientIp", () => {
  test("hops=1 takes the last entry, ignoring spoofed leading values", () => {
    expect(parseClientIp("1.1.1.1, 2.2.2.2, 203.0.113.9", null, 1)).toBe("203.0.113.9");
  });
  test("hops=2 skips the last (cloudflare) entry", () => {
    expect(parseClientIp("6.6.6.6, 203.0.113.9, 172.70.1.1", null, 2)).toBe("203.0.113.9");
  });
  test("list shorter than hops uses the first entry", () => {
    expect(parseClientIp("203.0.113.9", null, 3)).toBe("203.0.113.9");
    expect(parseClientIp("203.0.113.9, 10.0.0.1", null, 5)).toBe("203.0.113.9");
  });
  test("trims whitespace and drops empty entries", () => {
    expect(parseClientIp(" 1.1.1.1 ,, 203.0.113.9 , ", null, 1)).toBe("203.0.113.9");
  });
  test("falls back to x-real-ip when XFF is missing or empty", () => {
    expect(parseClientIp(null, "198.51.100.4", 1)).toBe("198.51.100.4");
    expect(parseClientIp(" , ", "198.51.100.4", 1)).toBe("198.51.100.4");
  });
  test("returns null when nothing is present", () => {
    expect(parseClientIp(null, null, 1)).toBeNull();
  });
  test("garbage values yield null", () => {
    expect(parseClientIp("1.1.1.1, <script>", null, 1)).toBeNull();
    expect(parseClientIp("not-an-ip", null, 1)).toBeNull();
    expect(parseClientIp(null, "999.1.1.1", 1)).toBeNull();
  });
  test("supports IPv6", () => {
    expect(parseClientIp("9.9.9.9, 2001:db8::1", null, 1)).toBe("2001:db8::1");
  });
  test("invalid hops falls back to 1", () => {
    expect(parseClientIp("1.1.1.1, 203.0.113.9", null, 0)).toBe("203.0.113.9");
    expect(parseClientIp("1.1.1.1, 203.0.113.9", null, Number.NaN)).toBe("203.0.113.9");
  });
});

describe("clientIp env handling", () => {
  const prev = process.env.TRUSTED_PROXY_HOPS;
  afterEach(() => {
    if (prev === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = prev;
  });
  test("defaults to 1 hop", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    expect(clientIp(req({ "x-forwarded-for": "5.5.5.5, 203.0.113.9" }))).toBe("203.0.113.9");
  });
  test("reads TRUSTED_PROXY_HOPS", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(clientIp(req({ "x-forwarded-for": "5.5.5.5, 203.0.113.9, 172.70.1.1" }))).toBe("203.0.113.9");
  });
  test("non-numeric env falls back to 1", () => {
    process.env.TRUSTED_PROXY_HOPS = "abc";
    expect(clientIp(req({ "x-forwarded-for": "5.5.5.5, 203.0.113.9" }))).toBe("203.0.113.9");
  });
});
