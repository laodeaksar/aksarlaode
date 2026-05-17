import { Effect, Either } from "effect"

import { serializeError, type AppError, type SerializedError } from "./Errors"
import { AppRuntime } from "./Runtime"
import { ApiClientService } from "./Services"

// ── runServerEffect ────────────────────────────────────────────────────────
// Primary helper for TanStack Start server functions.
// Executes an Effect program using the shared AppRuntime and propagates
// typed errors as thrown exceptions (TanStack Start serializes them to the client).

export async function runServerEffect<A>(
  effect: Effect.Effect<A, AppError, ApiClientService>
): Promise<A> {
  return AppRuntime.runPromise(effect)
}

// ── runServerEffectSafe ────────────────────────────────────────────────────
// Returns a discriminated union instead of throwing.
// Use when the caller needs to distinguish success from failure without
// try/catch — for example, returning structured error data to the client.

export async function runServerEffectSafe<A>(
  effect: Effect.Effect<A, AppError, ApiClientService>
): Promise<{ ok: true; data: A } | { ok: false; error: SerializedError }> {
  const result = await AppRuntime.runPromise(Effect.either(effect))

  if (Either.isRight(result)) {
    return { ok: true, data: result.right }
  }

  return { ok: false, error: serializeError(result.left) }
}
