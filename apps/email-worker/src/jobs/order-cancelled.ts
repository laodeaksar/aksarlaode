// P0 FIX: Replaced raw template-literal HTML interpolation with render() engine.
// payload.reason is now HTML-escaped before insertion — previously it was
// interpolated directly, allowing HTML injection from user-controlled data.
// Also switched to BaseProvider (was incorrectly typed as MailChannelsProvider).
import { fetchUserEmail, fetchUserName } from "@/lib/user-client";
import type { BaseProvider } from "@/providers/base.provider";
import type { EmailJobPayload } from "@/queues/email.queue";
import { render } from "@/templates/engine";
import { orderCancelledTemplate } from "@/templates/order-cancelled.html";

const STORE_NAME = process.env["STORE_NAME"] ?? "My Ecommerce";
const STORE_ADDRESS = process.env["STORE_ADDRESS"] ?? "Jakarta, Indonesia";
const STORE_URL = process.env["STORE_URL"] ?? "https://example.com";

export async function handleOrderCancelled(
  payload: EmailJobPayload["order-cancelled"],
  provider: BaseProvider
) {
  try {
    const userId = payload.userId ?? "";
    const to = payload.userEmail || (await fetchUserEmail(userId));

    if (!to) {
      console.warn(
        JSON.stringify({
          event: "order_cancelled_email_skipped_no_address",
          orderId: payload.orderId,
        })
      );
      return {
        success: false,
        error: "No email address resolved",
        retryable: false,
      };
    }

    const customerName = await fetchUserName(userId);
    const unsubscribeUrl = `${STORE_URL}/unsubscribe?email=${encodeURIComponent(to)}`;

    const html = render(orderCancelledTemplate, {
      orderId: payload.orderId,
      customerName,
      reason: payload.reason,
      storeName: STORE_NAME,
      storeAddress: STORE_ADDRESS,
      unsubscribeUrl,
    });

    return provider.send({
      to,
      subject: `Order ${payload.orderId} Cancelled`,
      html,
    });
  } catch (e) {
    return { success: false, error: String(e), retryable: true };
  }
}
