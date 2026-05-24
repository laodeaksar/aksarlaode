// Updated: uses render() engine so all variables are HTML-escaped.
// Added {{ customerName }} and unsubscribe footer for CAN-SPAM / UU ITE compliance.
export const orderCancelledTemplate = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Order Cancelled</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#dc2626">Order Cancelled</h1>
  <p>Hi {{ customerName }},</p>
  <p>Your order <strong>{{ orderId }}</strong> has been cancelled.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr style="background:#f3f4f6">
      <td style="padding:8px">Order ID</td>
      <td style="padding:8px"><strong>{{ orderId }}</strong></td>
    </tr>
    <tr>
      <td style="padding:8px">Reason</td>
      <td style="padding:8px">{{ reason }}</td>
    </tr>
  </table>
  <p>If stock was reserved, it has been released. Any pending payment will not be charged.</p>
  <p>If you did not request this cancellation, please contact our support team.</p>
  <hr>
  <p style="color:#6b7280;font-size:12px">{{ storeName }} · {{ storeAddress }}</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:8px">
    You received this email because you placed an order on {{ storeName }}.
    To stop receiving transactional emails,
    <a href="{{ unsubscribeUrl }}" style="color:#9ca3af">unsubscribe here</a>.
  </p>
</body>
</html>
`;
