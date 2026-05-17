import type { UserRole } from "@/types"
import { eq } from "drizzle-orm"
import { Data, Effect } from "effect"

import { ConflictError } from "@repo/common/errors"
import { db, schema } from "@repo/database"

class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: unknown }).code === "23505"
  )
}

/**
 * Atomically create a new user and their initial session in a single
 * Postgres transaction.
 *
 * ── Why a combined transaction ────────────────────────────────────────────────
 * Without this, a crash or DB timeout between INSERT users and INSERT sessions
 * produces a "ghost account": the user row exists (email appears taken), but no
 * session was ever created. The client receives a 500, and on retry gets a 409
 * because the email is already occupied. Recovery requires the forgot-password
 * flow, which many users cannot find. With a transaction, partial state is
 * impossible — either both rows exist or neither does.
 *
 * ── Token pre-generation ─────────────────────────────────────────────────────
 * The caller pre-generates `userData.id` and issues JWT tokens that embed it
 * BEFORE this function is called. If the transaction rolls back, those tokens
 * are discarded — they reference a userId that doesn't exist in the DB, so the
 * gateway's session lookup will reject them. The client retries from scratch.
 *
 * ── Error mapping ─────────────────────────────────────────────────────────────
 *   Postgres 23505 (unique_violation on email) → ConflictError → 409
 *   Anything else                              → DbError → 500
 */
export const createUserWithSession = (
  userData: {
    id: string
    email: string
    name: string
    passwordHash: string
    role: UserRole
  },
  sessionData: {
    id: string
    userId: string
    token: string
    expiresAt: Date
  }
) =>
  Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        const [user] = await tx
          .insert(schema.users)
          .values(userData)
          .returning()

        const [session] = await tx
          .insert(schema.sessions)
          .values(sessionData)
          .returning()

        if (!user || !session) {
          throw new Error("createUserWithSession: transaction produced no rows")
        }

        return { user, session }
      }),
    catch: (e) =>
      isUniqueViolation(e)
        ? new ConflictError("email")
        : new DbError({ cause: e }),
  })

/**
 * Atomically consume a password-reset token and apply the new password hash.
 *
 * ── Why a single transaction ──────────────────────────────────────────────────
 * Without a transaction the sequence is:
 *   1. updatePasswordHash  ← succeeds
 *   2. deleteByToken       ← fails (transient DB error)
 *   3. deleteAllSessions   ← never reached
 *
 * In that failure mode the password is changed but the reset token is NOT
 * invalidated — an attacker who intercepted the reset URL (referer leak,
 * email forward, proxy log) can reuse it to reset the password again to a
 * value they control, achieving full account takeover.
 *
 * With a transaction all three writes are atomic: if any step fails, Postgres
 * rolls back the entire operation. The token remains valid, the password is
 * unchanged, and the client can safely retry with the same link.
 *
 * ── Ordering ─────────────────────────────────────────────────────────────────
 * The token is deleted FIRST inside the transaction. This ensures that even if
 * two concurrent requests arrive with the same token, only one can delete the
 * row — the other finds zero rows deleted and the transaction is a no-op
 * (the outer handler re-checks for the token and returns 401).
 */
export const consumeResetToken = (
  tokenHash: string,
  userId: string,
  newPasswordHash: string
) =>
  Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        // 1. Delete the token first — acts as an optimistic lock.
        //    If two concurrent requests arrive, only one deletes the row.
        const deleted = await tx
          .delete(schema.passwordResetTokens)
          .where(eq(schema.passwordResetTokens.token, tokenHash))
          .returning()

        if (deleted.length === 0) {
          throw new Error("TOKEN_NOT_FOUND_OR_ALREADY_CONSUMED")
        }

        // 2. Update the password hash.
        await tx
          .update(schema.users)
          .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
          .where(eq(schema.users.id, userId))

        // 3. Invalidate all active sessions so any stolen session cookie is
        //    immediately unusable.
        await tx
          .delete(schema.sessions)
          .where(eq(schema.sessions.userId, userId))
      }),
    catch: (e) => {
      if (
        e instanceof Error &&
        e.message === "TOKEN_NOT_FOUND_OR_ALREADY_CONSUMED"
      ) {
        return new ConflictError(
          "token",
          "Reset token not found or already consumed"
        )
      }
      return new DbError({ cause: e })
    },
  })
