import { Effect } from "effect";

import type { Context } from "elysia";

import { orderRepository } from "@/repository/order.repository";

// ── Terminal statuses — order will not move further ───────────────────────────
const TERMINAL_STATUSES = new Set(["DELIVERED", "CANCELLED", "REFUNDED"]);

// ── Human-readable duration ───────────────────────────────────────────────────
function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.floor(ms / 1_000)}s`;
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (ms < 86_400_000) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

// ── Enriched timeline event ───────────────────────────────────────────────────
type TimelineEvent = {
  index: number;
  status: string;
  note: string | null;
  changedBy: string;
  timestamp: string; // ISO 8601
  durationSince: number | null; // ms since previous event; null for first
  durationHuman: string | null; // human-readable version of durationSince
  isCurrentState: boolean;
};

export const adminOrderTimelineHandler = async ({
  params,
  headers,
  set,
}: Context) => {
  // ── Authorization ─────────────────────────────────────────────────────────
  if (headers["x-user-role"] !== "ADMIN") {
    set.status = 403;
    return { error: "Forbidden — ADMIN role required", code: "FORBIDDEN" };
  }

  const { orderId } = params as { orderId: string };

  const result = await Effect.runPromiseExit(
    orderRepository.findByOrderId(orderId)
  );

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string };
    if (err._tag === "OrderNotFoundError") {
      set.status = 404;
      return { error: "Order not found", code: "ORDER_NOT_FOUND" };
    }
    set.status = 500;
    return { error: "Failed to fetch order" };
  }

  const order = result.value;

  // ── Sort history by timestamp ascending (defensive — should already be ordered) ─
  const history = [...(order.statusHistory ?? [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // ── Build enriched timeline ───────────────────────────────────────────────
  const isTerminal = TERMINAL_STATUSES.has(order.status);
  const now = new Date();
  const timeline: TimelineEvent[] = [];

  for (let i = 0; i < history.length; i++) {
    const event = history[i]!;
    const eventTs = new Date(event.timestamp).getTime();
    const prevTs = i > 0 ? new Date(history[i - 1]!.timestamp).getTime() : null;
    const duration = prevTs !== null ? eventTs - prevTs : null;

    timeline.push({
      index: i,
      status: event.status,
      note: event.note ?? null,
      changedBy: event.changedBy ?? "system",
      timestamp: new Date(event.timestamp).toISOString(),
      durationSince: duration,
      durationHuman: duration !== null ? formatDuration(duration) : null,
      isCurrentState: i === history.length - 1 && isTerminal,
    });
  }

  // ── Append a live "still in progress" marker for non-terminal orders ──────
  if (!isTerminal && history.length > 0) {
    const lastTs = new Date(history[history.length - 1]!.timestamp).getTime();
    const elapsedMs = now.getTime() - lastTs;

    timeline.push({
      index: history.length,
      status: `${order.status} (ongoing)`,
      note: null,
      changedBy: "system",
      timestamp: now.toISOString(),
      durationSince: elapsedMs,
      durationHuman: formatDuration(elapsedMs),
      isCurrentState: true,
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const firstTs =
    history.length > 0 ? new Date(history[0]!.timestamp).getTime() : null;
  const lastTs =
    isTerminal && history.length > 0
      ? new Date(history[history.length - 1]!.timestamp).getTime()
      : now.getTime();
  const totalDurationMs = firstTs !== null ? lastTs - firstTs : 0;

  // order.createdAt is typed on OrderDocument (Mongoose timestamps: true)
  const createdAtRaw = order.createdAt;

  return {
    orderId: order.orderId,
    userId: order.userId,
    currentStatus: order.status,
    grandTotal: order.grandTotal,
    createdAt: createdAtRaw ? new Date(createdAtRaw).toISOString() : null,
    isTerminal,
    summary: {
      eventCount: history.length,
      totalDurationMs,
      totalDurationHuman:
        totalDurationMs > 0 ? formatDuration(totalDurationMs) : "0ms",
      openedAt: firstTs ? new Date(firstTs).toISOString() : null,
      closedAt:
        isTerminal && history.length > 0
          ? new Date(history[history.length - 1]!.timestamp).toISOString()
          : null,
    },
    timeline,
  };
};
