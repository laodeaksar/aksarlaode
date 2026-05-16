import { Effect }               from "effect"
import { hashToken }            from "@/lib/token-hash"
import { userRepository }       from "@/repository/user.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
import { enqueuePasswordReset } from "@/lib/email-queue"
import { env }                  from "@repo/env/auth"
import { toErrorResponse }      from "@repo/common/errors"
import { recordForgotPasswordAttempt } from "@/lib/account-lockout"

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
  // FIX AUTH-01: per-email rate gate — 3 reset requests per 15 minutes.
  // The email is hashed before use as a key so plaintext addresses are never
  // stored in Redis. We always return the same 200 response regardless of
  // the rate-limit result to prevent email-enumeration via timing or status.
  const emailHash    = await hashToken(body.email.toLowerCase().trim())
  const rateCheck    = await recordForgotPasswordAttempt(emailHash)

  if (rateCheck.limited) {
    // Log for ops alerting but do NOT change the HTTP response — enumeration safe.
    console.warn(JSON.stringify({
      event:          "forgot_password_rate_limited",
      emailHashShort: emailHash.slice(0, 8),
      retryAfterSec:  rateCheck.retryAfterSec,
    }))
    // Identical response to the normal flow — no 429, no timing difference.
    return { message: "If that email is registered, a reset link has been sent." }
  }

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

    // EML-01 fix: queue name "email", job name "password-reset", correct payload shape.
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

  // Swallow ALL internal failures — the response is always identical.
  await Effect.runPromise(program.pipe(Effect.orElse(() => Effect.void)))

  return { message: "If that email is registered, a reset link has been sent." }
}
