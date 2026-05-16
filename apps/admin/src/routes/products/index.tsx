import { createFileRoute, Link }  from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState }        from "react"
import { productsApi }     from "@/lib/api"
import { DataTable }       from "@/components/data-table/data-table"
import { Button }          from "@repo/ui/components/button"
import { Badge }           from "@repo/ui/components/badge"
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@repo/ui/components/alert-dialog"
import type { ColumnDef }  from "@tanstack/react-table"
import type { Product }    from "@repo/common"

export const Route = createFileRoute("/products/")({
  component: ProductsPage,
})

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header:      "Product",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        {row.original.imageUrls?.[0] && (
          <img src={row.original.imageUrls[0]} className="h-10 w-10 rounded object-cover" />
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
    header:      "Price",
    cell: ({ getValue }) => `Rp ${(getValue() as number).toLocaleString("id-ID")}`,
  },
  {
    accessorKey: "stock",
    header:      "Stock",
    cell: ({ getValue }) => {
      const stock = getValue() as number
      return (
        <Badge variant={stock === 0 ? "destructive" : stock < 10 ? "secondary" : "default"}>
          {stock}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header:      "Status",
    cell: ({ getValue }) => {
      const status = getValue() as string
      const variants = { ACTIVE: "default", DRAFT: "secondary", ARCHIVED: "outline" } as const
      return <Badge variant={variants[status as keyof typeof variants] ?? "outline"}>{status}</Badge>
    },
  },
  {
    id:   "actions",
    cell: ({ row }) => (
      <div className="flex gap-2">
        <Link to="/products/$productId" params={{ productId: row.original.id }}>
          <Button size="sm" variant="outline">Edit</Button>
        </Link>
        <DeleteButton productId={row.original.id} />
      </div>
    ),
  },
]

function ProductsPage() {
  const [page,   setPage]   = useState(1)
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["products", page, search],
    queryFn:  () => productsApi.list(new URLSearchParams({
      page:   String(page),
      limit:  "20",
      search,
    }).toString()),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link to="/products/new">
          <Button>+ Add Product</Button>
        </Link>
      </div>

      <input
        className="w-64 rounded border px-3 py-2 text-sm"
        placeholder="Search products..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1) }}
      />

      <DataTable
        columns={columns}
        data={data?.data?.items ?? []}
        isLoading={isLoading}
        total={data?.data?.total ?? 0}
        page={page}
        onPageChange={setPage}
      />
    </div>
  )
}

// FIX ADM-04: Replace native confirm() with accessible AlertDialog so the
// user sees an explicit irreversibility warning before deleting a product.
function DeleteButton({ productId }: { productId: string }) {
  const queryClient = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () => productsApi.delete(productId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" disabled={isPending}>
          {isPending ? "..." : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Produk</AlertDialogTitle>
          <AlertDialogDescription>
            Aksi ini tidak bisa dibatalkan. Produk akan dihapus secara permanen dari sistem.
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
