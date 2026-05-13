// Generates: ORD-20240513-A3F9
export function generateOrderId(): string {
  const date   = new Date().toISOString().slice(0,10).replace(/-/g,"")
  const suffix = crypto.randomUUID().slice(0,4).toUpperCase()
  return `ORD-${date}-${suffix}`
}
