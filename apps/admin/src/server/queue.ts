import { createServerFn } from "@tanstack/react-start";

import { requirePermission } from "@/effect/AuthMiddleware";
import { effectMiddleware } from "@/effect/Middleware";
import type { QueueFailedJob, QueueStats } from "@/types";

// ── Internal helpers ────────────────────────────────────────────────────────
// Admin server functions call the email-worker's inspection HTTP server
// directly (not through the API gateway) using INTERNAL_SERVICE_TOKEN.
// The email-worker exposes these endpoints on EMAIL_WORKER_URL (port 9100).

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
  .handler(async (): Promise<QueueStats> =>
    workerFetch<QueueStats>("/queue/stats")
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
  .middleware([effectMiddleware, requirePermission("queue:manage")])
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
  .middleware([effectMiddleware, requirePermission("queue:manage")])
  .handler(
    async (): Promise<{ success: boolean; retriedCount: number }> =>
      workerFetch<{ success: boolean; retriedCount: number }>(
        "/queue/retry-all",
        { method: "POST" }
      )
  );
