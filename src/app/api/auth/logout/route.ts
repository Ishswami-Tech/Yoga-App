import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  destroySession,
  getUserIdForToken,
  revokeAllSessions,
} from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

/** True when the optional JSON body is exactly `{ all: true }`-style (all === true). */
async function wantsAll(req: NextRequest): Promise<boolean> {
  try {
    const body: unknown = await req.json();
    return (
      typeof body === "object" &&
      body !== null &&
      (body as { all?: unknown }).all === true
    );
  } catch {
    return false; // no / invalid body: plain single-session logout
  }
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const all = await wantsAll(req);
    let revoked = 0;
    if (token) {
      if (all) {
        // Resolve the owner before the presented session is deleted.
        const userId = await getUserIdForToken(token);
        if (userId) revoked = await revokeAllSessions(userId);
      }
      await destroySession(token);
    }
    const res = NextResponse.json({ ok: true, ...(all ? { revoked } : {}) });
    res.cookies.set(clearSessionCookie());
    return res;
  });
}
