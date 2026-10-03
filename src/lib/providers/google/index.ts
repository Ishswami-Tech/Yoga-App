// Google OAuth adapter (mock).
//
// In production this would use the Google Sign-In SDK with a real
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. The flow is:
//   1. Frontend renders the "Sign in with Google" button.
//   2. User clicks → Google popup → user consents → Google returns a JWT.
//   3. Frontend sends the JWT to our backend.
//   4. Backend verifies the JWT with Google's public keys.
//   5. Backend extracts email + name from the verified JWT.
//   6. If the email matches an existing user → create a session.
//     If not → auto-create a new STUDENT account (Google sign-up).
//
// In this sandbox we mock step 2-5: the frontend sends a fake Google
// "credential" (just the email + name), and the backend "verifies" it by
// trusting the payload (since there's no real Google secret). The rest of
// the flow (session creation, auto-registration) is real.

export type GoogleProfile = {
  email: string;
  name: string;
  // picture?: string; // avatar URL (mock)
  // sub?: string;     // Google subject ID
};

// "Verify" a Google credential. In production this would call
// google.oauth2.tokeninfo or verify the JWT signature. Here we just
// parse the JSON payload the frontend sends.
export function verifyGoogleCredential(credential: string): GoogleProfile | null {
  try {
    // The mock credential is a base64-encoded JSON string (like a real
    // Google JWT but without the signature). Decode and parse.
    const decoded = Buffer.from(credential, "base64").toString("utf-8");
    const payload = JSON.parse(decoded);

    if (!payload.email || !payload.name) return null;

    return {
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

// Build a mock Google "credential" for the dev "one-click login" button.
// In production, the Google Sign-In SDK would return a real JWT.
export function buildMockCredential(email: string, name: string): string {
  const payload = JSON.stringify({ email, name, iss: "prana-mock", aud: "prana-yoga" });
  return Buffer.from(payload).toString("base64");
}
