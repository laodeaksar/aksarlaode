import { Button } from "@repo/ui/components/button";

import { useFilteredNavigation, useRouteSearch } from "@/lib";

// ── Types ──────────────────────────────────────────────────────────────────

// `route` is typed as `any` here for two reasons:
//
// 1. TanStack Router's `UseSearchRoute` carries a large number of additional
//    generic constraints (`StructuralSharingOption`, `RouterCore`, etc.) that
//    make structural sub-typing impractical without importing internal types.
//
// 2. Every caller passes a concrete file-route object (e.g. the `Route`
//    export from a route file) so TypeScript validates the value at the
//    definition site; widening to `any` here does not lose safety.
//
// The selector's parameter is annotated `{ page?: number }` so the RETURN
// type of `useRouteSearch` is properly inferred as `number | undefined`
// rather than `{}`.

interface PaginationBarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  route: any;
  /**
   * The path used for navigation — must match the route that owns `page`
   * in its search schema. Forwarded directly to `useFilteredNavigation`.
   */
  to: string;
  /** Total number of records — used to compute `totalPages`. */
  total: number;
  /** Rows per page. Defaults to 20 to match `listXxxFn` server functions. */
  pageSize?: number;
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Self-contained pagination bar.
 *
 * - Reads the current `page` directly from the route's validated search
 *   params via `useRouteSearch` — re-renders ONLY when `page` changes,
 *   not when filters or other search keys change.
 * - Calls `useFilteredNavigation` internally so the parent page component
 *   no longer needs to wire up `goToPage` or pass `page` as a prop to
 *   `DataTable`.
 *
 * Usage:
 *   <DataTable columns={...} data={...} isLoading={...} />
 *   <PaginationBar route={Route} to="/products" total={data?.total ?? 0} />
 */
export function PaginationBar({
  route,
  to,
  total,
  pageSize = 20,
}: PaginationBarProps) {
  // Explicitly annotate the selector parameter so TS infers `number | undefined`
  // instead of the fallback `{}` that results from `route: any`.
  const rawPage = useRouteSearch(route, (s: { page?: number }) => s.page);
  const page = rawPage ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const { goToPage } = useFilteredNavigation(to);

  return (
    <div className="text-muted-foreground flex items-center justify-between text-sm">
      <p>{total} total records</p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
        >
          ← Prev
        </Button>
        <span>
          Page {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
