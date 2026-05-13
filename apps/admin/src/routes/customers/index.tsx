import { createFileRoute } from "@tanstack/react-router"
import { useQuery }        from "@tanstack/react-query"
import { customersApi }    from "@/lib/api"

export const Route = createFileRoute("/customers/")({
  component: CustomersPage,
})

function CustomersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn:  () => customersApi.list(),
  })

  if (isLoading) return <p className="p-6 text-gray-500">Loading customers...</p>

  const customers = data?.data?.items ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.email}</td>
                <td className="px-4 py-3 text-gray-500">{c.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && <p className="p-6 text-center text-gray-400">No customers yet.</p>}
      </div>
    </div>
  )
}
