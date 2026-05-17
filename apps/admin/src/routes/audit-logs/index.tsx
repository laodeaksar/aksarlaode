// FIX ADM-06b: Audit log viewer — shows a chronological list of sensitive
// admin actions (product deletes, order status changes, role changes).
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useQuery }                  from "@tanstack/react-query"
import { useState }                  from "react"
import { DataTable }                 from "@/components/data-table/data-table"
import { Badge }                     from "@repo/ui/components/badge"
import type { ColumnDef }            from "@tanstack/react-table"
import { can }                       from "@/lib/rbac"
import type { Session }              from "@/lib/auth"
import type { AuditLogEntry }        from "@/effect/Services"
import { listAuditLogsFn }           from "@/server/audit-logs"

export const Route = createFileRoute("/audit-logs/")({
  // Route-level RBAC: audit:read is granted to ADMIN and OWNER only.
  // FINANCE role is redirected to dashboard — sidebar link is already hidden
  // for them, but a direct URL must also be blocked here.
  beforeLoad: ({ context }) => {
    const { session } = context as { session?: Session }
    if (!session || !can(session.role, "audit:read")) {
      throw redirect({ to: "/dashboard" as any })
    }
  },

  // SSR loader: first page fetched server-side so the table renders immediately.
  loader: () => listAuditLogsFn({ data: { page: 1 } }),

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

  // Seed first page from SSR loader — table renders without a loading spinner
  const loaderData = Route.useLoaderData()

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn:  () => listAuditLogsFn({ data: { page } }),
    initialData: page === 1 ? loaderData : undefined,
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
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={page}
        onPageChange={setPage}
      />
    </div>
  )
}
