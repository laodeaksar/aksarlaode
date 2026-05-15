import type { MailChannelsProvider } from "@/providers/mailchannels.provider"
import { fetchUserEmail }             from "@/lib/user-client"
import type { EmailJobPayload }       from "@/queues/email.queue"

// FIX EML-02: previous version sent to payload.userId (a UUID) — not an email
// address.  Now uses payload.userEmail (set by EML-03 producer update).
// Falls back to fetchUserEmail from auth-service for older enqueued jobs.

export async function handleShippingUpdate(
  payload:  EmailJobPayload["shipping-update"],
  provider: MailChannelsProvider
) {
  try {
    const userId = payload.userId ?? ""
    const to     = payload.userEmail || await fetchUserEmail(userId)

    if (!to) {
      console.warn(JSON.stringify({ event: "shipping_update_email_skipped_no_address", orderId: payload.orderId }))
      return { success: false, error: "No email address resolved", retryable: false }
    }

    await provider.send({
      to,
      subject: `Your order ${payload.orderId} has shipped!`,
      html: `<p>Great news! Your order <strong>${payload.orderId}</strong> is on its way.</p>
             <p>Courier: <strong>${payload.courierName}</strong><br />
                Tracking: <strong>${payload.trackingNumber}</strong><br />
                Estimated delivery: <strong>${payload.estimatedDate}</strong></p>`,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e), retryable: true }
  }
}
