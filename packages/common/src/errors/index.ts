// ─────────────────────────────────────────────────────────────────────────────
// Typed HTTP error classes for use across all services.
//
// Usage in Effect programs:
//   yield* Effect.fail(new ValidationError())
//   yield* Effect.fail(new AuthError("Invalid credentials"))
//
// Usage in Hono handlers:
//   const { body, status } = toErrorResponse(result.cause.error)
//   return c.json(body, status as any)
// ─────────────────────────────────────────────────────────────────────────────

export abstract class AppError extends Error {
  abstract readonly _tag: string;
  abstract readonly statusCode: number;

  toResponse(): Record<string, unknown> {
    return { error: this.message };
  }
}

// 400 Bad Request
export class BadRequestError extends AppError {
  readonly _tag = "BadRequestError" as const;
  readonly statusCode = 400;
  constructor(message = "Bad request") {
    super(message);
  }
}

// 401 Unauthorized
export class AuthError extends AppError {
  readonly _tag = "AuthError" as const;
  readonly statusCode = 401;
  constructor(message = "Unauthorized") {
    super(message);
  }
}

// 403 Forbidden
export class ForbiddenError extends AppError {
  readonly _tag = "ForbiddenError" as const;
  readonly statusCode = 403;
  constructor(message = "Forbidden") {
    super(message);
  }
}

// 404 Not Found
export class NotFoundError extends AppError {
  readonly _tag = "NotFoundError" as const;
  readonly statusCode = 404;
  constructor(resource = "Resource") {
    super(`${resource} not found`);
  }
}

// 409 Conflict
export class ConflictError extends AppError {
  readonly _tag = "ConflictError" as const;
  readonly statusCode = 409;
  constructor(
    public readonly field: string,
    message?: string
  ) {
    super(message ?? `${field} already exists`);
  }
  override toResponse() {
    return { error: this.message, field: this.field };
  }
}

// 410 Gone — for expired resources (reset tokens, etc.)
export class GoneError extends AppError {
  readonly _tag = "GoneError" as const;
  readonly statusCode = 410;
  constructor(message = "Resource has expired") {
    super(message);
  }
}

// 422 Unprocessable Entity — for Zod / schema validation failures
export class ValidationError extends AppError {
  readonly _tag = "ValidationError" as const;
  readonly statusCode = 422;
  constructor(
    public readonly details?: unknown,
    message = "Invalid input"
  ) {
    super(message);
  }
  override toResponse() {
    return this.details
      ? { error: this.message, details: this.details }
      : { error: this.message };
  }
}

// 429 Too Many Requests
export class TooManyRequestsError extends AppError {
  readonly _tag = "TooManyRequestsError" as const;
  readonly statusCode = 429;
  constructor(message = "Too many requests, please try again later") {
    super(message);
  }
}

// 500 Internal Server Error
export class InternalError extends AppError {
  readonly _tag = "InternalError" as const;
  readonly statusCode = 500;
  constructor(message = "Internal server error") {
    super(message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler helper — converts any error to a { body, status } pair safe to
// pass directly to c.json() in a Hono handler.
// ─────────────────────────────────────────────────────────────────────────────
export function toErrorResponse(err: unknown): {
  body: Record<string, unknown>;
  status: number;
} {
  if (err instanceof AppError) {
    return { body: err.toResponse(), status: err.statusCode };
  }
  return { body: { error: "Internal server error" }, status: 500 };
}
