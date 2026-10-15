// Shared constants for the email sign-in code (kept dependency-free).
export const EMAIL_OTP_TTL_MS = 5 * 60 * 1000;
export const EMAIL_OTP_TTL_MINUTES = EMAIL_OTP_TTL_MS / 60000;

export type ProfileEmailDecision =
  | { kind: "keep" }
  | { kind: "require_verification" }
  | { kind: "claim_required" }
  | { kind: "claim"; email: string };

/**
 * What /api/profile/complete does about the email. When delivery is configured an address must
 * have been proven with a code (the verify step stores it as emailVerified), so a typed address is
 * never accepted. Without delivery the old unverified claim is kept so the app still works.
 */
export function decideProfileEmail(i: {
  currentEmail: string;
  isPlaceholder: boolean;
  emailVerified: boolean;
  claimedEmail: string | undefined;
  deliveryConfigured: boolean;
}): ProfileEmailDecision {
  if (i.deliveryConfigured) {
    return !i.isPlaceholder && i.emailVerified ? { kind: "keep" } : { kind: "require_verification" };
  }
  if (!i.isPlaceholder) return { kind: "keep" };
  if (!i.claimedEmail) return { kind: "claim_required" };
  return { kind: "claim", email: i.claimedEmail };
}

/** Whether the profile dialog must run the email verify step. */
export function needsEmailVerification(u: {
  emailIsPlaceholder?: boolean;
  emailVerified?: boolean;
}, emailMethodEnabled: boolean): boolean {
  return emailMethodEnabled && (u.emailIsPlaceholder === true || u.emailVerified === false);
}
