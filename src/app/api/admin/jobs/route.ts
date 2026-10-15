import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";
import { readHeartbeat } from "@/lib/services/job-runner";
import { evaluateJobStatus, type JobName } from "@/lib/services/job-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LISTED: JobName[] = ["generate", "remind"];

export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");
    const now = new Date();
    const items = await Promise.all(
      LISTED.map(async (job) => evaluateJobStatus({ job, heartbeat: await readHeartbeat(job), now }))
    );
    return NextResponse.json({ items, now: now.toISOString() });
  });
}
