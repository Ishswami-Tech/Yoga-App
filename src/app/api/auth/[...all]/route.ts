import { auth } from "@/lib/better-auth";
import {
  isAllowedAuthRequest,
  isAllowedSocialProvider,
  isSocialSignInPath,
} from "@/lib/auth-allowlist";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Phone/email codes are our own routes. Expose only these Better Auth
// endpoints: get-session, sign-out, sign-in/social (Google only) and
// callback/google. Every other endpoint is 404 (see lib/auth-allowlist.ts).
const handler = toNextJsHandler(auth);

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

function allowed(req: NextRequest): boolean {
  return isAllowedAuthRequest(req.method, new URL(req.url).pathname);
}

async function socialProviderAllowed(req: NextRequest): Promise<boolean> {
  try {
    return isAllowedSocialProvider(await req.clone().json());
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  return allowed(req) ? handler.GET(req) : notFound();
}

export async function POST(req: NextRequest) {
  if (!allowed(req)) return notFound();
  if (isSocialSignInPath(new URL(req.url).pathname) && !(await socialProviderAllowed(req))) {
    return notFound();
  }
  return handler.POST(req);
}
