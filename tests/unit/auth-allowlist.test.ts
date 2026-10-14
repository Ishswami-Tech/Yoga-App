import { describe, expect, test } from "bun:test";
import {
  isAllowedAuthRequest,
  isAllowedSocialProvider,
  isSocialSignInPath,
} from "../../src/lib/auth-allowlist";

const allowed: Array<[string, string]> = [
  ["GET", "/api/auth/get-session"],
  ["GET", "/api/auth/get-session/"],
  ["POST", "/api/auth/sign-out"],
  ["POST", "/api/auth/sign-in/social"],
  ["POST", "/api/auth/sign-in/social/"],
  ["GET", "/api/auth/callback/google"],
  ["GET", "/api/auth/callback/google//"],
  ["get", "/api/auth/callback/google"],
];

const blocked: Array<[string, string]> = [
  ["POST", "/api/auth/sign-up/email"],
  ["POST", "/api/auth/sign-in/email"],
  ["POST", "/api/auth/forget-password"],
  ["POST", "/api/auth/reset-password"],
  ["GET", "/api/auth/callback/github"],
  ["GET", "/api/auth/callback/"],
  ["GET", "/api/auth/callback"],
  ["GET", "/api/auth/callback/google/extra"],
  ["POST", "/api/auth/callback/google"],
  ["GET", "/api/auth/sign-in/social"],
  ["GET", "/api/auth/sign-out"],
  ["POST", "/api/auth/get-session"],
  ["DELETE", "/api/auth/sign-out"],
  ["GET", "/api/auth/GET-SESSION"],
  ["GET", "/api/auth/Callback/Google"],
  ["POST", "/api/auth/sign-in/Social"],
  ["POST", "/api/auth/sign-in/social/../sign-up/email"],
  ["POST", "/api/auth/sign-in/social/./"],
  ["POST", "/api/auth/sign-in/%2e%2e/sign-up/email"],
  ["POST", "/api/auth/sign-in%2Fsocial"],
  ["POST", "/api/auth/sign-in\social"],
  ["POST", "/api/auth//sign-in/social"],
  ["POST", "/api/auth/"],
  ["POST", "/api/auth"],
  ["GET", "/api/authx/get-session"],
  ["GET", "/other/get-session"],
  ["GET", "/api/auth/foo/get-session"],
];

describe("isAllowedAuthRequest", () => {
  test.each(allowed)("allows %s %s", (method, path) => {
    expect(isAllowedAuthRequest(method, path)).toBe(true);
  });
  test.each(blocked)("blocks %s %s", (method, path) => {
    expect(isAllowedAuthRequest(method, path)).toBe(false);
  });
});

describe("social sign-in helpers", () => {
  test("isSocialSignInPath", () => {
    expect(isSocialSignInPath("/api/auth/sign-in/social/")).toBe(true);
    expect(isSocialSignInPath("/api/auth/sign-in/email")).toBe(false);
  });
  test.each([
    [{ provider: "google" }, true],
    [{ provider: "github" }, false],
    [{ provider: "Google" }, false],
    [{}, false],
    [null, false],
    ["google", false],
    [{ provider: ["google"] }, false],
  ])("isAllowedSocialProvider(%p) = %p", (body, expected) => {
    expect(isAllowedSocialProvider(body)).toBe(expected);
  });
});
