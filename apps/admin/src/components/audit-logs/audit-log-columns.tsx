import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@repo/ui/components/badge";

import type { AuditLogEntry } from "@/effect/Services";

export const AUDIT_ACTIONS = [
  "product_created",
  "product_updated",
  "product_deleted",
  "order_status_changed",
  "user_role_changed",
] as const;

export const ACTOR_ROLES = ["OWNER", "ADMIN", "FINANCE"] as const;

const ACTION_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  product_created: "default",
  product_updated: "secondary",
  product_deleted: "destructive",
  order_status_changed: "secondary",
  user_role_changed: "default",
};

export const auditLogColumns: ColumnDef<AuditLogEntry>[] = [
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
      const action = getValue() as string;
      return (
        <Badge variant={ACTION_COLORS[action] ?? "outline"}>
          {action.replace(/_/g, " ")}
        </Badge>
      );
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
      const meta = getValue() as Record<string, unknown> | null;
      if (!meta)
        return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-w-xs overflow-hidden">
          {JSON.stringify(meta, null, 2)}
        </pre>
      );
    },
  },
];
