import type { OrderSummary } from "@/effect/Services";
import { formatIDR } from "@/lib";

interface RecentOrdersTableProps {
  orders: OrderSummary[];
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada pesanan terbaru.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <div
          key={order.orderId}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-muted-foreground font-mono text-xs">
            {order.orderId.slice(0, 12)}…
          </span>
          <span
            className={
              order.status === "CANCELLED"
                ? "font-medium text-red-600"
                : "font-medium text-green-700"
            }
          >
            {formatIDR(order.grandTotal)}
          </span>
        </div>
      ))}
    </div>
  );
}
