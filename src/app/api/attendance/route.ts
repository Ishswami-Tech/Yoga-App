import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAttendanceSummary } from "@/lib/services/attendance";
import { run } from "@/lib/api";

export const runtime = "nodejs";

// Current student's attendance summary (streaks + totals + recent).
export async function GET() {
  return run(async () => {
    const user = await requireAuth();
    const summary = await getAttendanceSummary(user.id);
    return NextResponse.json(summary);
  });
}
