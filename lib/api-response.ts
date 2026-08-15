/**
 * §14.3 — Unified API response shape.
 *
 * Success:  { success: true,  data,  meta? }
 * Error:    { success: false, error: { code, message, details? } }
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYMENT_REQUIRED"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  [key: string]: unknown;
}

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: ApiMeta;
};

export type ApiFailure = {
  success: false;
  error: ApiError;
};

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiFailure;

/* -- Builders ------------------------------------------------ */

export function ok<T>(data: T, meta?: ApiMeta): ApiSuccess<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

export function fail(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ApiFailure {
  return {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  };
}

/* -- HTTP-status mapping ------------------------------------- */

export function statusFor(code: ErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "VALIDATION_ERROR":
      return 422;
    case "RATE_LIMITED":
      return 429;
    case "PAYMENT_REQUIRED":
      return 402;
    case "PROVIDER_ERROR":
      return 502;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}

/* -- Typed application errors (throwable in server actions) -- */

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly httpStatus: number;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.httpStatus = statusFor(code);
  }

  static unauthenticated(message = "Authentication required"): AppError {
    return new AppError("UNAUTHENTICATED", message);
  }
  static unauthorized(message = "You are not authorized to do this"): AppError {
    return new AppError("UNAUTHORIZED", message);
  }
  static forbidden(message = "Access denied"): AppError {
    return new AppError("FORBIDDEN", message);
  }
  static notFound(
    message = "Resource not found",
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError("NOT_FOUND", message, details);
  }
  static validation(
    message = "Invalid input",
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError("VALIDATION_ERROR", message, details);
  }
  static conflict(
    message = "Conflict",
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError("CONFLICT", message, details);
  }
  static rateLimited(message = "Too many attempts"): AppError {
    return new AppError("RATE_LIMITED", message);
  }
  static paymentRequired(message = "Payment required"): AppError {
    return new AppError("PAYMENT_REQUIRED", message);
  }
  static provider(
    message = "Provider error",
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError("PROVIDER_ERROR", message, details);
  }
  static internal(
    message = "Internal server error",
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError("INTERNAL_ERROR", message, details);
  }
}

/** Convert any thrown value into a typed ApiFailure (for route handlers). */
export function toApiFailure(err: unknown): ApiFailure {
  if (err instanceof AppError) {
    return fail(err.code, err.message, err.details);
  }
  if (err instanceof Error) {
    return fail("INTERNAL_ERROR", err.message);
  }
  return fail("INTERNAL_ERROR", "Unknown error");
}

/** Wrap a route handler to standardize responses + error handling. */
export function apiHandler<T>(
  handler: () => Promise<ApiResponse<T>>,
): Promise<Response> {
  return handler()
    .then((res) => {
      const status = res.success ? 200 : statusFor(res.error.code);
      return Response.json(res, { status });
    })
    .catch((err) => {
      const failure = toApiFailure(err);
      return Response.json(failure, { status: statusFor(failure.error.code) });
    });
}
