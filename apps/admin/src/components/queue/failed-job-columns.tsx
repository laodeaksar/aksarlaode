import type { ColumnDef } from "@tanstack/react-table";

import type { QueueFailedJob } from "@/types";

import { RetryJobButton } from "./retry-job-button";

// ── Job type badge colours ──────────────────────────────────────────────────

const JOB_TYPE_STYLES: Record<string, string> = {
  "order-created":      "bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300",
  "order-confirmation": "bg-blue-100   text-blue-800   dark:bg-blue-900/40   dark:text-blue-300",
  "order-cancelled":    "bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300",
  "password-reset":     "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "shipping-update":    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  "staff-invite":       "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

function jobTypeBadge(name: string) {
  const cls =
    JOB_TYPE_STYLES[name] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {name}
    </span>
  );
}

// ── Relative time helper ────────────────────────────────────────────────────

function relativeTime(ms: number | null): string {
  if (ms === null) return "—";
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Column definitions ──────────────────────────────────────────────────────

type ColumnProps = {
  canManage: boolean;
};

export function buildFailedJobColumns({
  canManage,
}: ColumnProps): ColumnDef<QueueFailedJob>[] {
  const cols: ColumnDef<QueueFailedJob>[] = [
    {
      accessorKey: "id",
      header: "Job ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          …{row.original.id.slice(-10)}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Type",
      cell: ({ row }) => jobTypeBadge(row.original.name),
    },
    {
      accessorKey: "orderId",
      header: "Order ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.orderId ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      accessorKey: "failedReason",
      header: "Error",
      cell: ({ row }) => (
        <span
          className="block max-w-xs truncate text-sm text-destructive"
          title={row.original.failedReason}
        >
          {row.original.failedReason}
        </span>
      ),
    },
    {
      accessorKey: "attemptsMade",
      header: "Attempts",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.attemptsMade}</span>
      ),
    },
    {
      accessorKey: "finishedOn",
      header: "Failed At",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {relativeTime(row.original.finishedOn)}
        </span>
      ),
    },
  ];

  if (canManage) {
    cols.push({
      id: "actions",
      header: "",
      cell: ({ row }) => <RetryJobButton jobId={row.original.id} />,
    });
  }

  return cols;
}
