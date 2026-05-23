import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Form, reset, useField, useForm } from "@formisch/react";

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

import { ShoppingCartIcon } from "lucide-react";

import { getOrderFn, updateOrderStatusFn } from "@/server/orders";
import { StatusUpdateSchema, type StatusFormFields } from "@/schemas/forms";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceNotFound } from "@/components/shared";
import { can, toast, useSession } from "@/lib";

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
    <div className="max-w-4xl space-y-6">
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

  const form = useForm({
    schema: StatusUpdateSchema,
    initialInput: { nextStatus: "", note: "" },
  });

  const nextStatusField = useField(form, { path: ["nextStatus"] as const });
  const noteField = useField(form, { path: ["note"] as const });

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
      reset(form);
      setConfirmOpen(false);
    },
  });

  if (isLoading && !order) return <OrderDetailSkeleton />;
  if (!order)
    return (
      <ResourceNotFound
        icon={<ShoppingCartIcon />}
        title="Pesanan tidak ditemukan"
        description="Pesanan ini mungkin sudah dihapus atau ID tidak valid."
        backTo="/orders"
        backLabel="Lihat semua pesanan"
      />
    );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title={order.orderId}
          subtitle={new Date(order.createdAt).toLocaleString("id-ID")}
        />
        <Badge
          variant={STATUS_COLOR[order.status] ?? "outline"}
          className="px-3 py-1 text-sm"
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
            <div className="flex justify-between border-t pt-2 font-bold">
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
          <CardContent className="space-y-1 text-sm">
            {Object.entries(order.shippingAddress).map(([k, v]) => (
              <p key={k}>
                <span className="text-muted-foreground capitalize">{k}:</span>{" "}
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
            <ol className="border-border relative ml-3 space-y-4 border-l">
              {order.statusHistory.map((e, i) => (
                <li key={i} className="ml-4">
                  <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-blue-500" />
                  <p className="text-sm font-medium">{e.status}</p>
                  {e.note && (
                    <p className="text-muted-foreground text-xs">{e.note}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
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
              <Form
                of={form}
                onSubmit={(data) => {
                  if (data.nextStatus === "CANCELLED") {
                    setConfirmOpen(true);
                  } else {
                    executeUpdate(data);
                  }
                }}
                className="space-y-3"
              >
                <FieldGroup>
                  <Field data-invalid={!!nextStatusField.errors}>
                    <FieldLabel htmlFor="order-next-status">
                      New Status
                    </FieldLabel>
                    <select
                      {...nextStatusField.props}
                      id="order-next-status"
                      aria-label="Select new order status"
                      className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-xs focus:ring-2 focus:outline-none"
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
                    {nextStatusField.errors && (
                      <FieldError
                        errors={nextStatusField.errors.map((m) => ({
                          message: m,
                        }))}
                      />
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="order-note">
                      Note (optional)
                    </FieldLabel>
                    <Textarea
                      {...noteField.props}
                      id="order-note"
                      aria-label="Status update note"
                      rows={2}
                      placeholder="Optional note (e.g. tracking number)"
                    />
                  </Field>
                </FieldGroup>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!nextStatusField.input || isPending}
                >
                  {isPending ? "Updating..." : "Update Status"}
                </Button>
              </Form>
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
                const nextStatus = nextStatusField.input ?? "";
                const note = noteField.input ?? "";
                if (nextStatus) {
                  executeUpdate({ nextStatus, note });
                }
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
