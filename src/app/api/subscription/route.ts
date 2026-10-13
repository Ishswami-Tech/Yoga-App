import { NextRequest } from "next/server";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { getMembershipState, summarizeMembership } from "@/lib/services/subscriptions";
import { run, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

// Current user's subscription/membership summary.
export async function GET(_req: NextRequest) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const membership = await getMembershipState(user.id);
    return {
      state: membership.state,
      subscription: summarizeMembership(membership),
    };
  });
}

export async function _unused() {
  // ensures requireAuth import is referenced if tree-shake complains
  void requireAuth;
}
