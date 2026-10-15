// CSRF defence for cookie-authenticated mutations: SameSite=Lax alone is not
// enough (same-site sibling origins, older browsers). Browsers always send
// Origin and/or Sec-Fetch-Site on cross-origin writes; non-browser clients
// (curl, server-to-server) send neither and cannot be driven cross-site.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export type CsrfInput = {
  method: string;
  origin?: string | null;
  secFetchSite?: string | null;
  appUrl?: string | null;
};

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const o = new URL(value).origin;
    return o === "null" ? null : o;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(input: CsrfInput): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;

  const site = input.secFetchSite?.toLowerCase();
  if (site === "cross-site") return false;

  if (input.origin === undefined || input.origin === null || input.origin === "") {
    return true; // non-browser client (or same-origin browser without Origin)
  }

  const origin = originOf(input.origin);
  if (!origin) return false; // "null" or malformed
  const allowed = new Set<string>();
  const app = originOf(input.appUrl);
  if (app) allowed.add(app);
  if (process.env.NODE_ENV !== "production") DEV_ORIGINS.forEach((o) => allowed.add(o));
  return allowed.has(origin);
}
