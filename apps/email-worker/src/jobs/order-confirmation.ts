import { render }    from "@/templates/engine"
import { orderConfirmationTemplate } from "@/templates/order-confirmation.html"
import type { BaseProvider }         from "@/providers/base.provider"
import type { EmailJobPayload }      from "@/queues/email.queue"
import { fetchUserEmail, fetchUserName } from "@/lib/user-client"

// FIX EML-02: fetchUserEmail and fetchUserName were called but never defined
// anywhere in the codebase → ReferenceError on every job execution.
// They are now imported from @/lib/user-client which calls auth-service
// using the internal service token.
//
// FIX EML-03: uses payload.userEmail when present (set by updated producers)
// and falls back to fetchUserEmail(payload.userId) for older enqueued jobs.

export async function handleOrderConfirmation(
  payload:  EmailJobPayload["order-confirmation"],
  provider: BaseProvider
) {
  const userId = payload.userId ?? ""

  const to           = payload.userEmail || await fetchUserEmail(userId)
  const customerName = await fetchUserName(userId)

  if (!to) {
    console.warn(JSON.stringify({ event: "order_confirmation_email_skipped_no_address", orderId: payload.orderId }))
    return { success: false, error: "No email address resolved", retryable: false }
  }

  const html = render(orderConfirmationTemplate, {
    orderId:      payload.orderId,
    customerName,
    grandTotal:   payload.amount.toLocaleString("id-ID"),
    storeName:    "My Ecommerce",
    storeAddress: "Jakarta, Indonesia",
  })

  return provider.send({
    to,
    subject: `✅ Payment Confirmed — ${payload.orderId}`,
    html,
  })
}
