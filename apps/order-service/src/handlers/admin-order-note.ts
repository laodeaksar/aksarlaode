import { orderRepository } from "@/repository/order.repository"
import { Effect } from "effect"
import type { Context } from "elysia"

type NoteBody = {
  note: string
}

export const adminOrderNoteHandler = async ({
  params,
  body,
  headers,
  set,
}: Context) => {
  // ── Authorization ─────────────────────────────────────────────────────────
  if (headers["x-user-role"] !== "ADMIN") {
    set.status = 403
    return { error: "Forbidden — ADMIN role required", code: "FORBIDDEN" }
  }

  const { orderId } = params as { orderId: string }
  const { note } = body as NoteBody
  const adminId =
    (headers["x-user-id"] as string | undefined) ?? "admin:unknown"

  // ── Validate note content ─────────────────────────────────────────────────
  const trimmed = note.trim()
  if (trimmed.length === 0) {
    set.status = 422
    return { error: "Note must not be empty", code: "EMPTY_NOTE" }
  }
  if (trimmed.length > 1000) {
    set.status = 422
    return {
      error: "Note must not exceed 1000 characters",
      code: "NOTE_TOO_LONG",
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const result = await Effect.runPromiseExit(
    orderRepository.addNote(orderId, trimmed, adminId)
  )

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") {
      set.status = 404
      return { error: "Order not found", code: "ORDER_NOT_FOUND" }
    }
    set.status = 500
    return { error: "Failed to add note" }
  }

  const order = result.value

  // ── Return the appended note entry so the caller can display it immediately
  const history = order.statusHistory ?? []
  const addedEntry = history[history.length - 1] // guaranteed to be the one we just pushed

  set.status = 201
  return {
    orderId,
    entry: {
      status: addedEntry?.status ?? "__NOTE__",
      note: addedEntry?.note ?? trimmed,
      changedBy: addedEntry?.changedBy ?? adminId,
      timestamp: addedEntry
        ? new Date(addedEntry.timestamp).toISOString()
        : new Date().toISOString(),
    },
  }
}
