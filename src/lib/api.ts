import { NextResponse } from "next/server";
import { ZodError } from "zod";

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

export async function run<T>(
  fn: () => Promise<T>
): Promise<Response> {
  try {
    const data = await fn();
    if (data instanceof Response) return data;
    return ok(data);
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : String(e);
    if (code === "UNAUTHORIZED") return unauthorized();
    if (code === "FORBIDDEN") return forbidden();
    if (e instanceof ZodError) return fromZodError(e);
    console.error("[api] error", e);
    return fail(
      e instanceof Error ? e.message : "Internal server error",
      500,
      { code: "INTERNAL" }
    );
  }
}
