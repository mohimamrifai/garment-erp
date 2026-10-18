import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "./errors";

export type ApiMeta = Record<string, unknown>;

/**
 * Format respons API (konvensi proyek):
 * - sukses: `{ data, meta? }`
 * - error:  `{ error: { code, message, details? } }`
 */
export function apiSuccess<T>(data: T, init?: { status?: number; meta?: ApiMeta }): NextResponse {
  const body = init?.meta ? { data, meta: init.meta } : { data };
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

/** Rincian error validasi Zod yang ramah untuk form: `{ fields: [{ path, message }] }`. */
export function zodFieldDetails(error: ZodError): { fields: { path: string; message: string }[] } {
  return {
    fields: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw ApiError.badRequest("Body permintaan harus berupa JSON yang valid.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw ApiError.unprocessable("Data tidak valid.", zodFieldDetails(parsed.error));
  }
  return parsed.data;
}

export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw ApiError.badRequest("Parameter query tidak valid.", zodFieldDetails(parsed.error));
  }
  return parsed.data;
}

/** Tangkap error apa pun dan ubah menjadi respons JSON sesuai konvensi. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }

  // Error dari Better Auth (better-call APIError): punya `status` + `body`.
  if (
    typeof error === "object" &&
    error !== null &&
    "body" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    const apiLike = error as { status: number; body?: { message?: string; code?: string } };
    const status = apiLike.status >= 400 && apiLike.status <= 599 ? apiLike.status : 500;
    return NextResponse.json(
      {
        error: {
          code: apiLike.body?.code ?? "AUTH_ERROR",
          message: apiLike.body?.message ?? "Operasi gagal diproses.",
        },
      },
      { status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data tidak valid.",
          details: zodFieldDetails(error),
        },
      },
      { status: 422 },
    );
  }

  console.error("[api] error tak tertangani:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server." } },
    { status: 500 },
  );
}
