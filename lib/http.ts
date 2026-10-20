export type ApiResponse<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string>; code?: string };

/** Calls one of our API routes and always resolves to an ApiResponse. */
export async function requestJson<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  init?: { signal?: AbortSignal },
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: init?.signal,
    });
    return (await res.json()) as ApiResponse<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
}

/** POSTs JSON to one of our API routes and always resolves to an ApiResponse. */
export function postJson<T = Record<string, unknown>>(url: string, body?: unknown) {
  return requestJson<T>("POST", url, body);
}
