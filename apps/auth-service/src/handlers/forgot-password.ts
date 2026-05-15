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

    // Enqueue password-reset email via email-worker (BullMQ → apps/email-worker).
    // The raw token travels only through the Redis job payload — never in an HTTP
    // response body — so it is only accessible to whoever receives the email.
    yield* Effect.tryPromise({
      try: () => enqueuePasswordReset({
        to:       user.email,
        resetUrl: `${env.WEB_URL}/reset-password?token=${token}`,
      }),
      catch: (e) => {
        // Log the failure loudly — a failed enqueue means the user will never
        // receive the reset link. On-call must be alerted.
        console.error(JSON.stringify({
          event:  "password_reset_email_enqueue_error",
          userId: user.id,
          error:  String(e),
        }))
        return new Error("Email delivery unavailable")
      },
    })
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  // Response is intentionally identical whether the email is registered or not
  // to prevent user enumeration. The reset token is NEVER returned here.
  return { message: "If that email is registered, a reset link has been sent." }
}
