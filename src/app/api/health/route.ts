import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startWatchdog } from "@/lib/services/watchdog";

export const runtime = "nodejs";

// Lightweight liveness probe + DB connectivity check. Also starts the in-app
// worker watchdog on the first hit so the platform is self-sufficient even
// if the external worker mini-service (port 3004) is not running.
export async function GET() {
  try {
    startWatchdog();
    const c = await db.user.count();
    return NextResponse.json({
      status: "ok",
      db: "ok",
      users: c,
      watchdog: "started",
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { status: "degraded", error: e instanceof Error ? e.message : "db error" },
      { status: 500 }
    );
  }
}
