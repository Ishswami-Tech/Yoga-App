import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { requireRole } from "@/lib/auth";
import { run, fail } from "@/lib/api";
import { generateClasses } from "@/lib/services/class-generator";
import { sendReminders, retryFailedMessages } from "@/lib/services/reminders";
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
// optional self-host worker) or an ADMIN session. No query-string secrets.
async function authorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (cronSecret && header.startsWith("Bearer ") && safeEqual(header.slice(7), cronSecret)) {
    return true;
  }
  try {
    await requireRole("ADMIN");
    return true;
  } catch {
    return false;
  }
}

async function handle(req: NextRequest, bodyJob?: unknown) {
  return run(async () => {
    if (!(await authorized(req))) {
      return fail("Unauthorized", 401, { code: "UNAUTHORIZED" });
    }
    const url = new URL(req.url);
    const parsed = jobSchema.safeParse(bodyJob ?? url.searchParams.get("job") ?? "generate");
    if (!parsed.success) return fail("invalid job", 422);

    const started = Date.now();
    if (parsed.data === "generate") {
      const result = await generateClasses();
      return NextResponse.json({ ok: true, job: "generate", ms: Date.now() - started, result });
    }
    if (parsed.data === "remind") {
      // Reminder job also retries recently failed WhatsApp messages.
      const result = await sendReminders();
      // Failed sends are retried every 5th minute (bounded backoff, no spam).
      const retry = new Date().getUTCMinutes() % 5 === 0 ? await retryFailedMessages() : null;
      return NextResponse.json({ ok: true, job: "remind", ms: Date.now() - started, result, retry });
    }
    const result = await retryFailedMessages();
    return NextResponse.json({ ok: true, job: "retry", ms: Date.now() - started, result });
  });
}

// Vercel Cron sends GET.
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handle(req, (body as { job?: unknown })?.job);
}
