import { describe, expect, test } from "bun:test";
import { OTP_TEMPLATE_LANGUAGE, OTP_TEMPLATE_NAME, buildOtpComponents } from "@/lib/providers/whatsapp-otp";

const APP = "Shree Vishwayog Ayurved";

describe("verify_account OTP message", () => {
  test("uses the approved template name and language", () => {
    expect(OTP_TEMPLATE_NAME).toBe("verify_account");
    expect(OTP_TEMPLATE_LANGUAGE).toBe("en_US");
  });

  test("sends five body variables with the code as the fourth and no button", () => {
    const components = buildOtpComponents("123456", APP);
    expect(components).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "signing in to" },
          { type: "text", text: APP },
          { type: "text", text: "this device" },
          { type: "text", text: "123456" },
          { type: "text", text: APP },
        ],
      },
    ]);
  });
});
