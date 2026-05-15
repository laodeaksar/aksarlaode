import { Effect, Data }  from "effect"
import { db, schema }    from "@repo/database"
import type { UserRole } from "@/types"
import { ConflictError } from "@repo/common/errors"

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
    id:           string
    email:        string
    name:         string
    passwordHash: string
    role:         UserRole
  },
  sessionData: {
    id:        string
    userId:    string
    token:     string
    expiresAt: Date
  },
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
