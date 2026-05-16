import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery }              from "@tanstack/react-query"
import { useState }              from "react"
import { customersApi }          from "@/lib/api"
import { DataTable }             from "@/components/data-table/data-table"
import { Badge }                 from "@repo/ui/components/badge"
import type { ColumnDef }        from "@tanstack/react-table"
import type { User }             from "@repo/common"

export const Route = createFileRoute("/customers/")({
  component: CustomersPage,
})

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  OWNER:    "default",
  ADMIN:    "default",
  CUSTOMER: "outline",
}

const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header:      "Name",
    cell: ({ getValue }) => (
      <span className="font-medium text-gray-900">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "email",
    header:      "Email",
    cell: ({ getValue }) => (
      <span className="text-gray-600">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "role",
    header:      "Role",
    cell: ({ getValue }) => {
      const role = getValue() as string
      return (
        <Badge variant={ROLE_VARIANTS[role] ?? "outline"}>{role}</Badge>
      )
    },
  },
  {
    id:   "actions",
    header: "",
    cell: ({ row }) => (
      <Link
        to="/customers/$userId"
        params={{ userId: (row.original as any).id }}
        className="text-sm text-blue-600 hover:underline"
      >
        View
      </Link>
    ),
  },
]

// FIX ADM-03: server-side pagination for customers list.
// Previously loaded all customers in one request with no controls —
// replaced with paginated DataTable and search.
function CustomersPage() {
  const [page,   setPage]   = useState(1)
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["customers", page, search],
    queryFn:  () => customersApi.list(new URLSearchParams({
      page:   String(page),
      limit:  "20",
      ...(search ? { search } : {}),
    }).toString()),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>

      <input
        className="w-64 rounded border px-3 py-2 text-sm"
        placeholder="Search by name or email..."
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
