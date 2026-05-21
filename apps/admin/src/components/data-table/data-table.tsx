import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import {
  Table,
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
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Pure table renderer — displays rows and handles loading skeletons.
 *
 * Pagination is intentionally NOT part of this component. Render
 * `<PaginationBar>` below the table instead:
 *
 *   <DataTable columns={...} data={...} isLoading={...} />
 *   <PaginationBar route={Route} to="/products" total={data?.total ?? 0} />
 *
 * This separation means `DataTable` never re-renders due to a page change —
 * only due to new `data` arriving (which is the correct trigger).
 */
export function DataTable<T>({ columns, data, isLoading }: Props<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  <>{flexRender(h.column.columnDef.header, h.getContext())}</>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j} className="px-4 py-3">
                      <div className="bg-muted h-4 animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
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
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
