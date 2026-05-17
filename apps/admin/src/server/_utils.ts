// ── Shared server-function utilities ───────────────────────────────────────
// Imported by all files in src/server/. Do NOT import in client-side code.

import { Schema } from "effect"
import { ValidationError } from "@/effect/Errors"

/**
 * Decode `input` via Effect.Schema, throwing a typed `ValidationError` on
 * failure. Used as the body of every `.inputValidator()` call.
 */
export function decodeOrThrow<A, I>(schema: Schema.Schema<A, I>, input: I): A {
  const result = Schema.decodeUnknownEither(schema)(input)
  if (result._tag === "Left") {
    throw new ValidationError({
      message: result.left.message ?? "Invalid input",
      input,
    })
  }
  return result.right
}

/**
 * Strip keys whose value is `undefined` from an object.
 *
 * With `exactOptionalPropertyTypes: true`, Effect.Schema's `partial()` produces
 * `{ x?: T | undefined }` while hand-written types use `{ x?: T }`.
 * Removing explicit undefined entries makes the two shapes compatible.
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T
}
