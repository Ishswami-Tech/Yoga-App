import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Sign-in is WhatsApp OTP only. Expose just session lookup and sign-out from
// Better Auth; every other endpoint (sign-up, sign-in, reset-password, ...) is 404.
const handler = toNextJsHandler(auth);
const ALLOWED = new Set(["get-session", "sign-out"]);

function allowed(req: NextRequest): boolean {
  const last = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  return ALLOWED.has(last);
}
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function GET(req: NextRequest) {
  return allowed(req) ? handler.GET(req) : notFound();
}
export async function POST(req: NextRequest) {
  return allowed(req) ? handler.POST(req) : notFound();
}
