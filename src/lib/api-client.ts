// Thin fetch wrapper used across the client. Throws on non-2xx so react-query
// and direct callers can branch on errors.

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api<T = any>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...init,
  });
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    throw new ApiError(
      data?.error ?? res.statusText ?? "Request failed",
      res.status,
      data?.code,
      data?.details
    );
  }
  return data as T;
}

export const apiGet = <T = any>(input: string) => api<T>(input);
export const apiPost = <T = any>(input: string, body?: unknown) =>
  api<T>(input, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
export const apiPatch = <T = any>(input: string, body?: unknown) =>
  api<T>(input, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
export const apiDelete = <T = any>(input: string) =>
  api<T>(input, { method: "DELETE" });
