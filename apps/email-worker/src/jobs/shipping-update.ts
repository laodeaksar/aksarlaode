import { render }                 from "@/templates/engine"
import { shippingUpdateTemplate } from "@/templates/shipping-update.html"
import type { MailChannelsProvider } from "@/providers/mailchannels.provider"
import { fetchUserEmail, fetchUserName } from "@/lib/user-client"
import type { EmailJobPayload }       from "@/queues/email.queue"

// FIX EML-08: Uses the shared HTML template (with unsubscribe footer) instead
// of ad-hoc string interpolation.  Template variables are HTML-escaped by the
// template engine (EML-04 fix) so attacker-controlled tracking numbers etc.
// cannot inject HTML.

const STORE_NAME    = process.env["STORE_NAME"]    ?? "My Ecommerce"
const STORE_ADDRESS = process.env["STORE_ADDRESS"] ?? "Jakarta, Indonesia"
const STORE_URL     = process.env["STORE_URL"]     ?? "https://example.com"

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

    const customerName   = await fetchUserName(userId)
    const unsubscribeUrl = `${STORE_URL}/unsubscribe?email=${encodeURIComponent(to)}`

    const html = render(shippingUpdateTemplate, {
      orderId:        payload.orderId,
      customerName,
      courierName:    payload.courierName,
      trackingNumber: payload.trackingNumber,
      estimatedDate:  payload.estimatedDate,
      storeName:      STORE_NAME,
      storeAddress:   STORE_ADDRESS,
      unsubscribeUrl,
    })

    return provider.send({
      to,
      subject: `🚚 Your order ${payload.orderId} has shipped!`,
      html,
    })
  } catch (e) {
    return { success: false, error: String(e), retryable: true }
  }
}
