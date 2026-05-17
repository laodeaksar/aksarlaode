import { Data } from "effect"

// ── API errors ────────────────────────────────────────────
export class NetworkError extends Data.TaggedError("NetworkError")<{
  message: string
}> {}

export class HttpError extends Data.TaggedError("HttpError")<{
  status: number
  message: string
}> {}

export class ParseError extends Data.TaggedError("ParseError")<{
  message: string
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  resource: string
}> {}

export class AuthError extends Data.TaggedError("AuthError")<{
  reason: "expired" | "invalid" | "forbidden"
}> {}

// Union for convenience
export type ApiError =
  | NetworkError
  | HttpError
  | ParseError
  | NotFoundError
  | AuthError
