import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertEnvOnce } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liveness + readiness probe. Reports DB connectivity and which integrations
// are configured (booleans / variable names only, never values).
export async function GET() {
  const env = assertEnvOnce();
  let dbOk = false;
  let dbError: string | undefined;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.constructor.name : "error";
  }
  const status = dbOk ? (env.ok ? "ok" : "degraded") : "down";
  return NextResponse.json(
    {
      status,
      db: dbOk ? "ok" : "error",
      ...(dbError ? { dbError } : {}),
      integrations: env.integrations,
      missingEnv: env.problems.map((p) => p.name),
      ts: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
