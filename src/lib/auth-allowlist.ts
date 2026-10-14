// Allow-list for the Better Auth catch-all route (/api/auth/[...all]).
//
// Only session lookup, sign-out and the Google sign-in flow are reachable.
// Everything else Better Auth ships (email/password, reset-password, other
// social providers, ...) must stay a 404.

const AUTH_PREFIX = "/api/auth/";
const ALLOWED_SOCIAL_PROVIDER = "google";

interface AllowedRoute {
  readonly method: string;
  readonly path: string;
}

const ALLOWED_ROUTES: readonly AllowedRoute[] = [
  { method: "GET", path: "get-session" },
  { method: "POST", path: "sign-out" },
  { method: "POST", path: "sign-in/social" },
  { method: "GET", path: `callback/${ALLOWED_SOCIAL_PROVIDER}` },
];

// Returns the path under /api/auth/ (no trailing slashes), or null when the
// pathname is suspicious (traversal, encoded or backslash characters, empty
// segments) or outside the auth prefix.
function normalizeAuthPath(pathname: string): string | null {
  if (!pathname.startsWith(AUTH_PREFIX)) return null;
  if (pathname.includes("%") || pathname.includes("\\")) return null;
  const rest = pathname.slice(AUTH_PREFIX.length).replace(/\/+$/, "");
  if (!rest) return null;
  const segments = rest.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) return null;
  return rest;
}

export function isAllowedAuthRequest(method: string, pathname: string): boolean {
  const path = normalizeAuthPath(pathname);
  if (path === null) return false;
  const upper = method.toUpperCase();
  return ALLOWED_ROUTES.some((r) => r.method === upper && r.path === path);
}

export function isSocialSignInPath(pathname: string): boolean {
  return normalizeAuthPath(pathname) === "sign-in/social";
}

// The provider is carried in the JSON body of POST sign-in/social.
export function isAllowedSocialProvider(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  return (body as { provider?: unknown }).provider === ALLOWED_SOCIAL_PROVIDER;
}
