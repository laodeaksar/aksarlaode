import { useCallback, useRef } from "react"
import type { User } from "@/effect/Services"
import { listCustomersFn } from "@/server/customers"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@repo/ui/components/badge"

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
  const navigate = useNavigate()
  const { page, search } = Route.useSearch()
  const loaderData = Route.useLoaderData()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["customers", page, search],
    queryFn: () =>
      listCustomersFn({
        data: { page, ...(search ? { search } : {}) },
      }),
    initialData: page === 1 && !search ? loaderData : undefined,
  })

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        navigate({
          to: "/customers",
          search: (prev) => ({ ...prev, search: value, page: 1 }),
        })
      }, 300)
    },
    [navigate],
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigate({
        to: "/customers",
        search: (prev) => ({ ...prev, page: newPage }),
      })
    },
    [navigate],
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>

      <input
        className="w-64 rounded border px-3 py-2 text-sm"
        placeholder="Search by name or email..."
        defaultValue={search}
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
