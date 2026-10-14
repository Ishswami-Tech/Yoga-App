import { APP_NAME } from "@/lib/brand";

// Builds the `components` array for the WhatsApp login-code template message.
//
// Default (nothing configured): the Meta AUTHENTICATION template shape, i.e. the code as body
// variable {{1}} plus the "Copy code" button.
//
// For a template with extra variables (for example `verify_account`), set:
//   META_WA_OTP_BODY_PARAMS  JSON array of strings, one per body variable, in order.
//                            "{code}" is replaced by the login code and "{app}" by the app name.
//   META_WA_OTP_BUTTON       "copy" (default when BODY_PARAMS is unset) or "none".

type Env = Record<string, string | undefined>;

export type OtpComponent =
  | { type: "body"; parameters: { type: "text"; text: string }[] }
  | { type: "button"; sub_type: "url"; index: "0"; parameters: { type: "text"; text: string }[] };

function parseBodyParams(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("META_WA_OTP_BODY_PARAMS must be a JSON array of strings");
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((p) => typeof p === "string")) {
    throw new Error("META_WA_OTP_BODY_PARAMS must be a non-empty JSON array of strings");
  }
  if (!parsed.some((p) => (p as string).includes("{code}"))) {
    throw new Error("META_WA_OTP_BODY_PARAMS must include {code} in at least one entry");
  }
  return parsed as string[];
}

export function buildOtpComponents(code: string, env: Env = process.env, appName: string = APP_NAME): OtpComponent[] {
  const rawParams = env.META_WA_OTP_BODY_PARAMS?.trim();
  const button = (env.META_WA_OTP_BUTTON?.trim().toLowerCase() || (rawParams ? "none" : "copy")) as string;
  if (button !== "copy" && button !== "none") {
    throw new Error('META_WA_OTP_BUTTON must be "copy" or "none"');
  }

  const bodyTexts = rawParams
    ? parseBodyParams(rawParams).map((p) => p.replaceAll("{code}", code).replaceAll("{app}", appName))
    : [code];

  const components: OtpComponent[] = [
    { type: "body", parameters: bodyTexts.map((text) => ({ type: "text" as const, text })) },
  ];
  if (button === "copy") {
    components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] });
  }
  return components;
}
