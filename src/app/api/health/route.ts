import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { db } from "@/lib/db";
import { assertEnvOnce } from "@/lib/env";
import { readHeartbeat } from "@/lib/services/job-runner";
import { evaluateJobStatus, type JobName } from "@/lib/services/job-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkerHealth = { state: string; ageSeconds: number | null };
const WORKERS: JobName[] = ["generate", "remind"];

// Never throws: an unreachable AppSettings table reports 'unknown'.
async function workerHealth(): Promise<Record<string, WorkerHealth>> {
  const now = new Date();
  const entries = await Promise.all(
    WORKERS.map(async (job): Promise<[string, WorkerHealth]> => {
      try {
        const s = evaluateJobStatus({ job, heartbeat: await readHeartbeat(job), now });
        return [job, { state: s.state, ageSeconds: s.ageSeconds }];
      } catch {
        return [job, { state: "unknown", ageSeconds: null }];
      }
    })
  );
  return Object.fromEntries(entries);
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function hasCronBearer(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  return Boolean(cronSecret) && header.startsWith("Bearer ") && safeEqual(header.slice(7), cronSecret as string);
}

// Liveness + readiness probe. Public output is only {status, db, ts}; the
// detailed report (integrations, worker states, missing env names) requires
// `Authorization: Bearer ${CRON_SECRET}`.
export async function GET(req: NextRequest) {
  const env = assertEnvOnce();
  let dbOk = false;
  let dbError: string | undefined;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.constructor.name : "error";
  }
  const workers = dbOk
    ? await workerHealth()
    : Object.fromEntries(WORKERS.map((j) => [j, { state: "unknown", ageSeconds: null }]));
  const workersBad = Object.values(workers).some((w) => w.state === "stale" || w.state === "failing");
  const status = dbOk ? (env.ok && !workersBad ? "ok" : "degraded") : "down";
  const base = { status, db: dbOk ? "ok" : "error", ts: new Date().toISOString() };
  const body = hasCronBearer(req)
    ? {
        ...base,
        ...(dbError ? { dbError } : {}),
        integrations: env.integrations,
        optionalIntegrations: env.optionalIntegrations,
        workers,
        missingEnv: env.problems.map((p) => p.name),
      }
    : base;
  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
