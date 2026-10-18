/**
 * Error aplikasi yang dipetakan otomatis ke respons JSON oleh
 * `handleApiError()`. Service/route handler melempar `ApiError` dengan kode
 * mesin yang stabil untuk dikonsumsi klien.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = "Permintaan tidak valid.", details?: unknown): ApiError {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Anda belum masuk."): ApiError {
    return new ApiError(401, "UNAUTHENTICATED", message);
  }

  static forbidden(message = "Anda tidak memiliki akses untuk aksi ini."): ApiError {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Data tidak ditemukan."): ApiError {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static conflict(
    message = "Data bertentangan dengan data yang ada.",
    details?: unknown,
  ): ApiError {
    return new ApiError(409, "CONFLICT", message, details);
  }

  static unprocessable(message = "Data tidak valid.", details?: unknown): ApiError {
    return new ApiError(422, "VALIDATION_ERROR", message, details);
  }
}
