// FIX EML-08: Added unsubscribe link footer to comply with CAN-SPAM / UU ITE.
// The {{ unsubscribeUrl }} placeholder is populated by the template engine.
export const orderConfirmationTemplate = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Order Confirmed</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#16a34a">✅ Payment Confirmed!</h1>
  <p>Hi {{ customerName }},</p>
  <p>Your payment for order <strong>{{ orderId }}</strong> has been received.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr style="background:#f3f4f6">
      <td style="padding:8px">Order ID</td>
      <td style="padding:8px"><strong>{{ orderId }}</strong></td>
    </tr>
    <tr>
      <td style="padding:8px">Total</td>
      <td style="padding:8px"><strong>Rp {{ grandTotal }}</strong></td>
    </tr>
    <tr style="background:#f3f4f6">
      <td style="padding:8px">Status</td>
      <td style="padding:8px"><strong>Paid</strong></td>
    </tr>
  </table>
  <p>We'll notify you when your order ships.</p>
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
