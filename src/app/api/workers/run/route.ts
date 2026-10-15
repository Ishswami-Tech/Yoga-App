import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { requireRole } from "@/lib/auth";
import { run, fail } from "@/lib/api";
import { executeJob } from "@/lib/services/job-runner";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel function limit for the worker. Jobs are time-bounded below this.
export const maxDuration = 60;

const jobSchema = z.enum(["generate", "remind", "retry"]);

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Authorised via `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron and the
// optional self-host worker). POST also accepts an ADMIN session; GET never
// does, because a GET can be triggered by a cross-site navigation.
// No query-string secrets.
async function authorized(req: NextRequest, allowSession: boolean): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (cronSecret && header.startsWith("Bearer ") && safeEqual(header.slice(7), cronSecret)) {
    return true;
  }
  if (!allowSession) return false;
  try {
    await requireRole("ADMIN");
    return true;
  } catch {
    return false;
  }
}

async function handle(req: NextRequest, allowSession: boolean, bodyJob?: unknown) {
  return run(async () => {
    if (!(await authorized(req, allowSession))) {
      return fail("Unauthorized", 401, { code: "UNAUTHORIZED" });
    }
    const url = new URL(req.url);
    const parsed = jobSchema.safeParse(bodyJob ?? url.searchParams.get("job") ?? "generate");
    if (!parsed.success) return fail("invalid job", 422);

    const job = parsed.data;
    const outcome = await executeJob(job);
    if (outcome.skipped) {
      return NextResponse.json({ ok: true, job, skipped: true, reason: outcome.reason });
    }
    return NextResponse.json({ ok: true, job, ms: outcome.ms, ...outcome.payload });
  }, req);
}

// Vercel Cron sends GET.
export async function GET(req: NextRequest) {
  return handle(req, false);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handle(req, true, (body as { job?: unknown })?.job);
}
