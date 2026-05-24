// P0 FIX: Replaced raw template-literal HTML interpolation with render() engine.
// All variables (orderId, grandTotal) are now HTML-escaped before insertion,
// preventing HTML/script injection from attacker-controlled queue payloads.
import { fetchUserEmail } from "@/lib/user-client";
import type { BaseProvider } from "@/providers/base.provider";
import type { EmailJobPayload } from "@/queues/email.queue";
import { render } from "@/templates/engine";
import { orderCreatedTemplate } from "@/templates/order-created.html";

const STORE_NAME = process.env["STORE_NAME"] ?? "My Ecommerce";
const STORE_ADDRESS = process.env["STORE_ADDRESS"] ?? "Jakarta, Indonesia";

export async function handleOrderCreated(
  payload: EmailJobPayload["order-created"],
  provider: BaseProvider
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

    const html = render(orderCreatedTemplate, {
      orderId: payload.orderId,
      grandTotal: payload.grandTotal.toLocaleString("id-ID"),
      storeName: STORE_NAME,
      storeAddress: STORE_ADDRESS,
    });

    return provider.send({
      to,
      subject: `Order ${payload.orderId} Placed`,
      html,
    });
  } catch (e) {
    return { success: false, error: String(e), retryable: true };
  }
}
