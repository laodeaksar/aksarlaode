import type { MailChannelsProvider } from "../providers/mailchannels.provider"

export async function handleOrderCreated(
  payload:  { orderId: string; userId: string; grandTotal: number },
  provider: MailChannelsProvider
) {
  try {
    await provider.send({
      to:      payload.userId,
      subject: `Order ${payload.orderId} Created`,
      html:    `<p>Your order <strong>${payload.orderId}</strong> has been placed. Total: Rp ${payload.grandTotal.toLocaleString()}</p>`,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e), retryable: true }
  }
}
