export type ErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "COMPLIANCE_BLOCKED"
  | "APPROVAL_REQUIRED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_NOT_CONFIGURED"
  | "INVALID_SIGNATURE"
  | "CALCULATION_ERROR"
  | "INTERNAL";

/** Base error for all domain failures. `retryable` drives workflow retry policy. */
export class NorthstarError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "NorthstarError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export const isNorthstarError = (e: unknown): e is NorthstarError => e instanceof NorthstarError;

/** True if an error should be retried by the workflow engine. Unknown errors are retried (transient by default). */
export function isRetryable(e: unknown): boolean {
  if (isNorthstarError(e)) return e.retryable;
  return true;
}
