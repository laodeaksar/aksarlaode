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
</body>
</html>
`
