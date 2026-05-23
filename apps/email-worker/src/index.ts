import * as v from "valibot";

import { env } from "@repo/env/email-worker";

import { EnqueueSchema } from "./lib/enqueue-schema";
import { renderMetrics } from "./lib/metrics";
import {
  closeInspector,
  getActiveJobs,
  getFailedJobs,
  getQueueStats,
  getRecentlyCompletedJobs,
  retryAllFailed,
  retryJob,
} from "./lib/queue-inspector";
import { emailWorker } from "./processor/email.processor";
import { emailQueue } from "./queues/email.queue";
import type { EmailJobPayload, EmailJobType } from "./queues/email.queue";

console.info(
  JSON.stringify({ event: "worker_started", service: "email-worker" })
);

process.on("unhandledRejection", (reason: unknown) => {
  console.error(
    JSON.stringify({
      event: "unhandled_rejection",
      severity: "CRITICAL",
      error: reason instanceof Error ? reason.message : String(reason),
      service: "email-worker",
    })
  );
});

process.on("uncaughtException", (err: Error) => {
  console.error(
    JSON.stringify({
      event: "uncaught_exception",
      severity: "CRITICAL",
      error: err.message,
      stack: err.stack,
      service: "email-worker",
    })
  );
  process.exit(1);
});

// ── Auth helper ─────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && token === env.INTERNAL_SERVICE_TOKEN;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── HTTP server ─────────────────────────────────────────────────────────────

const METRICS_PORT = Number(process.env["METRICS_PORT"] ?? 9100);

Bun.serve({
  port: METRICS_PORT,
  async fetch(req: Request) {
    const { pathname } = new URL(req.url);
    const method = req.method;

    // ── Public endpoints ──────────────────────────────────────────────────

    if (method === "GET" && pathname === "/health") {
      return json({ status: "ok", service: "email-worker" });
    }

    if (method === "GET" && pathname === "/metrics") {
      return new Response(renderMetrics(), {
        headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
      });
    }

    // ── Protected endpoints — require INTERNAL_SERVICE_TOKEN ──────────────

    if (!isAuthorized(req)) return unauthorized();

    if (method === "GET" && pathname === "/queue/stats") {
      const stats = await getQueueStats();
      return json(stats);
    }

    if (method === "GET" && pathname === "/queue/jobs") {
      const jobs = await getFailedJobs(50);
      return json({ jobs });
    }

    // GET /queue/jobs/live — active + recently completed jobs in one call.
    // Returns up to 20 active and 20 completed jobs, all PII-stripped.
    if (method === "GET" && pathname === "/queue/jobs/live") {
      const [active, completed] = await Promise.all([
        getActiveJobs(20),
        getRecentlyCompletedJobs(20),
      ]);
      return json({ active, completed });
    }

    // POST /queue/retry/:jobId — retry a single failed job
    const retryMatch = pathname.match(/^\/queue\/retry\/([^/]+)$/);
    if (method === "POST" && retryMatch) {
      const jobId = decodeURIComponent(retryMatch[1] ?? "");
      if (!jobId) return json({ error: "Missing jobId" }, 400);
      const ok = await retryJob(jobId);
      return json({ success: ok, jobId });
    }

    // POST /queue/retry-all — retry every failed job
    if (method === "POST" && pathname === "/queue/retry-all") {
      const count = await retryAllFailed();
      return json({ success: true, retriedCount: count });
    }

    // POST /queue/enqueue — manually trigger an email job from the admin panel.
    // Only order-created, order-confirmation, and order-cancelled are supported.
    // Uses a unique resend jobId (prefixed with "resend:") so the job always
    // gets enqueued even if the original idempotency key was already consumed.
    if (method === "POST" && pathname === "/queue/enqueue") {
      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const parsed = v.safeParse(EnqueueSchema, body);
      if (!parsed.success) {
        return json(
          { error: "Invalid payload", issues: parsed.issues },
          400
        );
      }

      const { type, payload } = parsed.output;

      // Unique jobId with "resend:" prefix ensures manual re-sends bypass the
      // normal idempotency key and always reach the queue.
      const raw = payload as Record<string, unknown>;
      const orderId = typeof raw["orderId"] === "string" ? raw["orderId"] : "";
      const jobId = `resend:${type}:${orderId}:${Date.now()}`;

      const job = await emailQueue.add(
        type as EmailJobType,
        payload as EmailJobPayload[EmailJobType],
        { jobId }
      );

      console.info(
        JSON.stringify({
          event: "manual_resend_enqueued",
          jobType: type,
          orderId,
          jobId: job.id,
        })
      );

      return json({ queued: true, jobId: job.id });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.info(
  JSON.stringify({
    event: "metrics_server_started",
    service: "email-worker",
    port: METRICS_PORT,
  })
);

// ── Graceful shutdown ────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.info(
    JSON.stringify({ event: "shutdown", signal, service: "email-worker" })
  );
  await emailWorker.close();
  await emailQueue.close();
  await closeInspector();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
