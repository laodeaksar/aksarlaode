import type { MailChannelsProvider } from "@/providers/mailchannels.provider"

export async function handleOrderCancelled(
  payload:  { orderId: string; userId: string },
  provider: MailChannelsProvider
) {
  try {
    await provider.send({
      to:      payload.userId,
      subject: `Order ${payload.orderId} Cancelled`,
      html:    `<p>Your order <strong>${payload.orderId}</strong> has been cancelled.</p>`,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e), retryable: true }
  }
}
