import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@repo/ui/components/badge";

import { DataTable } from "@/components/data-table";
import type { AuditLogEntry } from "@/types";

// ── Column definitions ──────────────────────────────────────────────────────

const ACTION_STYLES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  queue_job_retried:  { label: "Job retried",   variant: "secondary"    },
  queue_jobs_retried: { label: "All retried",   variant: "secondary"    },
  queue_email_resent: { label: "Email resent",  variant: "default"      },
};

const activityColumns: ColumnDef<AuditLogEntry>[] = [
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
    accessorKey: "action",
    header: "Action",
    cell: ({ getValue }) => {
      const action = getValue() as string;
      const cfg = ACTION_STYLES[action] ?? {
        label: action.replace(/_/g, " "),
        variant: "outline" as const,
      };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
  {
    accessorKey: "actorId",
    header: "Triggered by",
    cell: ({ row }) => (
      <div>
        <p className="font-mono text-xs">{row.original.actorId.slice(0, 8)}…</p>
        <p className="text-muted-foreground text-xs">{row.original.actorRole}</p>
      </div>
    ),
  },
  {
    accessorKey: "resourceId",
    header: "Target",
    cell: ({ row }) => {
      const id = row.original.resourceId;
      if (id === "all") {
        return (
          <span className="text-muted-foreground text-xs italic">all failed jobs</span>
        );
      }
      return <span className="font-mono text-xs">{id}</span>;
    },
  },
  {
    id: "outcome",
    header: "Outcome",
    cell: ({ row }) => {
      const meta = row.original.metadata as Record<string, unknown> | null;
      const outcome = meta?.["outcome"] as string | undefined;
      if (!outcome) return <span className="text-muted-foreground text-xs">—</span>;
      return outcome === "ok" ? (
        <span className="text-xs font-medium text-green-600 dark:text-green-400">
          Success
        </span>
      ) : (
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          Failed
        </span>
      );
    },
  },
];

// ── Component ───────────────────────────────────────────────────────────────

type Props = {
  items: AuditLogEntry[];
  isLoading: boolean;
};

export function QueueActivityLog({ items, isLoading }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-foreground text-lg font-semibold">Recent Activity</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Last 10 queue actions — retries and manual resends — performed by admins.
        </p>
      </div>

      <DataTable
        columns={activityColumns}
        data={items}
        isLoading={isLoading}
      />

      {!isLoading && items.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No queue activity recorded yet. Actions will appear here after the first
          retry or manual resend.
        </p>
      )}
    </div>
  );
}
