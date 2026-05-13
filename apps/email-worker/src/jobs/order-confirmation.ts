import { render }    from "@/templates/engine"
import { orderConfirmationTemplate } from "@/templates/order-confirmation.html"
import type { BaseProvider }         from "@/providers/base.provider"
import type { EmailJobPayload }      from "@/queues/email.queue"

// Enrich payload from order-service / user-service before sending
export async function handleOrderConfirmation(
  payload:  EmailJobPayload["order-confirmation"],
  provider: BaseProvider
) {
  // In production: fetch user email from auth-service via internal call
  const userEmail    = await fetchUserEmail(payload.userId)
  const customerName = await fetchUserName(payload.userId)

  const html = render(orderConfirmationTemplate, {
    orderId:      payload.orderId,
    customerName,
    grandTotal:   payload.amount.toLocaleString("id-ID"),
    storeName:    "My Ecommerce",
    storeAddress: "Jakarta, Indonesia",
  })

  return provider.send({
    to:      userEmail,
    subject: `✅ Payment Confirmed — ${payload.orderId}`,
    html,
  })
}
