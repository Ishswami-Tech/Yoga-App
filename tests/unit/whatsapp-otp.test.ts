import { describe, expect, test } from "bun:test";
import {
  OTP_BRAND_NAME,
  OTP_PARAM_MAX_LENGTH,
  OTP_TEMPLATE_LANGUAGE,
  OTP_TEMPLATE_NAME,
  buildOtpComponents,
} from "@/lib/providers/whatsapp-otp";

describe("verify_account OTP message", () => {
  test("uses the approved template name and language", () => {
    expect(OTP_TEMPLATE_NAME).toBe("verify_account");
    expect(OTP_TEMPLATE_LANGUAGE).toBe("en_US");
  });

  test("sends five body variables (code is the fourth) plus the required copy-code button", () => {
    expect(buildOtpComponents("123456")).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "signing in to" },
          { type: "text", text: OTP_BRAND_NAME },
          { type: "text", text: "this device" },
          { type: "text", text: "123456" },
          { type: "text", text: OTP_BRAND_NAME },
        ],
      },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "123456" }] },
    ]);
  });

  test("every variable fits Meta's 15 character limit for authentication templates", () => {
    for (const component of buildOtpComponents("999999")) {
      for (const p of component.parameters) {
        expect(p.text.length).toBeLessThanOrEqual(OTP_PARAM_MAX_LENGTH);
      }
    }
  });
});
