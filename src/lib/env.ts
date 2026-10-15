// Runtime environment validation (zod). Nothing here runs at import time, so
// `next build` never fails on missing variables. Call `validateEnv()` (the
// health route does) to learn what is missing; it never returns values.
import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

const requiredSchema = z.object({
  DATABASE_URL: nonEmpty,
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url().refine((v) => v.startsWith("https://"), "must be an https URL"),
  CRON_SECRET: nonEmpty,
  RAZORPAY_KEY_ID: nonEmpty,
  RAZORPAY_KEY_SECRET: nonEmpty,
  RAZORPAY_WEBHOOK_SECRET: nonEmpty,
  META_WA_ACCESS_TOKEN: nonEmpty,
  META_WA_PHONE_NUMBER_ID: nonEmpty,
  GOOGLE_CALENDAR_CLIENT_ID: nonEmpty,
  GOOGLE_CALENDAR_CLIENT_SECRET: nonEmpty,
  GOOGLE_CALENDAR_REFRESH_TOKEN: nonEmpty,
});

export const OPTIONAL_ENV = [
  "SUPER_ADMIN_EMAILS",
  "SUPPORT_PHONE",
  "NEXT_PUBLIC_SUPPORT_PHONE",
  "NEXT_PUBLIC_APP_NAME",
] as const;

/**
 * Integrations that are not required to boot. The health report says which are configured (by name
 * only, never values) so a missing one is visible without failing validation.
 */
export const OPTIONAL_INTEGRATION_VARS = [
  "META_APP_SECRET",
  "META_WA_VERIFY_TOKEN",
  "PAYMENT_BRIDGE_URL",
  "PAYMENT_BRIDGE_SECRET",
  "PAYMENT_BRIDGE_APP_ID",
  "ZEPTOMAIL_TOKEN",
  "EMAIL_FROM_ADDRESS",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

export type OptionalIntegrationVar = (typeof OPTIONAL_INTEGRATION_VARS)[number];

export function optionalIntegrationsReport(env: NodeJS.ProcessEnv = process.env): Record<OptionalIntegrationVar, boolean> {
  return Object.fromEntries(
    OPTIONAL_INTEGRATION_VARS.map((name) => [name, Boolean(env[name]?.trim())])
  ) as Record<OptionalIntegrationVar, boolean>;
}

export type EnvReport = {
  ok: boolean;
  /** Names of required variables that are missing or invalid (never values). */
  problems: { name: string; issue: string }[];
  integrations: {
    database: boolean;
    auth: boolean;
    appUrl: boolean;
    cron: boolean;
    razorpay: boolean;
    razorpayWebhook: boolean;
    whatsapp: boolean;
    googleCalendar: boolean;
  };
  /** Optional integrations: true when configured. Not part of `ok`. */
  optionalIntegrations: Record<OptionalIntegrationVar, boolean>;
};

export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const parsed = requiredSchema.safeParse(env);
  const problems = parsed.success
    ? []
    : parsed.error.issues.map((i) => ({
        name: String(i.path[0]),
        issue: env[String(i.path[0])] ? i.message : "missing",
      }));
  const bad = new Set(problems.map((p) => p.name));
  const has = (...names: string[]) => names.every((n) => !bad.has(n));
  return {
    ok: problems.length === 0,
    problems,
    integrations: {
      database: has("DATABASE_URL"),
      auth: has("AUTH_SECRET"),
      appUrl: has("NEXT_PUBLIC_APP_URL"),
      cron: has("CRON_SECRET"),
      razorpay: has("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"),
      razorpayWebhook: has("RAZORPAY_WEBHOOK_SECRET"),
      whatsapp: has("META_WA_ACCESS_TOKEN", "META_WA_PHONE_NUMBER_ID"),
      googleCalendar: has(
        "GOOGLE_CALENDAR_CLIENT_ID",
        "GOOGLE_CALENDAR_CLIENT_SECRET",
        "GOOGLE_CALENDAR_REFRESH_TOKEN"
      ),
    },
    optionalIntegrations: optionalIntegrationsReport(env),
  };
}

let logged = false;
/** Validates once on first server use in production and logs missing names. */
export function assertEnvOnce(): EnvReport {
  const report = validateEnv();
  if (!logged && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    logged = true;
    if (!report.ok) {
      console.error(
        "[env] invalid/missing environment variables:",
        report.problems.map((p) => `${p.name} (${p.issue})`).join(", ")
      );
    }
  }
  return report;
}
