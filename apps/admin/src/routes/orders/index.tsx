import { createFileRoute }                    from "@tanstack/react-router"
import { useQuery }                            from "@tanstack/react-query"
import { ordersApi }                           from "../../lib/api"

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
})

function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn:  () => ordersApi.list(),
  })

  if (isLoading) return <p className="p-6 text-gray-500">Loading orders...</p>

  const orders = data?.data?.items ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Order ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o: any) => (
              <tr key={o.orderId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-900">{o.orderId}</td>
                <td className="px-4 py-3 text-gray-600">{o.status}</td>
                <td className="px-4 py-3 text-gray-600">Rp {o.totalAmount?.toLocaleString("id-ID")}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-6 text-center text-gray-400">No orders yet.</p>}
      </div>
    </div>
  )
}
