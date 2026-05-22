import { createServerFn } from "@tanstack/react-start";

import { Effect } from "effect";

import { auditMiddleware } from "@/effect/AuditMiddleware";
import { requirePermission } from "@/effect/AuthMiddleware";
import { effectMiddleware } from "@/effect/Middleware";
import { ApiClientService } from "@/effect/Services";
import type { AuditLogEntry, QueueFailedJob, QueueStats } from "@/types";

// ── Internal helpers ────────────────────────────────────────────────────────
// Admin server functions call the email-worker's inspection HTTP server
// directly (not through the API gateway) using INTERNAL_SERVICE_TOKEN.

function workerUrl(): string {
  return process.env["EMAIL_WORKER_URL"] ?? "http://localhost:9100";
}

function internalToken(): string {
  return process.env["INTERNAL_SERVICE_TOKEN"] ?? "";
}

async function workerFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${workerUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${internalToken()}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Email worker responded ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── GET /queue/stats ────────────────────────────────────────────────────────

export const getQueueStatsFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware, requirePermission("queue:read")])
  .handler(
    async (): Promise<QueueStats> => workerFetch<QueueStats>("/queue/stats")
  );

// ── GET /queue/jobs (failed) ────────────────────────────────────────────────

export const getFailedJobsFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware, requirePermission("queue:read")])
  .handler(
    async (): Promise<{ jobs: QueueFailedJob[] }> =>
      workerFetch<{ jobs: QueueFailedJob[] }>("/queue/jobs")
  );

// ── POST /queue/retry/:jobId ────────────────────────────────────────────────

export const retryJobFn = createServerFn({ method: "POST" })
  .middleware([
    effectMiddleware,
    requirePermission("queue:manage"),
    auditMiddleware,
  ])
  .inputValidator((raw: unknown) => {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as Record<string, unknown>)["jobId"] !== "string"
    ) {
      throw new Error("jobId is required and must be a string");
    }
    return { jobId: (raw as Record<string, string>)["jobId"] as string };
  })
  .handler(
    async ({
      data,
    }: {
      data: { jobId: string };
    }): Promise<{ success: boolean; jobId: string }> =>
      workerFetch<{ success: boolean; jobId: string }>(
        `/queue/retry/${encodeURIComponent(data.jobId)}`,
        { method: "POST" }
      )
  );

// ── POST /queue/retry-all ───────────────────────────────────────────────────

export const retryAllFn = createServerFn({ method: "POST" })
  .middleware([
    effectMiddleware,
    requirePermission("queue:manage"),
    auditMiddleware,
  ])
  .handler(
    async (): Promise<{ success: boolean; retriedCount: number }> =>
      workerFetch<{ success: boolean; retriedCount: number }>(
        "/queue/retry-all",
        { method: "POST" }
      )
  );

// ── POST /queue/resend ──────────────────────────────────────────────────────
// Fetches the order from the API gateway to validate it exists and resolve
// grandTotal/userId, then builds the appropriate payload and enqueues via
// the email-worker's /queue/enqueue endpoint.

export type ResendEmailType =
  | "order-created"
  | "order-confirmation"
  | "order-cancelled";

export type ResendEmailInput = {
  orderId: string;
  emailType: ResendEmailType;
  recipientEmail: string;
  reason?: string;
};

const RESEND_EMAIL_TYPES: readonly ResendEmailType[] = [
  "order-created",
  "order-confirmation",
  "order-cancelled",
];

export const resendEmailFn = createServerFn({ method: "POST" })
  .middleware([
    effectMiddleware,
    requirePermission("queue:manage"),
    auditMiddleware,
  ])
  .inputValidator((raw: unknown): ResendEmailInput => {
    if (typeof raw !== "object" || raw === null)
      throw new Error("Invalid input");
    const r = raw as Record<string, unknown>;
    if (typeof r["orderId"] !== "string" || !r["orderId"])
      throw new Error("orderId is required");
    if (!RESEND_EMAIL_TYPES.includes(r["emailType"] as ResendEmailType))
      throw new Error(
        "emailType must be one of: " + RESEND_EMAIL_TYPES.join(", ")
      );
    if (
      typeof r["recipientEmail"] !== "string" ||
      !r["recipientEmail"].includes("@")
    )
      throw new Error("A valid recipientEmail is required");
    const base = {
      orderId: r["orderId"] as string,
      emailType: r["emailType"] as ResendEmailType,
      recipientEmail: r["recipientEmail"] as string,
    };
    return typeof r["reason"] === "string"
      ? { ...base, reason: r["reason"] as string }
      : base;
  })
  .handler(
    async ({ data, context }): Promise<{ queued: boolean; jobId: string }> => {
      const order = await context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          return yield* api.orders.getOne(data.orderId);
        })
      );

      type EnqueueBody = {
        type: ResendEmailType;
        payload: Record<string, unknown>;
      };

      let body: EnqueueBody;

      switch (data.emailType) {
        case "order-created":
          body = {
            type: "order-created",
            payload: {
              orderId: order.orderId,
              userId: order.userId,
              userEmail: data.recipientEmail,
              grandTotal: order.grandTotal,
            },
          };
          break;
        case "order-confirmation":
          body = {
            type: "order-confirmation",
            payload: {
              orderId: order.orderId,
              userId: order.userId,
              userEmail: data.recipientEmail,
              amount: order.grandTotal,
            },
          };
          break;
        case "order-cancelled":
          body = {
            type: "order-cancelled",
            payload: {
              orderId: order.orderId,
              userEmail: data.recipientEmail,
              reason: data.reason ?? "Cancelled by admin",
            },
          };
          break;
      }

      return workerFetch<{ queued: boolean; jobId: string }>("/queue/enqueue", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
  );

// ── GET /queue/activity — recent queue audit log entries ───────────────────
// Runs three audit-log queries in parallel (one per queue action type) and
// merges them, returning the 10 most recent entries.

export const getQueueActivityFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware, requirePermission("queue:read")])
  .handler(async ({ context }): Promise<{ items: AuditLogEntry[] }> => {
    const items = await context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService;
        const [retried, retriedAll, resent] = yield* Effect.all([
          api.auditLogs.list({ page: 1, action: "queue_job_retried" }),
          api.auditLogs.list({ page: 1, action: "queue_jobs_retried" }),
          api.auditLogs.list({ page: 1, action: "queue_email_resent" }),
        ]);
        return [...retried.items, ...retriedAll.items, ...resent.items]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 10);
      })
    );
    return { items };
  });
