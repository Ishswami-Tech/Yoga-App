import { NextResponse } from "next/server";
import { emailConfigured } from "@/lib/providers/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const has = (...names: string[]) => names.every((n) => !!process.env[n]?.trim());

// GET /api/auth/methods
//
// Which sign-in methods are configured on this deployment, so the UI only shows working options.
// Booleans only: no secrets or config values are ever returned.
export async function GET() {
  const body = {
    phone: has("META_WA_ACCESS_TOKEN", "META_WA_PHONE_NUMBER_ID"),
    email: emailConfigured(),
    google: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
