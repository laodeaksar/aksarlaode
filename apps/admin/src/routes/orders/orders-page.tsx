import { useMemo, useState } from "react"
import type { OrderSummary } from "@/effect/Services"
import { listOrdersFn } from "@/server/orders"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@repo/ui/components/badge"

import { DataTable } from "@/components/data-table/data-table"

import { Route } from "./index"

const STATUS_VARIANTS: Record<
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
}

const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const

// Defined outside component — never changes, no memoization needed
const columns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: "orderId",
    header: "Order ID",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-gray-800">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue() as string
      return (
        <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
          {status.replace(/_/g, " ")}
        </Badge>
      )
    },
  },
  {
    accessorKey: "grandTotal",
    header: "Amount",
    cell: ({ getValue }) =>
      `Rp ${((getValue() as number) ?? 0).toLocaleString("id-ID")}`,
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
        className="text-sm text-blue-600 hover:underline"
      >
        View
      </Link>
    ),
  },
]

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")

  // Seed first-page data from the SSR loader — no skeleton on initial load
  const loaderData = Route.useLoaderData()

  const { data, isLoading } = useQuery({
    queryKey: ["orders", page, status],
    queryFn: () =>
      listOrdersFn({
        data: { page, ...(status ? { status } : {}) },
      }),
    // Use SSR data only for the first page with no filter applied
    initialData: page === 1 && !status ? loaderData : undefined,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>

      <div className="flex items-center gap-3">
        <select
          className="rounded border px-3 py-2 text-sm bg-white"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={page}
        onPageChange={setPage}
      />
    </div>
  )
}
