import { describe, expect, test } from "bun:test";
import { buildOtpComponents } from "@/lib/providers/whatsapp-otp";

const APP = "Shree Vishwayog Ayurved";

describe("buildOtpComponents", () => {
  test("defaults to the authentication template: code in body plus copy-code button", () => {
    expect(buildOtpComponents("123456", {}, APP)).toEqual([
      { type: "body", parameters: [{ type: "text", text: "123456" }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "123456" }] },
    ]);
  });

  test("custom body params substitute {code} and {app} and send no button", () => {
    const env = {
      META_WA_OTP_BODY_PARAMS: JSON.stringify(["signing in to", "membership", "{app}", "{code}", "{app}"]),
      META_WA_OTP_BUTTON: "none",
    };
    expect(buildOtpComponents("654321", env, APP)).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "signing in to" },
          { type: "text", text: "membership" },
          { type: "text", text: APP },
          { type: "text", text: "654321" },
          { type: "text", text: APP },
        ],
      },
    ]);
  });

  test("custom body params can still add the copy-code button", () => {
    const env = { META_WA_OTP_BODY_PARAMS: JSON.stringify(["{code}"]), META_WA_OTP_BUTTON: "copy" };
    expect(buildOtpComponents("111111", env, APP)).toHaveLength(2);
  });

  test("rejects params that never include the code", () => {
    const env = { META_WA_OTP_BODY_PARAMS: JSON.stringify(["a", "b"]) };
    expect(() => buildOtpComponents("123456", env, APP)).toThrow(/\{code\}/);
  });

  test("rejects malformed JSON and non-string entries", () => {
    expect(() => buildOtpComponents("1", { META_WA_OTP_BODY_PARAMS: "not json" }, APP)).toThrow(/META_WA_OTP_BODY_PARAMS/);
    expect(() => buildOtpComponents("1", { META_WA_OTP_BODY_PARAMS: "[1,2]" }, APP)).toThrow(/META_WA_OTP_BODY_PARAMS/);
    expect(() => buildOtpComponents("1", { META_WA_OTP_BODY_PARAMS: "[]" }, APP)).toThrow(/META_WA_OTP_BODY_PARAMS/);
  });

  test("rejects an unknown button mode", () => {
    expect(() => buildOtpComponents("1", { META_WA_OTP_BUTTON: "weird" }, APP)).toThrow(/META_WA_OTP_BUTTON/);
  });
});
