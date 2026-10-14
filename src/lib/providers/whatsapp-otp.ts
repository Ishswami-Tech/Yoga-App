// Login-code message: the approved Meta template `verify_account` (category Authentication,
// English US). Verified against Meta's API:
//   body: "This OTP code is for {{1}} your {{2}} account and linking it to {{3}}.
//          OTP: {{4}}
//          Do not share it with anyone, even to {{5}}, or they'll be able to access your account."
//   button: URL "Copy code" (code=otp{{1}}) which REQUIRES a parameter.
// Meta limits every variable of an authentication template to 15 characters, so the brand name
// used here is a short form ("Vishwayog Ayur", 14); the full app name is 23 characters and is rejected with 132018.
// None of this is secret, so it is fixed here rather than configured through env vars.

export const OTP_TEMPLATE_NAME = "verify_account";
export const OTP_TEMPLATE_LANGUAGE = "en_US";
export const OTP_BRAND_NAME = "Vishwayog Ayur"; // 14 chars; Meta allows at most 15 per variable and the full name is 23
export const OTP_PARAM_MAX_LENGTH = 15;

export type OtpComponent =
  | { type: "body"; parameters: { type: "text"; text: string }[] }
  | { type: "button"; sub_type: "url"; index: "0"; parameters: [{ type: "text"; text: string }] };

export function buildOtpComponents(code: string): OtpComponent[] {
  const texts = ["signing in to", OTP_BRAND_NAME, "this device", code, OTP_BRAND_NAME];
  return [
    { type: "body", parameters: texts.map((text) => ({ type: "text" as const, text })) },
    // Copy-code button: the code is appended to the button URL (code=otp<code>).
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
  ];
}
