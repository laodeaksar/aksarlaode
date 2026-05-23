import { type ReactNode, useRef } from "react";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type Row,
  type Table,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

// ── Types ──────────────────────────────────────────────────────────────────

type Props<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  /** Enable virtual scrolling for large datasets (orders, audit logs). */
  virtualize?: boolean;
  /** Container height when virtualize=true. Default: "600px" */
  containerHeight?: string;
  /** aria-label for the table — improves screen-reader context. */
  ariaLabel?: string;
  /**
   * Rendered inside a full-colspan cell when data is empty and not loading.
   * Pass a <ModuleEmptyState> for page-contextual messaging.
   */
  emptyState?: ReactNode;
};

// ── Skeleton rows (shared between normal and virtual mode) ─────────────────

function SkeletonRows<T>({
  columns,
  count = 5,
}: {
  columns: ColumnDef<T>[];
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i} aria-hidden="true">
          {columns.map((_, j) => (
            <TableCell key={j} className="px-4 py-3">
              <div className="bg-muted h-4 animate-pulse rounded" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Pure table renderer — displays rows, loading skeletons, and empty states.
 *
 * Pagination is intentionally NOT part of this component. Render
 * `<PaginationBar>` below the table instead:
 *
 *   <DataTable columns={...} data={...} isLoading={...} emptyState={...} />
 *   <PaginationBar route={Route} to="/products" total={data?.total ?? 0} />
 *
 * This separation means `DataTable` never re-renders due to a page change —
 * only due to new `data` arriving (which is the correct trigger).
 *
 * Pass `virtualize={true}` and optionally `containerHeight` to enable
 * TanStack Virtual for tables with hundreds of rows (orders, audit logs).
 */
export function DataTable<T>({
  columns,
  data,
  isLoading,
  virtualize = false,
  containerHeight = "600px",
  ariaLabel,
  emptyState,
}: Props<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const rows = table.getRowModel().rows;

  // ── Virtual mode ────────────────────────────────────────────────────────
  if (virtualize) {
    return (
      <VirtualTable
        table={table}
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        containerHeight={containerHeight}
        emptyState={emptyState}
        {...(ariaLabel !== undefined ? { ariaLabel } : {})}
      />
    );
  }

  // ── Normal mode ─────────────────────────────────────────────────────────
  return (
    <div className="overflow-hidden rounded-md border">
      <UITable
        {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
        aria-busy={isLoading}
      >
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} scope="col">
                  <>{flexRender(h.column.columnDef.header, h.getContext())}</>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <SkeletonRows columns={columns} />
          ) : rows.length === 0 && emptyState ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="p-0 hover:bg-transparent"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell: Cell<T, unknown>) => (
                  <TableCell key={cell.id}>
                    <>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </>
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </UITable>
    </div>
  );
}

// ── Virtual Table sub-component ────────────────────────────────────────────

type VirtualTableProps<T> = {
  table: Table<T>;
  rows: Row<T>[];
  columns: ColumnDef<T>[];
  isLoading: boolean;
  containerHeight: string;
  ariaLabel?: string;
  emptyState?: ReactNode;
};

function VirtualTable<T>({
  table,
  rows,
  columns,
  isLoading,
  containerHeight,
  ariaLabel,
  emptyState,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: isLoading ? 10 : rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop =
    virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  return (
    <div
      ref={parentRef}
      style={{ height: containerHeight, overflow: "auto" }}
      className="rounded-md border"
    >
      <UITable
        {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
        aria-busy={isLoading}
      >
        <TableHeader className="sticky top-0 z-10 bg-white dark:bg-gray-950">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} scope="col">
                  <>{flexRender(h.column.columnDef.header, h.getContext())}</>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i} aria-hidden="true">
                {columns.map((_, j) => (
                  <TableCell key={j} className="px-4 py-3">
                    <div className="bg-muted h-4 animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 && emptyState ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="p-0 hover:bg-transparent"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            <>
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  <td style={{ height: paddingTop }} />
                </tr>
              )}
              {virtualItems.map((virtualRow: VirtualItem) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell: Cell<T, unknown>) => (
                      <TableCell key={cell.id}>
                        <>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {paddingBottom > 0 && (
                <tr aria-hidden="true">
                  <td style={{ height: paddingBottom }} />
                </tr>
              )}
            </>
          )}
        </TableBody>
      </UITable>
    </div>
  );
}
