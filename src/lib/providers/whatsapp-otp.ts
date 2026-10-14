import { APP_NAME } from "@/lib/brand";

// Login-code message: the approved Meta template `verify_account` (category Authentication,
// English US). Verified against Meta's API: the body has five variables and there is one URL
// button ("Copy code", url ...code=otp{{1}}) that REQUIRES a parameter; omitting it makes Meta
// reject the send with error 132018.
//   "This OTP code is for {{1}} your {{2}} account and linking it to {{3}}.
//    OTP: {{4}}
//    Do not share it with anyone, even to {{5}}, or they'll be able to access your account."
// None of this is secret, so it is fixed here rather than configured through env vars.

export const OTP_TEMPLATE_NAME = "verify_account";
export const OTP_TEMPLATE_LANGUAGE = "en_US";

export type OtpComponent =
  | { type: "body"; parameters: { type: "text"; text: string }[] }
  | { type: "button"; sub_type: "url"; index: "0"; parameters: { type: "text"; text: string }[] };

export function buildOtpComponents(code: string, appName: string = APP_NAME): OtpComponent[] {
  const texts = ["signing in to", appName, "this device", code, appName];
  return [
    { type: "body", parameters: texts.map((text) => ({ type: "text" as const, text })) },
    // Copy-code button: the code is appended to the button URL (code=otp<code>).
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
  ];
}
