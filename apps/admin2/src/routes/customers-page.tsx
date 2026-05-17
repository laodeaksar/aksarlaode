import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import type { User } from "@repo/common"
import { Badge } from "@repo/ui/components/badge"

import { listCustomersFn } from "@/server/customers"
import { DataTable } from "@/components/data-table/data-table"

import { Route } from "./customers.route"

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  OWNER: "default",
  ADMIN: "default",
  CUSTOMER: "outline",
}

const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ getValue }) => (
      <span className="font-medium text-gray-900">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ getValue }) => (
      <span className="text-gray-600">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ getValue }) => {
      const role = getValue() as string
      return <Badge variant={ROLE_VARIANTS[role] ?? "outline"}>{role}</Badge>
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Link
        to="/customers/$userId"
        params={{ userId: row.original.id }}
        className="text-sm text-blue-600 hover:underline"
      >
        View
      </Link>
    ),
  },
]

export default function CustomersPage() {
  const [page, setPage] = useState(1)
  const [inputValue, setInputValue] = useState("")
  const [search, setSearch] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loaderData = Route.useLoaderData()

  const { data, isLoading } = useQuery({
    queryKey: ["customers", page, search],
    queryFn: () =>
      listCustomersFn({
        data: { page, ...(search ? { search } : {}) },
      }),
    initialData: page === 1 && !search ? loaderData : undefined,
  })

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>

      <input
        aria-label="Search customers by name or email"
        className="w-64 rounded border px-3 py-2 text-sm"
        placeholder="Search by name or email..."
        value={inputValue}
        onChange={handleSearchChange}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={page}
        onPageChange={setPage}
      />
    </div>
  )
}
