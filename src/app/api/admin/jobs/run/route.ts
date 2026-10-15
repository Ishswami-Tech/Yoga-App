import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";
import { audit } from "@/lib/services/audit";
import { executeJob } from "@/lib/services/job-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ job: z.enum(["generate", "remind"]) });

export async function POST(req: NextRequest) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const { job } = bodySchema.parse(await req.json().catch(() => ({})));
    await audit({
      actorUserId: admin.id,
      action: "JOB_RUN_MANUAL",
      entityType: "Job",
      entityId: job,
      metadata: { job },
    });
    const outcome = await executeJob(job);
    if (outcome.skipped) {
      return NextResponse.json({ ok: true, job, skipped: true, ms: 0 });
    }
    return NextResponse.json({ ok: true, job, ms: outcome.ms, result: outcome.payload });
  });
}
