import type { MailChannelsProvider } from "@/providers/mailchannels.provider"
import type { EmailJobPayload } from "@/queues/email.queue"

import { fetchUserEmail } from "@/lib/user-client"

// FIX EML-02: previous version sent to payload.userId (a UUID) — not an email
// address.  Now uses payload.userEmail (set by EML-03 producer update).
// Falls back to fetchUserEmail from auth-service for older enqueued jobs.

export async function handleOrderCancelled(
  payload: EmailJobPayload["order-cancelled"],
  provider: MailChannelsProvider
) {
  try {
    const userId = payload.userId ?? ""
    const to = payload.userEmail || (await fetchUserEmail(userId))

    if (!to) {
      console.warn(
        JSON.stringify({
          event: "order_cancelled_email_skipped_no_address",
          orderId: payload.orderId,
        })
      )
      return {
        success: false,
        error: "No email address resolved",
        retryable: false,
      }
    }

    await provider.send({
      to,
      subject: `Order ${payload.orderId} Cancelled`,
      html: `<p>Your order <strong>${payload.orderId}</strong> has been cancelled.</p>
             <p>Reason: ${payload.reason ?? "N/A"}</p>
             <p>If you did not request this cancellation, please contact our support team.</p>`,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e), retryable: true }
  }
}
