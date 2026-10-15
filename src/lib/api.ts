import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { isSameOriginRequest } from "@/lib/csrf";

export type ApiError = {
  error: string;
  code?: string;
  details?: unknown;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(error: string, status = 400, extra?: Partial<ApiError>) {
  return NextResponse.json(
    { error, ...extra } satisfies ApiError,
    { status }
  );
}

export function unauthorized() {
  return fail("Unauthorized", 401, { code: "UNAUTHORIZED" });
}

export function forbidden() {
  return fail("Forbidden", 403, { code: "FORBIDDEN" });
}

export function notFound(what = "Resource") {
  return fail(`${what} not found`, 404, { code: "NOT_FOUND" });
}

export function fromZodError(e: ZodError) {
  return fail("Validation failed", 422, {
    code: "VALIDATION",
    details: e.issues.map((i) => ({ path: i.path, message: i.message })),
  });
}

/**
 * Cross-site write guard. Route handlers rarely pass the request to run(), so
 * without it the method is inferred from the headers: browsers send Origin on
 * every cross-origin request and on all same-origin writes, but not on plain
 * same-origin GETs or navigations. Outside a request scope the check is skipped.
 */
async function crossSiteBlocked(req?: Request): Promise<boolean> {
  try {
    const h = req ? req.headers : await headers();
    const origin = h.get("origin");
    const method = req?.method ?? (origin ? "POST" : "GET");
    return !isSameOriginRequest({
      method,
      origin,
      secFetchSite: h.get("sec-fetch-site"),
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
  } catch {
    return false;
  }
}

export async function run<T>(
  fn: () => Promise<T>,
  req?: Request
): Promise<Response> {
  if (await crossSiteBlocked(req)) {
    return fail("Cross-site request blocked", 403, { code: "CSRF" });
  }
  try {
    const data = await fn();
    if (data instanceof Response) return data;
    return ok(data);
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : String(e);
    if (code === "UNAUTHORIZED") return unauthorized();
    if (code === "FORBIDDEN") return forbidden();
    if (e instanceof ZodError) return fromZodError(e);
    if (e instanceof Error && e.name === "PaymentsUnavailableError") {
      return fail("Payments are temporarily unavailable", 503, { code: "PAYMENTS_UNAVAILABLE" });
    }
    if (e instanceof Error && e.name === "SubscriptionError") {
      const err = e as Error & { code?: string; status?: number };
      return fail(err.message, err.status ?? 409, { code: err.code ?? "SUBSCRIPTION" });
    }
    // Detail stays server-side; never leak messages, stacks or schema names.
    console.error("[api] error", e);
    return fail("Internal server error", 500, { code: "INTERNAL" });
  }
}
