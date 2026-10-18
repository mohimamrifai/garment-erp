/**
 * Helper fetch untuk Client Components.
 * Semua endpoint `/api/v1` memakai format `{ data, meta? }` / `{ error }`.
 */

export class ApiRequestError extends Error {
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.details = details;
  }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
  } | null;

  if (!response.ok) {
    throw new ApiRequestError(
      body?.error?.message ?? "Terjadi kesalahan. Coba lagi.",
      body?.error?.code,
      body?.error?.details,
    );
  }

  return body?.data as T;
}
