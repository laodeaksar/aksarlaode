// Generates: ORD-20240513-A3F9B2C1 (8 hex chars — ~4.3 billion combinations/day)
export function generateOrderId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();
  return `ORD-${date}-${suffix}`;
}
