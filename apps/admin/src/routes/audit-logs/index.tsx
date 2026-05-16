// FIX ADM-06b: Audit log viewer — shows a chronological list of sensitive
// admin actions (product deletes, order status changes, role changes).
import { createFileRoute } from "@tanstack/react-router"
import { useQuery }        from "@tanstack/react-query"
import { useState }        from "react"
import { auditLogsApi, type AuditLogEntry } from "@/lib/api"
import { DataTable }       from "@/components/data-table/data-table"
import { Badge }           from "@repo/ui/components/badge"
import type { ColumnDef }  from "@tanstack/react-table"

export const Route = createFileRoute("/audit-logs/")({
  component: AuditLogsPage,
})

const ACTION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  product_deleted:       "destructive",
  order_status_changed:  "secondary",
  user_role_changed:     "default",
}

const columns: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: "createdAt",
    header:      "Time",
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }),
  },
  {
    accessorKey: "actorId",
    header:      "Actor",
    cell: ({ row }) => (
      <div>
        <p className="font-mono text-xs">{row.original.actorId.slice(0, 8)}…</p>
        <p className="text-xs text-gray-500">{row.original.actorRole}</p>
      </div>
    ),
  },
  {
    accessorKey: "action",
    header:      "Action",
    cell: ({ getValue }) => {
      const action = getValue() as string
      return (
        <Badge variant={ACTION_COLORS[action] ?? "outline"}>
          {action.replace(/_/g, " ")}
        </Badge>
      )
    },
  },
  {
    accessorKey: "resource",
    header:      "Resource",
    cell: ({ row }) => (
      <div>
        <p className="text-xs capitalize">{row.original.resource}</p>
        <p className="font-mono text-xs text-gray-500">{row.original.resourceId.slice(0, 8)}…</p>
      </div>
    ),
  },
  {
    accessorKey: "metadata",
    header:      "Metadata",
    cell: ({ getValue }) => {
      const meta = getValue() as Record<string, unknown> | null
      if (!meta) return <span className="text-gray-400 text-xs">—</span>
      return (
        <pre className="text-xs text-gray-600 whitespace-pre-wrap max-w-xs overflow-hidden">
          {JSON.stringify(meta, null, 2)}
        </pre>
      )
    },
  },
]

function AuditLogsPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn:  () => auditLogsApi.list(page),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sensitive admin actions — product deletes, order status changes, role changes.
          </p>
        </div>
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
