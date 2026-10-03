import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, destroySession } from "@/lib/auth";
import { run } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return run(async () => {
    const token = req.cookies.get("yoga_session")?.value;
    if (token) await destroySession(token);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(clearSessionCookie());
    return res;
  });
}
