import { fetchUserEmail } from "@/lib/user-client";
import type { MailChannelsProvider } from "@/providers/mailchannels.provider";
import type { EmailJobPayload } from "@/queues/email.queue";

// FIX EML-02: previous version sent to payload.userId (a UUID) — not an email
// address.  Now uses payload.userEmail (set by EML-03 producer update).
// Falls back to fetching from auth-service via user-client if payload.userEmail
// is missing (old job produced before the producer update was deployed).

export async function handleOrderCreated(
  payload: EmailJobPayload["order-created"],
  provider: MailChannelsProvider
) {
  try {
    const to = payload.userEmail || (await fetchUserEmail(payload.userId));

    if (!to) {
      console.warn(
        JSON.stringify({
          event: "order_created_email_skipped_no_address",
          orderId: payload.orderId,
        })
      );
      return {
        success: false,
        error: "No email address resolved",
        retryable: false,
      };
    }

    await provider.send({
      to,
      subject: `Order ${payload.orderId} Confirmed`,
      html: `<p>Your order <strong>${payload.orderId}</strong> has been placed successfully.</p>
             <p>Total: <strong>Rp ${payload.grandTotal.toLocaleString("id-ID")}</strong></p>
             <p>We will notify you once your order is being processed.</p>`,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e), retryable: true };
  }
}
