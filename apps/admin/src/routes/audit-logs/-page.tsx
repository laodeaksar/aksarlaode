import { useQuery } from "@tanstack/react-query";

import { Button } from "@repo/ui/components/button";

import { listAuditLogsFn } from "@/server/audit-logs";
import {
  ACTOR_ROLES,
  AUDIT_ACTIONS,
  auditLogColumns,
} from "@/components/audit-logs";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { useFilteredNavigation } from "@/lib";

import { Route } from "./route";

// ── Shared filter select style ─────────────────────────────────────────────
const SELECT_CLS =
  "rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs " +
  "focus:outline-none focus:ring-2 focus:ring-ring";

// ── Page ───────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { page, startDate, endDate, action, actorRole } = Route.useSearch();
  const currentPage = page ?? 1;
  const hasFilters = !!(startDate || endDate || action || actorRole);

  const { setFilter, clearFilters, goToPage } =
    useFilteredNavigation("/audit-logs");

  const queryParams = {
    page: currentPage,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(action ? { action } : {}),
    ...(actorRole ? { actorRole } : {}),
  };

  const { data, isLoading } = useQuery<
    Awaited<ReturnType<typeof listAuditLogsFn>>
  >({
    queryKey: ["audit-logs", { page: currentPage, startDate, endDate, action, actorRole }],
    queryFn: () => listAuditLogsFn({ data: queryParams }),
  });

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
          <label className="text-muted-foreground text-xs font-medium">
            From
          </label>
          <input
            type="date"
            className={SELECT_CLS}
            value={startDate ?? ""}
            max={endDate ?? undefined}
            onChange={(e) => setFilter("startDate", e.target.value)}
            aria-label="Filter from date"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs font-medium">
            To
          </label>
          <input
            type="date"
            className={SELECT_CLS}
            value={endDate ?? ""}
            min={startDate ?? undefined}
            onChange={(e) => setFilter("endDate", e.target.value)}
            aria-label="Filter to date"
          />
        </div>

        {/* Action filter */}
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs font-medium">
            Action
          </label>
          <select
            className={SELECT_CLS}
            value={action ?? ""}
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
          <label className="text-muted-foreground text-xs font-medium">
            Role
          </label>
          <select
            className={SELECT_CLS}
            value={actorRole ?? ""}
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
            onClick={() =>
              clearFilters("startDate", "endDate", "action", "actorRole")
            }
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
        page={currentPage}
        onPageChange={goToPage}
      />
    </div>
  );
}
