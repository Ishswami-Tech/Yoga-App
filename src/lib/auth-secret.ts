// AUTH_SECRET accessor. OTP hashing refuses to run without a real secret.
export function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set (at least 16 characters)");
  }
  return secret;
}
