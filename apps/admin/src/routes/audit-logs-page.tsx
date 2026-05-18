import { useState } from "react"

import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@repo/ui/components/badge"

import { listAuditLogsFn } from "@/server/audit-logs"
import type { AuditLogEntry } from "@/effect/Services"
import { DataTable } from "@/components/data-table/data-table"

import { Route } from "./audit-logs.route"

const ACTION_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  product_deleted: "destructive",
  order_status_changed: "secondary",
  user_role_changed: "default",
}

const columns: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleString("id-ID", {
        dateStyle: "short",
        timeStyle: "medium",
      }),
  },
  {
    accessorKey: "actorId",
    header: "Actor",
    cell: ({ row }) => (
      <div>
        <p className="font-mono text-xs">{row.original.actorId.slice(0, 8)}…</p>
        <p className="text-xs text-muted-foreground">{row.original.actorRole}</p>
      </div>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
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
    header: "Resource",
    cell: ({ row }) => (
      <div>
        <p className="text-xs capitalize">{row.original.resource}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {row.original.resourceId.slice(0, 8)}…
        </p>
      </div>
    ),
  },
  {
    accessorKey: "metadata",
    header: "Metadata",
    cell: ({ getValue }) => {
      const meta = getValue() as Record<string, unknown> | null
      if (!meta) return <span className="text-muted-foreground text-xs">—</span>
      return (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-w-xs overflow-hidden">
          {JSON.stringify(meta, null, 2)}
        </pre>
      )
    },
  },
]

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)

  const loaderData = Route.useLoaderData()

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", { page }],
    queryFn: () => listAuditLogsFn({ data: { page } }),
    initialData: page === 1 ? loaderData : undefined,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sensitive admin actions — product deletes, order status changes,
            role changes.
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
