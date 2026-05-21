import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";

import { exportOrdersFn } from "@/server/orders";
import { can, toast, useSession } from "@/lib";

import { ORDER_STATUSES } from "./order-columns";

export function ExportOrdersButton() {
  const { session } = useSession();
  const role = session?.role ?? "CUSTOMER";

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isPending, setIsPending] = useState(false);

  if (!can(role, "orders:write")) return null;

  const handleExport = async () => {
    setIsPending(true);
    try {
      const csv = await exportOrdersFn({
        data: {
          ...(status ? { status } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        },
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success("Export berhasil diunduh");
      setOpen(false);
      setStatus("");
      setDateFrom("");
      setDateTo("");
    } catch (err) {
      toast.error("Gagal mengekspor data pesanan", err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Export CSV</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Pesanan ke CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="export-status">Status</FieldLabel>
              <select
                id="export-status"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Semua status</option>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="export-date-from">Dari tanggal</FieldLabel>
              <input
                id="export-date-from"
                type="date"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="export-date-to">Sampai tanggal</FieldLabel>
              <input
                id="export-date-to"
                type="date"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </Field>
          </FieldGroup>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button onClick={handleExport} disabled={isPending}>
              {isPending ? "Mengunduh..." : "Download CSV"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
