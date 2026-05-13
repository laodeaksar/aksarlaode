export const orderCancelledTemplate = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Order Cancelled</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#dc2626">Order Cancelled</h1>
  <p>Hi {{ customerName }},</p>
  <p>Your order <strong>{{ orderId }}</strong> has been cancelled (reason: {{ reason }}).</p>
  <p>If stock was reserved, it has been released. Any pending payment will not be charged.</p>
  <hr>
  <p style="color:#6b7280;font-size:12px">{{ storeName }}</p>
</body>
</html>
`
