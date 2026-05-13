import type { MailChannelsProvider } from "@/providers/mailchannels.provider"

export async function handleShippingUpdate(
  payload:  { orderId: string; userId: string; status: string },
  provider: MailChannelsProvider
) {
  try {
    await provider.send({
      to:      payload.userId,
      subject: `Order ${payload.orderId} Shipping Update`,
      html:    `<p>Your order <strong>${payload.orderId}</strong> status: ${payload.status}</p>`,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e), retryable: true }
  }
}
