import { describe, expect, test, afterEach } from "bun:test";
import { isSameOriginRequest } from "@/lib/csrf";

const APP = "https://yoga.example.com";
const env = process.env as Record<string, string | undefined>;
const orig = env.NODE_ENV;
afterEach(() => {
  env.NODE_ENV = orig;
});

type Case = [string, Parameters<typeof isSameOriginRequest>[0], boolean];
const cases: Case[] = [
  ["GET always ok", { method: "GET", origin: "https://evil.com", secFetchSite: "cross-site", appUrl: APP }, true],
  ["HEAD ok", { method: "HEAD", origin: "https://evil.com", appUrl: APP }, true],
  ["OPTIONS ok", { method: "options", origin: "https://evil.com", appUrl: APP }, true],
  ["same origin", { method: "POST", origin: APP, secFetchSite: "same-origin", appUrl: APP }, true],
  ["same origin, app url with path", { method: "POST", origin: APP, appUrl: `${APP}/app/` }, true],
  ["other origin", { method: "POST", origin: "https://evil.com", appUrl: APP }, false],
  ["subdomain rejected", { method: "POST", origin: "https://a.yoga.example.com", appUrl: APP }, false],
  ["suffix lookalike rejected", { method: "POST", origin: "https://yoga.example.com.evil.com", appUrl: APP }, false],
  ["null origin rejected", { method: "POST", origin: "null", appUrl: APP }, false],
  ["garbage origin rejected", { method: "POST", origin: "not a url", appUrl: APP }, false],
  ["port mismatch", { method: "POST", origin: "https://yoga.example.com:8443", appUrl: APP }, false],
  ["scheme mismatch", { method: "POST", origin: "http://yoga.example.com", appUrl: APP }, false],
  ["cross-site fetch metadata", { method: "POST", secFetchSite: "cross-site", appUrl: APP }, false],
  ["cross-site beats matching origin", { method: "DELETE", origin: APP, secFetchSite: "cross-site", appUrl: APP }, false],
  ["same-site fetch metadata ok", { method: "PATCH", secFetchSite: "same-site", appUrl: APP }, true],
  ["none fetch metadata ok", { method: "POST", secFetchSite: "none", appUrl: APP }, true],
  ["missing headers allowed", { method: "POST", appUrl: APP }, true],
  ["PUT other origin", { method: "PUT", origin: "https://evil.com", appUrl: APP }, false],
];

describe("isSameOriginRequest", () => {
  for (const [name, input, expected] of cases) {
    test(name, () => {
      env.NODE_ENV = "production";
      expect(isSameOriginRequest(input)).toBe(expected);
    });
  }

  test("localhost allowed outside production", () => {
    env.NODE_ENV = "development";
    expect(isSameOriginRequest({ method: "POST", origin: "http://localhost:3000", appUrl: APP })).toBe(true);
    expect(isSameOriginRequest({ method: "POST", origin: "http://127.0.0.1:3000", appUrl: APP })).toBe(true);
    expect(isSameOriginRequest({ method: "POST", origin: "http://localhost:4000", appUrl: APP })).toBe(false);
  });

  test("localhost rejected in production", () => {
    env.NODE_ENV = "production";
    expect(isSameOriginRequest({ method: "POST", origin: "http://localhost:3000", appUrl: APP })).toBe(false);
  });

  test("missing appUrl with an Origin present is rejected", () => {
    env.NODE_ENV = "production";
    expect(isSameOriginRequest({ method: "POST", origin: "https://x.com", appUrl: undefined })).toBe(false);
  });
});
