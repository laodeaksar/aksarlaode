import { Effect }               from "effect"
import { hashToken }            from "@/lib/token-hash"
import { userRepository }       from "@/repository/user.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
import { enqueuePasswordReset } from "@/lib/email-queue"
import { env }                  from "@repo/env/auth"
import { toErrorResponse }      from "@repo/common/errors"

function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("")
}

export const forgotPasswordHandler = async ({
  body,
  set,
}: {
  body: { email: string }
  set:  any
}) => {
  const program = Effect.gen(function* () {
    const user = yield* userRepository.findByEmail(body.email)
    if (!user) return   // early exit — enumeration-safe, same response below

    yield* resetTokenRepository.deleteAllByUserId(user.id)

    const token     = generateResetToken()
    const tokenHash = yield* Effect.tryPromise({
      try:   () => hashToken(token),
      catch: (e) => new Error(String(e)),
    })
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)   // 1 hour
    yield* resetTokenRepository.create({ token: tokenHash, userId: user.id, expiresAt })

    // ── Fire-and-forget email enqueue ─────────────────────────────────────────
    // CRITICAL: Do NOT yield this — a queue failure must NOT change the HTTP
    // response. If the email fails and we return an error, an attacker can
    // distinguish registered vs unregistered emails (registered = 500 when queue
    // is down; unregistered = 200 always). Both paths must return 200.
    //
    // The raw token travels only through the Redis job payload — never in an
    // HTTP response body — so it is only accessible to whoever receives the email.
    enqueuePasswordReset({
      to:       user.email,
      resetUrl: `${env.WEB_URL}/reset-password?token=${token}`,
    }).catch((e) => {
      // Log loudly so on-call is alerted, but do not propagate.
      console.error(JSON.stringify({
        event:  "password_reset_email_enqueue_error",
        userId: user.id,
        error:  String(e),
      }))
    })
  })

  // Swallow ALL internal failures — the response is always identical.
  // A DB error writing the token is also silenced here: the user gets the
  // same "check your email" message, the link just won't arrive.
  await Effect.runPromise(program.pipe(Effect.orElse(() => Effect.void)))

  // Response is intentionally identical whether the email is registered or not,
  // whether the queue is up or down, and whether the DB write succeeded or not.
  return { message: "If that email is registered, a reset link has been sent." }
}
