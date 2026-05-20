import { useState } from "react";
import { useForm } from "react-hook-form";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";

import { getOrderFn, updateOrderStatusFn } from "@/server/orders";
import { StatusUpdateSchema, type StatusFormFields } from "@/schemas/forms";
import { can, effectResolver, toast, useSession } from "@/lib";
import { PageHeader } from "@/components/layout/page-header";

// ── Constants ──────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

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
};

// ── Skeleton ───────────────────────────────────────────────────────────────

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface OrderDetailProps {
  orderId: string;
}

export function OrderDetail({ orderId }: OrderDetailProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { session } = useSession();
  const role = session?.role ?? "CUSTOMER";
  const canWrite = can(role, "orders:write");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderFn({ data: { id: orderId } }),
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StatusFormFields>({
    resolver: effectResolver(StatusUpdateSchema),
    defaultValues: { nextStatus: "", note: "" },
  });

  const watchedNextStatus = watch("nextStatus");

  const { mutate: executeUpdate, isPending } = useMutation({
    mutationFn: ({ nextStatus, note }: StatusFormFields) =>
      updateOrderStatusFn({
        data: {
          id: orderId,
          status: nextStatus,
          ...(note ? { note } : {}),
        },
      }),

    onMutate: async ({ nextStatus, note }) => {
      await queryClient.cancelQueries({ queryKey: ["order", orderId] });
      const previous = queryClient.getQueryData(["order", orderId]);

      queryClient.setQueryData(
        ["order", orderId],
        (old: typeof order | undefined) => {
          if (!old) return old;
          return {
            ...old,
            status: nextStatus,
            statusHistory: [
              ...old.statusHistory,
              {
                status: nextStatus,
                note: note?.trim() || undefined,
                timestamp: new Date().toISOString(),
              },
            ],
          };
        }
      );

      return { previous };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(["order", orderId], ctx.previous);
      }
      toast.error("Gagal mengubah status pesanan", err);
    },

    onSuccess: () => {
      toast.success("Status pesanan berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      reset();
      setConfirmOpen(false);
    },
  });

  const onStatusSubmit = handleSubmit((data) => {
    if (data.nextStatus === "CANCELLED") {
      setConfirmOpen(true);
    } else {
      executeUpdate(data);
    }
  });

  if (isLoading && !order) return <OrderDetailSkeleton />;
  if (!order) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title={order.orderId}
          subtitle={new Date(order.createdAt).toLocaleString("id-ID")}
        />
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
                  <p className="text-muted-foreground">
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
                <span className="capitalize text-muted-foreground">{k}:</span>{" "}
                {v}
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
            <ol className="relative border-l border-border ml-3 space-y-4">
              {order.statusHistory.map((e, i) => (
                <li key={i} className="ml-4">
                  <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-blue-500" />
                  <p className="text-sm font-medium">{e.status}</p>
                  {e.note && (
                    <p className="text-xs text-muted-foreground">{e.note}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
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
                <FieldGroup>
                  <Field data-invalid={!!errors.nextStatus}>
                    <FieldLabel htmlFor="order-next-status">
                      New Status
                    </FieldLabel>
                    <select
                      id="order-next-status"
                      aria-label="Select new order status"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      {...register("nextStatus")}
                    >
                      <option value="">Select new status...</option>
                      {ORDER_STATUSES.filter((s) => s !== order.status).map(
                        (s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        )
                      )}
                    </select>
                    {errors.nextStatus && (
                      <FieldError errors={[errors.nextStatus]} />
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="order-note">
                      Note (optional)
                    </FieldLabel>
                    <Textarea
                      id="order-note"
                      aria-label="Status update note"
                      rows={2}
                      placeholder="Optional note (e.g. tracking number)"
                      {...register("note")}
                    />
                  </Field>
                </FieldGroup>

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
                const { nextStatus, note } = watch();
                executeUpdate({ nextStatus, note });
              }}
            >
              Ya, Batalkan Pesanan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
