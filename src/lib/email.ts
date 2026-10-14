// Email handling for sign-up. Accounts are identified by WhatsApp number; the email is contact
// information. Phone-only accounts carry a reserved placeholder address (never a real mailbox).

export const PLACEHOLDER_EMAIL_DOMAIN = "phone.vishwayog.invalid";

const EMAIL_RE = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,}$/;

export function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

/** Returns the trimmed, lowercased address, or null if it is not a plausible real email. */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const email = input.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  if (!EMAIL_RE.test(email) || email.includes("..")) return null;
  if (isPlaceholderEmail(email)) return null;
  return email;
}

export type EmailSignInUser = { status: string; emailVerified: boolean };
export type EmailSignInDecision = "ok" | "disabled" | "unverified_claim";

/**
 * May an emailed code sign into an existing account with this address?
 * An address typed into a profile but never verified is only a claim: whoever receives a code for
 * it must NOT be signed into that account (otherwise typing someone else's address would hand them
 * the account). Such accounts are entered with their WhatsApp number instead.
 */
export function emailSignInDecision(user: EmailSignInUser): EmailSignInDecision {
  if (user.status !== "ACTIVE") return "disabled";
  if (!user.emailVerified) return "unverified_claim";
  return "ok";
}
