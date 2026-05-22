import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@repo/ui/components/badge";

import type { AuditLogEntry } from "@/effect/Services";

export const AUDIT_ACTIONS = [
  "product_created",
  "product_updated",
  "product_deleted",
  "order_status_changed",
  "user_role_changed",
  "queue_job_retried",
  "queue_jobs_retried",
  "queue_email_resent",
] as const;

export const ACTOR_ROLES = ["OWNER", "ADMIN", "FINANCE"] as const;

const ACTION_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  product_created:      "default",
  product_updated:      "secondary",
  product_deleted:      "destructive",
  order_status_changed: "secondary",
  user_role_changed:    "default",
  queue_job_retried:    "secondary",
  queue_jobs_retried:   "secondary",
  queue_email_resent:   "default",
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
        <p className="text-muted-foreground text-xs">
          {row.original.actorRole}
        </p>
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
        <p className="text-muted-foreground font-mono text-xs">
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
        <pre className="text-muted-foreground max-w-xs overflow-hidden text-xs whitespace-pre-wrap">
          {JSON.stringify(meta, null, 2)}
        </pre>
      );
    },
  },
];
