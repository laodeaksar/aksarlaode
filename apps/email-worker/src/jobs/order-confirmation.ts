import { fetchUserEmail, fetchUserName } from "@/lib/user-client";
import type { BaseProvider } from "@/providers/base.provider";
import type { EmailJobPayload } from "@/queues/email.queue";
import { render } from "@/templates/engine";
import { orderConfirmationTemplate } from "@/templates/order-confirmation.html";

// FIX EML-02: fetchUserEmail and fetchUserName are imported from @/lib/user-client.
// FIX EML-03: uses payload.userEmail when present, falls back to auth-service lookup.
// FIX EML-08: passes unsubscribeUrl to template for CAN-SPAM / UU ITE compliance.

const STORE_NAME = process.env["STORE_NAME"] ?? "My Ecommerce";
const STORE_ADDRESS = process.env["STORE_ADDRESS"] ?? "Jakarta, Indonesia";
const STORE_URL = process.env["STORE_URL"] ?? "https://example.com";

export async function handleOrderConfirmation(
  payload: EmailJobPayload["order-confirmation"],
  provider: BaseProvider
) {
  const userId = payload.userId ?? "";

  const to = payload.userEmail || (await fetchUserEmail(userId));
  const customerName = await fetchUserName(userId);

  if (!to) {
    console.warn(
      JSON.stringify({
        event: "order_confirmation_email_skipped_no_address",
        orderId: payload.orderId,
      })
    );
    return {
      success: false,
      error: "No email address resolved",
      retryable: false,
    };
  }

  const unsubscribeUrl = `${STORE_URL}/unsubscribe?email=${encodeURIComponent(to)}`;

  const html = render(orderConfirmationTemplate, {
    orderId: payload.orderId,
    customerName,
    grandTotal: payload.amount.toLocaleString("id-ID"),
    storeName: STORE_NAME,
    storeAddress: STORE_ADDRESS,
    unsubscribeUrl,
  });

  return provider.send({
    to,
    subject: `✅ Payment Confirmed — ${payload.orderId}`,
    html,
  });
}
