import type { FetchLike } from "../types";

const REQUEST_TIMEOUT_MS = 15_000;

/** JSON request helper shared by the gateway adapters. Throws with the gateway name on non-2xx. */
export async function requestJson<T>(
  gateway: string,
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal, cache: "no-store" });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const detail = typeof data === "string" ? data : JSON.stringify(data);
      throw new Error(`${gateway} request failed (HTTP ${response.status}): ${detail.slice(0, 300)}`);
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}
