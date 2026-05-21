import { useCallback } from "react";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/button";

import { listAuditLogsFn } from "@/server/audit-logs";
import { auditLogColumns, AUDIT_ACTIONS, ACTOR_ROLES } from "@/components/audit-logs";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";

import { Route } from "./route";

// ── Shared filter select style ─────────────────────────────────────────────
const SELECT_CLS =
  "rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs " +
  "focus:outline-none focus:ring-2 focus:ring-ring";

// ── Page ───────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const { page, startDate, endDate, action, actorRole } = Route.useSearch();
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
      <PageHeader
        title="Audit Log"
        subtitle="Sensitive admin actions — product deletes, order status changes, role changes."
      />

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
        columns={auditLogColumns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={page}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
