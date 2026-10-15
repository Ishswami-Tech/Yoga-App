import { describe, expect, test } from "bun:test";
import { OPTIONAL_INTEGRATION_VARS, validateEnv } from "../../src/lib/env";

describe("optionalIntegrations", () => {
  test("reports every optional var as false when unset, without affecting ok/problems", () => {
    const r = validateEnv({} as NodeJS.ProcessEnv);
    expect(Object.keys(r.optionalIntegrations).sort()).toEqual([...OPTIONAL_INTEGRATION_VARS].sort());
    expect(Object.values(r.optionalIntegrations).every((v) => v === false)).toBe(true);
    expect(r.problems.some((p) => OPTIONAL_INTEGRATION_VARS.includes(p.name as never))).toBe(false);
  });
  test("reports configured vars as booleans only (never values)", () => {
    const r = validateEnv({ ZEPTOMAIL_TOKEN: "secret-value", GOOGLE_CLIENT_ID: "  " } as unknown as NodeJS.ProcessEnv);
    expect(r.optionalIntegrations.ZEPTOMAIL_TOKEN).toBe(true);
    expect(r.optionalIntegrations.GOOGLE_CLIENT_ID).toBe(false);
    expect(JSON.stringify(r)).not.toContain("secret-value");
  });
});
