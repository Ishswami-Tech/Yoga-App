import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";
import { generateClasses } from "@/lib/services/class-generator";
import { sendReminders, retryFailedMessages } from "@/lib/services/reminders";
import { audit } from "@/lib/services/audit";

export const runtime = "nodejs";

// Manual safe trigger for the worker jobs. Admins can force-run class
// generation, reminder dispatch, or retry-failed-messages from the UI.
export async function POST(req: NextRequest) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const url = new URL(req.url);
    const job = url.searchParams.get("job") ?? "generate";
    let result: unknown;
    if (job === "generate") {
      result = await generateClasses();
    } else if (job === "remind") {
      result = await sendReminders();
    } else if (job === "retry") {
      result = await retryFailedMessages();
    } else {
      return NextResponse.json(
        { error: "unknown job", code: "BAD_JOB" },
        { status: 400 }
      );
    }
    await audit({
      actorUserId: admin.id,
      action: "WORKER_RUN",
      entityType: "Worker",
      entityId: job,
      metadata: { job },
    });
    return NextResponse.json({ ok: true, job, result });
  });
}
