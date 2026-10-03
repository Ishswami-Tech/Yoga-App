// Better Auth client SDK — used by React components for auth.
// Provides typed methods: signIn.email, signUp.email, signOut, useSession.
// All requests go to /api/auth/[...all] (the Better Auth catch-all route).

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

// Re-export convenience hooks/methods
export const { signIn, signOut, signUp, useSession } = authClient;
