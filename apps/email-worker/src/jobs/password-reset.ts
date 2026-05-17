import type { BaseProvider } from "@/providers/base.provider"
import type { EmailJobPayload } from "@/queues/email.queue"
import { render } from "@/templates/engine"
import { passwordResetTemplate } from "@/templates/password-reset.html"

export async function handlePasswordReset(
  payload: EmailJobPayload["password-reset"],
  provider: BaseProvider
) {
  const html = render(passwordResetTemplate, {
    resetLink: payload.resetLink,
  })

  return provider.send({
    to: payload.email,
    subject: "Reset Your Password",
    html,
  })
}
