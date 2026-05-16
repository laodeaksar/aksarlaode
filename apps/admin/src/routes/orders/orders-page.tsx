import { Link }                 from "@tanstack/react-router"
import { useQuery }               from "@tanstack/react-query"
import { useState }               from "react"
import { ordersApi }              from "@/lib/api"
import { DataTable }              from "@/components/data-table/data-table"
import { Badge }                  from "@repo/ui/components/badge"
import type { ColumnDef }         from "@tanstack/react-table"
import type { OrderSummary }      from "@/lib/api"

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING_PAYMENT: "secondary",
  PAID:            "default",
  PROCESSING:      "default",
  SHIPPED:         "default",
  DELIVERED:       "outline",
  CANCELLED:       "destructive",
  REFUNDED:        "secondary",
}

const columns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: "orderId",
    header:      "Order ID",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-gray-800">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "status",
    header:      "Status",
    cell: ({ getValue }) => {
      const status = getValue() as string
      return (
        <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
          {status.replace("_", " ")}
        </Badge>
      )
    },
  },
  {
    accessorKey: "grandTotal",
    header:      "Amount",
    cell: ({ getValue }) =>
      `Rp ${((getValue() as number) ?? 0).toLocaleString("id-ID")}`,
  },
  {
    accessorKey: "createdAt",
    header:      "Date",
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("id-ID"),
  },
  {
    id:   "actions",
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
  const [page,   setPage]   = useState(1)
  const [status, setStatus] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["orders", page, status],
    queryFn:  () => ordersApi.list(new URLSearchParams({
      page:    String(page),
      limit:   "20",
      ...(status ? { status } : {}),
    }).toString()),
  })

  const ORDER_STATUSES = [
    "PENDING_PAYMENT","PAID","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED",
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>

      <div className="flex items-center gap-3">
        <select
          className="rounded border px-3 py-2 text-sm bg-white"
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map(s => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data?.items ?? []}
        isLoading={isLoading}
        total={data?.data?.total ?? 0}
        page={page}
        onPageChange={setPage}
      />
    </div>
  )
}
