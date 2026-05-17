import { createFileRoute } from "@tanstack/react-router"

import { getCustomerFn } from "@/server/customers"

export const Route = createFileRoute("/customers/$userId")({
  loader: ({ params }) => getCustomerFn({ data: { id: params.userId } }),
  component: CustomerDetailPage,
})

function CustomerDetailPage() {
  const customer = Route.useLoaderData()

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900">Customer Detail</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">Name</span>
          <span className="font-medium text-gray-900">{customer.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">Email</span>
          <span className="font-medium text-gray-900">{customer.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">Role</span>
          <span className="font-medium text-gray-900">{customer.role}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 text-sm">ID</span>
          <span className="font-mono text-xs text-gray-600">{customer.id}</span>
        </div>
      </div>
    </div>
  )
}
