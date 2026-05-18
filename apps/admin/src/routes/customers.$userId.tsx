import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { getCustomerFn } from "@/server/customers"

export const Route = createFileRoute("/customers/$userId")({
  loader: ({ params }) => getCustomerFn({ data: { id: params.userId } }),
  component: CustomerDetailPage,
})

function CustomerDetailPage() {
  const { userId } = Route.useParams()
  const loaderData = Route.useLoaderData()

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", userId],
    queryFn: () => getCustomerFn({ data: { id: userId } }),
    initialData: loaderData,
  })

  if (isLoading && !customer)
    return <p className="p-6 text-muted-foreground">Loading customer...</p>
  if (!customer)
    return <p className="p-6 text-red-500">Customer not found.</p>

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold text-foreground">Customer Detail</h1>
      <div className="bg-card rounded-xl border border-border p-6 space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Name</span>
          <span className="font-medium text-foreground">{customer.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Email</span>
          <span className="font-medium text-foreground">{customer.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">Role</span>
          <span className="font-medium text-foreground">{customer.role}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">ID</span>
          <span className="font-mono text-xs text-muted-foreground">{customer.id}</span>
        </div>
      </div>
    </div>
  )
}
