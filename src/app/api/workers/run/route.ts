import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { run, fail } from "@/lib/api";
import { generateClasses } from "@/lib/services/class-generator";
import { sendReminders, retryFailedMessages } from "@/lib/services/reminders";
import { z } from "zod";

export const runtime = "nodejs";

const jobSchema = z.object({
  job: z.enum(["generate", "remind", "retry"]),
  secret: z.string().optional(),
});

// Authenticated worker endpoint used by the external cron mini-service.
// Requires either an admin session OR the CRON_SECRET query param.
export async function POST(req: NextRequest) {
  return run(async () => {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;
    let authorized = false;
    if (cronSecret && secret === cronSecret) {
      authorized = true;
    } else {
      try {
        await requireRole(["ADMIN", "INSTRUCTOR"]);
        authorized = true;
      } catch {
        authorized = false;
      }
    }
    if (!authorized) {
      return fail("Unauthorized", 401, { code: "UNAUTHORIZED" });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = jobSchema.safeParse({
      job: body.job ?? url.searchParams.get("job") ?? "generate",
    });
    if (!parsed.success) return fail("invalid job", 422);

    if (parsed.data.job === "generate") {
      const result = await generateClasses();
      return NextResponse.json({ ok: true, job: "generate", result });
    }
    if (parsed.data.job === "remind") {
      const result = await sendReminders();
      return NextResponse.json({ ok: true, job: "remind", result });
    }
    const result = await retryFailedMessages();
    return NextResponse.json({ ok: true, job: "retry", result });
  });
}
