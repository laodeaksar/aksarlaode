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
</body>
</html>
`
