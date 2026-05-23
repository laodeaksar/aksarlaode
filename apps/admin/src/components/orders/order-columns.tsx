import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@repo/ui/components/badge";

import type { OrderSummary } from "@/effect/Services";
import { formatIDR } from "@/lib";

export const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING_PAYMENT: "secondary",
  PAID: "default",
  PROCESSING: "default",
  SHIPPED: "default",
  DELIVERED: "outline",
  CANCELLED: "destructive",
  REFUNDED: "secondary",
};

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export const orderColumns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: "orderId",
    header: "Order ID",
    cell: ({ getValue }) => (
      <span className="text-foreground font-mono text-xs">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue() as string;
      return (
        <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
          {status.replace(/_/g, " ")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "grandTotal",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ getValue }) => {
      const total = Number(getValue() as number) ?? 0;
      return (
        <div className="text-right">
          {formatIDR(total)}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleDateString("id-ID"),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Link
        to="/orders/$orderId"
        params={{ orderId: row.original.orderId }}
        // @ts-ignore
        search={{}}
        className="text-sm text-blue-600 hover:underline"
      >
        View
      </Link>
    ),
  },
];
