// Queue inspection utilities — used by the HTTP inspection endpoints in index.ts.
// Uses a dedicated Queue instance (not the producer/worker instance) so it can
// be closed independently during shutdown without interrupting in-flight jobs.

import { Queue } from "bullmq";

import { env } from "@repo/env/email-worker";
import { parseRedisUrl } from "@repo/env/utils";

// ── Shared types ─────────────────────────────────────────────────────────────

export type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

// PII-safe summaries — no email addresses, tokens, or personal data.

export type FailedJobSummary = {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  finishedOn: number | null;
  orderId: string | null;
};

export type ActiveJobSummary = {
  id: string;
  name: string;
  attemptsMade: number;
  /** Unix ms — when the job was enqueued. */
  timestamp: number;
  /** Unix ms — when the worker picked it up (null if still waiting in active state). */
  processedOn: number | null;
  orderId: string | null;
};

export type CompletedJobSummary = {
  id: string;
  name: string;
  /** Unix ms — when the job was enqueued. */
  timestamp: number;
  /** Unix ms — when the worker started processing. */
  processedOn: number | null;
  /** Unix ms — when the job finished. */
  finishedOn: number | null;
  /** Processing duration in milliseconds. */
  durationMs: number | null;
  orderId: string | null;
};

// ── Inspector queue instance ─────────────────────────────────────────────────

const inspectorQueue = new Queue("email", {
  connection: parseRedisUrl(env.REDIS_URL),
});

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getQueueStats(): Promise<QueueStats> {
  const counts = await inspectorQueue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused"
  );
  return {
    waiting: counts["waiting"] ?? 0,
    active: counts["active"] ?? 0,
    completed: counts["completed"] ?? 0,
    failed: counts["failed"] ?? 0,
    delayed: counts["delayed"] ?? 0,
    paused: counts["paused"] ?? 0,
  };
}

// ── Failed jobs ───────────────────────────────────────────────────────────────

export async function getFailedJobs(limit = 50): Promise<FailedJobSummary[]> {
  const jobs = await inspectorQueue.getFailed(0, limit - 1);
  return jobs.map((job) => {
    const raw = job.data as Record<string, unknown>;
    return {
      id: job.id ?? "unknown",
      name: job.name,
      failedReason: job.failedReason ?? "Unknown error",
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      finishedOn: typeof job.finishedOn === "number" ? job.finishedOn : null,
      orderId: typeof raw["orderId"] === "string" ? raw["orderId"] : null,
    };
  });
}

// ── Active jobs ───────────────────────────────────────────────────────────────

export async function getActiveJobs(limit = 20): Promise<ActiveJobSummary[]> {
  const jobs = await inspectorQueue.getActive(0, limit - 1);
  return jobs.map((job) => {
    const raw = job.data as Record<string, unknown>;
    return {
      id: job.id ?? "unknown",
      name: job.name,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: typeof job.processedOn === "number" ? job.processedOn : null,
      orderId: typeof raw["orderId"] === "string" ? raw["orderId"] : null,
    };
  });
}

// ── Recently completed jobs ───────────────────────────────────────────────────
// BullMQ retains up to `removeOnComplete.count` (100) completed jobs in Redis.

export async function getRecentlyCompletedJobs(
  limit = 20
): Promise<CompletedJobSummary[]> {
  const jobs = await inspectorQueue.getCompleted(0, limit - 1);
  return jobs.map((job) => {
    const raw = job.data as Record<string, unknown>;
    const processedOn =
      typeof job.processedOn === "number" ? job.processedOn : null;
    const finishedOn =
      typeof job.finishedOn === "number" ? job.finishedOn : null;
    return {
      id: job.id ?? "unknown",
      name: job.name,
      timestamp: job.timestamp,
      processedOn,
      finishedOn,
      durationMs:
        processedOn !== null && finishedOn !== null
          ? finishedOn - processedOn
          : null,
      orderId: typeof raw["orderId"] === "string" ? raw["orderId"] : null,
    };
  });
}

// ── Per-type failure stats ────────────────────────────────────────────────────
// Aggregates ALL retained failed + completed jobs by job name.
// BullMQ keeps up to removeOnComplete.count (100) and removeOnFail.count (500)
// entries in Redis, so the numbers reflect the recent window, not lifetime.

export type JobTypeStats = {
  /** BullMQ job name / email type (e.g. "order-created"). */
  name: string;
  completed: number;
  failed: number;
  /** Integer 0-100 — percentage of (failed / total) rounded to nearest int. */
  failureRate: number;
};

export async function getJobTypeStats(): Promise<JobTypeStats[]> {
  const [failedJobs, completedJobs] = await Promise.all([
    inspectorQueue.getFailed(0, -1),
    inspectorQueue.getCompleted(0, -1),
  ]);

  const counts: Record<string, { completed: number; failed: number }> = {};

  for (const job of completedJobs) {
    if (!counts[job.name]) counts[job.name] = { completed: 0, failed: 0 };
    counts[job.name]!.completed += 1;
  }
  for (const job of failedJobs) {
    if (!counts[job.name]) counts[job.name] = { completed: 0, failed: 0 };
    counts[job.name]!.failed += 1;
  }

  return Object.entries(counts)
    .map(([name, { completed, failed }]) => ({
      name,
      completed,
      failed,
      failureRate:
        completed + failed > 0
          ? Math.round((failed / (completed + failed)) * 100)
          : 0,
    }))
    .sort((a, b) => b.failureRate - a.failureRate);
}

// ── Retry helpers ─────────────────────────────────────────────────────────────

export async function retryJob(jobId: string): Promise<boolean> {
  const job = await inspectorQueue.getJob(jobId);
  if (!job) return false;
  await job.retry();
  return true;
}

export async function retryAllFailed(): Promise<number> {
  const jobs = await inspectorQueue.getFailed(0, -1);
  const results = await Promise.allSettled(jobs.map((j) => j.retry()));
  return results.filter((r) => r.status === "fulfilled").length;
}

// ── Shutdown ──────────────────────────────────────────────────────────────────

export async function closeInspector(): Promise<void> {
  await inspectorQueue.close();
}
