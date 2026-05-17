import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { deleteProductFn, listProductsFn } from "@/server/products"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import type { Product } from "@repo/common"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"

import { can } from "@/lib/rbac"
import { useSession } from "@/lib/session-context"
import { DataTable } from "@/components/data-table/data-table"

import { Route } from "./products.route"

export default function ProductsPage() {
  const navigate = useNavigate()
  const { page, search } = Route.useSearch()
  const loaderData = Route.useLoaderData()

  // Local input state for immediate feedback — URL param updates after 300ms.
  const [inputValue, setInputValue] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync input value when URL changes externally (back/forward navigation).
  useEffect(() => {
    setInputValue(search)
  }, [search])

  const { session } = useSession()
  const role = session?.role ?? "CUSTOMER"
  const canWrite = can(role, "products:write")

  const { data, isLoading } = useQuery({
    queryKey: ["products", page, search],
    queryFn: () =>
      listProductsFn({ data: { page, limit: 20, search } }),
    initialData: loaderData,
  })

  const handleSearch = useCallback(
    (value: string) => {
      setInputValue(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        navigate({
          to: "/products",
          search: (prev) => ({ ...prev, search: value, page: 1 }),
        })
      }, 300)
    },
    [navigate],
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigate({
        to: "/products",
        search: (prev) => ({ ...prev, page: newPage }),
      })
    },
    [navigate],
  )

  // Memoized: only rebuilds when canWrite changes (role switch), not on every
  // page/search state change. Prevents TanStack Table from re-initializing.
  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.imageUrls?.[0] && (
              <img
                src={row.original.imageUrls[0]}
                width={40}
                height={40}
                loading="lazy"
                className="h-10 w-10 rounded object-cover"
                alt={row.original.name}
              />
            )}
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-gray-500">{row.original.sku}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ getValue }) =>
          `Rp ${(getValue() as number).toLocaleString("id-ID")}`,
      },
      {
        accessorKey: "stock",
        header: "Stock",
        cell: ({ getValue }) => {
          const stock = getValue() as number
          return (
            <Badge
              variant={
                stock === 0
                  ? "destructive"
                  : stock < 10
                    ? "secondary"
                    : "default"
              }
            >
              {stock}
            </Badge>
          )
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() as string
          const variants = {
            ACTIVE: "default",
            DRAFT: "secondary",
            ARCHIVED: "outline",
          } as const
          return (
            <Badge
              variant={variants[status as keyof typeof variants] ?? "outline"}
            >
              {status}
            </Badge>
          )
        },
      },
      ...(canWrite
        ? [
            {
              id: "actions",
              cell: ({ row }: { row: { original: Product } }) => (
                <div className="flex gap-2">
                  <Link
                    to="/products/$productId"
                    params={{ productId: row.original.id }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Edit product"
                    >
                      Edit
                    </Button>
                  </Link>
                  <DeleteButton productId={row.original.id} />
                </div>
              ),
            },
          ]
        : []),
    ],
    [canWrite],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        {canWrite && (
          <Link to="/products/new">
            <Button>+ Add Product</Button>
          </Link>
        )}
      </div>

      <input
        className="w-64 rounded border px-3 py-2 text-sm"
        placeholder="Search products..."
        aria-label="Search products"
        value={inputValue}
        onChange={(e) => handleSearch(e.target.value)}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={page}
        onPageChange={handlePageChange}
      />
    </div>
  )
}

// ── Delete button with optimistic removal ─────────────────────────────────
function DeleteButton({ productId }: { productId: string }) {
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteProductFn({ data: { id: productId } }),

    // Optimistic: remove the product from every cached page immediately
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["products"] })
      const snapshots = queryClient.getQueriesData<{
        items: Product[]
        total: number
      }>({
        queryKey: ["products"],
      })
      queryClient.setQueriesData<{ items: Product[]; total: number }>(
        { queryKey: ["products"] },
        (old) =>
          old
            ? {
                items: old.items.filter((p) => p.id !== productId),
                total: old.total - 1,
              }
            : old,
      )
      return { snapshots }
    },

    // Roll back on error
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      )
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          aria-label="Delete product"
        >
          {isPending ? "..." : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Produk</AlertDialogTitle>
          <AlertDialogDescription>
            Aksi ini tidak bisa dibatalkan. Produk akan dihapus secara permanen
            dari sistem.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => mutate()}>
            Ya, Hapus Permanen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
