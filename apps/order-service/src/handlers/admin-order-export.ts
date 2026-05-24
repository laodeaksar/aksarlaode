import type { Context } from "elysia";

import { env } from "@repo/env/order";

import { exportOrders } from "@/repository/order.repository";
import type { OrderStatus } from "@/types";

// ── Config ────────────────────────────────────────────────────────────────────
// FIX ORD-05: Reduced from 50 000 to 10 000 to limit memory pressure and
// prevent admins from triggering multi-second DB scans accidentally.
// Large historical exports should be handled via a background job / SFTP.
const MAX_EXPORT_ROWS = 10_000;

const VALID_STATUSES = new Set<OrderStatus>([
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

// ── CSV helpers ───────────────────────────────────────────────────────────────
const HEADERS = [
  "orderId",
  "userId",
  "status",
  "grandTotal",
  "totalAmount",
  "shippingFee",
  "discountAmount",
  "itemCount",
  "createdAt",
  "paidAt",
  "shippedAt",
  "deliveredAt",
  "cancelledAt",
  "recipientName",
  "city",
  "province",
  "postalCode",
  "country",
  "notes",
];

/** RFC 4180 — wrap in double-quotes and escape internal quotes */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoOrEmpty(v: unknown): string {
  if (!v) return "";
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

function row(doc: Record<string, any>): string {
  return (
    [
      cell(doc.orderId),
      cell(doc.userId),
      cell(doc.status),
      cell(doc.grandTotal),
      cell(doc.totalAmount),
      cell(doc.shippingFee ?? 0),
      cell(doc.discountAmount ?? 0),
      cell((doc.items ?? []).length),
      isoOrEmpty(doc.createdAt),
      isoOrEmpty(doc.paidAt),
      isoOrEmpty(doc.shippedAt),
      isoOrEmpty(doc.deliveredAt),
      isoOrEmpty(doc.cancelledAt),
      cell(doc.shippingAddress?.recipientName),
      cell(doc.shippingAddress?.city),
      cell(doc.shippingAddress?.province),
      cell(doc.shippingAddress?.postalCode),
      cell(doc.shippingAddress?.country ?? "ID"),
      cell(doc.notes),
    ].join(",") + "\r\n"
  );
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const adminOrderExportHandler = async ({
  query,
  headers,
  set,
}: Context) => {
  // ── Authorization ─────────────────────────────────────────────────────────
  if (headers["x-user-role"] !== "ADMIN") {
    set.status = 403;
    return { error: "Forbidden — ADMIN role required", code: "FORBIDDEN" };
  }

  const q = query as {
    userId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    filename?: string;
  };

  // ── Parse & validate status filter ────────────────────────────────────────
  let statusFilter: OrderStatus[] | undefined;
  if (q.status) {
    const requested = q.status
      .split(",")
      .map((s) => s.trim().toUpperCase()) as OrderStatus[];
    const invalid = requested.filter((s) => !VALID_STATUSES.has(s));
    if (invalid.length > 0) {
      set.status = 422;
      return {
        error: `Invalid status values: ${invalid.join(", ")}`,
        code: "INVALID_STATUS",
      };
    }
    statusFilter = requested;
  }

  // ── Parse & validate date filters ─────────────────────────────────────────
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (q.dateFrom) {
    dateFrom = new Date(q.dateFrom);
    if (isNaN(dateFrom.getTime())) {
      set.status = 422;
      return {
        error: "Invalid dateFrom — must be ISO 8601",
        code: "INVALID_DATE",
      };
    }
  }
  if (q.dateTo) {
    dateTo = new Date(q.dateTo);
    if (isNaN(dateTo.getTime())) {
      set.status = 422;
      return {
        error: "Invalid dateTo — must be ISO 8601",
        code: "INVALID_DATE",
      };
    }
    dateTo.setHours(23, 59, 59, 999);
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    set.status = 422;
    return {
      error: "dateFrom must be before dateTo",
      code: "INVALID_DATE_RANGE",
    };
  }

  // ── Derive a sensible filename ─────────────────────────────────────────────
  const ts = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = q.filename
    ? q.filename.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 80)
    : `orders_export_${ts}`;

  // ── Stream CSV ────────────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Header row
        controller.enqueue(encoder.encode(HEADERS.join(",") + "\r\n"));

        const gen = exportOrders(
          {
            userId: q.userId || undefined,
            status: statusFilter,
            dateFrom,
            dateTo,
          },
          MAX_EXPORT_ROWS
        );

        for await (const doc of gen) {
          controller.enqueue(encoder.encode(row(doc as Record<string, any>)));
        }
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "order_export_stream_error",
            error: err instanceof Error ? err.message : String(err),
          })
        );
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "X-Export-Max-Rows": String(MAX_EXPORT_ROWS),
      "Cache-Control": "no-store",
    },
  });
};
