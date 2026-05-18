// FIX EML-08: Added unsubscribe link footer to comply with CAN-SPAM / UU ITE.
export const shippingUpdateTemplate = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Order Has Shipped</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1>🚚 Your Order Is On Its Way!</h1>
  <p>Hi {{ customerName }},</p>
  <p>Order <strong>{{ orderId }}</strong> has been shipped.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr style="background:#f3f4f6">
      <td style="padding:8px">Courier</td>
      <td style="padding:8px"><strong>{{ courierName }}</strong></td>
    </tr>
    <tr>
      <td style="padding:8px">Tracking No.</td>
      <td style="padding:8px"><strong>{{ trackingNumber }}</strong></td>
    </tr>
    <tr style="background:#f3f4f6">
      <td style="padding:8px">Estimated Arrival</td>
      <td style="padding:8px"><strong>{{ estimatedDate }}</strong></td>
    </tr>
  </table>
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
