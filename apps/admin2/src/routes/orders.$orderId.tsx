import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Badge } from "@repo/ui/badge"
import { Button } from "@repo/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog"

import { ordersApi } from "@/lib/api"
import { effectResolver } from "@/lib/effect-resolver"
import { can } from "@/lib/rbac"
import { useSession } from "@/lib/session-context"
import { getOrderFn } from "@/server/orders"
import { StatusUpdateSchema, type StatusFormFields } from "@/schemas/forms"

export const Route = createFileRoute("/orders/$orderId")({
  loader: ({ params }) => getOrderFn({ data: { id: params.orderId } }),
  component: OrderDetailPage,
})

const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const

const STATUS_COLOR: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PAID: "default",
  DELIVERED: "default",
  PROCESSING: "secondary",
  SHIPPED: "secondary",
  PENDING_PAYMENT: "outline",
  CANCELLED: "destructive",
}

function OrderDetailPage() {
  const { orderId } = Route.useParams()
  const loaderData = Route.useLoaderData()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { session } = useSession()
  const role = session?.role ?? "CUSTOMER"
  const canWrite = can(role, "orders:write")

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderFn({ data: { id: orderId } }),
    initialData: loaderData,
  })

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StatusFormFields>({
    resolver: effectResolver(StatusUpdateSchema),
    defaultValues: { nextStatus: "", note: "" },
  })

  const watchedNextStatus = watch("nextStatus")

  const { mutate: executeUpdate, isPending } = useMutation({
    mutationFn: ({ nextStatus, note }: StatusFormFields) =>
      ordersApi.updateStatus(orderId, nextStatus, note || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] })
      reset()
      setConfirmOpen(false)
    },
  })

  const onStatusSubmit = handleSubmit((data) => {
    if (data.nextStatus === "CANCELLED") {
      setConfirmOpen(true)
    } else {
      executeUpdate(data)
    }
  })

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{order.orderId}</h1>
          <p className="text-sm text-gray-500">
            {new Date(order.createdAt).toLocaleString("id-ID")}
          </p>
        </div>
        <Badge
          variant={STATUS_COLOR[order.status] ?? "outline"}
          className="text-sm px-3 py-1"
        >
          {order.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Line items */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.productId}
                className="flex justify-between text-sm"
              >
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-gray-500">
                    x{item.quantity} @ Rp {item.price.toLocaleString("id-ID")}
                  </p>
                </div>
                <p className="font-semibold">
                  Rp {item.subtotal.toLocaleString("id-ID")}
                </p>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Grand Total</span>
              <span>Rp {order.grandTotal.toLocaleString("id-ID")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Shipping address */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {Object.entries(order.shippingAddress).map(([k, v]) => (
              <p key={k}>
                <span className="capitalize text-gray-500">{k}:</span> {v}
              </p>
            ))}
          </CardContent>
        </Card>

        {/* Status history */}
        <Card>
          <CardHeader>
            <CardTitle>Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-gray-200 ml-3 space-y-4">
              {order.statusHistory.map((e, i) => (
                <li key={i} className="ml-4">
                  <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-blue-500" />
                  <p className="text-sm font-medium">{e.status}</p>
                  {e.note && <p className="text-xs text-gray-500">{e.note}</p>}
                  <p className="text-xs text-gray-400">
                    {new Date(e.timestamp).toLocaleString("id-ID")}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Update status — only shown for roles with orders:write */}
        {canWrite && (
          <Card>
            <CardHeader>
              <CardTitle>Update Status</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onStatusSubmit} className="space-y-3">
                <div>
                  <label htmlFor="order-next-status" className="sr-only">
                    New status
                  </label>
                  <select
                    id="order-next-status"
                    aria-label="Select new order status"
                    className="w-full rounded border px-3 py-2 text-sm"
                    {...register("nextStatus")}
                  >
                    <option value="">Select new status...</option>
                    {ORDER_STATUSES.filter((s) => s !== order.status).map(
                      (s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ),
                    )}
                  </select>
                  {errors.nextStatus && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.nextStatus.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="order-note" className="sr-only">
                    Note
                  </label>
                  <textarea
                    id="order-note"
                    aria-label="Status update note"
                    className="w-full rounded border px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Optional note (e.g. tracking number)"
                    {...register("note")}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!watchedNextStatus || isPending || isSubmitting}
                >
                  {isPending || isSubmitting ? "Updating..." : "Update Status"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation dialog — only shown when transitioning to CANCELLED */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Pesanan</AlertDialogTitle>
            <AlertDialogDescription>
              Aksi ini tidak bisa dibatalkan. Pesanan akan berpindah ke status
              CANCELLED dan stok akan dibebaskan kembali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const { nextStatus, note } = watch()
                executeUpdate({ nextStatus, note })
              }}
            >
              Ya, Batalkan Pesanan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
