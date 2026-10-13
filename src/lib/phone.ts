// Single canonical phone format for login and registration.
//
// Canonical digits = country code + national number, no "+" (E.164 digits).
// Stored on User.whatsappNumber as "+<digits>". Default country code comes from
// DEFAULT_COUNTRY_CODE (91).

export function defaultCountryCode(): string {
  const cc = (process.env.DEFAULT_COUNTRY_CODE ?? "91").replace(/\D/g, "");
  return cc || "91";
}

/** Returns E.164 digits (no "+") or null if the input is not a plausible number. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!/^[0-9+\-\s().]{7,24}$/.test(raw)) return null;
  const hasPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const cc = defaultCountryCode();
  if (!hasPlus) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = cc + digits.replace(/^0+/, "");
    else if (digits.length === 10) digits = cc + digits;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  if (digits.startsWith("0")) return null;
  // Indian mobile numbers: 91 + 10 digits starting 6-9.
  if (digits.startsWith("91") && digits.length === 12 && !/^[6-9]/.test(digits.slice(2))) return null;
  return digits;
}

/** Canonical stored form, e.g. "+919876543210". */
export function toCanonical(digits: string): string {
  return `+${digits}`;
}

/** Stored spellings that may exist for a canonical number (legacy rows included). */
export function phoneCandidates(digits: string): string[] {
  const out = new Set<string>([`+${digits}`, digits]);
  const cc = defaultCountryCode();
  if (digits.startsWith(cc) && digits.length === cc.length + 10) {
    out.add(digits.slice(cc.length));
  }
  return [...out];
}

/** Masked for logs / UI: +91******3210 */
export function maskPhone(digits: string): string {
  return `+${digits.slice(0, 2)}${"*".repeat(Math.max(0, digits.length - 6))}${digits.slice(-4)}`;
}
