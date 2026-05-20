import { useCallback } from "react";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

import { listAuditLogsFn } from "@/server/audit-logs";
import type { AuditLogEntry } from "@/effect/Services";
import { DataTable } from "@/components/data-table/data-table";

import { Route } from "./audit-logs.route";

// ── Constants ──────────────────────────────────────────────────────────────

const AUDIT_ACTIONS = [
  "product_created",
  "product_updated",
  "product_deleted",
  "order_status_changed",
  "user_role_changed",
] as const;

const ACTOR_ROLES = ["OWNER", "ADMIN", "FINANCE"] as const;

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

// ── Table columns ──────────────────────────────────────────────────────────
// Defined outside the component — stable reference, no memoization needed.

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

// ── Shared filter select style ─────────────────────────────────────────────
const SELECT_CLS =
  "rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs " +
  "focus:outline-none focus:ring-2 focus:ring-ring";

// ── Page ───────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const { page, startDate, endDate, action, actorRole } = Route.useSearch();
  const loaderData = Route.useLoaderData();

  // True when any filter beyond page number is active.
  const hasFilters = !!(startDate || endDate || action || actorRole);

  // Build the React Query cache key from the complete filter set.
  const queryKey = ["audit-logs", { page, startDate, endDate, action, actorRole }];

  // Derive the params object once — used by both queryFn and initialData check.
  const queryParams = {
    page,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(action ? { action } : {}),
    ...(actorRole ? { actorRole } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listAuditLogsFn({ data: queryParams }),
    // Only seed from SSR loader data when no filter is applied (loader runs
    // with whatever the URL params were on SSR, so only page-1 no-filter is safe).
    initialData:
      page === 1 && !hasFilters ? loaderData : undefined,
  });

  // ── Navigation helpers ─────────────────────────────────────────────────

  // Generic setter: updates one search param and resets page to 1.
  const setFilter = useCallback(
    (key: string, value: string) => {
      navigate({
        to: "/audit-logs",
        search: (prev) => ({ ...prev, [key]: value, page: 1 }),
      });
    },
    [navigate]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigate({
        to: "/audit-logs",
        search: (prev) => ({ ...prev, page: newPage }),
      });
    },
    [navigate]
  );

  const clearFilters = useCallback(() => {
    navigate({
      to: "/audit-logs",
      search: { page: 1, startDate: "", endDate: "", action: "", actorRole: "" },
    });
  }, [navigate]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sensitive admin actions — product deletes, order status changes, role
          changes.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            From
          </label>
          <input
            type="date"
            className={SELECT_CLS}
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setFilter("startDate", e.target.value)}
            aria-label="Filter from date"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            To
          </label>
          <input
            type="date"
            className={SELECT_CLS}
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setFilter("endDate", e.target.value)}
            aria-label="Filter to date"
          />
        </div>

        {/* Action filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Action
          </label>
          <select
            className={SELECT_CLS}
            value={action}
            onChange={(e) => setFilter("action", e.target.value)}
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Actor role filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Role
          </label>
          <select
            className={SELECT_CLS}
            value={actorRole}
            onChange={(e) => setFilter("actorRole", e.target.value)}
            aria-label="Filter by actor role"
          >
            <option value="">All roles</option>
            {ACTOR_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Clear button — only visible when a filter is active */}
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="self-end"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Results */}
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={page}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
