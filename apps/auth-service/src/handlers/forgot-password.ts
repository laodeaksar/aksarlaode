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
    if (!user) return

    yield* resetTokenRepository.deleteAllByUserId(user.id)

    const token     = generateResetToken()
    const tokenHash = yield* Effect.tryPromise({
      try:   () => hashToken(token),
      catch: (e) => new Error(String(e)),
    })
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    yield* resetTokenRepository.create({ token: tokenHash, userId: user.id, expiresAt })

    // FIX EML-01: payload shape updated to match EmailJobPayload["password-reset"]
    // in email-worker (userId + email + resetLink).
    // Queue name in enqueuePasswordReset is now "email" (see lib/email-queue.ts).
    enqueuePasswordReset({
      userId:    user.id,
      email:     user.email,
      resetLink: `${env.WEB_URL}/reset-password?token=${token}`,
    }).catch((e) => {
      console.error(JSON.stringify({
        event:  "password_reset_email_enqueue_error",
        userId: user.id,
        error:  String(e),
      }))
    })
  })

  await Effect.runPromise(program.pipe(Effect.orElse(() => Effect.void)))

  return { message: "If that email is registered, a reset link has been sent." }
}
