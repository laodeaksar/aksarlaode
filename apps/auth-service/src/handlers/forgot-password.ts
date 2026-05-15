import { Effect }               from "effect"
import { hashToken }            from "@/lib/token-hash"
import { userRepository }       from "@/repository/user.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
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

    // TODO: enqueue email via email service — token must ONLY reach the user
    // via out-of-band channel (email), never in this HTTP response.
    // Example:
    //   await emailQueue.add("password-reset", {
    //     to:       user.email,
    //     resetUrl: `${env.WEB_URL}/reset-password?token=${token}`,
    //   })
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  // Response is intentionally identical whether the email is registered or not
  // to prevent user enumeration, and the reset token is NEVER returned here.
  return { message: "If that email is registered, a reset link has been sent." }
}
